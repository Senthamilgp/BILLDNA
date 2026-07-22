// ============================================================
// BillDNA cloud sync — auth + offline-first sync layer
// Wraps window.storage so the app keeps working offline; when
// logged in + online, local data mirrors to Supabase (per-user,
// RLS-isolated). Same account on mobile + PC = same data.
// ============================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vakbwubhdsvefulguklb.supabase.co";
const SUPABASE_KEY = "sb_publishable_JG5-iUFv4FUtd8Cdr-uv3A_ElllF78i";

// Only create a real client in a genuine browser. In test/SSR (jsdom) we
// expose a harmless stub so importing the app never opens sockets or hangs.
const isRealBrowser = typeof window !== "undefined"
  && typeof WebSocket !== "undefined"
  && !("__BILLDNA_TEST__" in globalThis);

function makeStub() {
  const noAuth = { getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    signUp: async () => ({ error: { message: "offline" } }),
    signInWithPassword: async () => ({ error: { message: "offline" } }),
    signOut: async () => ({}) };
  const q = { insert: async()=>({}), select(){return this;}, eq(){return this;},
    order(){return this;}, limit: async()=>({data:[]}), single: async()=>({data:null}),
    upsert: async()=>({}) };
  return { auth: noAuth, from: () => q, channel: () => ({ on(){return this;}, subscribe(){return this;} }), removeChannel(){} };
}

export const supa = isRealBrowser ? createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
}) : makeStub();

// ---- lead capture (landing page, before signup) ----
export async function captureLead(mobile, email) {
  try {
    await supa.from("leads").insert({ mobile: mobile || null, email: email || null });
    return true;
  } catch { return false; }
}

// ---- auth ----
export async function signUp(email, password) {
  return supa.auth.signUp({ email, password });
}
export async function signIn(email, password) {
  return supa.auth.signInWithPassword({ email, password });
}
export async function signOut() { return supa.auth.signOut(); }
export async function currentUser() {
  const { data } = await supa.auth.getUser();
  return data?.user || null;
}
export function onAuth(cb) {
  return supa.auth.onAuthStateChange((_e, session) => cb(session?.user || null));
}

// ---- sync: local ERP state <-> cloud ----
// Local state shape (billdna_erp_v2) is a single JSON blob. For robust
// multi-device sync we mirror it as ONE cloud record per company kind
// "company_state" keyed by company id, plus companies list. This keeps
// the client simple and matches how the app already stores everything.

const LKEY = "billdna_erp_v2";

async function readLocal() {
  try { const r = await window.storage.get(LKEY); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function writeLocal(obj) {
  try { await window.storage.set(LKEY, JSON.stringify(obj)); } catch {}
}

// Pull cloud → local (on login / app open). Last-write-wins by updated_at.
export async function pullFromCloud(user) {
  if (!user) return null;
  const { data: comps } = await supa.from("companies").select("*").eq("owner_id", user.id);
  const { data: recs } = await supa.from("records").select("*")
    .eq("owner_id", user.id).eq("kind", "app_state").order("updated_at", { ascending: false }).limit(1);
  if (recs && recs.length) {
    const cloudState = recs[0].data;
    const local = await readLocal();
    // choose newer by embedded _syncedAt
    const cloudAt = new Date(recs[0].updated_at).getTime();
    const localAt = local?._syncedAt || 0;
    if (!local || cloudAt >= localAt) {
      cloudState._syncedAt = cloudAt;
      await writeLocal(cloudState);
      return cloudState;
    }
  }
  return null;
}

// Push local → cloud (debounced by caller). Upserts one app_state record.
let pushTimer = null;
export function schedulePush(user, delay = 2500) {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushToCloud(user), delay);
}

export async function pushToCloud(user) {
  if (!user || !navigator.onLine) return { ok: false, reason: "offline" };
  const local = await readLocal();
  if (!local) return { ok: false, reason: "no-data" };
  try {
    // ensure a company row exists so the FK + dashboards work; use first company
    const first = (local.companies || [])[0];
    let companyId = null;
    if (first) {
      const { data: existing } = await supa.from("companies").select("id").eq("owner_id", user.id).limit(1);
      if (existing && existing.length) companyId = existing[0].id;
      else {
        const { data: ins } = await supa.from("companies").insert({
          owner_id: user.id, name: first.name, gstin: first.gstin || null,
          email: first.email || null, phone: first.phone || null,
          address: first.address || null, city: first.city || null, state: first.state || null,
          scheme: first.scheme || "regular", comp_rate: first.compRate || 1,
        }).select("id").single();
        companyId = ins?.id || null;
      }
    }
    if (!companyId) return { ok: false, reason: "no-company" };
    // upsert single app_state record (local_id fixed = 'state')
    const now = Date.now();
    local._syncedAt = now;
    await writeLocal(local);
    await supa.from("records").upsert({
      owner_id: user.id, company_id: companyId, kind: "app_state",
      local_id: "state", data: local, deleted: false,
    }, { onConflict: "company_id,kind,local_id" });
    return { ok: true, at: now };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Realtime: when another device pushes, refresh here.
export function subscribeRealtime(user, onChange) {
  if (!user) return () => {};
  const ch = supa.channel("app_state_" + user.id)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "records", filter: `owner_id=eq.${user.id}` },
      () => onChange())
    .subscribe();
  return () => supa.removeChannel(ch);
}
