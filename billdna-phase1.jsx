import React, { useState, useEffect, useCallback } from "react";

/* ============================================================
   BillDNA ERP — Phase 1: Core
   Modules: Auth, Company Setup, Multi-Company, Multi-Branch,
   Roles & Permissions, Dashboard, Notifications, Activity Logs,
   Backup & Restore
   Storage: window.storage (persists across sessions)
   ============================================================ */

const T = {
  bg: "#0E1420", panel: "#161E2E", panel2: "#1C2638", line: "#26324A",
  text: "#E8EDF6", dim: "#8A97AD", acc: "#2FB7A4", acc2: "#F5B841",
  danger: "#E5604C", ok: "#4CC97A",
};

const PERMS = ["billing","purchase","inventory","accounting","reports","masters","settings","users"];
const ROLE_PRESETS = {
  Owner:   PERMS,
  Manager: ["billing","purchase","inventory","reports","masters"],
  Cashier: ["billing"],
  Accountant: ["accounting","reports"],
};

const seed = () => ({
  users: [{ id: "u1", name: "Admin", email: "admin@billdna.in", pin: "1234", role: "Owner", active: true }],
  companies: [],
  activeCompanyId: null,
  activeBranchId: null,
  notifications: [{ id: "n1", msg: "Welcome to BillDNA ERP. Setup your first company.", ts: Date.now(), read: false }],
  logs: [{ id: "l1", ts: Date.now(), user: "System", action: "System initialized" }],
});

const KEY = "billdna_core_v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtTs = (t) => new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function BillDNA() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null); // logged-in user
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);

  // ---- load ----
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY);
        setDb(r ? JSON.parse(r.value) : seed());
      } catch { setDb(seed()); }
    })();
  }, []);

  // ---- save ----
  const save = useCallback(async (next) => {
    setDb(next);
    try { await window.storage.set(KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
  }, []);

  const log = (d, action) => {
    d.logs = [{ id: uid(), ts: Date.now(), user: session?.name || "System", action }, ...d.logs].slice(0, 200);
  };
  const notify = (d, msg) => {
    d.notifications = [{ id: uid(), msg, ts: Date.now(), read: false }, ...d.notifications].slice(0, 100);
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  if (!db) return <div style={{ background: T.bg, minHeight: "100vh", color: T.dim, display: "grid", placeItems: "center", fontFamily: "system-ui" }}>Loading BillDNA…</div>;

  if (!session) return <Login db={db} onLogin={(u) => {
    const d = structuredClone(db); log(d, `${u.name} logged in`); save(d); setSession(u);
  }} />;

  const company = db.companies.find(c => c.id === db.activeCompanyId);
  const branch = company?.branches.find(b => b.id === db.activeBranchId);
  const unread = db.notifications.filter(n => !n.read).length;
  const can = (p) => session.role === "Owner" || (ROLE_PRESETS[session.role] || []).includes(p);

  const NAV = [
    ["dashboard", "Dashboard", true],
    ["companies", "Companies & Branches", can("settings")],
    ["users", "Users & Roles", can("users")],
    ["notifications", `Alerts${unread ? ` (${unread})` : ""}`, true],
    ["logs", "Activity Log", can("settings")],
    ["backup", "Backup & Restore", can("settings")],
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${T.line}`, background: T.panel }}>
        <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 18 }}>Bill<span style={{ color: T.acc }}>DNA</span></div>
        <div style={{ fontSize: 12, color: T.dim, flex: 1 }}>
          {company ? `${company.name}${branch ? ` · ${branch.name}` : ""}` : "No company selected"}
        </div>
        <div style={{ fontSize: 12, color: T.dim }}>{session.name} · {session.role}</div>
        <button onClick={() => setSession(null)} style={btn(T.panel2)}>Logout</button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 190, borderRight: `1px solid ${T.line}`, padding: 10, display: "flex", flexDirection: "column", gap: 4, background: T.panel }}>
          {NAV.filter(n => n[2]).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ ...btn(view === k ? T.acc : "transparent"), color: view === k ? "#08221E" : T.text, textAlign: "left", fontWeight: view === k ? 700 : 400 }}>
              {label}
            </button>
          ))}
          <div style={{ marginTop: "auto", fontSize: 10, color: T.dim, padding: 6 }}>Phase 1 · Core v1.0</div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {view === "dashboard" && <Dashboard db={db} company={company} branch={branch} />}
          {view === "companies" && <Companies db={db} save={save} log={log} notify={notify} flash={flash} />}
          {view === "users" && <Users db={db} save={save} log={log} flash={flash} session={session} />}
          {view === "notifications" && <Notifications db={db} save={save} />}
          {view === "logs" && <Logs db={db} />}
          {view === "backup" && <Backup db={db} save={save} log={log} flash={flash} />}
        </div>
      </div>

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: T.acc, color: "#08221E", padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{toast}</div>}
    </div>
  );
}

/* ---------- Login ---------- */
function Login({ db, onLogin }) {
  const [email, setEmail] = useState("admin@billdna.in");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const go = () => {
    const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.pin === pin && x.active);
    if (u) onLogin(u); else setErr("Email or PIN incorrect. Default: admin@billdna.in / 1234");
  };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 28, width: 320 }}>
        <div style={{ fontWeight: 800, fontSize: 26, color: T.text, marginBottom: 4 }}>Bill<span style={{ color: T.acc }}>DNA</span></div>
        <div style={{ color: T.dim, fontSize: 12, marginBottom: 18 }}>SME ERP · Sign in to continue</div>
        <input style={inp()} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inp()} placeholder="PIN" type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
        {err && <div style={{ color: T.danger, fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button onClick={go} style={{ ...btn(T.acc), width: "100%", color: "#08221E", fontWeight: 800, padding: 10 }}>Sign in</button>
        <div style={{ color: T.dim, fontSize: 11, marginTop: 12 }}>Default: admin@billdna.in · PIN 1234</div>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ db, company, branch }) {
  const stats = [
    ["Companies", db.companies.length],
    ["Branches", db.companies.reduce((a, c) => a + c.branches.length, 0)],
    ["Users", db.users.filter(u => u.active).length],
    ["Alerts", db.notifications.filter(n => !n.read).length],
  ];
  return (
    <div>
      <H1>Dashboard</H1>
      {!company && <Card><div style={{ color: T.acc2 }}>⚠ Setup pending — go to Companies & Branches and create your first company.</div></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "14px 0" }}>
        {stats.map(([l, v]) => (
          <Card key={l}><div style={{ fontSize: 28, fontWeight: 800, color: T.acc }}>{v}</div><div style={{ color: T.dim, fontSize: 12 }}>{l}</div></Card>
        ))}
      </div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Active context</div>
        <div style={{ fontSize: 13, color: T.dim }}>
          Company: <b style={{ color: T.text }}>{company?.name || "—"}</b><br />
          Branch: <b style={{ color: T.text }}>{branch?.name || "—"}</b><br />
          GSTIN: <b style={{ color: T.text }}>{company?.gstin || "—"}</b>
        </div>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent activity</div>
        {db.logs.slice(0, 6).map(l => (
          <div key={l.id} style={{ fontSize: 12, color: T.dim, padding: "4px 0", borderBottom: `1px solid ${T.line}` }}>
            <span style={{ color: T.acc }}>{fmtTs(l.ts)}</span> · {l.user} — {l.action}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ---------- Companies & Branches ---------- */
function Companies({ db, save, log, notify, flash }) {
  const [name, setName] = useState(""); const [gstin, setGstin] = useState(""); const [city, setCity] = useState("");
  const [bName, setBName] = useState(""); const [bCity, setBCity] = useState("");
  const [sel, setSel] = useState(db.activeCompanyId);

  const addCompany = () => {
    if (!name.trim()) return flash("Company name required");
    const d = structuredClone(db);
    const c = { id: uid(), name: name.trim(), gstin: gstin.trim().toUpperCase(), city: city.trim(), branches: [{ id: uid(), name: "Main Branch", city: city.trim() }] };
    d.companies.push(c);
    if (!d.activeCompanyId) { d.activeCompanyId = c.id; d.activeBranchId = c.branches[0].id; }
    log(d, `Company created: ${c.name}`); notify(d, `Company "${c.name}" created with Main Branch`);
    save(d); setName(""); setGstin(""); setCity(""); setSel(c.id); flash("Company created");
  };

  const addBranch = () => {
    if (!sel || !bName.trim()) return flash("Select company & branch name");
    const d = structuredClone(db);
    const c = d.companies.find(x => x.id === sel);
    c.branches.push({ id: uid(), name: bName.trim(), city: bCity.trim() });
    log(d, `Branch added: ${bName} → ${c.name}`);
    save(d); setBName(""); setBCity(""); flash("Branch added");
  };

  const activate = (cId, bId) => {
    const d = structuredClone(db);
    d.activeCompanyId = cId; d.activeBranchId = bId;
    const c = d.companies.find(x => x.id === cId);
    log(d, `Switched to ${c.name} / ${c.branches.find(b => b.id === bId).name}`);
    save(d); flash("Context switched");
  };

  return (
    <div>
      <H1>Companies & Branches</H1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>New company</div>
          <input style={inp()} placeholder="Company name *" value={name} onChange={e => setName(e.target.value)} />
          <input style={inp()} placeholder="GSTIN (optional)" value={gstin} onChange={e => setGstin(e.target.value)} />
          <input style={inp()} placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
          <button onClick={addCompany} style={{ ...btn(T.acc), color: "#08221E", fontWeight: 700 }}>Create company</button>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>New branch</div>
          <select style={inp()} value={sel || ""} onChange={e => setSel(e.target.value)}>
            <option value="">Select company</option>
            {db.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input style={inp()} placeholder="Branch name *" value={bName} onChange={e => setBName(e.target.value)} />
          <input style={inp()} placeholder="City" value={bCity} onChange={e => setBCity(e.target.value)} />
          <button onClick={addBranch} style={{ ...btn(T.acc), color: "#08221E", fontWeight: 700 }}>Add branch</button>
        </Card>
      </div>
      {db.companies.map(c => (
        <Card key={c.id}>
          <div style={{ fontWeight: 700 }}>{c.name} {c.gstin && <span style={{ color: T.dim, fontSize: 12 }}>· {c.gstin}</span>}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {c.branches.map(b => {
              const active = db.activeCompanyId === c.id && db.activeBranchId === b.id;
              return (
                <button key={b.id} onClick={() => activate(c.id, b.id)}
                  style={{ ...btn(active ? T.acc : T.panel2), color: active ? "#08221E" : T.text, fontWeight: active ? 700 : 400 }}>
                  {b.name}{b.city ? ` (${b.city})` : ""}{active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Users & Roles ---------- */
function Users({ db, save, log, flash, session }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [pin, setPin] = useState(""); const [role, setRole] = useState("Cashier");

  const add = () => {
    if (!name.trim() || !email.trim() || pin.length < 4) return flash("Name, email & 4-digit PIN required");
    if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) return flash("Email already exists");
    const d = structuredClone(db);
    d.users.push({ id: uid(), name: name.trim(), email: email.trim(), pin, role, active: true });
    log(d, `User added: ${name} (${role})`);
    save(d); setName(""); setEmail(""); setPin(""); flash("User added");
  };
  const toggle = (id) => {
    const d = structuredClone(db);
    const u = d.users.find(x => x.id === id);
    if (u.id === session.id) return flash("Cannot deactivate yourself");
    u.active = !u.active;
    log(d, `User ${u.active ? "activated" : "deactivated"}: ${u.name}`);
    save(d);
  };

  return (
    <div>
      <H1>Users & Roles</H1>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Add user</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          <input style={inp(0)} placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
          <input style={inp(0)} placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inp(0)} placeholder="PIN (4+) *" value={pin} onChange={e => setPin(e.target.value)} />
          <select style={inp(0)} value={role} onChange={e => setRole(e.target.value)}>
            {Object.keys(ROLE_PRESETS).map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={add} style={{ ...btn(T.acc), color: "#08221E", fontWeight: 700, marginTop: 10 }}>Add user</button>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Role permissions</div>
        {Object.entries(ROLE_PRESETS).map(([r, ps]) => (
          <div key={r} style={{ fontSize: 12, color: T.dim, padding: "3px 0" }}>
            <b style={{ color: T.acc2 }}>{r}</b>: {ps.join(", ")}
          </div>
        ))}
      </Card>
      {db.users.map(u => (
        <Card key={u.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <b>{u.name}</b> <span style={{ color: T.dim, fontSize: 12 }}>· {u.email} · {u.role}</span>
            </div>
            <span style={{ fontSize: 11, color: u.active ? T.ok : T.danger }}>{u.active ? "Active" : "Inactive"}</span>
            {u.id !== session.id && <button onClick={() => toggle(u.id)} style={btn(T.panel2)}>{u.active ? "Deactivate" : "Activate"}</button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Notifications ---------- */
function Notifications({ db, save }) {
  const markAll = () => {
    const d = structuredClone(db);
    d.notifications.forEach(n => n.read = true);
    save(d);
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <H1>Notifications</H1>
        <button onClick={markAll} style={{ ...btn(T.panel2), marginLeft: "auto" }}>Mark all read</button>
      </div>
      {db.notifications.map(n => (
        <Card key={n.id}>
          <div style={{ fontSize: 13, color: n.read ? T.dim : T.text }}>{!n.read && <span style={{ color: T.acc }}>● </span>}{n.msg}</div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>{fmtTs(n.ts)}</div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Activity Logs ---------- */
function Logs({ db }) {
  return (
    <div>
      <H1>Activity Log</H1>
      <Card>
        {db.logs.map(l => (
          <div key={l.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
            <span style={{ color: T.acc }}>{fmtTs(l.ts)}</span> · <b>{l.user}</b> — <span style={{ color: T.dim }}>{l.action}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ---------- Backup & Restore ---------- */
function Backup({ db, save, log, flash }) {
  const [restoreTxt, setRestoreTxt] = useState("");
  const download = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `billdna-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    const d = structuredClone(db); log(d, "Backup downloaded"); save(d);
    flash("Backup downloaded — save to your Drive / email it to yourself");
  };
  const restore = () => {
    try {
      const parsed = JSON.parse(restoreTxt);
      if (!parsed.users || !parsed.companies) throw new Error("bad");
      log(parsed, "Data restored from backup");
      save(parsed); setRestoreTxt(""); flash("Restored successfully");
    } catch { flash("Invalid backup file content"); }
  };
  return (
    <div>
      <H1>Backup & Restore</H1>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Backup</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 10 }}>Downloads full data as JSON. Upload it to your Google Drive or email it to yourself for safe keeping.</div>
        <button onClick={download} style={{ ...btn(T.acc), color: "#08221E", fontWeight: 700 }}>Download backup</button>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Restore</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 8 }}>Paste backup file content below. This replaces all current data.</div>
        <textarea style={{ ...inp(0), minHeight: 100, width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 11 }}
          value={restoreTxt} onChange={e => setRestoreTxt(e.target.value)} placeholder='{"users":[...]}' />
        <button onClick={restore} style={{ ...btn(T.danger), color: "#fff", fontWeight: 700, marginTop: 8 }}>Restore data</button>
      </Card>
    </div>
  );
}

/* ---------- UI primitives ---------- */
const H1 = ({ children }) => <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{children}</div>;
const Card = ({ children }) => <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>{children}</div>;
const btn = (bg) => ({ background: bg, border: "none", borderRadius: 8, padding: "8px 12px", color: T.text, cursor: "pointer", fontSize: 13 });
const inp = (mb = 8) => ({ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 10px", color: T.text, width: "100%", boxSizing: "border-box", marginBottom: mb, fontSize: 13, display: "block" });
