import React, { useState, useEffect, useCallback, useMemo } from "react";

/* ============================================================
   BillDNA ERP — Phases 1–5 (integrated)
   P1 Core: Auth, Companies, Branches, Roles, Dashboard, Alerts, Logs, Backup
   P2 Masters: Customers, Suppliers, Products (Category/Brand/Unit/HSN/GST/Barcode), Warehouses
   P3 Billing: GST/Retail Invoice, Estimate, Quotation, POS, Print, WhatsApp share, Sales Return
   P4 Purchase: Purchase Invoice, Supplier Payments, Pending Purchases
   P5 Inventory: Auto stock in/out, Adjustment, Warehouse Transfer, Low-stock alerts
   Storage: window.storage key "billdna_erp_v2" (migrates from v1)
   ============================================================ */

const T = { bg:"#0E1420", panel:"#161E2E", panel2:"#1C2638", line:"#26324A", text:"#E8EDF6", dim:"#8A97AD", acc:"#2FB7A4", acc2:"#F5B841", danger:"#E5604C", ok:"#4CC97A" };
const PERMS = ["billing","purchase","inventory","accounting","reports","masters","settings","users"];
const ROLE_PRESETS = { Owner:PERMS, Manager:["billing","purchase","inventory","reports","masters"], Cashier:["billing"], Accountant:["accounting","reports"] };
const GST_RATES = [0,5,12,18,28];
const INV_TYPES = ["GST Invoice","Retail Invoice","Estimate","Quotation","Proforma"];
const KEY="billdna_erp_v2", OLD_KEY="billdna_core_v1";
const uid=()=>Math.random().toString(36).slice(2,9);
const fmtTs=t=>new Date(t).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const inr=n=>"₹"+(+n||0).toLocaleString("en-IN",{maximumFractionDigits:2});

const seed=()=>({
  users:[{id:"u1",name:"Admin",email:"admin@billdna.in",pin:"1234",role:"Owner",active:true}],
  companies:[],activeCompanyId:null,activeBranchId:null,
  customers:[],suppliers:[],products:[],warehouses:[],
  invoices:[],purchases:[],payments:[],stockMoves:[],vouchers:[],
  seq:{inv:0,pur:0},
  notifications:[{id:"n1",msg:"Welcome to BillDNA ERP (Phases 1–5).",ts:Date.now(),read:false}],
  logs:[{id:"l1",ts:Date.now(),user:"System",action:"System initialized"}],
});

export default function BillDNA(){
  const [db,setDb]=useState(null);
  const [session,setSession]=useState(null);
  const [view,setView]=useState("dashboard");
  const [toast,setToast]=useState(null);

  useEffect(()=>{(async()=>{
    try{
      const r=await window.storage.get(KEY);
      if(r){setDb(JSON.parse(r.value));return;}
    }catch{}
    // migrate from Phase-1 store if present
    try{
      const o=await window.storage.get(OLD_KEY);
      if(o){const old=JSON.parse(o.value);setDb({...seed(),...old,seq:{inv:0,pur:0},customers:[],suppliers:[],products:[],warehouses:[],invoices:[],purchases:[],payments:[],stockMoves:[]});return;}
    }catch{}
    setDb(seed());
  })();},[]);

  const save=useCallback(async next=>{setDb(next);try{await window.storage.set(KEY,JSON.stringify(next));}catch(e){console.error(e);}},[]);
  const log=(d,action)=>{d.logs=[{id:uid(),ts:Date.now(),user:session?.name||"System",action},...d.logs].slice(0,300);};
  const notify=(d,msg)=>{d.notifications=[{id:uid(),msg,ts:Date.now(),read:false},...d.notifications].slice(0,150);};
  const flash=m=>{setToast(m);setTimeout(()=>setToast(null),2200);};

  if(!db) return <div style={{background:T.bg,minHeight:"100vh",color:T.dim,display:"grid",placeItems:"center",fontFamily:"system-ui"}}>Loading BillDNA…</div>;
  if(!session) return <Login db={db} onLogin={u=>{const d=structuredClone(db);log(d,`${u.name} logged in`);save(d);setSession(u);}}/>;

  const company=db.companies.find(c=>c.id===db.activeCompanyId);
  const branch=company?.branches.find(b=>b.id===db.activeBranchId);
  const unread=db.notifications.filter(n=>!n.read).length;
  const can=p=>session.role==="Owner"||(ROLE_PRESETS[session.role]||[]).includes(p);
  const lowStock=db.products.filter(p=>totalStock(p)<=(p.low??0)&&p.low>0);

  const NAV=[
    ["dashboard","📊 Dashboard",true],
    ["pos","🧾 POS Billing",can("billing")],
    ["invoices","📄 Invoices",can("billing")],
    ["purchase","📦 Purchase",can("purchase")],
    ["inventory","🏬 Inventory",can("inventory")],
    ["accounting","📒 Accounting",can("accounting")],
    ["gst","🧾 GST Reports",can("accounting")||can("reports")],
    ["crm","🤝 CRM",can("billing")||can("masters")],
    ["reports","📈 Reports",can("reports")],
    ["mfg","🏭 Manufacturing",can("inventory")],
    ["hr","👷 HR & Payroll",can("users")||can("settings")],
    ["products","🛒 Products",can("masters")],
    ["customers","👥 Customers",can("masters")],
    ["suppliers","🚚 Suppliers",can("masters")],
    ["companies","🏢 Companies",can("settings")],
    ["users","🔐 Users & Roles",can("users")],
    ["notifications",`🔔 Alerts${unread?` (${unread})`:""}`,true],
    ["logs","📜 Activity Log",can("settings")],
    ["backup","💾 Backup",can("settings")],
  ];

  const ctx={db,save,log,notify,flash,session,company,branch,can};

  return(
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:`1px solid ${T.line}`,background:T.panel}}>
        <div style={{fontWeight:800,letterSpacing:1,fontSize:18}}>Bill<span style={{color:T.acc}}>DNA</span></div>
        <div style={{fontSize:12,color:T.dim,flex:1}}>{company?`${company.name}${branch?` · ${branch.name}`:""}`:"No company selected"}</div>
        {lowStock.length>0&&<div style={{fontSize:11,color:T.acc2}}>⚠ {lowStock.length} low stock</div>}
        <div style={{fontSize:12,color:T.dim}}>{session.name} · {session.role}</div>
        <button onClick={()=>setSession(null)} style={btn(T.panel2)}>Logout</button>
      </div>
      <div style={{display:"flex",flex:1,minHeight:0}}>
        <div style={{width:190,borderRight:`1px solid ${T.line}`,padding:10,display:"flex",flexDirection:"column",gap:3,background:T.panel,overflowY:"auto"}}>
          {NAV.filter(n=>n[2]).map(([k,label])=>(
            <button key={k} onClick={()=>setView(k)} style={{...btn(view===k?T.acc:"transparent"),color:view===k?"#08221E":T.text,textAlign:"left",fontWeight:view===k?700:400,fontSize:12.5}}>{label}</button>
          ))}
          <div style={{marginTop:"auto",fontSize:10,color:T.dim,padding:6}}>Phases 1–5 · v2.0</div>
        </div>
        <div style={{flex:1,overflow:"auto",padding:18}}>
          {view==="dashboard"&&<Dashboard {...ctx} lowStock={lowStock}/>}
          {view==="pos"&&<POS {...ctx}/>}
          {view==="invoices"&&<Invoices {...ctx}/>}
          {view==="purchase"&&<Purchase {...ctx}/>}
          {view==="inventory"&&<Inventory {...ctx}/>}
          {view==="accounting"&&<Accounting {...ctx}/>}
          {view==="gst"&&<GstReports {...ctx}/>}
          {view==="crm"&&<Crm {...ctx}/>}
          {view==="reports"&&<Reports {...ctx}/>}
          {view==="mfg"&&<Manufacturing {...ctx}/>}
          {view==="hr"&&<Hr {...ctx}/>}
          {view==="products"&&<Products {...ctx}/>}
          {view==="customers"&&<Parties {...ctx} kind="customers" title="Customers"/>}
          {view==="suppliers"&&<Parties {...ctx} kind="suppliers" title="Suppliers"/>}
          {view==="companies"&&<Companies {...ctx}/>}
          {view==="users"&&<Users {...ctx}/>}
          {view==="notifications"&&<Notifications {...ctx}/>}
          {view==="logs"&&<Logs db={db}/>}
          {view==="backup"&&<Backup {...ctx}/>}
        </div>
      </div>
      {toast&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:T.acc,color:"#08221E",padding:"8px 18px",borderRadius:8,fontWeight:700,fontSize:13,zIndex:99}}>{toast}</div>}
    </div>
  );
}

const totalStock=p=>Object.values(p.stock||{}).reduce((a,b)=>a+b,0);

/* ---------- Login ---------- */
function Login({db,onLogin}){
  const [email,setEmail]=useState("admin@billdna.in");const [pin,setPin]=useState("");const [err,setErr]=useState("");
  const go=()=>{const u=db.users.find(x=>x.email.toLowerCase()===email.trim().toLowerCase()&&x.pin===pin&&x.active);
    if(u)onLogin(u);else setErr("Email or PIN incorrect. Default: admin@billdna.in / 1234");};
  return(<div style={{background:T.bg,minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"system-ui"}}>
    <div style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:14,padding:28,width:320}}>
      <div style={{fontWeight:800,fontSize:26,color:T.text,marginBottom:4}}>Bill<span style={{color:T.acc}}>DNA</span></div>
      <div style={{color:T.dim,fontSize:12,marginBottom:18}}>SME ERP · Phases 1–5</div>
      <input style={inp()} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input style={inp()} placeholder="PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
      {err&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>{err}</div>}
      <button onClick={go} style={{...btn(T.acc),width:"100%",color:"#08221E",fontWeight:800,padding:10}}>Sign in</button>
    </div></div>);
}

/* ---------- Dashboard ---------- */
function Dashboard({db,company,branch,lowStock}){
  const today=new Date().toDateString();
  const todaySales=db.invoices.filter(i=>new Date(i.ts).toDateString()===today&&i.type.includes("Invoice"));
  const outstanding=db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  const purDue=db.purchases.reduce((a,p)=>a+Math.max(0,p.total-p.paid),0);
  const stats=[
    ["Today's Sales",inr(todaySales.reduce((a,i)=>a+i.total,0))],
    ["Today's Bills",todaySales.length],
    ["Receivables",inr(outstanding)],
    ["Payables",inr(purDue)],
    ["Products",db.products.length],
    ["Customers",db.customers.length],
  ];
  return(<div>
    <H1>Dashboard</H1>
    {!company&&<Card><div style={{color:T.acc2}}>⚠ Setup pending — create your first company in Companies.</div></Card>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,margin:"14px 0"}}>
      {stats.map(([l,v])=><Card key={l}><div style={{fontSize:22,fontWeight:800,color:T.acc}}>{v}</div><div style={{color:T.dim,fontSize:12}}>{l}</div></Card>)}
    </div>
    {lowStock.length>0&&<Card><div style={{fontWeight:700,color:T.acc2,marginBottom:6}}>⚠ Low stock</div>
      {lowStock.slice(0,8).map(p=><div key={p.id} style={{fontSize:12,color:T.dim,padding:"2px 0"}}>{p.name} — {totalStock(p)} left (min {p.low})</div>)}</Card>}
    <Card><div style={{fontWeight:700,marginBottom:8}}>Recent activity</div>
      {db.logs.slice(0,6).map(l=><div key={l.id} style={{fontSize:12,color:T.dim,padding:"4px 0",borderBottom:`1px solid ${T.line}`}}>
        <span style={{color:T.acc}}>{fmtTs(l.ts)}</span> · {l.user} — {l.action}</div>)}</Card>
  </div>);
}

/* ---------- Products (P2 Masters) ---------- */
function Products({db,save,log,flash}){
  const empty={name:"",sku:"",barcode:"",category:"",brand:"",unit:"pcs",hsn:"",gst:18,price:"",cost:"",low:5};
  const [f,setF]=useState(empty);const [q,setQ]=useState("");
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const add=()=>{
    if(!f.name.trim()||!f.price)return flash("Name & selling price required");
    const d=structuredClone(db);
    d.products.push({id:uid(),...f,name:f.name.trim(),price:+f.price,cost:+f.cost||0,gst:+f.gst,low:+f.low||0,
      barcode:f.barcode.trim()||("BD"+Date.now().toString().slice(-8)),stock:{}});
    log(d,`Product added: ${f.name}`);save(d);setF(empty);flash("Product saved");
  };
  const del=id=>{const d=structuredClone(db);const p=d.products.find(x=>x.id===id);
    d.products=d.products.filter(x=>x.id!==id);log(d,`Product deleted: ${p.name}`);save(d);};
  const list=db.products.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.barcode.includes(q)||p.sku.toLowerCase().includes(q.toLowerCase()));
  return(<div>
    <H1>Products</H1>
    <Card>
      <div style={{fontWeight:700,marginBottom:8}}>Add product</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
        <input style={inp(0)} placeholder="Name *" value={f.name} onChange={e=>set("name",e.target.value)}/>
        <input style={inp(0)} placeholder="SKU" value={f.sku} onChange={e=>set("sku",e.target.value)}/>
        <input style={inp(0)} placeholder="Barcode (auto if blank)" value={f.barcode} onChange={e=>set("barcode",e.target.value)}/>
        <input style={inp(0)} placeholder="Category" value={f.category} onChange={e=>set("category",e.target.value)}/>
        <input style={inp(0)} placeholder="Brand" value={f.brand} onChange={e=>set("brand",e.target.value)}/>
        <select style={inp(0)} value={f.unit} onChange={e=>set("unit",e.target.value)}>
          {["pcs","kg","g","ltr","ml","box","dozen","mtr","ft","set"].map(u=><option key={u}>{u}</option>)}
        </select>
        <input style={inp(0)} placeholder="HSN/SAC" value={f.hsn} onChange={e=>set("hsn",e.target.value)}/>
        <select style={inp(0)} value={f.gst} onChange={e=>set("gst",e.target.value)}>
          {GST_RATES.map(r=><option key={r} value={r}>GST {r}%</option>)}
        </select>
        <input style={inp(0)} placeholder="Selling ₹ *" type="number" value={f.price} onChange={e=>set("price",e.target.value)}/>
        <input style={inp(0)} placeholder="Cost ₹" type="number" value={f.cost} onChange={e=>set("cost",e.target.value)}/>
        <input style={inp(0)} placeholder="Low-stock alert qty" type="number" value={f.low} onChange={e=>set("low",e.target.value)}/>
      </div>
      <button onClick={add} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Save product</button>
    </Card>
    <input style={inp()} placeholder="🔍 Search name / barcode / SKU" value={q} onChange={e=>setQ(e.target.value)}/>
    {list.map(p=>(
      <Card key={p.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <b>{p.name}</b> <span style={{color:T.dim,fontSize:12}}>· {p.category||"—"} · {p.brand||"—"}</span>
          <div style={{fontSize:11,color:T.dim}}>HSN {p.hsn||"—"} · GST {p.gst}% · ▮▮ {p.barcode}</div>
        </div>
        <div style={{fontSize:13}}><b style={{color:T.acc}}>{inr(p.price)}</b>/{p.unit}</div>
        <div style={{fontSize:12,color:totalStock(p)<=p.low?T.acc2:T.ok}}>Stock: {totalStock(p)}</div>
        <button onClick={()=>del(p.id)} style={{...btn(T.panel2),color:T.danger}}>✕</button>
      </div></Card>))}
    {list.length===0&&<div style={{color:T.dim,fontSize:13}}>No products yet. Add your first product above.</div>}
  </div>);
}

/* ---------- Customers / Suppliers (P2) ---------- */
function Parties({db,save,log,flash,kind,title}){
  const [f,setF]=useState({name:"",phone:"",gstin:"",city:""});
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const add=()=>{
    if(!f.name.trim())return flash("Name required");
    const d=structuredClone(db);
    d[kind].push({id:uid(),...f,name:f.name.trim(),ts:Date.now()});
    log(d,`${title.slice(0,-1)} added: ${f.name}`);save(d);setF({name:"",phone:"",gstin:"",city:""});flash("Saved");
  };
  const bal=id=>kind==="customers"
    ? db.invoices.filter(i=>i.customerId===id).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0)
    : db.purchases.filter(p=>p.supplierId===id).reduce((a,p)=>a+Math.max(0,p.total-p.paid),0);
  return(<div>
    <H1>{title}</H1>
    <Card><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
      <input style={inp(0)} placeholder="Name *" value={f.name} onChange={e=>set("name",e.target.value)}/>
      <input style={inp(0)} placeholder="Phone" value={f.phone} onChange={e=>set("phone",e.target.value)}/>
      <input style={inp(0)} placeholder="GSTIN" value={f.gstin} onChange={e=>set("gstin",e.target.value)}/>
      <input style={inp(0)} placeholder="City" value={f.city} onChange={e=>set("city",e.target.value)}/>
    </div>
    <button onClick={add} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add</button></Card>
    {db[kind].map(c=>(
      <Card key={c.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><b>{c.name}</b> <span style={{color:T.dim,fontSize:12}}>· {c.phone||"—"} · {c.city||"—"}</span>
          {c.gstin&&<div style={{fontSize:11,color:T.dim}}>GSTIN: {c.gstin}</div>}</div>
        <div style={{fontSize:12,color:bal(c.id)>0?T.acc2:T.ok}}>{kind==="customers"?"Due":"Payable"}: {inr(bal(c.id))}</div>
      </div></Card>))}
  </div>);
}

/* ---------- POS Billing (P3) ---------- */
function POS({db,save,log,notify,flash,branch}){
  const [cart,setCart]=useState([]);const [q,setQ]=useState("");
  const [custId,setCustId]=useState("");const [type,setType]=useState("GST Invoice");
  const [payMode,setPayMode]=useState("Cash");const [paidAmt,setPaidAmt]=useState("");
  const [lastInv,setLastInv]=useState(null);

  const matches=q?db.products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.barcode===q||p.sku.toLowerCase()===q.toLowerCase()).slice(0,6):[];
  const addItem=p=>{setCart(c=>{const ex=c.find(i=>i.pid===p.id);
    return ex?c.map(i=>i.pid===p.id?{...i,qty:i.qty+1}:i):[...c,{pid:p.id,name:p.name,rate:p.price,gst:p.gst,unit:p.unit,qty:1,hsn:p.hsn}];});setQ("");};
  const setQty=(pid,qty)=>setCart(c=>qty<=0?c.filter(i=>i.pid!==pid):c.map(i=>i.pid===pid?{...i,qty}:i));
  const setRate=(pid,rate)=>setCart(c=>c.map(i=>i.pid===pid?{...i,rate:+rate||0}:i));

  const sub=cart.reduce((a,i)=>a+i.rate*i.qty,0);
  const taxable=type==="GST Invoice"||type==="Retail Invoice";
  const tax=taxable?cart.reduce((a,i)=>a+i.rate*i.qty*i.gst/100,0):0;
  const total=Math.round((sub+tax)*100)/100;

  const finalize=()=>{
    if(cart.length===0)return flash("Cart empty");
    const d=structuredClone(db);
    d.seq.inv++;
    const no=`${type.split(" ")[0].slice(0,3).toUpperCase()}-${String(d.seq.inv).padStart(4,"0")}`;
    const paid=paidAmt===""?total:Math.min(+paidAmt,total);
    const inv={id:uid(),no,type,customerId:custId||null,items:cart,sub,tax,total,paid,payMode,ts:Date.now(),branchId:branch?.id||null,returned:false};
    d.invoices.unshift(inv);
    if(taxable){ // stock out
      cart.forEach(i=>{const p=d.products.find(x=>x.id===i.pid);if(!p)return;
        const wh=Object.keys(p.stock)[0]||"default";
        p.stock[wh]=(p.stock[wh]||0)-i.qty;
        d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:i.pid,wh,qty:-i.qty,type:"Sale",ref:no});
        if(totalStock(p)<=p.low&&p.low>0)notify(d,`Low stock: ${p.name} (${totalStock(p)} left)`);
      });
    }
    log(d,`${type} ${no} — ${inr(total)} (${payMode})`);
    save(d);setCart([]);setCustId("");setPaidAmt("");setLastInv(inv);flash(`${no} saved`);
  };

  const cust=db.customers.find(c=>c.id===lastInv?.customerId);
  const waLink=lastInv&&cust?.phone?`https://wa.me/91${cust.phone.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(`${lastInv.type} ${lastInv.no}\nTotal: ${inr(lastInv.total)}\nThank you! — BillDNA`)}`:null;

  return(<div>
    <H1>POS Billing</H1>
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:14}}>
      <div>
        <input style={inp()} autoFocus placeholder="🔍 Scan barcode / search product, Enter to add" value={q}
          onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&matches[0])addItem(matches[0]);}}/>
        {matches.map(p=><button key={p.id} onClick={()=>addItem(p)} style={{...btn(T.panel2),display:"block",width:"100%",textAlign:"left",marginBottom:4}}>
          {p.name} — {inr(p.price)} <span style={{color:T.dim,fontSize:11}}>({totalStock(p)} in stock)</span></button>)}
        <Card>
          {cart.length===0&&<div style={{color:T.dim,fontSize:13}}>Cart empty. Scan or search to add items.</div>}
          {cart.map(i=>(
            <div key={i.pid} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${T.line}`}}>
              <div style={{flex:1,fontSize:13}}>{i.name}<div style={{fontSize:10,color:T.dim}}>GST {i.gst}%</div></div>
              <input type="number" style={{...inp(0),width:60}} value={i.rate} onChange={e=>setRate(i.pid,e.target.value)}/>
              <button onClick={()=>setQty(i.pid,i.qty-1)} style={btn(T.panel2)}>−</button>
              <b style={{width:24,textAlign:"center"}}>{i.qty}</b>
              <button onClick={()=>setQty(i.pid,i.qty+1)} style={btn(T.panel2)}>+</button>
              <div style={{width:80,textAlign:"right",fontSize:13}}>{inr(i.rate*i.qty)}</div>
            </div>))}
        </Card>
      </div>
      <div>
        <Card>
          <select style={inp()} value={type} onChange={e=>setType(e.target.value)}>{INV_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          <select style={inp()} value={custId} onChange={e=>setCustId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {db.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{fontSize:13,color:T.dim,display:"flex",justifyContent:"space-between"}}><span>Subtotal</span><span>{inr(sub)}</span></div>
          {taxable&&<div style={{fontSize:13,color:T.dim,display:"flex",justifyContent:"space-between"}}><span>CGST+SGST</span><span>{inr(tax)}</span></div>}
          <div style={{fontSize:18,fontWeight:800,display:"flex",justifyContent:"space-between",margin:"6px 0",color:T.acc}}><span>Total</span><span>{inr(total)}</span></div>
          <select style={inp()} value={payMode} onChange={e=>setPayMode(e.target.value)}>{["Cash","UPI","Card","Credit"].map(m=><option key={m}>{m}</option>)}</select>
          <input style={inp()} type="number" placeholder={`Paid amount (blank = full ${inr(total)})`} value={paidAmt} onChange={e=>setPaidAmt(e.target.value)}/>
          <button onClick={finalize} style={{...btn(T.acc),width:"100%",color:"#08221E",fontWeight:800,padding:10}}>💾 Save & Bill</button>
        </Card>
        {lastInv&&<Card>
          <div style={{fontWeight:700,marginBottom:6}}>Last bill: {lastInv.no}</div>
          <div style={{fontSize:12,color:T.dim,marginBottom:8}}>{inr(lastInv.total)} · {lastInv.payMode}</div>
          <button onClick={()=>window.print()} style={{...btn(T.panel2),marginRight:6}}>🖨 Print</button>
          {waLink&&<a href={waLink} target="_blank" rel="noreferrer" style={{...btn(T.ok),color:"#08221E",fontWeight:700,textDecoration:"none",display:"inline-block"}}>WhatsApp</a>}
        </Card>}
      </div>
    </div>
  </div>);
}

/* ---------- Invoices list + returns (P3) ---------- */
function Invoices({db,save,log,flash}){
  const [filter,setFilter]=useState("All");
  const list=db.invoices.filter(i=>filter==="All"||i.type===filter);
  const receive=(id)=>{const d=structuredClone(db);const i=d.invoices.find(x=>x.id===id);
    i.paid=i.total;d.payments.unshift({id:uid(),ts:Date.now(),ref:i.no,amt:i.total-0,dir:"in"});
    log(d,`Payment received: ${i.no}`);save(d);flash("Marked paid");};
  const doReturn=(id)=>{const d=structuredClone(db);const i=d.invoices.find(x=>x.id===id);
    if(i.returned)return flash("Already returned");
    i.returned=true;
    i.items.forEach(it=>{const p=d.products.find(x=>x.id===it.pid);if(!p)return;
      const wh=Object.keys(p.stock)[0]||"default";p.stock[wh]=(p.stock[wh]||0)+it.qty;
      d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:it.pid,wh,qty:it.qty,type:"Sales Return",ref:i.no});});
    log(d,`Sales return: ${i.no}`);save(d);flash("Return processed, stock restored");};
  const custName=id=>db.customers.find(c=>c.id===id)?.name||"Walk-in";
  return(<div>
    <H1>Invoices</H1>
    <select style={{...inp(),maxWidth:220}} value={filter} onChange={e=>setFilter(e.target.value)}>
      <option>All</option>{INV_TYPES.map(t=><option key={t}>{t}</option>)}
    </select>
    {list.map(i=>(
      <Card key={i.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:160}}>
          <b>{i.no}</b> <span style={{fontSize:11,color:T.dim}}>· {i.type} · {fmtTs(i.ts)}</span>
          <div style={{fontSize:12,color:T.dim}}>{custName(i.customerId)} · {i.items.length} items{i.returned&&<span style={{color:T.danger}}> · RETURNED</span>}</div>
        </div>
        <div style={{fontWeight:700,color:T.acc}}>{inr(i.total)}</div>
        <div style={{fontSize:11,color:i.paid>=i.total?T.ok:T.acc2}}>{i.paid>=i.total?"Paid":`Due ${inr(i.total-i.paid)}`}</div>
        {i.paid<i.total&&<button onClick={()=>receive(i.id)} style={btn(T.panel2)}>Mark paid</button>}
        {!i.returned&&i.type.includes("Invoice")&&<button onClick={()=>doReturn(i.id)} style={{...btn(T.panel2),color:T.danger}}>Return</button>}
      </div></Card>))}
    {list.length===0&&<div style={{color:T.dim,fontSize:13}}>No invoices yet.</div>}
  </div>);
}

/* ---------- Purchase (P4) ---------- */
function Purchase({db,save,log,flash}){
  const [supId,setSupId]=useState("");const [items,setItems]=useState([]);const [q,setQ]=useState("");
  const matches=q?db.products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).slice(0,5):[];
  const addItem=p=>{setItems(c=>{const ex=c.find(i=>i.pid===p.id);
    return ex?c.map(i=>i.pid===p.id?{...i,qty:i.qty+1}:i):[...c,{pid:p.id,name:p.name,rate:p.cost||p.price,qty:1}];});setQ("");};
  const total=items.reduce((a,i)=>a+i.rate*i.qty,0);
  const saveP=(paidFull)=>{
    if(!supId||items.length===0)return flash("Supplier & items required");
    const d=structuredClone(db);d.seq.pur++;
    const no=`PUR-${String(d.seq.pur).padStart(4,"0")}`;
    d.purchases.unshift({id:uid(),no,supplierId:supId,items,total,paid:paidFull?total:0,ts:Date.now()});
    items.forEach(i=>{const p=d.products.find(x=>x.id===i.pid);if(!p)return;
      const wh=Object.keys(p.stock)[0]||"default";p.stock[wh]=(p.stock[wh]||0)+i.qty;
      p.cost=i.rate;
      d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:i.pid,wh,qty:i.qty,type:"Purchase",ref:no});});
    log(d,`Purchase ${no} — ${inr(total)}`);save(d);setItems([]);setSupId("");flash(`${no} saved, stock updated`);
  };
  const payOff=id=>{const d=structuredClone(db);const p=d.purchases.find(x=>x.id===id);
    p.paid=p.total;d.payments.unshift({id:uid(),ts:Date.now(),ref:p.no,amt:p.total,dir:"out"});
    log(d,`Supplier paid: ${p.no}`);save(d);flash("Payment recorded");};
  const supName=id=>db.suppliers.find(s=>s.id===id)?.name||"—";
  return(<div>
    <H1>Purchase</H1>
    <Card>
      <select style={inp()} value={supId} onChange={e=>setSupId(e.target.value)}>
        <option value="">Select supplier *</option>
        {db.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input style={inp()} placeholder="🔍 Add products to purchase" value={q} onChange={e=>setQ(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&matches[0])addItem(matches[0]);}}/>
      {matches.map(p=><button key={p.id} onClick={()=>addItem(p)} style={{...btn(T.panel2),display:"block",width:"100%",textAlign:"left",marginBottom:4}}>{p.name}</button>)}
      {items.map(i=>(
        <div key={i.pid} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
          <div style={{flex:1,fontSize:13}}>{i.name}</div>
          <input type="number" style={{...inp(0),width:70}} value={i.rate} onChange={e=>setItems(c=>c.map(x=>x.pid===i.pid?{...x,rate:+e.target.value||0}:x))}/>
          <input type="number" style={{...inp(0),width:55}} value={i.qty} onChange={e=>setItems(c=>c.map(x=>x.pid===i.pid?{...x,qty:+e.target.value||0}:x))}/>
          <div style={{width:80,textAlign:"right",fontSize:13}}>{inr(i.rate*i.qty)}</div>
        </div>))}
      {items.length>0&&<>
        <div style={{fontSize:16,fontWeight:800,color:T.acc,margin:"10px 0"}}>Total: {inr(total)}</div>
        <button onClick={()=>saveP(true)} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginRight:8}}>Save (Paid)</button>
        <button onClick={()=>saveP(false)} style={{...btn(T.acc2),color:"#08221E",fontWeight:700}}>Save (Credit)</button></>}
    </Card>
    <div style={{fontWeight:700,margin:"12px 0 8px"}}>Purchase history</div>
    {db.purchases.map(p=>(
      <Card key={p.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><b>{p.no}</b> <span style={{fontSize:11,color:T.dim}}>· {supName(p.supplierId)} · {fmtTs(p.ts)}</span></div>
        <div style={{fontWeight:700}}>{inr(p.total)}</div>
        <div style={{fontSize:11,color:p.paid>=p.total?T.ok:T.acc2}}>{p.paid>=p.total?"Paid":`Pending ${inr(p.total-p.paid)}`}</div>
        {p.paid<p.total&&<button onClick={()=>payOff(p.id)} style={btn(T.panel2)}>Pay</button>}
      </div></Card>))}
  </div>);
}

/* ---------- Inventory (P5) ---------- */
function Inventory({db,save,log,flash,company}){
  const [tab,setTab]=useState("stock");
  const [adjPid,setAdjPid]=useState("");const [adjQty,setAdjQty]=useState("");
  const [trPid,setTrPid]=useState("");const [trFrom,setTrFrom]=useState("");const [trTo,setTrTo]=useState("");const [trQty,setTrQty]=useState("");
  const [whName,setWhName]=useState("");
  const whs=useMemo(()=>{
    const s=new Set(["default"]);
    db.products.forEach(p=>Object.keys(p.stock||{}).forEach(w=>s.add(w)));
    (db.warehouses||[]).forEach(w=>s.add(w.name));
    return [...s];
  },[db]);

  const addWh=()=>{if(!whName.trim())return flash("Name required");
    const d=structuredClone(db);d.warehouses.push({id:uid(),name:whName.trim()});
    log(d,`Warehouse added: ${whName}`);save(d);setWhName("");flash("Warehouse added");};

  const adjust=()=>{
    if(!adjPid||adjQty==="")return flash("Product & qty required");
    const d=structuredClone(db);const p=d.products.find(x=>x.id===adjPid);
    const wh=Object.keys(p.stock)[0]||"default";
    const diff=+adjQty-(p.stock[wh]||0);
    p.stock[wh]=+adjQty;
    d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:p.id,wh,qty:diff,type:"Adjustment",ref:"ADJ"});
    log(d,`Stock adjusted: ${p.name} → ${adjQty}`);save(d);setAdjQty("");flash("Adjusted");
  };

  const transfer=()=>{
    if(!trPid||!trFrom||!trTo||!trQty||trFrom===trTo)return flash("Fill all transfer fields");
    const d=structuredClone(db);const p=d.products.find(x=>x.id===trPid);
    const qn=+trQty;
    if((p.stock[trFrom]||0)<qn)return flash("Not enough stock in source");
    p.stock[trFrom]=(p.stock[trFrom]||0)-qn;
    p.stock[trTo]=(p.stock[trTo]||0)+qn;
    d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:p.id,wh:`${trFrom}→${trTo}`,qty:qn,type:"Transfer",ref:"TRF"});
    log(d,`Transfer: ${p.name} ${qn} (${trFrom}→${trTo})`);save(d);setTrQty("");flash("Transferred");
  };

  const pName=id=>db.products.find(p=>p.id===id)?.name||"—";
  return(<div>
    <H1>Inventory</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["stock","Stock"],["adjust","Adjustment"],["transfer","Transfer"],["moves","Movements"],["wh","Warehouses"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>))}
    </div>
    {tab==="stock"&&db.products.map(p=>(
      <Card key={p.id}><div style={{display:"flex",gap:10,alignItems:"center"}}>
        <div style={{flex:1}}><b>{p.name}</b>
          <div style={{fontSize:11,color:T.dim}}>{Object.entries(p.stock||{}).map(([w,q])=>`${w}: ${q}`).join(" · ")||"no stock"}</div></div>
        <div style={{fontWeight:700,color:totalStock(p)<=p.low?T.acc2:T.ok}}>{totalStock(p)} {p.unit}</div>
      </div></Card>))}
    {tab==="adjust"&&<Card>
      <select style={inp()} value={adjPid} onChange={e=>setAdjPid(e.target.value)}>
        <option value="">Select product</option>
        {db.products.map(p=><option key={p.id} value={p.id}>{p.name} (now {totalStock(p)})</option>)}
      </select>
      <input style={inp()} type="number" placeholder="New qty (physical count)" value={adjQty} onChange={e=>setAdjQty(e.target.value)}/>
      <button onClick={adjust} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Apply adjustment</button>
    </Card>}
    {tab==="transfer"&&<Card>
      <select style={inp()} value={trPid} onChange={e=>setTrPid(e.target.value)}>
        <option value="">Select product</option>
        {db.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 90px",gap:8}}>
        <select style={inp(0)} value={trFrom} onChange={e=>setTrFrom(e.target.value)}><option value="">From</option>{whs.map(w=><option key={w}>{w}</option>)}</select>
        <select style={inp(0)} value={trTo} onChange={e=>setTrTo(e.target.value)}><option value="">To</option>{whs.map(w=><option key={w}>{w}</option>)}</select>
        <input style={inp(0)} type="number" placeholder="Qty" value={trQty} onChange={e=>setTrQty(e.target.value)}/>
      </div>
      <button onClick={transfer} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Transfer</button>
    </Card>}
    {tab==="moves"&&<Card>
      {db.stockMoves.slice(0,50).map(m=>(
        <div key={m.id} style={{fontSize:12,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{color:T.acc}}>{fmtTs(m.ts)}</span> · {pName(m.pid)} · <b style={{color:m.qty>0?T.ok:T.danger}}>{m.qty>0?"+":""}{m.qty}</b> · {m.type} ({m.ref}) · {m.wh}
        </div>))}
      {db.stockMoves.length===0&&<div style={{color:T.dim,fontSize:13}}>No movements yet.</div>}
    </Card>}
    {tab==="wh"&&<Card>
      <div style={{display:"flex",gap:8}}>
        <input style={inp(0)} placeholder="Warehouse name" value={whName} onChange={e=>setWhName(e.target.value)}/>
        <button onClick={addWh} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Add</button>
      </div>
      <div style={{marginTop:10,fontSize:13,color:T.dim}}>{whs.join(" · ")}</div>
    </Card>}
  </div>);
}

/* ---------- Companies (P1) ---------- */
function Companies({db,save,log,notify,flash}){
  const [name,setName]=useState("");const [gstin,setGstin]=useState("");const [city,setCity]=useState("");
  const [bName,setBName]=useState("");const [sel,setSel]=useState(db.activeCompanyId);
  const addCompany=()=>{
    if(!name.trim())return flash("Company name required");
    const d=structuredClone(db);
    const c={id:uid(),name:name.trim(),gstin:gstin.trim().toUpperCase(),city:city.trim(),branches:[{id:uid(),name:"Main Branch",city:city.trim()}]};
    d.companies.push(c);
    if(!d.activeCompanyId){d.activeCompanyId=c.id;d.activeBranchId=c.branches[0].id;}
    log(d,`Company created: ${c.name}`);notify(d,`Company "${c.name}" created`);
    save(d);setName("");setGstin("");setCity("");setSel(c.id);flash("Company created");
  };
  const addBranch=()=>{
    if(!sel||!bName.trim())return flash("Select company & branch name");
    const d=structuredClone(db);const c=d.companies.find(x=>x.id===sel);
    c.branches.push({id:uid(),name:bName.trim()});
    log(d,`Branch added: ${bName}`);save(d);setBName("");flash("Branch added");
  };
  const activate=(cId,bId)=>{const d=structuredClone(db);
    d.activeCompanyId=cId;d.activeBranchId=bId;
    log(d,`Context switched`);save(d);flash("Switched");};
  return(<div>
    <H1>Companies & Branches</H1>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,marginBottom:8}}>New company</div>
        <input style={inp()} placeholder="Company name *" value={name} onChange={e=>setName(e.target.value)}/>
        <input style={inp()} placeholder="GSTIN" value={gstin} onChange={e=>setGstin(e.target.value)}/>
        <input style={inp()} placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/>
        <button onClick={addCompany} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Create</button></Card>
      <Card><div style={{fontWeight:700,marginBottom:8}}>New branch</div>
        <select style={inp()} value={sel||""} onChange={e=>setSel(e.target.value)}>
          <option value="">Select company</option>
          {db.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input style={inp()} placeholder="Branch name *" value={bName} onChange={e=>setBName(e.target.value)}/>
        <button onClick={addBranch} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Add branch</button></Card>
    </div>
    {db.companies.map(c=>(
      <Card key={c.id}><div style={{fontWeight:700}}>{c.name} {c.gstin&&<span style={{color:T.dim,fontSize:12}}>· {c.gstin}</span>}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
          {c.branches.map(b=>{const active=db.activeCompanyId===c.id&&db.activeBranchId===b.id;
            return <button key={b.id} onClick={()=>activate(c.id,b.id)}
              style={{...btn(active?T.acc:T.panel2),color:active?"#08221E":T.text,fontWeight:active?700:400}}>{b.name}{active?" ✓":""}</button>;})}
        </div></Card>))}
  </div>);
}

/* ---------- Users (P1) ---------- */
function Users({db,save,log,flash,session}){
  const [f,setF]=useState({name:"",email:"",pin:"",role:"Cashier"});
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const add=()=>{
    if(!f.name.trim()||!f.email.trim()||f.pin.length<4)return flash("Name, email & 4-digit PIN required");
    if(db.users.some(u=>u.email.toLowerCase()===f.email.trim().toLowerCase()))return flash("Email exists");
    const d=structuredClone(db);
    d.users.push({id:uid(),...f,name:f.name.trim(),email:f.email.trim(),active:true});
    log(d,`User added: ${f.name} (${f.role})`);save(d);setF({name:"",email:"",pin:"",role:"Cashier"});flash("User added");
  };
  const toggle=id=>{const d=structuredClone(db);const u=d.users.find(x=>x.id===id);
    if(u.id===session.id)return flash("Cannot deactivate yourself");
    u.active=!u.active;log(d,`User ${u.active?"activated":"deactivated"}: ${u.name}`);save(d);};
  return(<div>
    <H1>Users & Roles</H1>
    <Card><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
      <input style={inp(0)} placeholder="Name *" value={f.name} onChange={e=>set("name",e.target.value)}/>
      <input style={inp(0)} placeholder="Email *" value={f.email} onChange={e=>set("email",e.target.value)}/>
      <input style={inp(0)} placeholder="PIN *" value={f.pin} onChange={e=>set("pin",e.target.value)}/>
      <select style={inp(0)} value={f.role} onChange={e=>set("role",e.target.value)}>{Object.keys(ROLE_PRESETS).map(r=><option key={r}>{r}</option>)}</select>
    </div>
    <button onClick={add} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add user</button></Card>
    {db.users.map(u=>(
      <Card key={u.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><b>{u.name}</b> <span style={{color:T.dim,fontSize:12}}>· {u.email} · {u.role}</span></div>
        <span style={{fontSize:11,color:u.active?T.ok:T.danger}}>{u.active?"Active":"Inactive"}</span>
        {u.id!==session.id&&<button onClick={()=>toggle(u.id)} style={btn(T.panel2)}>{u.active?"Deactivate":"Activate"}</button>}
      </div></Card>))}
  </div>);
}

/* ---------- Notifications / Logs / Backup (P1) ---------- */
function Notifications({db,save}){
  const markAll=()=>{const d=structuredClone(db);d.notifications.forEach(n=>n.read=true);save(d);};
  return(<div>
    <div style={{display:"flex",alignItems:"center"}}><H1>Notifications</H1>
      <button onClick={markAll} style={{...btn(T.panel2),marginLeft:"auto"}}>Mark all read</button></div>
    {db.notifications.map(n=>(
      <Card key={n.id}><div style={{fontSize:13,color:n.read?T.dim:T.text}}>{!n.read&&<span style={{color:T.acc}}>● </span>}{n.msg}</div>
        <div style={{fontSize:11,color:T.dim,marginTop:4}}>{fmtTs(n.ts)}</div></Card>))}
  </div>);
}
function Logs({db}){
  return(<div><H1>Activity Log</H1><Card>
    {db.logs.map(l=><div key={l.id} style={{fontSize:12,padding:"6px 0",borderBottom:`1px solid ${T.line}`}}>
      <span style={{color:T.acc}}>{fmtTs(l.ts)}</span> · <b>{l.user}</b> — <span style={{color:T.dim}}>{l.action}</span></div>)}
  </Card></div>);
}
function Backup({db,save,log,flash}){
  const [txt,setTxt]=useState("");
  const download=()=>{
    const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`billdna-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
    const d=structuredClone(db);log(d,"Backup downloaded");save(d);
    flash("Backup downloaded — upload to your Drive or email yourself");
  };
  const restore=()=>{try{
    const p=JSON.parse(txt);
    if(!p.users||!p.companies)throw new Error("bad");
    log(p,"Data restored from backup");save(p);setTxt("");flash("Restored");
  }catch{flash("Invalid backup content");}};
  return(<div>
    <H1>Backup & Restore</H1>
    <Card><div style={{fontWeight:700,marginBottom:6}}>Backup</div>
      <div style={{fontSize:12,color:T.dim,marginBottom:10}}>Downloads full data as JSON. Save it to your Google Drive or email it to yourself.</div>
      <button onClick={download} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Download backup</button></Card>
    <Card><div style={{fontWeight:700,marginBottom:6}}>Restore</div>
      <textarea style={{...inp(0),minHeight:100,width:"100%",boxSizing:"border-box",fontFamily:"monospace",fontSize:11}}
        value={txt} onChange={e=>setTxt(e.target.value)} placeholder='Paste backup JSON here'/>
      <button onClick={restore} style={{...btn(T.danger),color:"#fff",fontWeight:700,marginTop:8}}>Restore data</button></Card>
  </div>);
}

/* ---------- Accounting (P6) ---------- */
function Accounting({db,save,log,flash}){
  const [tab,setTab]=useState("daybook");
  const [f,setF]=useState({type:"Expense",account:"",amt:"",mode:"Cash",note:""});
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const vouchers=db.vouchers||[];

  // unified transaction stream: invoices(in), purchases(out), vouchers
  const txns=useMemo(()=>{
    const t=[];
    db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned).forEach(i=>t.push({ts:i.ts,ref:i.no,acct:custName(db,i.customerId),desc:"Sale",amt:i.paid,mode:i.payMode==="Credit"?"Credit":i.payMode,dir:"in",full:i.total}));
    db.purchases.forEach(p=>t.push({ts:p.ts,ref:p.no,acct:supName(db,p.supplierId),desc:"Purchase",amt:p.paid,mode:"Cash",dir:"out",full:p.total}));
    vouchers.forEach(v=>t.push({ts:v.ts,ref:v.no,acct:v.account,desc:v.type,amt:v.amt,mode:v.mode,dir:["Receipt","Income"].includes(v.type)?"in":v.type==="Contra"?"contra":"out"}));
    return t.sort((a,b)=>b.ts-a.ts);
  },[db]);

  const addVoucher=()=>{
    if(!f.account.trim()||!+f.amt)return flash("Account & amount required");
    const d=structuredClone(db);d.vouchers=d.vouchers||[];
    const no=`${f.type.slice(0,3).toUpperCase()}-${String(d.vouchers.length+1).padStart(4,"0")}`;
    d.vouchers.unshift({id:uid(),no,ts:Date.now(),...f,amt:+f.amt,account:f.account.trim()});
    log(d,`${f.type} voucher ${no} — ${inr(+f.amt)}`);
    save(d);setF({type:"Expense",account:"",amt:"",mode:"Cash",note:""});flash(`${no} saved`);
  };

  // P&L
  const sales=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned);
  const revenue=sales.reduce((a,i)=>a+i.sub,0);
  const cogs=sales.reduce((a,i)=>a+i.items.reduce((x,it)=>{const p=db.products.find(z=>z.id===it.pid);return x+(p?.cost||0)*it.qty;},0),0);
  const expenses=vouchers.filter(v=>["Expense","Payment"].includes(v.type)).reduce((a,v)=>a+v.amt,0);
  const otherInc=vouchers.filter(v=>["Income","Receipt"].includes(v.type)).reduce((a,v)=>a+v.amt,0);
  const gross=revenue-cogs, net=gross-expenses+otherInc;

  // Balance sheet (simplified)
  const receivables=db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  const payables=db.purchases.reduce((a,p)=>a+Math.max(0,p.total-p.paid),0);
  const stockValue=db.products.reduce((a,p)=>a+totalStock(p)*(p.cost||0),0);
  const cashIn=txns.filter(t=>t.dir==="in"&&t.mode==="Cash").reduce((a,t)=>a+t.amt,0);
  const cashOut=txns.filter(t=>t.dir==="out"&&t.mode==="Cash").reduce((a,t)=>a+t.amt,0);
  const bankIn=txns.filter(t=>t.dir==="in"&&["UPI","Card","Bank"].includes(t.mode)).reduce((a,t)=>a+t.amt,0);
  const bankOut=txns.filter(t=>t.dir==="out"&&["UPI","Card","Bank"].includes(t.mode)).reduce((a,t)=>a+t.amt,0);
  const cashBal=cashIn-cashOut, bankBal=bankIn-bankOut;

  const today=new Date().toDateString();
  const book=(mode)=>txns.filter(t=>t.dir!=="contra"&&(mode==="Cash"?t.mode==="Cash":["UPI","Card","Bank"].includes(t.mode)));

  const Row=({t})=>(
    <div style={{display:"flex",gap:8,fontSize:12,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
      <span style={{color:T.acc,width:100}}>{fmtTs(t.ts)}</span>
      <span style={{width:80}}>{t.ref}</span>
      <span style={{flex:1,color:T.dim}}>{t.acct} · {t.desc}</span>
      <span style={{width:60,fontSize:10,color:T.dim}}>{t.mode}</span>
      <b style={{width:90,textAlign:"right",color:t.dir==="in"?T.ok:t.dir==="contra"?T.acc2:T.danger}}>{t.dir==="in"?"+":t.dir==="contra"?"⇄":"−"}{inr(t.amt)}</b>
    </div>);

  const TABS=[["daybook","Day Book"],["cash","Cash Book"],["bank","Bank Book"],["voucher","Vouchers"],["ledger","Ledger"],["pl","P&L"],["bs","Balance Sheet"],["tb","Trial Balance"],["cf","Cash Flow"]];
  const [ledgerAcct,setLedgerAcct]=useState("");
  const accts=[...new Set(txns.map(t=>t.acct))];

  return(<div>
    <H1>Accounting</H1>
    <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400,fontSize:12}}>{l}</button>)}
    </div>

    {tab==="daybook"&&<Card><div style={{fontWeight:700,marginBottom:8}}>Today's transactions</div>
      {txns.filter(t=>new Date(t.ts).toDateString()===today).map((t,i)=><Row key={i} t={t}/>)}
      {txns.filter(t=>new Date(t.ts).toDateString()===today).length===0&&<div style={{color:T.dim,fontSize:13}}>No transactions today.</div>}</Card>}

    {tab==="cash"&&<Card><div style={{fontWeight:700,marginBottom:4}}>Cash Book · Balance: <span style={{color:cashBal>=0?T.ok:T.danger}}>{inr(cashBal)}</span></div>
      {book("Cash").map((t,i)=><Row key={i} t={t}/>)}</Card>}

    {tab==="bank"&&<Card><div style={{fontWeight:700,marginBottom:4}}>Bank Book (UPI/Card) · Balance: <span style={{color:bankBal>=0?T.ok:T.danger}}>{inr(bankBal)}</span></div>
      {book("Bank").map((t,i)=><Row key={i} t={t}/>)}</Card>}

    {tab==="voucher"&&<><Card>
      <div style={{fontWeight:700,marginBottom:8}}>New voucher</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
        <select style={inp(0)} value={f.type} onChange={e=>set("type",e.target.value)}>
          {["Expense","Income","Payment","Receipt","Journal","Contra"].map(t=><option key={t}>{t}</option>)}</select>
        <input style={inp(0)} placeholder="Account / party *" value={f.account} onChange={e=>set("account",e.target.value)}/>
        <input style={inp(0)} type="number" placeholder="Amount *" value={f.amt} onChange={e=>set("amt",e.target.value)}/>
        <select style={inp(0)} value={f.mode} onChange={e=>set("mode",e.target.value)}>{["Cash","Bank","UPI","Card"].map(m=><option key={m}>{m}</option>)}</select>
        <input style={inp(0)} placeholder="Note" value={f.note} onChange={e=>set("note",e.target.value)}/>
      </div>
      <button onClick={addVoucher} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Save voucher</button></Card>
      {vouchers.map(v=><Card key={v.id}><div style={{display:"flex",gap:10,alignItems:"center"}}>
        <div style={{flex:1}}><b>{v.no}</b> <span style={{fontSize:11,color:T.dim}}>· {v.type} · {v.account} · {fmtTs(v.ts)}</span>
          {v.note&&<div style={{fontSize:11,color:T.dim}}>{v.note}</div>}</div>
        <b style={{color:["Receipt","Income"].includes(v.type)?T.ok:T.danger}}>{inr(v.amt)}</b>
        <span style={{fontSize:10,color:T.dim}}>{v.mode}</span></div></Card>)}</>}

    {tab==="ledger"&&<Card>
      <select style={inp()} value={ledgerAcct} onChange={e=>setLedgerAcct(e.target.value)}>
        <option value="">Select account</option>{accts.map(a=><option key={a}>{a}</option>)}</select>
      {ledgerAcct&&txns.filter(t=>t.acct===ledgerAcct).map((t,i)=><Row key={i} t={t}/>)}
      {ledgerAcct&&<div style={{fontWeight:700,marginTop:8,textAlign:"right"}}>Net: {inr(txns.filter(t=>t.acct===ledgerAcct).reduce((a,t)=>a+(t.dir==="in"?t.amt:t.dir==="out"?-t.amt:0),0))}</div>}
    </Card>}

    {tab==="pl"&&<Card>
      <div style={{fontWeight:700,marginBottom:10}}>Profit & Loss</div>
      {[["Revenue (net sales, excl. GST)",revenue],["Less: Cost of goods sold",-cogs],["Gross Profit",gross],
        ["Less: Expenses",-expenses],["Add: Other income",otherInc],["Net Profit",net]].map(([l,v],i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",
          borderBottom:`1px solid ${T.line}`,fontWeight:l.includes("Profit")?800:400,
          color:l.includes("Profit")?(v>=0?T.ok:T.danger):T.text}}>
          <span>{l}</span><span>{inr(Math.abs(v))}{v<0?" (−)":""}</span></div>))}
    </Card>}

    {tab==="bs"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.ok}}>Assets</div>
        {[["Cash in hand",cashBal],["Bank balance",bankBal],["Receivables",receivables],["Stock value (at cost)",stockValue]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0"}}><span style={{color:T.dim}}>{l}</span><span>{inr(v)}</span></div>))}
        <div style={{fontWeight:800,display:"flex",justifyContent:"space-between",borderTop:`1px solid ${T.line}`,paddingTop:6}}><span>Total</span><span>{inr(cashBal+bankBal+receivables+stockValue)}</span></div></Card>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.danger}}>Liabilities & Equity</div>
        {[["Payables",payables],["Retained earnings (net profit)",net]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0"}}><span style={{color:T.dim}}>{l}</span><span>{inr(v)}</span></div>))}
        <div style={{fontWeight:800,display:"flex",justifyContent:"space-between",borderTop:`1px solid ${T.line}`,paddingTop:6}}><span>Total</span><span>{inr(payables+net)}</span></div></Card>
    </div>}

    {tab==="tb"&&<Card><div style={{fontWeight:700,marginBottom:8}}>Trial Balance</div>
      <div style={{display:"flex",fontSize:11,color:T.dim,fontWeight:700,padding:"4px 0"}}><span style={{flex:1}}>Account</span><span style={{width:100,textAlign:"right"}}>Debit</span><span style={{width:100,textAlign:"right"}}>Credit</span></div>
      {[["Cash",Math.max(cashBal,0),Math.max(-cashBal,0)],["Bank",Math.max(bankBal,0),Math.max(-bankBal,0)],
        ["Receivables",receivables,0],["Stock",stockValue,0],["COGS",cogs,0],["Expenses",expenses,0],
        ["Sales",0,revenue],["Other income",0,otherInc],["Payables",0,payables]].map(([l,dr,cr])=>(
        <div key={l} style={{display:"flex",fontSize:13,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{flex:1,color:T.dim}}>{l}</span>
          <span style={{width:100,textAlign:"right"}}>{dr?inr(dr):"—"}</span>
          <span style={{width:100,textAlign:"right"}}>{cr?inr(cr):"—"}</span></div>))}
    </Card>}

    {tab==="cf"&&<Card><div style={{fontWeight:700,marginBottom:8}}>Cash Flow</div>
      {[["Total inflow",txns.filter(t=>t.dir==="in").reduce((a,t)=>a+t.amt,0),T.ok],
        ["Total outflow",txns.filter(t=>t.dir==="out").reduce((a,t)=>a+t.amt,0),T.danger],
        ["Net flow",txns.reduce((a,t)=>a+(t.dir==="in"?t.amt:t.dir==="out"?-t.amt:0),0),T.acc]].map(([l,v,c])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"7px 0",fontWeight:l==="Net flow"?800:400,color:c}}>
          <span>{l}</span><span>{inr(v)}</span></div>))}
    </Card>}
  </div>);
}
const custName=(db,id)=>db.customers.find(c=>c.id===id)?.name||"Walk-in";
const supName=(db,id)=>db.suppliers.find(s=>s.id===id)?.name||"—";

/* ---------- GST & Tax Reports (P7) ---------- */
function GstReports({db,company,flash}){
  const [tab,setTab]=useState("gstr1");
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));

  const gstInvs=db.invoices.filter(i=>i.type==="GST Invoice"&&!i.returned&&new Date(i.ts).toISOString().slice(0,7)===month);
  const allTaxInvs=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&new Date(i.ts).toISOString().slice(0,7)===month);
  const purchases=db.purchases.filter(p=>new Date(p.ts).toISOString().slice(0,7)===month);

  // Rate-wise breakup (outward)
  const rateWise=useMemo(()=>{
    const m={};
    allTaxInvs.forEach(i=>i.items.forEach(it=>{
      const taxable=it.rate*it.qty;
      const r=it.gst||0;
      m[r]=m[r]||{taxable:0,cgst:0,sgst:0};
      m[r].taxable+=taxable;
      m[r].cgst+=taxable*r/200;
      m[r].sgst+=taxable*r/200;
    }));
    return m;
  },[allTaxInvs]);

  const totTaxable=Object.values(rateWise).reduce((a,v)=>a+v.taxable,0);
  const totCgst=Object.values(rateWise).reduce((a,v)=>a+v.cgst,0);
  const totSgst=Object.values(rateWise).reduce((a,v)=>a+v.sgst,0);

  // ITC estimate from purchases (uses product GST rate at time of view)
  const itc=useMemo(()=>{
    let t=0;
    purchases.forEach(p=>p.items.forEach(it=>{
      const prod=db.products.find(x=>x.id===it.pid);
      t+=(it.rate*it.qty)*(prod?.gst||0)/100;
    }));
    return t;
  },[purchases,db.products]);

  // HSN summary
  const hsn=useMemo(()=>{
    const m={};
    allTaxInvs.forEach(i=>i.items.forEach(it=>{
      const k=it.hsn||"—";
      m[k]=m[k]||{qty:0,taxable:0,tax:0,gst:it.gst};
      m[k].qty+=it.qty;
      m[k].taxable+=it.rate*it.qty;
      m[k].tax+=it.rate*it.qty*(it.gst||0)/100;
    }));
    return m;
  },[allTaxInvs]);

  const custName=id=>db.customers.find(c=>c.id===id);

  const exportJson=(name,data)=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`${name}-${month}.json`;a.click();
    flash(`${name} exported — CA-kku anuppalam`);
  };

  const gstr1Data={gstin:company?.gstin||"",period:month,
    b2b:gstInvs.filter(i=>custName(i.customerId)?.gstin).map(i=>({inv:i.no,date:new Date(i.ts).toLocaleDateString("en-IN"),party:custName(i.customerId)?.name,gstin:custName(i.customerId)?.gstin,taxable:i.sub,tax:i.tax,total:i.total})),
    b2c:gstInvs.filter(i=>!custName(i.customerId)?.gstin).map(i=>({inv:i.no,date:new Date(i.ts).toLocaleDateString("en-IN"),taxable:i.sub,tax:i.tax,total:i.total}))};

  const gstr3bData={gstin:company?.gstin||"",period:month,
    outward:{taxable:totTaxable,cgst:totCgst,sgst:totSgst,igst:0},
    itc:{estimated:itc},netPayable:Math.max(0,totCgst+totSgst-itc)};

  const TABS=[["gstr1","GSTR-1"],["gstr3b","GSTR-3B"],["hsn","HSN Summary"],["tax","Tax Summary"]];
  const th={fontSize:11,color:T.dim,fontWeight:700,padding:"4px 0"};
  const td={fontSize:12.5,padding:"5px 0",borderBottom:`1px solid ${T.line}`};

  return(<div>
    <H1>GST Reports</H1>
    <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>)}
      <input type="month" style={{...inp(0),width:150,marginLeft:"auto"}} value={month} onChange={e=>setMonth(e.target.value)}/>
    </div>
    {!company?.gstin&&<Card><div style={{color:T.acc2,fontSize:13}}>⚠ Company GSTIN set pannala — Companies page-la add pannunga. Reports work aagum, but filing-ku GSTIN venum.</div></Card>}

    {tab==="gstr1"&&<>
      <Card>
        <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
          <div style={{fontWeight:700}}>GSTR-1 · Outward supplies · {month}</div>
          <button onClick={()=>exportJson("GSTR1",gstr1Data)} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginLeft:"auto"}}>⬇ Export JSON</button>
        </div>
        <div style={{fontWeight:700,fontSize:13,color:T.acc,margin:"8px 0 4px"}}>B2B ({gstr1Data.b2b.length} invoices)</div>
        <div style={{display:"flex",gap:8}}><span style={{...th,width:90}}>Invoice</span><span style={{...th,flex:1}}>Party / GSTIN</span><span style={{...th,width:90,textAlign:"right"}}>Taxable</span><span style={{...th,width:80,textAlign:"right"}}>Tax</span></div>
        {gstr1Data.b2b.map(r=><div key={r.inv} style={{display:"flex",gap:8}}>
          <span style={{...td,width:90}}>{r.inv}</span><span style={{...td,flex:1,color:T.dim}}>{r.party}<br/><span style={{fontSize:10}}>{r.gstin}</span></span>
          <span style={{...td,width:90,textAlign:"right"}}>{inr(r.taxable)}</span><span style={{...td,width:80,textAlign:"right"}}>{inr(r.tax)}</span></div>)}
        {gstr1Data.b2b.length===0&&<div style={{color:T.dim,fontSize:12}}>No B2B invoices (customer GSTIN missing-na B2C-la varum)</div>}
        <div style={{fontWeight:700,fontSize:13,color:T.acc,margin:"12px 0 4px"}}>B2C ({gstr1Data.b2c.length} invoices)</div>
        {gstr1Data.b2c.map(r=><div key={r.inv} style={{display:"flex",gap:8}}>
          <span style={{...td,width:90}}>{r.inv}</span><span style={{...td,flex:1,color:T.dim}}>{r.date}</span>
          <span style={{...td,width:90,textAlign:"right"}}>{inr(r.taxable)}</span><span style={{...td,width:80,textAlign:"right"}}>{inr(r.tax)}</span></div>)}
        {gstr1Data.b2c.length===0&&<div style={{color:T.dim,fontSize:12}}>No B2C invoices this month</div>}
      </Card>
    </>}

    {tab==="gstr3b"&&<Card>
      <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:700}}>GSTR-3B · Summary · {month}</div>
        <button onClick={()=>exportJson("GSTR3B",gstr3bData)} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginLeft:"auto"}}>⬇ Export JSON</button>
      </div>
      {[["3.1(a) Outward taxable supplies",totTaxable],["CGST",totCgst],["SGST/UTGST",totSgst],["IGST (inter-state — not tracked yet)",0],
        ["4. Eligible ITC (est. from purchases)",itc],["Net tax payable",gstr3bData.netPayable]].map(([l,v])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"7px 0",borderBottom:`1px solid ${T.line}`,
          fontWeight:l.includes("Net")?800:400,color:l.includes("Net")?T.acc2:T.text}}>
          <span>{l}</span><span>{inr(v)}</span></div>))}
      <div style={{fontSize:11,color:T.dim,marginTop:8}}>Note: ITC estimate — actual filing-ku CA verify pannanum. IGST inter-state support Phase later-la varum.</div>
    </Card>}

    {tab==="hsn"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>HSN-wise Summary · {month}</div>
      <div style={{display:"flex",gap:8}}><span style={{...th,width:90}}>HSN</span><span style={{...th,width:60,textAlign:"right"}}>Qty</span><span style={{...th,flex:1,textAlign:"right"}}>Taxable</span><span style={{...th,width:70,textAlign:"right"}}>GST%</span><span style={{...th,width:90,textAlign:"right"}}>Tax</span></div>
      {Object.entries(hsn).map(([k,v])=><div key={k} style={{display:"flex",gap:8}}>
        <span style={{...td,width:90}}>{k}</span><span style={{...td,width:60,textAlign:"right"}}>{v.qty}</span>
        <span style={{...td,flex:1,textAlign:"right"}}>{inr(v.taxable)}</span><span style={{...td,width:70,textAlign:"right"}}>{v.gst}%</span>
        <span style={{...td,width:90,textAlign:"right"}}>{inr(v.tax)}</span></div>)}
      {Object.keys(hsn).length===0&&<div style={{color:T.dim,fontSize:12}}>No invoices this month</div>}
    </Card>}

    {tab==="tax"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>Rate-wise Tax Summary · {month}</div>
      <div style={{display:"flex",gap:8}}><span style={{...th,width:70}}>Rate</span><span style={{...th,flex:1,textAlign:"right"}}>Taxable</span><span style={{...th,width:90,textAlign:"right"}}>CGST</span><span style={{...th,width:90,textAlign:"right"}}>SGST</span></div>
      {Object.entries(rateWise).map(([r,v])=><div key={r} style={{display:"flex",gap:8}}>
        <span style={{...td,width:70}}>{r}%</span><span style={{...td,flex:1,textAlign:"right"}}>{inr(v.taxable)}</span>
        <span style={{...td,width:90,textAlign:"right"}}>{inr(v.cgst)}</span><span style={{...td,width:90,textAlign:"right"}}>{inr(v.sgst)}</span></div>)}
      <div style={{display:"flex",gap:8,fontWeight:800,marginTop:4}}>
        <span style={{width:70}}>Total</span><span style={{flex:1,textAlign:"right"}}>{inr(totTaxable)}</span>
        <span style={{width:90,textAlign:"right",color:T.acc}}>{inr(totCgst)}</span><span style={{width:90,textAlign:"right",color:T.acc}}>{inr(totSgst)}</span></div>
    </Card>}
  </div>);
}

/* ---------- CRM (P8) ---------- */
function Crm({db,save,log,flash}){
  const [tab,setTab]=useState("credit");
  const [selCust,setSelCust]=useState("");
  const [fu,setFu]=useState({customerId:"",note:"",due:""});

  const custInvs=id=>db.invoices.filter(i=>i.customerId===id&&!i.returned);
  const due=id=>custInvs(id).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  const spent=id=>custInvs(id).filter(i=>i.type.includes("Invoice")).reduce((a,i)=>a+i.total,0);
  const points=id=>Math.floor(spent(id)/100); // 1 point per ₹100

  const waRemind=c=>{
    const amt=due(c.id);
    return `https://wa.me/91${(c.phone||"").replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(`Vanakkam ${c.name},\nUngal pending balance: ${inr(amt)}.\nPayment seekiram settle panna request. Nandri! 🙏\n— BillDNA`)}`;
  };

  const addFu=()=>{
    if(!fu.customerId||!fu.note.trim())return flash("Customer & note required");
    const d=structuredClone(db);d.followups=d.followups||[];
    d.followups.unshift({id:uid(),ts:Date.now(),...fu,note:fu.note.trim(),done:false});
    log(d,`Follow-up added: ${d.customers.find(c=>c.id===fu.customerId)?.name}`);
    save(d);setFu({customerId:"",note:"",due:""});flash("Follow-up saved");
  };
  const toggleFu=id=>{const d=structuredClone(db);
    const f=d.followups.find(x=>x.id===id);f.done=!f.done;save(d);};

  const debtors=db.customers.filter(c=>due(c.id)>0).sort((a,b)=>due(b.id)-due(a.id));
  const followups=(db.followups||[]).sort((a,b)=>(a.done-b.done)||(Date.parse(a.due||"2099")-Date.parse(b.due||"2099")));
  const cName=id=>db.customers.find(c=>c.id===id)?.name||"—";
  const overdue=f=>!f.done&&f.due&&Date.parse(f.due)<Date.now();

  const TABS=[["credit","Credit & Reminders"],["history","Customer History"],["followup","Follow-ups"],["loyalty","Loyalty"]];
  return(<div>
    <H1>CRM</H1>
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400,fontSize:12.5}}>{l}</button>)}
    </div>

    {tab==="credit"&&<>
      {debtors.length===0&&<Card><div style={{color:T.ok,fontSize:13}}>✓ No pending customer dues. Super!</div></Card>}
      {debtors.map(c=>(
        <Card key={c.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:150}}><b>{c.name}</b>
            <div style={{fontSize:11,color:T.dim}}>{c.phone||"no phone"} · {custInvs(c.id).filter(i=>i.paid<i.total).length} pending bills</div></div>
          <b style={{color:T.acc2}}>{inr(due(c.id))}</b>
          {c.phone&&<a href={waRemind(c)} target="_blank" rel="noreferrer" style={{...btn(T.ok),color:"#08221E",fontWeight:700,textDecoration:"none"}}>📲 Remind</a>}
        </div></Card>))}
    </>}

    {tab==="history"&&<>
      <select style={inp()} value={selCust} onChange={e=>setSelCust(e.target.value)}>
        <option value="">Select customer</option>
        {db.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {selCust&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          <Card><div style={{fontSize:18,fontWeight:800,color:T.acc}}>{inr(spent(selCust))}</div><div style={{fontSize:11,color:T.dim}}>Total business</div></Card>
          <Card><div style={{fontSize:18,fontWeight:800,color:T.acc2}}>{inr(due(selCust))}</div><div style={{fontSize:11,color:T.dim}}>Pending due</div></Card>
          <Card><div style={{fontSize:18,fontWeight:800,color:T.ok}}>{points(selCust)}</div><div style={{fontSize:11,color:T.dim}}>Loyalty points</div></Card>
        </div>
        {custInvs(selCust).map(i=>(
          <Card key={i.id}><div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}><b>{i.no}</b> <span style={{fontSize:11,color:T.dim}}>· {i.type} · {fmtTs(i.ts)} · {i.items.length} items</span></div>
            <b>{inr(i.total)}</b>
            <span style={{fontSize:11,color:i.paid>=i.total?T.ok:T.acc2}}>{i.paid>=i.total?"Paid":`Due ${inr(i.total-i.paid)}`}</span>
          </div></Card>))}
        {custInvs(selCust).length===0&&<div style={{color:T.dim,fontSize:13}}>No bills yet for this customer.</div>}
      </>}
    </>}

    {tab==="followup"&&<>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 130px",gap:8}}>
          <select style={inp(0)} value={fu.customerId} onChange={e=>setFu(s=>({...s,customerId:e.target.value}))}>
            <option value="">Customer *</option>
            {db.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input style={inp(0)} placeholder="Note (e.g. call about new order) *" value={fu.note} onChange={e=>setFu(s=>({...s,note:e.target.value}))}/>
          <input style={inp(0)} type="date" value={fu.due} onChange={e=>setFu(s=>({...s,due:e.target.value}))}/>
        </div>
        <button onClick={addFu} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add follow-up</button>
      </Card>
      {followups.map(f=>(
        <Card key={f.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
          <input type="checkbox" checked={f.done} onChange={()=>toggleFu(f.id)} style={{width:16,height:16,accentColor:T.acc}}/>
          <div style={{flex:1,textDecoration:f.done?"line-through":"none",color:f.done?T.dim:T.text,fontSize:13}}>
            <b>{cName(f.customerId)}</b> — {f.note}
            {f.due&&<span style={{fontSize:11,color:overdue(f)?T.danger:T.dim}}> · due {f.due}{overdue(f)?" ⚠ OVERDUE":""}</span>}
          </div>
        </div></Card>))}
      {followups.length===0&&<div style={{color:T.dim,fontSize:13}}>No follow-ups. Add one above.</div>}
    </>}

    {tab==="loyalty"&&<>
      <Card><div style={{fontSize:12,color:T.dim}}>Rule: ₹100 business = 1 point. Redeem manually (e.g. 100 points = ₹50 off) — discount-ah POS rate-la adjust pannunga.</div></Card>
      {db.customers.map(c=>({c,p:points(c.id)})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p).map(({c,p})=>(
        <Card key={c.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><b>{c.name}</b> <span style={{fontSize:11,color:T.dim}}>· {inr(spent(c.id))} lifetime</span></div>
          <b style={{color:T.acc}}>⭐ {p} pts</b>
        </div></Card>))}
      {db.customers.every(c=>points(c.id)===0)&&<div style={{color:T.dim,fontSize:13}}>No loyalty points yet — billing start aanadhum points accumulate aagum.</div>}
    </>}
  </div>);
}

/* ---------- Reports (P9) ---------- */
function Reports({db}){
  const [tab,setTab]=useState("sales");
  const [days,setDays]=useState(30);
  const cutoff=Date.now()-days*86400000;
  const invs=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&i.ts>=cutoff);

  // Daily sales
  const daily=useMemo(()=>{
    const m={};
    invs.forEach(i=>{const k=new Date(i.ts).toLocaleDateString("en-IN");m[k]=(m[k]||0)+i.total;});
    return Object.entries(m).slice(0,31);
  },[invs]);

  // Product-wise sales + profit
  const prodStats=useMemo(()=>{
    const m={};
    invs.forEach(i=>i.items.forEach(it=>{
      const p=db.products.find(x=>x.id===it.pid);
      m[it.pid]=m[it.pid]||{name:it.name,qty:0,revenue:0,profit:0,lastSold:0};
      m[it.pid].qty+=it.qty;
      m[it.pid].revenue+=it.rate*it.qty;
      m[it.pid].profit+=(it.rate-(p?.cost||0))*it.qty;
      m[it.pid].lastSold=Math.max(m[it.pid].lastSold,i.ts);
    }));
    return Object.entries(m).map(([pid,v])=>({pid,...v}));
  },[invs,db.products]);

  const byQty=[...prodStats].sort((a,b)=>b.qty-a.qty);
  const fast=byQty.slice(0,10);
  const slow=byQty.filter(p=>p.qty>0).slice(-10).reverse();
  const soldPids=new Set(prodStats.map(p=>p.pid));
  const dead=db.products.filter(p=>!soldPids.has(p.id)&&totalStock(p)>0);

  // ABC analysis (by revenue: A=70%, B=next 20%, C=rest)
  const abc=useMemo(()=>{
    const sorted=[...prodStats].sort((a,b)=>b.revenue-a.revenue);
    const tot=sorted.reduce((a,p)=>a+p.revenue,0)||1;
    let cum=0;
    return sorted.map(p=>{cum+=p.revenue;const pct=cum/tot;
      return {...p,cls:pct<=0.7?"A":pct<=0.9?"B":"C"};});
  },[prodStats]);

  // Outstanding
  const custDue=db.customers.map(c=>({name:c.name,
    due:db.invoices.filter(i=>i.customerId===c.id&&!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0)}))
    .filter(x=>x.due>0).sort((a,b)=>b.due-a.due);
  const supDue=db.suppliers.map(s=>({name:s.name,
    due:db.purchases.filter(p=>p.supplierId===s.id).reduce((a,p)=>a+Math.max(0,p.total-p.paid),0)}))
    .filter(x=>x.due>0).sort((a,b)=>b.due-a.due);

  // Expense summary
  const expByAcct=useMemo(()=>{
    const m={};
    (db.vouchers||[]).filter(v=>["Expense","Payment"].includes(v.type)&&v.ts>=cutoff)
      .forEach(v=>{m[v.account]=(m[v.account]||0)+v.amt;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[db.vouchers,cutoff]);

  const totRev=invs.reduce((a,i)=>a+i.total,0);
  const totProfit=prodStats.reduce((a,p)=>a+p.profit,0);
  const totExp=expByAcct.reduce((a,[,v])=>a+v,0);

  const TABS=[["sales","Sales"],["products","Product Sales"],["fastslow","Fast / Slow"],["dead","Dead Stock"],["abc","ABC"],["outstanding","Outstanding"],["expense","Expenses"],["profit","Profit"]];
  const Bar=({label,val,max,color=T.acc})=>(
    <div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.dim}}>{label}</span><b>{inr(val)}</b></div>
      <div style={{background:T.panel2,borderRadius:4,height:8}}><div style={{background:color,width:`${Math.min(100,val/max*100)}%`,height:8,borderRadius:4}}/></div>
    </div>);

  return(<div>
    <H1>Reports</H1>
    <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400,fontSize:12}}>{l}</button>)}
      <select style={{...inp(0),width:110,marginLeft:"auto"}} value={days} onChange={e=>setDays(+e.target.value)}>
        {[[7,"7 days"],[30,"30 days"],[90,"90 days"],[365,"1 year"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>

    {tab==="sales"&&<Card>
      <div style={{fontWeight:700,marginBottom:4}}>Daily sales · last {days} days · Total: <span style={{color:T.acc}}>{inr(totRev)}</span> · {invs.length} bills</div>
      {daily.map(([d,v])=><Bar key={d} label={d} val={v} max={Math.max(...daily.map(x=>x[1]),1)}/>)}
      {daily.length===0&&<div style={{color:T.dim,fontSize:13}}>No sales in this period.</div>}
    </Card>}

    {tab==="products"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>Product-wise sales</div>
      {byQty.map(p=><div key={p.pid} style={{display:"flex",gap:8,fontSize:12.5,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
        <span style={{flex:1}}>{p.name}</span><span style={{width:60,textAlign:"right",color:T.dim}}>{p.qty} sold</span>
        <span style={{width:90,textAlign:"right"}}>{inr(p.revenue)}</span>
        <span style={{width:90,textAlign:"right",color:p.profit>=0?T.ok:T.danger}}>{inr(p.profit)}</span></div>)}
      {byQty.length===0&&<div style={{color:T.dim,fontSize:13}}>No sales yet.</div>}
    </Card>}

    {tab==="fastslow"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.ok}}>🔥 Fast moving (top 10)</div>
        {fast.map(p=><div key={p.pid} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{p.name}</span><b>{p.qty}</b></div>)}
        {fast.length===0&&<div style={{color:T.dim,fontSize:12}}>—</div>}</Card>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.acc2}}>🐢 Slow moving (bottom 10)</div>
        {slow.map(p=><div key={p.pid} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{p.name}</span><b>{p.qty}</b></div>)}
        {slow.length===0&&<div style={{color:T.dim,fontSize:12}}>—</div>}</Card>
    </div>}

    {tab==="dead"&&<Card>
      <div style={{fontWeight:700,marginBottom:8,color:T.danger}}>💀 Dead stock (stock irukku, {days} days-la oru sale-um illa)</div>
      {dead.map(p=><div key={p.id} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}>
        <span style={{flex:1}}>{p.name}</span><span style={{color:T.dim}}>{totalStock(p)} {p.unit} · value {inr(totalStock(p)*(p.cost||0))}</span></div>)}
      {dead.length===0&&<div style={{color:T.ok,fontSize:13}}>✓ No dead stock. Super!</div>}
    </Card>}

    {tab==="abc"&&<Card>
      <div style={{fontWeight:700,marginBottom:4}}>ABC Analysis (revenue-wise)</div>
      <div style={{fontSize:11,color:T.dim,marginBottom:8}}>A = top 70% revenue (focus items) · B = next 20% · C = last 10%</div>
      {abc.map(p=><div key={p.pid} style={{display:"flex",gap:8,fontSize:12.5,padding:"4px 0",borderBottom:`1px solid ${T.line}`}}>
        <b style={{width:24,color:p.cls==="A"?T.ok:p.cls==="B"?T.acc2:T.dim}}>{p.cls}</b>
        <span style={{flex:1}}>{p.name}</span><span>{inr(p.revenue)}</span></div>)}
      {abc.length===0&&<div style={{color:T.dim,fontSize:13}}>No sales data.</div>}
    </Card>}

    {tab==="outstanding"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.acc2}}>Receivables (customers)</div>
        {custDue.map(c=><div key={c.name} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{c.name}</span><b>{inr(c.due)}</b></div>)}
        {custDue.length===0&&<div style={{color:T.ok,fontSize:12}}>✓ Nil</div>}</Card>
      <Card><div style={{fontWeight:700,marginBottom:8,color:T.danger}}>Payables (suppliers)</div>
        {supDue.map(s=><div key={s.name} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{s.name}</span><b>{inr(s.due)}</b></div>)}
        {supDue.length===0&&<div style={{color:T.ok,fontSize:12}}>✓ Nil</div>}</Card>
    </div>}

    {tab==="expense"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>Expenses · last {days} days · Total: <span style={{color:T.danger}}>{inr(totExp)}</span></div>
      {expByAcct.map(([a,v])=><Bar key={a} label={a} val={v} max={Math.max(...expByAcct.map(x=>x[1]),1)} color={T.danger}/>)}
      {expByAcct.length===0&&<div style={{color:T.dim,fontSize:13}}>No expenses recorded (Accounting → Vouchers-la add pannunga).</div>}
    </Card>}

    {tab==="profit"&&<Card>
      <div style={{fontWeight:700,marginBottom:10}}>Profit summary · last {days} days</div>
      {[["Revenue (incl. GST)",totRev,T.text],["Gross profit (sales − cost)",totProfit,T.ok],
        ["Expenses",-totExp,T.danger],["Net (gross − expenses)",totProfit-totExp,totProfit-totExp>=0?T.ok:T.danger]].map(([l,v,c])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"7px 0",fontWeight:l.includes("Net")?800:400,color:c,borderBottom:`1px solid ${T.line}`}}>
          <span>{l}</span><span>{inr(Math.abs(v))}{v<0?" (−)":""}</span></div>))}
      <div style={{fontSize:11,color:T.dim,marginTop:8}}>Note: Gross profit product cost basis-la — cost update pannala-na 0 cost assume aagum.</div>
    </Card>}
  </div>);
}

/* ---------- Manufacturing (P10) ---------- */
function Manufacturing({db,save,log,notify,flash}){
  const [tab,setTab]=useState("bom");
  // BOM builder
  const [bomFor,setBomFor]=useState("");const [bomItems,setBomItems]=useState([]);const [bomLabor,setBomLabor]=useState("");
  const [rmPid,setRmPid]=useState("");const [rmQty,setRmQty]=useState("");
  // Production
  const [prodBomId,setProdBomId]=useState("");const [prodQty,setProdQty]=useState("");const [scrapQty,setScrapQty]=useState("");

  const boms=db.boms||[];
  const runs=db.productionRuns||[];
  const pName=id=>db.products.find(p=>p.id===id)?.name||"—";
  const pCost=id=>db.products.find(p=>p.id===id)?.cost||0;

  const addRm=()=>{
    if(!rmPid||!+rmQty)return flash("Raw material & qty required");
    setBomItems(c=>{const ex=c.find(i=>i.pid===rmPid);
      return ex?c.map(i=>i.pid===rmPid?{...i,qty:+rmQty}:i):[...c,{pid:rmPid,qty:+rmQty}];});
    setRmPid("");setRmQty("");
  };

  const bomCost=items=>items.reduce((a,i)=>a+pCost(i.pid)*i.qty,0);

  const saveBom=()=>{
    if(!bomFor||bomItems.length===0)return flash("Finished product & raw materials required");
    const d=structuredClone(db);d.boms=d.boms||[];
    if(d.boms.some(b=>b.productId===bomFor))return flash("BOM already exists for this product");
    d.boms.push({id:uid(),productId:bomFor,items:bomItems,labor:+bomLabor||0});
    log(d,`BOM created: ${pName(bomFor)}`);
    save(d);setBomFor("");setBomItems([]);setBomLabor("");flash("BOM saved");
  };
  const delBom=id=>{const d=structuredClone(db);
    d.boms=d.boms.filter(b=>b.id!==id);log(d,"BOM deleted");save(d);};

  const produce=()=>{
    const bom=boms.find(b=>b.id===prodBomId);
    if(!bom||!+prodQty)return flash("BOM & qty required");
    const qty=+prodQty, scrap=+scrapQty||0;
    const d=structuredClone(db);
    // check raw stock
    for(const i of bom.items){
      const p=d.products.find(x=>x.id===i.pid);
      if(!p||totalStock(p)<i.qty*qty)return flash(`Raw material pathala: ${pName(i.pid)} (need ${i.qty*qty}, have ${p?totalStock(p):0})`);
    }
    // consume raw
    bom.items.forEach(i=>{
      const p=d.products.find(x=>x.id===i.pid);
      const wh=Object.keys(p.stock)[0]||"default";
      p.stock[wh]=(p.stock[wh]||0)-i.qty*qty;
      d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:i.pid,wh,qty:-i.qty*qty,type:"Production consume",ref:"MFG"});
    });
    // add finished (net of scrap)
    const fp=d.products.find(x=>x.id===bom.productId);
    const goodQty=Math.max(0,qty-scrap);
    const wh=Object.keys(fp.stock)[0]||"default";
    fp.stock[wh]=(fp.stock[wh]||0)+goodQty;
    d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:fp.id,wh,qty:goodQty,type:"Production output",ref:"MFG"});
    // costing: (raw cost + labor) per unit produced spread over good units
    const totalCost=(bomCost(bom.items)+bom.labor)*qty;
    const unitCost=goodQty>0?totalCost/goodQty:0;
    fp.cost=Math.round(unitCost*100)/100;
    d.productionRuns=d.productionRuns||[];
    d.productionRuns.unshift({id:uid(),ts:Date.now(),bomId:bom.id,productId:bom.productId,qty,scrap,goodQty,totalCost,unitCost:fp.cost});
    log(d,`Production: ${pName(bom.productId)} ×${goodQty} (scrap ${scrap}) @ ${inr(fp.cost)}/unit`);
    if(scrap>0)notify(d,`Scrap alert: ${scrap} units in ${pName(bom.productId)} production`);
    save(d);setProdQty("");setScrapQty("");flash(`Produced ${goodQty} units · cost ${inr(fp.cost)}/unit`);
  };

  const TABS=[["bom","BOM"],["produce","Production"],["runs","History & Costing"]];
  return(<div>
    <H1>Manufacturing</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>)}
    </div>

    {tab==="bom"&&<>
      <Card>
        <div style={{fontWeight:700,marginBottom:8}}>New BOM (Bill of Materials)</div>
        <select style={inp()} value={bomFor} onChange={e=>setBomFor(e.target.value)}>
          <option value="">Finished product *</option>
          {db.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8}}>
          <select style={inp(0)} value={rmPid} onChange={e=>setRmPid(e.target.value)}>
            <option value="">Raw material</option>
            {db.products.filter(p=>p.id!==bomFor).map(p=><option key={p.id} value={p.id}>{p.name} (cost {inr(p.cost)})</option>)}
          </select>
          <input style={inp(0)} type="number" placeholder="Qty per unit" value={rmQty} onChange={e=>setRmQty(e.target.value)}/>
          <button onClick={addRm} style={{...btn(T.panel2)}}>+ Add</button>
        </div>
        {bomItems.map(i=><div key={i.pid} style={{fontSize:12.5,padding:"4px 0",display:"flex",gap:8}}>
          <span style={{flex:1}}>{pName(i.pid)}</span><span>×{i.qty}</span><span style={{color:T.dim}}>{inr(pCost(i.pid)*i.qty)}</span>
          <button onClick={()=>setBomItems(c=>c.filter(x=>x.pid!==i.pid))} style={{...btn(T.panel2),color:T.danger,padding:"2px 8px"}}>✕</button></div>)}
        <input style={inp()} type="number" placeholder="Labor/overhead cost per unit ₹" value={bomLabor} onChange={e=>setBomLabor(e.target.value)}/>
        {bomItems.length>0&&<div style={{fontSize:13,fontWeight:700,color:T.acc,marginBottom:8}}>Est. cost/unit: {inr(bomCost(bomItems)+(+bomLabor||0))}</div>}
        <button onClick={saveBom} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Save BOM</button>
      </Card>
      {boms.map(b=>(
        <Card key={b.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><b>{pName(b.productId)}</b>
            <div style={{fontSize:11,color:T.dim}}>{b.items.map(i=>`${pName(i.pid)} ×${i.qty}`).join(" + ")}{b.labor?` + labor ${inr(b.labor)}`:""}</div></div>
          <span style={{fontSize:12,color:T.acc}}>{inr(bomCost(b.items)+b.labor)}/unit</span>
          <button onClick={()=>delBom(b.id)} style={{...btn(T.panel2),color:T.danger}}>✕</button>
        </div></Card>))}
      {boms.length===0&&<div style={{color:T.dim,fontSize:13}}>No BOMs yet. Raw materials-um finished product-um Products page-la irukanum.</div>}
    </>}

    {tab==="produce"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>Production run</div>
      <select style={inp()} value={prodBomId} onChange={e=>setProdBomId(e.target.value)}>
        <option value="">Select BOM *</option>
        {boms.map(b=><option key={b.id} value={b.id}>{pName(b.productId)}</option>)}
      </select>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input style={inp(0)} type="number" placeholder="Qty to produce *" value={prodQty} onChange={e=>setProdQty(e.target.value)}/>
        <input style={inp(0)} type="number" placeholder="Scrap/reject qty" value={scrapQty} onChange={e=>setScrapQty(e.target.value)}/>
      </div>
      {prodBomId&&+prodQty>0&&(()=>{const b=boms.find(x=>x.id===prodBomId);
        return <div style={{fontSize:12,color:T.dim,margin:"8px 0"}}>
          Raw needed: {b.items.map(i=>`${pName(i.pid)} ×${i.qty*+prodQty}`).join(", ")}<br/>
          Total cost: <b style={{color:T.acc}}>{inr((bomCost(b.items)+b.labor)*+prodQty)}</b></div>;})()}
      <button onClick={produce} style={{...btn(T.acc),color:"#08221E",fontWeight:800,marginTop:6,padding:10}}>▶ Run production</button>
    </Card>}

    {tab==="runs"&&<Card>
      <div style={{fontWeight:700,marginBottom:8}}>Production history</div>
      {runs.map(r=>(
        <div key={r.id} style={{fontSize:12.5,padding:"6px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{color:T.acc}}>{fmtTs(r.ts)}</span> · <b>{pName(r.productId)}</b> · produced {r.goodQty}
          {r.scrap>0&&<span style={{color:T.danger}}> (scrap {r.scrap})</span>} · cost {inr(r.totalCost)} · <b style={{color:T.acc2}}>{inr(r.unitCost)}/unit</b>
        </div>))}
      {runs.length===0&&<div style={{color:T.dim,fontSize:13}}>No production runs yet.</div>}
    </Card>}
  </div>);
}

/* ---------- HR & Payroll (P11) ---------- */
function Hr({db,save,log,flash}){
  const [tab,setTab]=useState("emp");
  const [f,setF]=useState({name:"",phone:"",role:"",salary:""});
  const [attDate,setAttDate]=useState(new Date().toISOString().slice(0,10));
  const [payMonth,setPayMonth]=useState(new Date().toISOString().slice(0,7));
  const [inc,setInc]=useState({});

  const emps=db.employees||[];
  const att=db.attendance||{}; // {"2026-07-19":{empId:"P|A|H"}}
  const payroll=db.payrollRuns||[];

  const addEmp=()=>{
    if(!f.name.trim()||!+f.salary)return flash("Name & monthly salary required");
    const d=structuredClone(db);d.employees=d.employees||[];
    d.employees.push({id:uid(),...f,name:f.name.trim(),salary:+f.salary,active:true});
    log(d,`Employee added: ${f.name}`);save(d);setF({name:"",phone:"",role:"",salary:""});flash("Employee added");
  };
  const toggleEmp=id=>{const d=structuredClone(db);
    const e=d.employees.find(x=>x.id===id);e.active=!e.active;
    log(d,`Employee ${e.active?"activated":"deactivated"}: ${e.name}`);save(d);};

  const mark=(empId,status)=>{
    const d=structuredClone(db);d.attendance=d.attendance||{};
    d.attendance[attDate]=d.attendance[attDate]||{};
    d.attendance[attDate][empId]=status;
    save(d);
  };

  // month stats
  const monthDays=Object.keys(att).filter(k=>k.startsWith(payMonth));
  const stat=empId=>{
    let p=0,a=0,h=0;
    monthDays.forEach(day=>{const s=att[day]?.[empId];
      if(s==="P")p++;else if(s==="A")a++;else if(s==="H")h++;});
    return {p,a,h,payable:p+h*0.5};
  };
  const workingDays=26; // standard
  const calcSalary=(e,incentive)=>{
    const s=stat(e.id);
    const base=e.salary*Math.min(1,s.payable/workingDays);
    return Math.round(base+(+incentive||0));
  };

  const runPayroll=()=>{
    const d=structuredClone(db);
    d.payrollRuns=d.payrollRuns||[];
    if(d.payrollRuns.some(r=>r.month===payMonth))return flash("Payroll already run for this month");
    const rows=(d.employees||[]).filter(e=>e.active).map(e=>{
      const s=stat(e.id);
      const incentive=+inc[e.id]||0;
      return {empId:e.id,name:e.name,base:e.salary,present:s.p,half:s.h,absent:s.a,incentive,net:calcSalary(e,incentive)};
    });
    const total=rows.reduce((a,r)=>a+r.net,0);
    d.payrollRuns.unshift({id:uid(),ts:Date.now(),month:payMonth,rows,total});
    // record as expense voucher
    d.vouchers=d.vouchers||[];
    d.vouchers.unshift({id:uid(),no:`SAL-${payMonth}`,ts:Date.now(),type:"Expense",account:"Salaries",amt:total,mode:"Cash",note:`Payroll ${payMonth}`});
    log(d,`Payroll run ${payMonth} — ${inr(total)}`);
    save(d);setInc({});flash(`Payroll saved · ${inr(total)} (Accounting-la expense auto-entry)`);
  };

  const TABS=[["emp","Employees"],["att","Attendance"],["pay","Payroll"],["hist","History"]];
  return(<div>
    <H1>HR & Payroll</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>)}
    </div>

    {tab==="emp"&&<>
      <Card><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
        <input style={inp(0)} placeholder="Name *" value={f.name} onChange={e=>setF(s=>({...s,name:e.target.value}))}/>
        <input style={inp(0)} placeholder="Phone" value={f.phone} onChange={e=>setF(s=>({...s,phone:e.target.value}))}/>
        <input style={inp(0)} placeholder="Role (e.g. Sales)" value={f.role} onChange={e=>setF(s=>({...s,role:e.target.value}))}/>
        <input style={inp(0)} type="number" placeholder="Monthly salary ₹ *" value={f.salary} onChange={e=>setF(s=>({...s,salary:e.target.value}))}/>
      </div>
      <button onClick={addEmp} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add employee</button></Card>
      {emps.map(e=>(
        <Card key={e.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><b>{e.name}</b> <span style={{fontSize:11,color:T.dim}}>· {e.role||"—"} · {e.phone||"—"}</span></div>
          <span style={{fontSize:12,color:T.acc}}>{inr(e.salary)}/mo</span>
          <span style={{fontSize:11,color:e.active?T.ok:T.danger}}>{e.active?"Active":"Left"}</span>
          <button onClick={()=>toggleEmp(e.id)} style={btn(T.panel2)}>{e.active?"Mark left":"Rejoin"}</button>
        </div></Card>))}
      {emps.length===0&&<div style={{color:T.dim,fontSize:13}}>No employees yet.</div>}
    </>}

    {tab==="att"&&<>
      <input type="date" style={{...inp(),maxWidth:180}} value={attDate} onChange={e=>setAttDate(e.target.value)}/>
      {emps.filter(e=>e.active).map(e=>{
        const cur=att[attDate]?.[e.id];
        return(<Card key={e.id}><div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,fontSize:13}}><b>{e.name}</b></div>
          {[["P","Present",T.ok],["H","Half-day",T.acc2],["A","Absent",T.danger]].map(([s,l,c])=>(
            <button key={s} onClick={()=>mark(e.id,s)}
              style={{...btn(cur===s?c:T.panel2),color:cur===s?"#08221E":T.text,fontWeight:cur===s?800:400}}>{l}</button>))}
        </div></Card>);})}
      {emps.filter(e=>e.active).length===0&&<div style={{color:T.dim,fontSize:13}}>Active employees illa.</div>}
    </>}

    {tab==="pay"&&<>
      <Card>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <div style={{fontWeight:700,flex:1}}>Payroll · {payMonth}</div>
          <input type="month" style={{...inp(0),width:150}} value={payMonth} onChange={e=>setPayMonth(e.target.value)}/>
        </div>
        <div style={{fontSize:11,color:T.dim,marginBottom:8}}>Formula: salary × (present + half×0.5) / {workingDays} working days + incentive. Attendance mark pannala-na 0 varum.</div>
        {emps.filter(e=>e.active).map(e=>{
          const s=stat(e.id);
          return(<div key={e.id} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.line}`,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:120,fontSize:13}}><b>{e.name}</b>
              <div style={{fontSize:10,color:T.dim}}>P:{s.p} H:{s.h} A:{s.a} · base {inr(e.salary)}</div></div>
            <input style={{...inp(0),width:100}} type="number" placeholder="Incentive"
              value={inc[e.id]||""} onChange={ev=>setInc(m=>({...m,[e.id]:ev.target.value}))}/>
            <b style={{width:90,textAlign:"right",color:T.acc}}>{inr(calcSalary(e,inc[e.id]))}</b>
          </div>);})}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,margin:"10px 0",fontSize:15}}>
          <span>Total payout</span>
          <span style={{color:T.acc}}>{inr(emps.filter(e=>e.active).reduce((a,e)=>a+calcSalary(e,inc[e.id]),0))}</span></div>
        <button onClick={runPayroll} style={{...btn(T.acc),color:"#08221E",fontWeight:800,padding:10,width:"100%"}}>💰 Run payroll & save</button>
      </Card>
    </>}

    {tab==="hist"&&<>
      {payroll.map(r=>(
        <Card key={r.id}>
          <div style={{fontWeight:700,marginBottom:6}}>{r.month} · Total {inr(r.total)} <span style={{fontSize:11,color:T.dim}}>· {fmtTs(r.ts)}</span></div>
          {r.rows.map(row=><div key={row.empId} style={{fontSize:12,color:T.dim,display:"flex",padding:"3px 0"}}>
            <span style={{flex:1}}>{row.name} (P:{row.present} H:{row.half} A:{row.absent}{row.incentive?` +inc ${inr(row.incentive)}`:""})</span>
            <b style={{color:T.text}}>{inr(row.net)}</b></div>)}
        </Card>))}
      {payroll.length===0&&<div style={{color:T.dim,fontSize:13}}>No payroll runs yet.</div>}
    </>}
  </div>);
}

/* ---------- UI primitives ---------- */
const H1=({children})=><div style={{fontSize:20,fontWeight:800,marginBottom:12}}>{children}</div>;
const Card=({children})=><div style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:10,padding:14,marginBottom:12}}>{children}</div>;
const btn=bg=>({background:bg,border:"none",borderRadius:8,padding:"8px 12px",color:T.text,cursor:"pointer",fontSize:13});
const inp=(mb=8)=>({background:T.panel2,border:`1px solid ${T.line}`,borderRadius:8,padding:"9px 10px",color:T.text,width:"100%",boxSizing:"border-box",marginBottom:mb,fontSize:13,display:"block"});
