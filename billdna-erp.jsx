import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ============================================================
   BillDNA ERP — Phases 1–5 (integrated)
   P1 Core: Auth, Companies, Branches, Roles, Dashboard, Alerts, Logs, Backup
   P2 Masters: Customers, Suppliers, Products (Category/Brand/Unit/HSN/GST/Barcode), Warehouses
   P3 Billing: GST/Retail Invoice, Estimate, Quotation, POS, Print, WhatsApp share, Sales Return
   P4 Purchase: Purchase Invoice, Supplier Payments, Pending Purchases
   P5 Inventory: Auto stock in/out, Adjustment, Warehouse Transfer, Low-stock alerts
   Storage: window.storage key "billdna_erp_v2" (migrates from v1)
   ============================================================ */

import * as XLSX from "xlsx";
const T = { bg:"#F3F5F9", panel:"#FFFFFF", panel2:"#EEF2F7", line:"#E1E7EF", text:"#1B2437", dim:"#68738B", acc:"#12A990", acc2:"#E8960C", danger:"#D9483B", ok:"#1D9E5F" };
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
  const [view,setView]=useState("home");
  const [toast,setToast]=useState(null);
  const [narrow,setNarrow]=useState(typeof window!=="undefined"&&window.innerWidth<720);
  const [profileOpen,setProfileOpen]=useState(false);
  const toastTimer=useRef(null);
  useEffect(()=>{const on=()=>setNarrow(window.innerWidth<720);window.addEventListener("resize",on);return()=>window.removeEventListener("resize",on);},[]);

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
  const flash=m=>{setToast(m);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),2200);};

  if(!db) return <div style={{background:T.bg,minHeight:"100vh",color:T.dim,display:"grid",placeItems:"center",fontFamily:"system-ui"}}>Loading BillDNA…</div>;
  if(!session) return <Login db={db} onLogin={u=>{const d=structuredClone(db);log(d,`${u.name} logged in`);save(d);setSession(u);}}/>;

  const company=db.companies.find(c=>c.id===db.activeCompanyId);
  const branch=company?.branches.find(b=>b.id===db.activeBranchId);
  const unread=db.notifications.filter(n=>!n.read).length;
  const can=p=>session.role==="Owner"||(ROLE_PRESETS[session.role]||[]).includes(p);
  const lowStock=db.products.filter(p=>totalStock(p)<=(p.low??0)&&p.low>0);

  const showAll=!!db.settings?.showAll;
  const NAV=[
    ["home","🏠 Home",true],
    ["fullsale","📝 Full Sale",can("billing")],
    ["invoices","📄 Invoices",can("billing")],
    ["purchase","📦 Purchase",can("purchase")],
    ["qexp","💸 Expense",can("billing")||can("accounting")],
    ["qsal","👷 Daily Salary",can("billing")||can("settings")],
    ["wa","📲 WhatsApp",can("billing")],
    ["products","🛒 Products",can("masters")],
    ["customers","👥 Customers",can("masters")],
    ["reports","📈 Reports",can("reports")],
    ["gst","🧾 GST Reports",can("accounting")||can("reports")],
    ["companies","🏢 Setup",can("settings")],
    ["backup","💾 Backup",can("settings")],
    ...(showAll?[
      ["pos","🧾 Quick Bill (POS)",can("billing")],
      ["inventory","🏬 Inventory",can("inventory")],
      ["accounting","📒 Accounting",can("accounting")],
      ["crm","🤝 CRM",can("billing")||can("masters")],
      ["mfg","🏭 Manufacturing",can("inventory")],
      ["hr","👷 HR & Payroll",can("users")||can("settings")],
      ["assets","🏗 Assets",can("settings")],
      ["finance","🏦 Finance",can("accounting")],
      ["store","🛍 Online Store",true],
      ["ai","🤖 AI Assistant",can("reports")],
      ["integrations","🔌 Export & Tools",can("settings")],
      ["admin","⚙️ Admin Panel",can("settings")],
      ["suppliers","🚚 Suppliers",can("masters")],
      ["users","🔐 Users & Roles",can("users")],
      ["notifications",`🔔 Alerts${unread?` (${unread})`:""}`,true],
      ["logs","📜 Activity Log",can("settings")],
    ]:[]),
  ];
  const toggleAll=()=>{const d=structuredClone(db);
    d.settings={...d.settings,showAll:!showAll};
    log(d,`All features ${!showAll?"shown":"hidden"}`);save(d);};

  const ctx={db,save,log,notify,flash,session,company,branch,can};

  return(
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:`1px solid ${T.line}`,background:T.panel}}>
        <div style={{fontWeight:800,letterSpacing:1,fontSize:18}}>Bill<span style={{color:T.acc}}>DNA</span></div>
        <div style={{fontSize:12,color:T.dim,flex:1}}>{company?`${company.name}${branch?` · ${branch.name}`:""}`:"No company selected"}</div>
        {lowStock.length>0&&<div style={{fontSize:11,color:T.acc2}}>⚠ {lowStock.length} low stock</div>}
        <button onClick={()=>setProfileOpen(true)} style={{...btn(T.panel2),fontSize:12,color:T.text}}>{company?company.name:"⚙ Setup"} ▾</button>
        <div style={{fontSize:12,color:T.dim}}>{session.name} · {session.role}</div>
        <button onClick={()=>setSession(null)} style={btn(T.panel2)}>Logout</button>
      </div>
      <div style={{display:"flex",flex:1,minHeight:0}}>
        {!narrow&&<div style={{width:200,borderRight:`1px solid ${T.line}`,padding:10,display:"flex",flexDirection:"column",gap:3,background:T.panel,overflowY:"auto"}}>
          {NAV.filter(n=>n[2]).map(([k,label])=>(
            <button key={k} onClick={()=>setView(k)} style={{...btn(view===k?T.acc:"transparent"),color:view===k?"#fff":T.text,textAlign:"left",fontWeight:view===k?700:500,fontSize:12.5}}>{label}</button>
          ))}
          <div style={{marginTop:"auto"}}>
            <button onClick={toggleAll} style={{...btn(T.panel2),width:"100%",fontSize:11,color:T.dim}}>{showAll?"🔒 Simple mode":"🔓 All features"}</button>
            <div style={{fontSize:10,color:T.dim,padding:6}}>v2.0 · light</div>
          </div>
        </div>}
        <div style={{flex:1,overflow:"auto",padding:narrow?"14px 12px 78px":18}}>
          {view==="home"&&<Dashboard {...ctx} lowStock={lowStock} setView={setView}/>}
          {view==="qexp"&&<QuickEntry {...ctx} kind="Expense"/>}
          {view==="qrcpt"&&<QuickEntry {...ctx} kind="Receipt"/>}
          {view==="qsal"&&<QuickEntry {...ctx} kind="Salary"/>}
          {view==="wa"&&<WhatsAppCenter {...ctx}/>}
          {view==="fullsale"&&<FullSale {...ctx}/>}
          {view==="more"&&<MoreGrid nav={NAV} setView={setView} showAll={showAll} toggleAll={toggleAll}/>}
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
          {view==="assets"&&<Assets {...ctx}/>}
          {view==="finance"&&<Finance {...ctx}/>}
          {view==="store"&&<Store {...ctx}/>}
          {view==="ai"&&<Ai {...ctx}/>}
          {view==="integrations"&&<Integrations {...ctx}/>}
          {view==="admin"&&<AdminPanel {...ctx}/>}
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
      {narrow&&<div style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",background:T.panel,borderTop:`1px solid ${T.line}`,zIndex:50}}>
        {[["home","🏠","Home"],["fullsale","🧾","Bill"],["purchase","📦","Purchase"],["reports","📈","Reports"],["more","⋯","More"]].map(([k,ic,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,background:"transparent",border:"none",padding:"8px 0 10px",cursor:"pointer",color:view===k?T.acc:T.dim,fontWeight:view===k?800:500}}>
            <div style={{fontSize:20}}>{ic}</div><div style={{fontSize:10}}>{l}</div>
          </button>))}
      </div>}
      {profileOpen&&<CompanyModal db={db} save={save} log={log} notify={notify} flash={flash} onClose={()=>setProfileOpen(false)}/>}
      {toast&&<div style={{position:"fixed",bottom:narrow?64:20,left:"50%",transform:"translateX(-50%)",background:T.acc,color:"#fff",padding:"8px 18px",borderRadius:8,fontWeight:700,fontSize:13,zIndex:99}}>{toast}</div>}
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
      <div style={{color:T.dim,fontSize:12,marginBottom:18}}>SME ERP · Billing made simple</div>
      <input style={inp()} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input style={inp()} placeholder="PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
      {err&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>{err}</div>}
      <button onClick={go} style={{...btn(T.acc),width:"100%",color:"#08221E",fontWeight:800,padding:10}}>Sign in</button>
    </div></div>);
}

/* ---------- Mini SVG charts (dependency-free) ---------- */
function Donut({data,size=140}){
  const tot=data.reduce((a,d)=>a+d.v,0)||1;const R=size/2,r=R*0.62;let ang=-90;
  const arc=(cx,cy,rad,a0,a1)=>{const p=(a,rr)=>[cx+rr*Math.cos(a*Math.PI/180),cy+rr*Math.sin(a*Math.PI/180)];
    const[x0,y0]=p(a0,rad),[x1,y1]=p(a1,rad);const big=a1-a0>180?1:0;
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${big} 1 ${x1} ${y1}`;};
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    {data.map((d,i)=>{const a0=ang,a1=ang+d.v/tot*360;ang=a1;
      return <path key={i} d={arc(R,R,(R+r)/2,a0,a1-0.5)} stroke={d.c} strokeWidth={R-r} fill="none"/>;})}
    <text x={R} y={R-4} textAnchor="middle" fontSize="11" fill={T.dim}>Total</text>
    <text x={R} y={R+12} textAnchor="middle" fontSize="13" fontWeight="800" fill={T.text}>{inr(tot).length>9?"":inr(tot)}</text>
  </svg>);
}
function HBars({data,color=T.acc,neg=false}){
  const max=Math.max(...data.map(d=>Math.abs(d.v)),1);
  return(<div>{data.map((d,i)=>(
    <div key={i} style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:2}}><span style={{color:T.dim}}>{d.l}</span><b style={{fontSize:11.5}}>{inr(d.v)}</b></div>
      <div style={{background:T.panel2,borderRadius:4,height:9}}><div style={{background:d.c||color,width:`${Math.abs(d.v)/max*100}%`,height:9,borderRadius:4}}/></div>
    </div>))}</div>);
}
function LineChart({actual,forecast,w=520,h=180}){
  const all=[...actual,...forecast];const max=Math.max(...all,1),min=Math.min(...all,0);
  const rng=max-min||1;const n=all.length;const pad=28;
  const X=i=>pad+i*(w-pad*2)/(n-1||1);const Y=v=>h-pad-(v-min)/rng*(h-pad*2);
  const path=arr=>arr.map((v,i)=>`${i?"L":"M"} ${X(i)} ${Y(v)}`).join(" ");
  const fPath=forecast.length?forecast.map((v,i)=>`${i?"L":"M"} ${X(actual.length-1+i)} ${Y(v)}`).join(" "):"";
  return(<svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
    <line x1={pad} y1={Y(0)} x2={w-pad} y2={Y(0)} stroke={T.line}/>
    <path d={path(actual)} stroke={T.acc} strokeWidth="2.5" fill="none"/>
    {forecast.length>0&&<path d={`M ${X(actual.length-1)} ${Y(actual[actual.length-1]||0)} ${fPath}`} stroke={T.acc2} strokeWidth="2.5" strokeDasharray="5 4" fill="none"/>}
    {actual.map((v,i)=><circle key={i} cx={X(i)} cy={Y(v)} r="3" fill={T.acc}/>)}
  </svg>);
}

/* ---------- Dashboard (v2.3 redesign) ---------- */
function Dashboard({db,company,branch,lowStock,setView}){
  const today=new Date();
  const dayKey=d=>d.toLocaleDateString("en-IN");
  const salesInv=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned);
  // KPIs
  const todaySales=salesInv.filter(i=>new Date(i.ts).toDateString()===today.toDateString()).reduce((a,i)=>a+i.total,0);
  const receivables=db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  const payables=db.purchases.reduce((a,p)=>a+Math.max(0,p.total-p.paid),0);
  const cutoff=Date.now()-30*86400000;
  const monthSales=salesInv.filter(i=>i.ts>=cutoff).reduce((a,i)=>a+i.total,0);
  // 7-day actual + 3-day forecast (moving avg)
  const days=[...Array(7)].map((_,i)=>{const d=new Date(today);d.setDate(d.getDate()-(6-i));return d;});
  const actual=days.map(d=>salesInv.filter(i=>new Date(i.ts).toDateString()===d.toDateString()).reduce((a,i)=>a+i.total,0));
  const avg=actual.reduce((a,b)=>a+b,0)/7;
  const forecast=[avg,avg,avg];
  // Inflows / Outflows (last 30d)
  const vch=db.vouchers||[];
  const inflow=[
    {l:"Sales collected",v:salesInv.filter(i=>i.ts>=cutoff).reduce((a,i)=>a+i.paid,0),c:T.ok},
    {l:"Other income",v:vch.filter(v=>["Income","Receipt"].includes(v.type)&&v.ts>=cutoff).reduce((a,v)=>a+v.amt,0),c:"#4CAF7D"},
  ];
  const outflow=[
    {l:"Purchases",v:db.purchases.filter(p=>p.ts>=cutoff).reduce((a,p)=>a+p.paid,0),c:T.danger},
    {l:"Expenses",v:vch.filter(v=>v.type==="Expense"&&!v.account.startsWith("Daily Wage:")&&v.ts>=cutoff).reduce((a,v)=>a+v.amt,0),c:"#E36A5C"},
    {l:"Wages/Salary",v:vch.filter(v=>(v.account.startsWith("Daily Wage:")||v.no?.startsWith("SAL-"))&&v.ts>=cutoff).reduce((a,v)=>a+v.amt,0),c:"#EE8B7F"},
  ].filter(x=>x.v>0);
  // top products donut (30d revenue)
  const pr={};salesInv.filter(i=>i.ts>=cutoff).forEach(i=>i.items.forEach(it=>{pr[it.name]=(pr[it.name]||0)+it.rate*it.qty;}));
  const palette=["#12A990","#0E7AD3","#E8960C","#9B59B6","#E36A5C","#4CAF7D"];
  const donut=Object.entries(pr).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([l,v],i)=>({l,v,c:palette[i%6]}));

  const KPI=({label,val,sub,color,to})=>(
    <button onClick={()=>to&&setView(to)} style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:14,padding:16,textAlign:"left",cursor:to?"pointer":"default",boxShadow:"0 1px 3px rgba(20,30,60,.05)"}}>
      <div style={{fontSize:12,color:T.dim,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:color||T.text}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:T.dim,marginTop:2}}>{sub}</div>}
    </button>);
  const Panel=({title,children,action})=>(
    <div style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:14,padding:16,boxShadow:"0 1px 3px rgba(20,30,60,.05)"}}>
      <div style={{display:"flex",alignItems:"center",marginBottom:10}}><div style={{fontWeight:700,fontSize:14}}>{title}</div>
        {action&&<button onClick={action.fn} style={{marginLeft:"auto",background:"transparent",border:"none",color:T.acc,fontSize:12,cursor:"pointer",fontWeight:600}}>{action.label}</button>}</div>
      {children}</div>);

  return(<div>
    <div style={{display:"flex",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div style={{fontSize:20,fontWeight:800}}>Dashboard</div>
      <div style={{fontSize:12,color:T.dim,marginLeft:"auto"}}>{company?`${company.name}${branch?` · ${branch.name}`:""}`:"No company"}</div>
    </div>
    {!company&&<Card><div style={{color:T.acc2}}>⚠ Setup pending — Setup page-la company create pannunga.</div></Card>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:10,marginBottom:14}}>
      {[["fullsale","📝","Invoice","#0E7AD3"],["qrcpt","🧾","Receipt",T.ok],["qexp","💸","Expense",T.danger],["qsal","👷","Salary",T.acc2],["purchase","📦","Purchase","#5B6BD6"]].map(([k,ic,l,c])=>(
        <button key={k} onClick={()=>setView(k)} style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:14,padding:"14px 6px",cursor:"pointer",boxShadow:"0 1px 3px rgba(20,30,60,.05)"}}>
          <div style={{fontSize:24}}>{ic}</div><div style={{fontSize:12,fontWeight:700,color:c,marginTop:3}}>{l}</div></button>))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:14}}>
      <KPI label="Today's Sales" val={inr(todaySales)} color={T.acc} to="fullsale"/>
      <KPI label="This Month" val={inr(monthSales)} sub="last 30 days" color={T.text}/>
      <KPI label="Receivables" val={inr(receivables)} sub="to collect" color={T.acc2} to="crm"/>
      <KPI label="Payables" val={inr(payables)} sub="to pay" color={T.danger} to="purchase"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:12}}>
      <Panel title="Sales — 7 days + forecast">
        <LineChart actual={actual} forecast={forecast}/>
        <div style={{display:"flex",gap:16,fontSize:11,color:T.dim,marginTop:6}}>
          <span><span style={{color:T.acc}}>●</span> Actual</span><span><span style={{color:T.acc2}}>┄</span> Forecast</span>
          <span style={{marginLeft:"auto"}}>Avg/day: <b style={{color:T.text}}>{inr(Math.round(avg))}</b></span></div>
      </Panel>
      <Panel title="Top Products (30d)">
        {donut.length>0?<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <Donut data={donut}/>
          <div style={{flex:1,minWidth:100}}>{donut.map((d,i)=><div key={i} style={{fontSize:11,display:"flex",alignItems:"center",gap:5,padding:"2px 0"}}>
            <span style={{width:9,height:9,borderRadius:2,background:d.c,display:"inline-block"}}/><span style={{flex:1,color:T.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.l}</span></div>)}</div>
        </div>:<div style={{color:T.dim,fontSize:13}}>No sales yet</div>}
      </Panel>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <Panel title="Inflows (30d)"><HBars data={inflow.filter(x=>x.v>0).length?inflow:[{l:"No inflow",v:0,c:T.dim}]}/></Panel>
      <Panel title="Outflows (30d)"><HBars data={outflow.length?outflow:[{l:"No outflow",v:0,c:T.dim}]}/></Panel>
    </div>
    {lowStock.length>0&&<Panel title="⚠ Low Stock" action={{label:"View all →",fn:()=>setView("products")}}>
      {lowStock.slice(0,6).map(p=><div key={p.id} style={{fontSize:12.5,padding:"4px 0",display:"flex",borderBottom:`1px solid ${T.line}`}}>
        <span style={{flex:1}}>{p.name}</span><b style={{color:T.acc2}}>{totalStock(p)} left</b></div>)}
    </Panel>}
    <div style={{marginTop:12}}><Panel title="Recent activity">
      {db.logs.slice(0,6).map(l=><div key={l.id} style={{fontSize:12,color:T.dim,padding:"4px 0",borderBottom:`1px solid ${T.line}`}}>
        <span style={{color:T.acc}}>{fmtTs(l.ts)}</span> · {l.user} — {l.action}</div>)}
    </Panel></div>
  </div>);
}

/* ---------- Products (P2 Masters) ---------- */
function Products({db,save,log,flash}){
  const empty={name:"",sku:"",barcode:"",category:"",brand:"",unit:"pcs",hsn:"",gst:18,price:"",cost:"",low:5};
  const [f,setF]=useState(empty);const [q,setQ]=useState("");
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const add=()=>{
    if(!f.name.trim()||!(+f.price>0))return flash("Name & valid selling price (>0) required");
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
  const savingRef=useRef(false);

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
    if(savingRef.current)return;
    savingRef.current=true;
    setTimeout(()=>{savingRef.current=false;},0);
    const d=structuredClone(db);
    d.seq.inv++;
    const pfx=d.settings?.invPrefix?d.settings.invPrefix+"-":"";
    const no=`${pfx}${type.split(" ")[0].slice(0,3).toUpperCase()}-${String(d.seq.inv).padStart(4,"0")}`;
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
    const waCust=d.customers.find(c=>c.id===custId);
    if(waCust?.phone&&(d.settings?.waAuto?.invoice!==false)){
      d.waQueue=d.waQueue||[];
      d.waQueue.unshift({id:uid(),key:`inv-${no}`,ts:Date.now(),type:"Invoice",phone:waCust.phone,name:waCust.name,
        text:`*${d.companies.find(c=>c.id===d.activeCompanyId)?.name||"Bill"}*\n${type} ${no}\nTotal: ${inr(total)}${paid<total?`\nBalance: ${inr(total-paid)}`:"\nPaid ✓"}\nNandri! 🙏`,sent:false});
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
    const tc=d.customers.find(c=>c.id===i.customerId);
    if(tc?.phone&&(d.settings?.waAuto?.thanks!==false)){
      d.waQueue=d.waQueue||[];
      d.waQueue.unshift({id:uid(),key:`thx-${i.no}`,ts:Date.now(),type:"Thanks",phone:tc.phone,name:tc.name,
        text:`Payment received ✓\n${i.no} — ${inr(i.total)}\nThank you ${tc.name}! 🙏\n— ${d.companies.find(c=>c.id===d.activeCompanyId)?.name||""}`,sent:false});
    }
    log(d,`Payment received: ${i.no}`);save(d);flash("Marked paid");};
  const doReturn=(id)=>{const d=structuredClone(db);const i=d.invoices.find(x=>x.id===id);
    if(i.returned)return flash("Already returned");
    i.returned=true;
    i.items.forEach(it=>{const p=d.products.find(x=>x.id===it.pid);if(!p)return;
      const wh=Object.keys(p.stock)[0]||"default";p.stock[wh]=(p.stock[wh]||0)+it.qty;
      d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:it.pid,wh,qty:it.qty,type:"Sales Return",ref:i.no});});
    log(d,`Sales return: ${i.no}`);save(d);flash("Return processed, stock restored");};
  const custName=id=>db.customers.find(c=>c.id===id)?.name||"Walk-in";
  const exportXls=()=>xls([["No","Type","Date","Customer","Subtotal","Tax","Total","Paid","Mode"],
    ...list.map(i=>[i.no,i.type,new Date(i.ts).toLocaleDateString("en-IN"),custName(i.customerId),i.sub,i.tax,i.total,i.paid,i.payMode])],"invoices.xlsx");
  return(<div>
    <div style={{display:"flex",alignItems:"center",gap:8}}><H1>Invoices</H1>
      <button onClick={exportXls} style={{...btn(T.acc),color:"#fff",fontWeight:700,marginLeft:"auto"}}>⬇ Excel</button>
      <button onClick={()=>window.print()} style={btn(T.panel2)}>🖨 PDF</button></div>
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
    const c={id:uid(),name:name.trim(),gstin:gstin.trim().toUpperCase(),city:city.trim(),email:"",phone:"",address:"",state:"",branches:[{id:uid(),name:"Main Branch",city:city.trim()}]};
    d.companies.push(c);
    if(!d.activeCompanyId){d.activeCompanyId=c.id;d.activeBranchId=c.branches[0].id;}
    log(d,`Company created: ${c.name}`);notify(d,`Company "${c.name}" created (${c.scheme==="composite"?"Composition "+c.compRate+"%":"Regular GST"})`);
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
  const isComp=company?.scheme==="composite";
  const compRate=company?.compRate||1;
  const [tab,setTab]=useState("gstr1");
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));

  const gstInvs=db.invoices.filter(i=>i.type==="GST Invoice"&&!i.returned&&new Date(i.ts).toISOString().slice(0,7)===month);
  const allTaxInvs=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&new Date(i.ts).toISOString().slice(0,7)===month);
  const purchases=db.purchases.filter(p=>new Date(p.ts).toISOString().slice(0,7)===month);

  // Rate-wise breakup (outward)
  const rateWise=useMemo(()=>{
    const m={};
    allTaxInvs.filter(i=>!i.igst).forEach(i=>i.items.forEach(it=>{
      const taxable=it.rate*it.qty;
      const r=it.gst||0;
      m[r]=m[r]||{taxable:0,cgst:0,sgst:0};
      m[r].taxable+=taxable;
      m[r].cgst+=taxable*r/200;
      m[r].sgst+=taxable*r/200;
    }));
    return m;
  },[allTaxInvs]);

  const igstAgg=useMemo(()=>{let taxable=0,tax=0;
    allTaxInvs.filter(i=>i.igst).forEach(i=>{taxable+=i.sub;tax+=i.tax;});
    return{taxable,tax};},[allTaxInvs]);
  const totTaxable=Object.values(rateWise).reduce((a,v)=>a+v.taxable,0)+igstAgg.taxable;
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
    outward:{taxable:totTaxable,cgst:totCgst,sgst:totSgst,igst:igstAgg.tax},
    itc:{estimated:itc},netPayable:Math.max(0,totCgst+totSgst+igstAgg.tax-itc)};

  const TABS=[["gstr1","GSTR-1"],["gstr3b","GSTR-3B"],["hsn","HSN Summary"],["tax","Tax Summary"]];
  const th={fontSize:11,color:T.dim,fontWeight:700,padding:"4px 0"};
  const td={fontSize:12.5,padding:"5px 0",borderBottom:`1px solid ${T.line}`};

  const compTurnover=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&new Date(i.ts).toISOString().slice(0,7)===month)
    .reduce((a,i)=>a+(i.sub||i.total),0);
  const compTax=Math.round(compTurnover*compRate/100*100)/100;
  const cmpExport=()=>{const b=new Blob([JSON.stringify({gstin:company?.gstin||"",period:month,scheme:"composition",rate:compRate+"%",turnover:compTurnover,taxPayable:compTax},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`CMP08-${month}.json`;a.click();flash("CMP-08 exported");};
  if(isComp)return(<div>
    <H1>GST Reports · Composition</H1>
    <Card><div style={{fontSize:13,color:T.acc2,marginBottom:4}}>⚠ Composition scheme ({compRate}%) — GSTR-1/3B apply aagathu. Quarterly CMP-08 + annual GSTR-4 dhaan.</div></Card>
    <div style={{display:"flex",gap:8,margin:"12px 0",alignItems:"center"}}>
      <div style={{fontWeight:700}}>CMP-08 Summary</div>
      <input type="month" style={{...inp(0),width:150,marginLeft:"auto"}} value={month} onChange={e=>setMonth(e.target.value)}/>
      <button onClick={cmpExport} style={{...btn(T.acc),color:"#fff",fontWeight:700}}>⬇ Export</button>
      <button onClick={()=>window.print()} style={btn(T.panel2)}>🖨 PDF</button>
    </div>
    <Card>
      {[["Total turnover (outward supplies)",inr(compTurnover)],["Composition rate",compRate+"%"],["Tax payable (CMP-08)",inr(compTax)]].map(([l,v])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"8px 0",borderBottom:`1px solid ${T.line}`,fontWeight:l.includes("payable")?800:400,color:l.includes("payable")?T.acc2:T.text}}>
          <span>{l}</span><span>{v}</span></div>))}
      <div style={{fontSize:11,color:T.dim,marginTop:8}}>Note: composition dealer tax vasool panna mudiyathu; idhu ungal own liability. Bills = Bill of Supply. CA verify pannuvaanga.</div>
    </Card>
  </div>);
    return(<div>
    <H1>GST Reports</H1>
    <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>)}
      <input type="month" style={{...inp(0),width:150,marginLeft:"auto"}} value={month} onChange={e=>setMonth(e.target.value)}/>
      <button onClick={()=>xls([["Rate %","Taxable","CGST","SGST"],...Object.entries(rateWise).map(([r,v])=>[r,v.taxable,v.cgst,v.sgst]),[],["HSN","Qty","Taxable","GST %","Tax"],...Object.entries(hsn).map(([k,v])=>[k,v.qty,v.taxable,v.gst,v.tax])],`gst-${month}.xlsx`)} style={{...btn(T.acc),color:"#fff",fontWeight:700}}>⬇ Excel</button>
      <button onClick={()=>window.print()} style={btn(T.panel2)}>🖨 PDF</button>
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
      {[["3.1(a) Outward taxable supplies",totTaxable],["CGST",totCgst],["SGST/UTGST",totSgst],["IGST (inter-state)",igstAgg.tax],
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

/* ---------- Reports (v2.3: engine + Tier-1) ---------- */
function Reports({db}){
  const [tab,setTab]=useState("daybook");
  const iso=d=>new Date(d).toISOString().slice(0,10);
  const [from,setFrom]=useState(iso(Date.now()-30*86400000));
  const [to,setTo]=useState(iso(Date.now()));
  const [party,setParty]=useState("");
  const inRange=ts=>{const d=iso(ts);return d>=from&&d<=to;};

  const salesInv=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned);
  const custName=id=>db.customers.find(c=>c.id===id)?.name||"Walk-in";
  const supName=id=>db.suppliers.find(s=>s.id===id)?.name||"—";
  const pCost=id=>db.products.find(p=>p.id===id)?.cost||0;
  const vch=db.vouchers||[];

  // ===== unified txn stream for Day Book / All Transactions / Bank =====
  const stream=useMemo(()=>{
    const t=[];
    db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned).forEach(i=>t.push({ts:i.ts,ref:i.no,party:custName(i.customerId),desc:"Sale",inAmt:i.paid,outAmt:0,mode:i.payMode,cat:"Sale"}));
    db.purchases.forEach(p=>t.push({ts:p.ts,ref:p.no,party:supName(p.supplierId),desc:"Purchase",inAmt:0,outAmt:p.paid,mode:"Cash",cat:"Purchase"}));
    vch.forEach(v=>{const isIn=["Receipt","Income"].includes(v.type);
      t.push({ts:v.ts,ref:v.no,party:v.account,desc:v.type,inAmt:isIn?v.amt:0,outAmt:isIn?0:v.amt,mode:v.mode,cat:v.type});});
    return t.sort((a,b)=>b.ts-a.ts);
  },[db]);
  const streamF=stream.filter(x=>inRange(x.ts));

  const exportXls=(rows,name)=>xls(rows,`${name}-${from}_${to}.xlsx`);

  // ===== Party Statement (running balance) =====
  const partyTxns=useMemo(()=>{
    if(!party)return[];
    const rows=[];
    db.invoices.filter(i=>i.customerId===party&&!i.returned).forEach(i=>{
      rows.push({ts:i.ts,ref:i.no,desc:i.type,debit:i.total,credit:0});
      if(i.paid>0)rows.push({ts:i.ts+1,ref:i.no,desc:"Payment recv",debit:0,credit:i.paid});
    });
    return rows.filter(r=>inRange(r.ts)).sort((a,b)=>a.ts-b.ts);
  },[party,from,to,db]);
  let run=0;

  // ===== Bill-wise Profit =====
  const billProfit=salesInv.filter(i=>inRange(i.ts)).map(i=>{
    const cost=i.items.reduce((a,it)=>a+pCost(it.pid)*it.qty,0);
    return{no:i.no,ts:i.ts,party:custName(i.customerId),sale:i.sub,cost,profit:i.sub-cost};
  });

  // ===== Stock Summary (value) =====
  const stockRows=db.products.map(p=>({name:p.name,qty:totalStock(p),cost:p.cost||0,val:totalStock(p)*(p.cost||0),price:p.price}));

  // ===== Bank Statement (bank/UPI/card modes, running) =====
  const bankTx=streamF.filter(x=>["UPI","Card","Bank","Cheque"].includes(x.mode)).sort((a,b)=>a.ts-b.ts);
  let bankRun=0;

  const TABS=[["daybook","Day Book"],["party","Party Statement"],["alltxn","All Transactions"],["billprofit","Bill-wise Profit"],["stock","Stock Summary"],["bank","Bank Statement"],["sales","Sales Trend"],["products","Product Sales"],["fastslow","Fast/Slow"],["dead","Dead Stock"],["abc","ABC"],["outstanding","Outstanding"],["profit","Profit"]];
  const th={fontSize:10.5,color:T.dim,fontWeight:700,padding:"5px 4px",textAlign:"left"};
  const td={fontSize:12,padding:"5px 4px",borderBottom:`1px solid ${T.line}`};
  const Money=({v,c})=>+v?<span style={{color:c}}>{inr(v)}</span>:<span style={{color:T.dim}}>—</span>;

  // for analytics tabs (reuse range)
  const invsR=salesInv.filter(i=>inRange(i.ts));
  const prodStats=useMemo(()=>{const m={};
    invsR.forEach(i=>i.items.forEach(it=>{const p=db.products.find(x=>x.id===it.pid);
      m[it.pid]=m[it.pid]||{name:it.name,qty:0,revenue:0,profit:0};
      m[it.pid].qty+=it.qty;m[it.pid].revenue+=it.rate*it.qty;m[it.pid].profit+=(it.rate-(p?.cost||0))*it.qty;}));
    return Object.values(m);},[from,to,db]);
  const byQty=[...prodStats].sort((a,b)=>b.qty-a.qty);
  const soldNames=new Set(prodStats.map(p=>p.name));
  const dead=db.products.filter(p=>!soldNames.has(p.name)&&totalStock(p)>0);
  const abc=(()=>{const sorted=[...prodStats].sort((a,b)=>b.revenue-a.revenue);const tot=sorted.reduce((a,p)=>a+p.revenue,0)||1;let c=0;
    return sorted.map(p=>{c+=p.revenue;const pct=c/tot;return{...p,cls:pct<=0.7?"A":pct<=0.9?"B":"C"};});})();
  const custDue=db.customers.map(c=>({name:c.name,due:db.invoices.filter(i=>i.customerId===c.id&&!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0)})).filter(x=>x.due>0).sort((a,b)=>b.due-a.due);
  const supDue=db.suppliers.map(sp=>({name:sp.name,due:db.purchases.filter(p=>p.supplierId===sp.id).reduce((a,p)=>a+Math.max(0,p.total-p.paid),0)})).filter(x=>x.due>0).sort((a,b)=>b.due-a.due);
  const totProfit=prodStats.reduce((a,p)=>a+p.profit,0);
  const totExp=vch.filter(v=>["Expense","Payment"].includes(v.type)&&inRange(v.ts)).reduce((a,v)=>a+v.amt,0);

  return(<div>
    <H1>Reports</H1>
    {/* Report engine toolbar */}
    <Card>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,color:T.dim}}>From</span>
        <input type="date" style={{...inp(0),width:150}} value={from} onChange={e=>setFrom(e.target.value)}/>
        <span style={{fontSize:12,color:T.dim}}>To</span>
        <input type="date" style={{...inp(0),width:150}} value={to} onChange={e=>setTo(e.target.value)}/>
        {["This month","Last 7d","This year"].map(q=><button key={q} onClick={()=>{
          const n=new Date();if(q==="Last 7d"){setFrom(iso(Date.now()-7*86400000));setTo(iso(Date.now()));}
          else if(q==="This month"){setFrom(iso(new Date(n.getFullYear(),n.getMonth(),1)));setTo(iso(Date.now()));}
          else{setFrom(iso(new Date(n.getFullYear(),0,1)));setTo(iso(Date.now()));}
        }} style={{...btn(T.panel2),fontSize:11}}>{q}</button>)}
      </div>
    </Card>
    <div style={{display:"flex",gap:5,margin:"12px 0",flexWrap:"wrap"}}>
      {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#fff":T.text,fontWeight:tab===k?700:500,fontSize:11.5}}>{l}</button>)}
    </div>

    {tab==="daybook"&&<Card>
      <Hdr title={`Day Book · ${streamF.length} txns`} onX={()=>exportXls([["Date","Ref","Party","Type","In","Out","Mode"],...streamF.map(x=>[fmtTs(x.ts),x.ref,x.party,x.desc,x.inAmt,x.outAmt,x.mode])],"daybook")}/>
      <div style={{display:"flex",gap:8}}><span style={{...th,width:100}}>Date</span><span style={{...th,width:80}}>Ref</span><span style={{...th,flex:1}}>Party/Desc</span><span style={{...th,width:90,textAlign:"right"}}>In</span><span style={{...th,width:90,textAlign:"right"}}>Out</span></div>
      {streamF.map((x,i)=><div key={i} style={{display:"flex",gap:8}}>
        <span style={{...td,width:100,color:T.acc}}>{fmtTs(x.ts)}</span><span style={{...td,width:80}}>{x.ref}</span>
        <span style={{...td,flex:1,color:T.dim}}>{x.party} · {x.desc}</span>
        <span style={{...td,width:90,textAlign:"right"}}><Money v={x.inAmt} c={T.ok}/></span>
        <span style={{...td,width:90,textAlign:"right"}}><Money v={x.outAmt} c={T.danger}/></span></div>)}
      <TotRow cells={[["In",streamF.reduce((a,x)=>a+x.inAmt,0),T.ok],["Out",streamF.reduce((a,x)=>a+x.outAmt,0),T.danger]]}/>
    </Card>}

    {tab==="party"&&<Card>
      <select style={inp()} value={party} onChange={e=>setParty(e.target.value)}>
        <option value="">Select party (customer)</option>
        {db.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {party&&<>
        <Hdr title={`Statement · ${custName(party)}`} onX={()=>exportXls([["Date","Ref","Particulars","Debit","Credit","Balance"],...(()=>{let b=0;return partyTxns.map(r=>{b+=r.debit-r.credit;return[fmtTs(r.ts),r.ref,r.desc,r.debit,r.credit,b];});})()],"statement")}/>
        <div style={{display:"flex",gap:8}}><span style={{...th,width:100}}>Date</span><span style={{...th,flex:1}}>Particulars</span><span style={{...th,width:80,textAlign:"right"}}>Debit</span><span style={{...th,width:80,textAlign:"right"}}>Credit</span><span style={{...th,width:90,textAlign:"right"}}>Balance</span></div>
        {partyTxns.map((r,i)=>{run+=r.debit-r.credit;return<div key={i} style={{display:"flex",gap:8}}>
          <span style={{...td,width:100,color:T.acc}}>{fmtTs(r.ts)}</span><span style={{...td,flex:1,color:T.dim}}>{r.desc} ({r.ref})</span>
          <span style={{...td,width:80,textAlign:"right"}}><Money v={r.debit} c={T.text}/></span>
          <span style={{...td,width:80,textAlign:"right"}}><Money v={r.credit} c={T.ok}/></span>
          <b style={{...td,width:90,textAlign:"right",color:run>0?T.danger:T.ok}}>{inr(run)}</b></div>;})}
        <div style={{fontWeight:800,textAlign:"right",marginTop:8,color:run>0?T.danger:T.ok}}>Closing balance: {inr(run)}{run>0?" (owes you)":""}</div>
      </>}
      {!party&&<div style={{color:T.dim,fontSize:13}}>Customer select pannunga — full ledger + running balance varum.</div>}
    </Card>}

    {tab==="alltxn"&&<Card>
      <Hdr title={`All Transactions · ${streamF.length}`} onX={()=>exportXls([["Date","Ref","Party","Type","In","Out","Mode"],...streamF.map(x=>[fmtTs(x.ts),x.ref,x.party,x.desc,x.inAmt,x.outAmt,x.mode])],"all-txns")}/>
      {streamF.map((x,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"5px 4px",borderBottom:`1px solid ${T.line}`}}>
        <span style={{color:T.acc,width:100}}>{fmtTs(x.ts)}</span><span style={{width:70}}>{x.ref}</span>
        <span style={{flex:1,color:T.dim}}>{x.party}</span><span style={{width:60,fontSize:10,color:T.dim}}>{x.cat}</span>
        <b style={{width:90,textAlign:"right",color:x.inAmt?T.ok:T.danger}}>{x.inAmt?"+":"−"}{inr(x.inAmt||x.outAmt)}</b></div>)}
    </Card>}

    {tab==="billprofit"&&<Card>
      <Hdr title="Bill-wise Profit" onX={()=>exportXls([["Bill","Date","Party","Sale","Cost","Profit"],...billProfit.map(b=>[b.no,fmtTs(b.ts),b.party,b.sale,b.cost,b.profit])],"bill-profit")}/>
      <div style={{display:"flex",gap:8}}><span style={{...th,width:80}}>Bill</span><span style={{...th,flex:1}}>Party</span><span style={{...th,width:80,textAlign:"right"}}>Sale</span><span style={{...th,width:80,textAlign:"right"}}>Cost</span><span style={{...th,width:80,textAlign:"right"}}>Profit</span></div>
      {billProfit.map(b=><div key={b.no} style={{display:"flex",gap:8}}>
        <span style={{...td,width:80}}>{b.no}</span><span style={{...td,flex:1,color:T.dim}}>{b.party}</span>
        <span style={{...td,width:80,textAlign:"right"}}>{inr(b.sale)}</span><span style={{...td,width:80,textAlign:"right",color:T.dim}}>{inr(b.cost)}</span>
        <b style={{...td,width:80,textAlign:"right",color:b.profit>=0?T.ok:T.danger}}>{inr(b.profit)}</b></div>)}
      <TotRow cells={[["Sale",billProfit.reduce((a,b)=>a+b.sale,0),T.text],["Profit",billProfit.reduce((a,b)=>a+b.profit,0),T.ok]]}/>
    </Card>}

    {tab==="stock"&&<Card>
      <Hdr title={`Stock Summary · value ${inr(stockRows.reduce((a,r)=>a+r.val,0))}`} onX={()=>exportXls([["Item","Qty","Cost","Stock Value","Sale Price"],...stockRows.map(r=>[r.name,r.qty,r.cost,r.val,r.price])],"stock-summary")}/>
      <div style={{display:"flex",gap:8}}><span style={{...th,flex:1}}>Item</span><span style={{...th,width:70,textAlign:"right"}}>Qty</span><span style={{...th,width:80,textAlign:"right"}}>Cost</span><span style={{...th,width:90,textAlign:"right"}}>Value</span></div>
      {stockRows.map((r,i)=><div key={i} style={{display:"flex",gap:8}}>
        <span style={{...td,flex:1}}>{r.name}</span><span style={{...td,width:70,textAlign:"right",color:r.qty<0?T.danger:T.text}}>{r.qty}</span>
        <span style={{...td,width:80,textAlign:"right",color:T.dim}}>{inr(r.cost)}</span><b style={{...td,width:90,textAlign:"right"}}>{inr(r.val)}</b></div>)}
    </Card>}

    {tab==="bank"&&<Card>
      <Hdr title="Bank / Digital Statement" onX={()=>exportXls([["Date","Ref","Desc","Deposit","Withdrawal","Mode"],...bankTx.map(x=>[fmtTs(x.ts),x.ref,x.party,x.inAmt,x.outAmt,x.mode])],"bank-statement")}/>
      <div style={{display:"flex",gap:8}}><span style={{...th,width:100}}>Date</span><span style={{...th,flex:1}}>Description</span><span style={{...th,width:80,textAlign:"right"}}>Deposit</span><span style={{...th,width:80,textAlign:"right"}}>Withdraw</span><span style={{...th,width:90,textAlign:"right"}}>Balance</span></div>
      {bankTx.map((x,i)=>{bankRun+=x.inAmt-x.outAmt;return<div key={i} style={{display:"flex",gap:8}}>
        <span style={{...td,width:100,color:T.acc}}>{fmtTs(x.ts)}</span><span style={{...td,flex:1,color:T.dim}}>{x.party} · {x.mode}</span>
        <span style={{...td,width:80,textAlign:"right"}}><Money v={x.inAmt} c={T.ok}/></span>
        <span style={{...td,width:80,textAlign:"right"}}><Money v={x.outAmt} c={T.danger}/></span>
        <b style={{...td,width:90,textAlign:"right"}}>{inr(bankRun)}</b></div>;})}
      {bankTx.length===0&&<div style={{color:T.dim,fontSize:13}}>No bank/UPI/card transactions in range.</div>}
    </Card>}

    {tab==="sales"&&<Card>
      <Hdr title={`Sales Trend · ${inr(invsR.reduce((a,i)=>a+i.total,0))} · ${invsR.length} bills`} onX={()=>exportXls([["Date","Sales"],...(()=>{const m={};invsR.forEach(i=>{const k=new Date(i.ts).toLocaleDateString("en-IN");m[k]=(m[k]||0)+i.total;});return Object.entries(m);})()],"sales")}/>
      {(()=>{const m={};invsR.forEach(i=>{const k=new Date(i.ts).toLocaleDateString("en-IN");m[k]=(m[k]||0)+i.total;});
        const e=Object.entries(m).slice(0,31);const mx=Math.max(...e.map(x=>x[1]),1);
        return e.length?e.map(([d,v])=><div key={d} style={{marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5}}><span style={{color:T.dim}}>{d}</span><b>{inr(v)}</b></div>
          <div style={{background:T.panel2,borderRadius:4,height:8}}><div style={{background:T.acc,width:`${v/mx*100}%`,height:8,borderRadius:4}}/></div></div>):
          <div style={{color:T.dim,fontSize:13}}>No sales in range.</div>;})()}
    </Card>}

    {tab==="products"&&<Card>
      <Hdr title="Product Sales" onX={()=>exportXls([["Product","Qty","Revenue","Profit"],...byQty.map(p=>[p.name,p.qty,p.revenue,p.profit])],"product-sales")}/>
      {byQty.map((p,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"5px 4px",borderBottom:`1px solid ${T.line}`}}>
        <span style={{flex:1}}>{p.name}</span><span style={{width:60,textAlign:"right",color:T.dim}}>{p.qty}</span>
        <span style={{width:90,textAlign:"right"}}>{inr(p.revenue)}</span><span style={{width:90,textAlign:"right",color:p.profit>=0?T.ok:T.danger}}>{inr(p.profit)}</span></div>)}
      {byQty.length===0&&<div style={{color:T.dim,fontSize:13}}>No sales.</div>}
    </Card>}

    {tab==="fastslow"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Card><div style={{fontWeight:700,color:T.ok,marginBottom:8}}>🔥 Fast moving</div>
        {byQty.slice(0,10).map((p,i)=><div key={i} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{p.name}</span><b>{p.qty}</b></div>)}
        {byQty.length===0&&<div style={{color:T.dim,fontSize:12}}>—</div>}</Card>
      <Card><div style={{fontWeight:700,color:T.acc2,marginBottom:8}}>🐢 Slow moving</div>
        {byQty.filter(p=>p.qty>0).slice(-10).reverse().map((p,i)=><div key={i} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{p.name}</span><b>{p.qty}</b></div>)}
        {byQty.length===0&&<div style={{color:T.dim,fontSize:12}}>—</div>}</Card>
    </div>}

    {tab==="dead"&&<Card><div style={{fontWeight:700,color:T.danger,marginBottom:8}}>💀 Dead Stock (range-la sale illa)</div>
      {dead.map(p=><div key={p.id} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{p.name}</span><span style={{color:T.dim}}>{totalStock(p)} · {inr(totalStock(p)*(p.cost||0))}</span></div>)}
      {dead.length===0&&<div style={{color:T.ok,fontSize:13}}>✓ No dead stock.</div>}</Card>}

    {tab==="abc"&&<Card><div style={{fontWeight:700,marginBottom:4}}>ABC Analysis</div>
      <div style={{fontSize:11,color:T.dim,marginBottom:8}}>A=top 70% · B=next 20% · C=last 10%</div>
      {abc.map((p,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12.5,padding:"4px 0",borderBottom:`1px solid ${T.line}`}}>
        <b style={{width:24,color:p.cls==="A"?T.ok:p.cls==="B"?T.acc2:T.dim}}>{p.cls}</b><span style={{flex:1}}>{p.name}</span><span>{inr(p.revenue)}</span></div>)}
      {abc.length===0&&<div style={{color:T.dim,fontSize:13}}>No data.</div>}</Card>}

    {tab==="outstanding"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Card><div style={{fontWeight:700,color:T.acc2,marginBottom:8}}>Receivables</div>
        {custDue.map(c=><div key={c.name} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{c.name}</span><b>{inr(c.due)}</b></div>)}
        {custDue.length===0&&<div style={{color:T.ok,fontSize:12}}>✓ Nil</div>}</Card>
      <Card><div style={{fontWeight:700,color:T.danger,marginBottom:8}}>Payables</div>
        {supDue.map(sp=><div key={sp.name} style={{fontSize:12.5,padding:"4px 0",display:"flex"}}><span style={{flex:1}}>{sp.name}</span><b>{inr(sp.due)}</b></div>)}
        {supDue.length===0&&<div style={{color:T.ok,fontSize:12}}>✓ Nil</div>}</Card>
    </div>}

    {tab==="profit"&&<Card><div style={{fontWeight:700,marginBottom:10}}>Profit Summary · {from} → {to}</div>
      {[["Revenue (incl GST)",invsR.reduce((a,i)=>a+i.total,0),T.text],["Gross profit",totProfit,T.ok],["Expenses",-totExp,T.danger],["Net",totProfit-totExp,totProfit-totExp>=0?T.ok:T.danger]].map(([l,v,c])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"7px 0",fontWeight:l==="Net"?800:400,color:c,borderBottom:`1px solid ${T.line}`}}>
          <span>{l}</span><span>{inr(Math.abs(v))}{v<0?" (−)":""}</span></div>))}
    </Card>}
  </div>);
}
function Hdr({title,onX}){return<div style={{display:"flex",alignItems:"center",marginBottom:8}}>
  <div style={{fontWeight:700,fontSize:13.5}}>{title}</div>
  <button onClick={onX} style={{...btn(T.acc),color:"#fff",fontWeight:700,marginLeft:"auto",fontSize:12}}>⬇ Excel</button>
  <button onClick={()=>window.print()} style={{...btn(T.panel2),marginLeft:6,fontSize:12}}>🖨 PDF</button></div>;}
function TotRow({cells}){return<div style={{display:"flex",justifyContent:"flex-end",gap:16,fontWeight:800,marginTop:8,paddingTop:6,borderTop:`2px solid ${T.line}`}}>
  {cells.map(([l,v,c])=><span key={l} style={{color:c}}>{l}: {inr(v)}</span>)}</div>;}

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
  const workingDays=+(db.settings?.workingDays)||26;
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

/* ---------- Assets (P12) ---------- */
function Assets({db,save,log,flash}){
  const [f,setF]=useState({name:"",cost:"",date:new Date().toISOString().slice(0,10),rate:10,serviceEvery:""});
  const assets=db.assets||[];
  const yearsSince=d=>(Date.now()-Date.parse(d))/31557600000;
  const curValue=a=>Math.max(0,Math.round(a.cost*(1-a.rate/100*yearsSince(a.date))));
  const serviceDue=a=>a.serviceEvery&&(Date.now()-Date.parse(a.lastService||a.date))/86400000>=a.serviceEvery;
  const add=()=>{
    if(!f.name.trim()||!+f.cost)return flash("Name & cost required");
    const d=structuredClone(db);d.assets=d.assets||[];
    d.assets.push({id:uid(),...f,name:f.name.trim(),cost:+f.cost,rate:+f.rate,serviceEvery:+f.serviceEvery||0,lastService:f.date});
    log(d,`Asset added: ${f.name}`);save(d);setF({name:"",cost:"",date:new Date().toISOString().slice(0,10),rate:10,serviceEvery:""});flash("Asset saved");
  };
  const doService=id=>{const d=structuredClone(db);
    const a=d.assets.find(x=>x.id===id);a.lastService=new Date().toISOString().slice(0,10);
    log(d,`Asset serviced: ${a.name}`);save(d);flash("Service recorded");};
  return(<div>
    <H1>Assets</H1>
    <Card><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
      <input style={inp(0)} placeholder="Asset name *" value={f.name} onChange={e=>setF(s=>({...s,name:e.target.value}))}/>
      <input style={inp(0)} type="number" placeholder="Cost ₹ *" value={f.cost} onChange={e=>setF(s=>({...s,cost:e.target.value}))}/>
      <input style={inp(0)} type="date" value={f.date} onChange={e=>setF(s=>({...s,date:e.target.value}))}/>
      <input style={inp(0)} type="number" placeholder="Dep %/yr" value={f.rate} onChange={e=>setF(s=>({...s,rate:e.target.value}))}/>
      <input style={inp(0)} type="number" placeholder="Service every (days)" value={f.serviceEvery} onChange={e=>setF(s=>({...s,serviceEvery:e.target.value}))}/>
    </div>
    <button onClick={add} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add asset</button></Card>
    {assets.map(a=>(
      <Card key={a.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:150}}><b>{a.name}</b>
          <div style={{fontSize:11,color:T.dim}}>Bought {a.date} · {inr(a.cost)} · dep {a.rate}%/yr</div></div>
        <div style={{fontSize:13}}>Now: <b style={{color:T.acc}}>{inr(curValue(a))}</b></div>
        {serviceDue(a)&&<span style={{fontSize:11,color:T.danger}}>🔧 Service due</span>}
        {a.serviceEvery>0&&<button onClick={()=>doService(a.id)} style={btn(T.panel2)}>Serviced today</button>}
      </div></Card>))}
    {assets.length===0&&<div style={{color:T.dim,fontSize:13}}>No assets. Machines, vehicles, computers ellam add pannalam.</div>}
  </div>);
}

/* ---------- Finance (P13) ---------- */
function Finance({db,save,log,flash}){
  const [tab,setTab]=useState("loans");
  const [f,setF]=useState({name:"",principal:"",rate:"",months:""});
  const loans=db.loans||[];
  const emiCalc=(P,annualRate,n)=>{const r=annualRate/1200;
    return r===0?P/n:P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);};
  const addLoan=()=>{
    if(!f.name.trim()||!+f.principal||!+f.months)return flash("Name, principal & months required");
    const d=structuredClone(db);d.loans=d.loans||[];
    const emi=Math.round(emiCalc(+f.principal,+f.rate||0,+f.months));
    d.loans.push({id:uid(),...f,name:f.name.trim(),principal:+f.principal,rate:+f.rate||0,months:+f.months,emi,paid:0});
    log(d,`Loan added: ${f.name} EMI ${inr(emi)}`);save(d);setF({name:"",principal:"",rate:"",months:""});flash(`EMI: ${inr(emi)}/month`);
  };
  const payEmi=id=>{const d=structuredClone(db);
    const l=d.loans.find(x=>x.id===id);
    if(l.paid>=l.months)return flash("Loan already closed");
    l.paid++;
    d.vouchers=d.vouchers||[];
    d.vouchers.unshift({id:uid(),no:`EMI-${l.name}-${l.paid}`,ts:Date.now(),type:"Expense",account:`Loan: ${l.name}`,amt:l.emi,mode:"Bank",note:`EMI ${l.paid}/${l.months}`});
    log(d,`EMI paid: ${l.name} ${l.paid}/${l.months}`);save(d);flash("EMI recorded in Accounting");};
  // Bank reconciliation: bank-mode entries
  const recon=db.recon||{};
  const bankTxns=[
    ...db.invoices.filter(i=>["UPI","Card","Bank"].includes(i.payMode)&&!i.returned).map(i=>({key:"inv-"+i.id,ts:i.ts,label:`${i.no} sale`,amt:i.paid,dir:"in"})),
    ...(db.vouchers||[]).filter(v=>["Bank","UPI","Card"].includes(v.mode)).map(v=>({key:"vch-"+v.id,ts:v.ts,label:`${v.no} ${v.type}`,amt:v.amt,dir:["Receipt","Income"].includes(v.type)?"in":"out"})),
  ].sort((a,b)=>b.ts-a.ts);
  const toggleRecon=key=>{const d=structuredClone(db);
    d.recon=d.recon||{};d.recon[key]=!d.recon[key];save(d);};
  const unreconciled=bankTxns.filter(t=>!recon[t.key]).length;
  return(<div>
    <H1>Finance</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["loans","Loans & EMI"],["recon",`Bank Reconciliation${unreconciled?` (${unreconciled})`:""}`]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400}}>{l}</button>))}
    </div>
    {tab==="loans"&&<>
      <Card><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
        <input style={inp(0)} placeholder="Loan name *" value={f.name} onChange={e=>setF(s=>({...s,name:e.target.value}))}/>
        <input style={inp(0)} type="number" placeholder="Principal ₹ *" value={f.principal} onChange={e=>setF(s=>({...s,principal:e.target.value}))}/>
        <input style={inp(0)} type="number" placeholder="Interest %/yr" value={f.rate} onChange={e=>setF(s=>({...s,rate:e.target.value}))}/>
        <input style={inp(0)} type="number" placeholder="Months *" value={f.months} onChange={e=>setF(s=>({...s,months:e.target.value}))}/>
      </div>
      <button onClick={addLoan} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Add loan</button></Card>
      {loans.map(l=>{
        const outstanding=l.emi*(l.months-l.paid);
        const totalInterest=l.emi*l.months-l.principal;
        return(<Card key={l.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:160}}><b>{l.name}</b>
            <div style={{fontSize:11,color:T.dim}}>{inr(l.principal)} @ {l.rate}% · {l.paid}/{l.months} EMIs · interest total {inr(Math.round(totalInterest))}</div></div>
          <div style={{fontSize:13}}>EMI <b style={{color:T.acc}}>{inr(l.emi)}</b></div>
          <div style={{fontSize:12,color:T.acc2}}>Balance {inr(outstanding)}</div>
          {l.paid<l.months?<button onClick={()=>payEmi(l.id)} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Pay EMI</button>
            :<span style={{fontSize:11,color:T.ok}}>✓ Closed</span>}
        </div></Card>);})}
      {loans.length===0&&<div style={{color:T.dim,fontSize:13}}>No loans tracked.</div>}
    </>}
    {tab==="recon"&&<Card>
      <div style={{fontSize:12,color:T.dim,marginBottom:8}}>Bank statement-oda compare panni match aana entry-ah tick pannunga.</div>
      {bankTxns.map(t=>(
        <div key={t.key} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
          <input type="checkbox" checked={!!recon[t.key]} onChange={()=>toggleRecon(t.key)} style={{width:16,height:16,accentColor:T.acc}}/>
          <span style={{color:T.acc,fontSize:11,width:100}}>{fmtTs(t.ts)}</span>
          <span style={{flex:1,fontSize:12.5,color:recon[t.key]?T.dim:T.text}}>{t.label}</span>
          <b style={{color:t.dir==="in"?T.ok:T.danger,fontSize:13}}>{t.dir==="in"?"+":"−"}{inr(t.amt)}</b>
        </div>))}
      {bankTxns.length===0&&<div style={{color:T.dim,fontSize:13}}>No bank/UPI/card transactions yet.</div>}
    </Card>}
  </div>);
}

/* ---------- Online Store (P14) ---------- */
function Store({db,save,log,notify,flash,company}){
  const [tab,setTab]=useState("shop");
  const [cart,setCart]=useState({});
  const [cust,setCust]=useState({name:"",phone:""});
  const orders=db.orders||[];
  const upiId=db.settings?.upiId||"";
  const items=Object.entries(cart).filter(([,q])=>q>0);
  const total=items.reduce((a,[pid,q])=>{const p=db.products.find(x=>x.id===pid);return a+(p?.price||0)*q;},0);
  const setQ=(pid,q)=>setCart(c=>({...c,[pid]:Math.max(0,q)}));
  const placeOrder=()=>{
    if(items.length===0||!cust.name.trim())return flash("Items & customer name required");
    const d=structuredClone(db);d.orders=d.orders||[];
    const no=`ORD-${String(d.orders.length+1).padStart(4,"0")}`;
    d.orders.unshift({id:uid(),no,ts:Date.now(),name:cust.name.trim(),phone:cust.phone,
      items:items.map(([pid,q])=>{const p=d.products.find(x=>x.id===pid);return{pid,name:p.name,qty:q,rate:p.price};}),
      total,status:"New"});
    notify(d,`New online order ${no} — ${inr(total)} (${cust.name})`);
    log(d,`Online order ${no}`);save(d);setCart({});setCust({name:"",phone:""});flash(`${no} placed!`);
  };
  const STAGES=["New","Packed","Shipped","Delivered"];
  const advance=id=>{const d=structuredClone(db);
    const o=d.orders.find(x=>x.id===id);
    const i=STAGES.indexOf(o.status);
    if(i<STAGES.length-1){o.status=STAGES[i+1];
      if(o.status==="Delivered"){ // convert to invoice + stock out
        d.seq.inv++;
        const pfx=d.settings?.invPrefix?d.settings.invPrefix+"-":"";
        const no=`${pfx}GST-${String(d.seq.inv).padStart(4,"0")}`;
        const sub=o.items.reduce((a,it)=>a+it.rate*it.qty,0);
        const tax=o.items.reduce((a,it)=>{const p=d.products.find(x=>x.id===it.pid);return a+it.rate*it.qty*(p?.gst||0)/100;},0);
        d.invoices.unshift({id:uid(),no,type:"GST Invoice",customerId:null,items:o.items.map(it=>{const p=d.products.find(x=>x.id===it.pid);return{...it,gst:p?.gst||0,hsn:p?.hsn||"",unit:p?.unit||"pcs"};}),sub,tax,total:Math.round((sub+tax)*100)/100,paid:Math.round((sub+tax)*100)/100,payMode:"UPI",ts:Date.now(),branchId:null,returned:false,orderNo:o.no});
        o.items.forEach(it=>{const p=d.products.find(x=>x.id===it.pid);if(!p)return;
          const wh=Object.keys(p.stock)[0]||"default";p.stock[wh]=(p.stock[wh]||0)-it.qty;
          d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:it.pid,wh,qty:-it.qty,type:"Online sale",ref:no});});
      }
      log(d,`Order ${o.no} → ${o.status}`);save(d);}
  };
  const upiLink=o=>`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(company?.name||"BillDNA")}&am=${o.total}&cu=INR&tn=${o.no}`;
  return(<div>
    <H1>Online Store</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["shop","🛍 Shop (customer view)"],["orders",`Orders${orders.filter(o=>o.status!=="Delivered").length?` (${orders.filter(o=>o.status!=="Delivered").length})`:""}`]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400,fontSize:12.5}}>{l}</button>))}
    </div>
    {tab==="shop"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:12}}>
        {db.products.filter(p=>totalStock(p)>0).map(p=>(
          <Card key={p.id}>
            <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
            <div style={{fontSize:11,color:T.dim}}>{p.category||"—"}</div>
            <div style={{color:T.acc,fontWeight:800,margin:"4px 0"}}>{inr(p.price)}<span style={{fontSize:10,color:T.dim}}>/{p.unit}</span></div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={()=>setQ(p.id,(cart[p.id]||0)-1)} style={btn(T.panel2)}>−</button>
              <b>{cart[p.id]||0}</b>
              <button onClick={()=>setQ(p.id,(cart[p.id]||0)+1)} style={btn(T.panel2)}>+</button>
            </div>
          </Card>))}
      </div>
      {db.products.filter(p=>totalStock(p)>0).length===0&&<div style={{color:T.dim,fontSize:13,marginBottom:12}}>Stock-la products illa — catalog empty.</div>}
      {total>0&&<Card>
        <div style={{fontWeight:800,fontSize:16,color:T.acc,marginBottom:8}}>Cart total: {inr(total)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={inp(0)} placeholder="Customer name *" value={cust.name} onChange={e=>setCust(s=>({...s,name:e.target.value}))}/>
          <input style={inp(0)} placeholder="Phone" value={cust.phone} onChange={e=>setCust(s=>({...s,phone:e.target.value}))}/>
        </div>
        <button onClick={placeOrder} style={{...btn(T.acc),color:"#08221E",fontWeight:800,marginTop:10,padding:10,width:"100%"}}>🛒 Place order</button>
      </Card>}
    </>}
    {tab==="orders"&&<>
      {orders.map(o=>(
        <Card key={o.id}><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:160}}><b>{o.no}</b> <span style={{fontSize:11,color:T.dim}}>· {o.name} · {fmtTs(o.ts)}</span>
            <div style={{fontSize:11,color:T.dim}}>{o.items.map(i=>`${i.name}×${i.qty}`).join(", ")}</div></div>
          <b style={{color:T.acc}}>{inr(o.total)}</b>
          <span style={{fontSize:11,fontWeight:700,color:o.status==="Delivered"?T.ok:T.acc2}}>{o.status}</span>
          {upiId&&o.status!=="Delivered"&&<a href={upiLink(o)} style={{...btn(T.panel2),textDecoration:"none",fontSize:11}}>UPI pay</a>}
          {o.status!=="Delivered"&&<button onClick={()=>advance(o.id)} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>→ {STAGES[STAGES.indexOf(o.status)+1]}</button>}
        </div></Card>))}
      {orders.length===0&&<div style={{color:T.dim,fontSize:13}}>No online orders yet.</div>}
      <div style={{fontSize:11,color:T.dim,marginTop:8}}>Delivered aana udane GST invoice + stock out auto-create aagum. UPI ID-ah Admin Panel-la set pannunga.</div>
    </>}
  </div>);
}

/* ---------- AI Assistant (P15) ---------- */
function Ai({db,flash}){
  const [tab,setTab]=useState("forecast");
  const [q,setQ]=useState("");const [chat,setChat]=useState([]);const [busy,setBusy]=useState(false);

  // stats last 30 days
  const cutoff=Date.now()-30*86400000;
  const invs=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&i.ts>=cutoff);
  const perProd=useMemo(()=>{
    const m={};
    invs.forEach(i=>i.items.forEach(it=>{m[it.pid]=m[it.pid]||{name:it.name,qty:0};m[it.pid].qty+=it.qty;}));
    return m;
  },[invs]);
  const rows=db.products.map(p=>{
    const sold30=perProd[p.id]?.qty||0;
    const avgDaily=sold30/30;
    const stock=totalStock(p);
    const daysLeft=avgDaily>0?Math.floor(stock/avgDaily):Infinity;
    const reorder=Math.max(0,Math.ceil(avgDaily*14-stock)); // 14-day cover
    return {p,sold30,avgDaily,stock,daysLeft,reorder};
  });
  const salesDaily=invs.reduce((a,i)=>a+i.total,0)/30;
  const next7=Math.round(salesDaily*7);

  const ask=async()=>{
    if(!q.trim()||busy)return;
    const question=q.trim();setQ("");setBusy(true);
    setChat(c=>[...c,{role:"user",text:question}]);
    const snapshot={
      products:db.products.length,customers:db.customers.length,
      sales30d:invs.reduce((a,i)=>a+i.total,0),bills30d:invs.length,
      receivables:db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0),
      payables:db.purchases.reduce((a,p)=>a+Math.max(0,p.total-p.paid),0),
      lowStock:db.products.filter(p=>totalStock(p)<=(p.low||0)&&p.low>0).map(p=>p.name).slice(0,10),
      topProducts:Object.values(perProd).sort((a,b)=>b.qty-a.qty).slice(0,5),
    };
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,
          messages:[{role:"user",content:`You are BillDNA AI Business Advisor for a Tamil Nadu SME. Reply in Tanglish (Tamil-English mix), short and practical, max 5 lines. Business data: ${JSON.stringify(snapshot)}\n\nQuestion: ${question}`}]})});
      const data=await res.json();
      const text=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"Reply varala, thirumba try pannunga.";
      setChat(c=>[...c,{role:"ai",text}]);
    }catch(e){setChat(c=>[...c,{role:"ai",text:"Network error — thirumba try pannunga."}]);}
    setBusy(false);
  };

  return(<div>
    <H1>AI Assistant</H1>
    <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["forecast","📦 Inventory Forecast"],["predict","📈 Sales Prediction"],["chat","💬 Business Advisor"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{...btn(tab===k?T.acc:T.panel2),color:tab===k?"#08221E":T.text,fontWeight:tab===k?700:400,fontSize:12.5}}>{l}</button>))}
    </div>
    {tab==="forecast"&&<Card>
      <div style={{fontWeight:700,marginBottom:4}}>Reorder suggestions (14-day cover, 30-day sales basis)</div>
      <div style={{display:"flex",gap:8,fontSize:11,color:T.dim,fontWeight:700,padding:"4px 0"}}>
        <span style={{flex:1}}>Product</span><span style={{width:70,textAlign:"right"}}>Sold/30d</span><span style={{width:60,textAlign:"right"}}>Stock</span><span style={{width:70,textAlign:"right"}}>Days left</span><span style={{width:80,textAlign:"right"}}>Order qty</span></div>
      {rows.filter(r=>r.sold30>0).sort((a,b)=>a.daysLeft-b.daysLeft).map(r=>(
        <div key={r.p.id} style={{display:"flex",gap:8,fontSize:12.5,padding:"5px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{flex:1}}>{r.p.name}</span><span style={{width:70,textAlign:"right",color:T.dim}}>{r.sold30}</span>
          <span style={{width:60,textAlign:"right"}}>{r.stock}</span>
          <span style={{width:70,textAlign:"right",color:r.daysLeft<7?T.danger:r.daysLeft<15?T.acc2:T.ok}}>{r.daysLeft===Infinity?"∞":r.daysLeft}</span>
          <b style={{width:80,textAlign:"right",color:r.reorder>0?T.acc2:T.dim}}>{r.reorder>0?r.reorder:"—"}</b></div>))}
      {rows.every(r=>r.sold30===0)&&<div style={{color:T.dim,fontSize:13}}>30 days-la sales data illa — billing start pannunga.</div>}
    </Card>}
    {tab==="predict"&&<Card>
      <div style={{fontWeight:700,marginBottom:10}}>Sales prediction (30-day moving average)</div>
      {[["Avg daily sales",inr(Math.round(salesDaily))],["Predicted next 7 days",inr(next7)],["Predicted next 30 days",inr(Math.round(salesDaily*30))]].map(([l,v])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"7px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{color:T.dim}}>{l}</span><b style={{color:T.acc}}>{v}</b></div>))}
      <div style={{fontSize:11,color:T.dim,marginTop:8}}>Simple moving average — data adhigam aana accuracy improve aagum.</div>
    </Card>}
    {tab==="chat"&&<>
      <Card>
        <div style={{maxHeight:300,overflowY:"auto",marginBottom:10}}>
          {chat.length===0&&<div style={{color:T.dim,fontSize:13}}>Business patthi kelunga — "Indha maasam profit eppadi?", "Enna stock order pannanum?", "Sales increase panna idea?"</div>}
          {chat.map((m,i)=>(
            <div key={i} style={{marginBottom:8,textAlign:m.role==="user"?"right":"left"}}>
              <div style={{display:"inline-block",background:m.role==="user"?T.acc:T.panel2,color:m.role==="user"?"#08221E":T.text,padding:"8px 12px",borderRadius:10,fontSize:13,maxWidth:"85%",whiteSpace:"pre-wrap",textAlign:"left"}}>{m.text}</div>
            </div>))}
          {busy&&<div style={{color:T.dim,fontSize:12}}>AI yosikkuthu…</div>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input style={inp(0)} placeholder="Ungal business question..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()}/>
          <button onClick={ask} disabled={busy} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Ask</button>
        </div>
      </Card>
    </>}
  </div>);
}

/* ---------- Integrations & Exports (P16) ---------- */
function Integrations({db,flash,company}){
  const csv=(rows,name)=>{
    const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
    const txt=rows.map(r=>r.map(esc).join(",")).join("\n");
    const blob=new Blob(["\ufeff"+txt],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();
    flash(`${name} downloaded`);
  };
  const expProducts=()=>csv([["Name","SKU","Barcode","Category","HSN","GST%","Price","Cost","Stock"],
    ...db.products.map(p=>[p.name,p.sku,p.barcode,p.category,p.hsn,p.gst,p.price,p.cost,totalStock(p)])],"products.csv");
  const expCustomers=()=>csv([["Name","Phone","GSTIN","City"],...db.customers.map(c=>[c.name,c.phone,c.gstin,c.city])],"customers.csv");
  const expInvoices=()=>csv([["No","Type","Date","Customer","Subtotal","Tax","Total","Paid","Mode"],
    ...db.invoices.map(i=>[i.no,i.type,new Date(i.ts).toLocaleDateString("en-IN"),db.customers.find(c=>c.id===i.customerId)?.name||"Walk-in",i.sub,i.tax,i.total,i.paid,i.payMode])],"invoices.csv");
  const expTally=()=>{
    const vch=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned).map(i=>`
  <TALLYMESSAGE><VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${new Date(i.ts).toISOString().slice(0,10).replace(/-/g,"")}</DATE>
    <VOUCHERNUMBER>${i.no}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${db.customers.find(c=>c.id===i.customerId)?.name||"Cash"}</PARTYLEDGERNAME>
    <AMOUNT>${i.total}</AMOUNT>
  </VOUCHER></TALLYMESSAGE>`).join("");
    const xml=`<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDATA>${vch}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    const blob=new Blob([xml],{type:"application/xml"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tally-sales.xml";a.click();
    flash("Tally XML downloaded — Tally-la Import Data pannunga");
  };
  return(<div>
    <H1>Export & Tools</H1>
    <Card><div style={{fontWeight:700,marginBottom:8}}>Excel / CSV Export</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={expProducts} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Products CSV</button>
        <button onClick={expCustomers} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Customers CSV</button>
        <button onClick={expInvoices} style={{...btn(T.acc),color:"#08221E",fontWeight:700}}>Invoices CSV</button>
      </div>
      <div style={{fontSize:11,color:T.dim,marginTop:6}}>Excel/Google Sheets-la direct open aagum.</div></Card>
    <Card><div style={{fontWeight:700,marginBottom:8}}>Tally Export</div>
      <button onClick={expTally} style={{...btn(T.acc2),color:"#08221E",fontWeight:700}}>Sales vouchers → Tally XML</button></Card>
    <Card><div style={{fontWeight:700,marginBottom:8}}>Print / PDF</div>
      <button onClick={()=>window.print()} style={{...btn(T.panel2)}}>🖨 Print current page (browser PDF save)</button>
      <div style={{fontSize:11,color:T.dim,marginTop:6}}>Thermal printer: browser print dialog-la 80mm paper size select pannunga.</div></Card>
    <Card><div style={{fontWeight:700,marginBottom:4}}>Already integrated</div>
      <div style={{fontSize:12.5,color:T.dim}}>✓ WhatsApp invoice & payment reminders (CRM, POS) · ✓ UPI deep-link payments (Store) · ✓ Barcode scan-to-bill (POS search) · ✓ GSTR JSON export (GST Reports) · ✓ JSON full backup (Backup)</div></Card>
  </div>);
}

/* ---------- Admin Panel (P18) ---------- */
function AdminPanel({db,save,log,flash,session}){
  const s=db.settings||{};
  const [f,setF]=useState({upiId:s.upiId||"",workingDays:s.workingDays||26,invPrefix:s.invPrefix||""});
  const saveSettings=()=>{
    const d=structuredClone(db);
    d.settings={...d.settings,upiId:f.upiId.trim(),workingDays:+f.workingDays||26,invPrefix:f.invPrefix.trim()};
    log(d,"Settings updated");save(d);flash("Settings saved");
  };
  const stats=[
    ["Companies",db.companies.length],["Branches",db.companies.reduce((a,c)=>a+c.branches.length,0)],
    ["Users",db.users.length],["Products",db.products.length],
    ["Customers",db.customers.length],["Invoices",db.invoices.length],
    ["Purchases",db.purchases.length],["Online orders",(db.orders||[]).length],
    ["Employees",(db.employees||[]).length],["Assets",(db.assets||[]).length],
  ];
  const dataSize=Math.round(JSON.stringify(db).length/1024);
  return(<div>
    <H1>Admin Panel</H1>
    <Card><div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15}}>BillDNA <span style={{color:T.acc}}>Pro</span></div>
        <div style={{fontSize:11,color:T.dim}}>All 18 phases unlocked · Single-device edition · Data: {dataSize} KB</div></div>
      <span style={{fontSize:11,color:T.ok,fontWeight:700}}>● Active</span></div></Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:12}}>
      {stats.map(([l,v])=><Card key={l}><div style={{fontSize:20,fontWeight:800,color:T.acc}}>{v}</div><div style={{fontSize:11,color:T.dim}}>{l}</div></Card>)}
    </div>
    <Card><div style={{fontWeight:700,marginBottom:8}}>System settings</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
        <div><div style={{fontSize:11,color:T.dim,marginBottom:3}}>UPI ID (Store payments)</div>
          <input style={inp(0)} placeholder="yourname@upi" value={f.upiId} onChange={e=>setF(x=>({...x,upiId:e.target.value}))}/></div>
        <div><div style={{fontSize:11,color:T.dim,marginBottom:3}}>Working days/month (Payroll)</div>
          <input style={inp(0)} type="number" value={f.workingDays} onChange={e=>setF(x=>({...x,workingDays:e.target.value}))}/></div>
        <div><div style={{fontSize:11,color:T.dim,marginBottom:3}}>Invoice prefix (optional)</div>
          <input style={inp(0)} placeholder="e.g. SD" value={f.invPrefix} onChange={e=>setF(x=>({...x,invPrefix:e.target.value}))}/></div>
      </div>
      <button onClick={saveSettings} style={{...btn(T.acc),color:"#08221E",fontWeight:700,marginTop:10}}>Save settings</button></Card>
    <Card><div style={{fontWeight:700,marginBottom:4}}>Audit</div>
      <div style={{fontSize:12.5,color:T.dim}}>Full activity trail Activity Log page-la irukku · Backup & Restore page-la data safety · User roles Users page-la manage pannalam.</div></Card>
  </div>);
}

/* ---------- Home Hub (v2 front page) ---------- */
async function askClaude(db,question){
  const cutoff=Date.now()-30*86400000;
  const invs=db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&i.ts>=cutoff);
  const snapshot={sales30d:invs.reduce((a,i)=>a+i.total,0),bills30d:invs.length,
    receivables:db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0),
    lowStock:db.products.filter(p=>totalStock(p)<=(p.low||0)&&p.low>0).map(p=>p.name).slice(0,8)};
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,
      messages:[{role:"user",content:`You are BillDNA AI advisor for an Indian small business. Reply short, practical, max 4 lines, simple English. Data: ${JSON.stringify(snapshot)}\n\nQuestion: ${question}`}]})});
  const data=await res.json();
  return (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n")||"No reply, try again.";
}
function HomeHub({db,setView,session}){
  const [q,setQ]=useState("");const [ans,setAns]=useState("");const [busy,setBusy]=useState(false);
  const today=new Date().toDateString();
  const todayInvs=db.invoices.filter(i=>new Date(i.ts).toDateString()===today&&i.type.includes("Invoice")&&!i.returned);
  const todaySales=todayInvs.reduce((a,i)=>a+i.total,0);
  const receivables=db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  // AI auto-suggestions (rule-based, instant)
  const cutoff=Date.now()-30*86400000;
  const sold={};db.invoices.filter(i=>i.type.includes("Invoice")&&!i.returned&&i.ts>=cutoff)
    .forEach(i=>i.items.forEach(it=>{sold[it.pid]=(sold[it.pid]||0)+it.qty;}));
  const sugg=[];
  db.products.forEach(p=>{const s30=sold[p.id]||0;if(s30>0){
    const days=Math.floor(totalStock(p)/(s30/30));
    if(days<7)sugg.push(`⚠ ${p.name} — ${days} days stock dhaan. Order ${Math.ceil(s30/30*14-totalStock(p))} units.`);}});
  const lowS=db.products.filter(p=>totalStock(p)<=(p.low||0)&&p.low>0);
  if(lowS.length)sugg.push(`📦 ${lowS.length} items low stock: ${lowS.slice(0,3).map(p=>p.name).join(", ")}`);
  const topDebtor=db.customers.map(c=>({c,due:db.invoices.filter(i=>i.customerId===c.id&&!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0)})).sort((a,b)=>b.due-a.due)[0];
  if(topDebtor&&topDebtor.due>0)sugg.push(`💰 ${topDebtor.c.name} — ${inr(topDebtor.due)} pending. Reminder anuppunga.`);
  if(sugg.length===0)sugg.push("✅ Ellam nalla irukku. Billing start pannunga!");
  const ask=async()=>{if(!q.trim()||busy)return;setBusy(true);setAns("");
    try{setAns(await askClaude(db,q.trim()));}catch{setAns("Network error — try again.");}
    setBusy(false);};
  const ACTIONS=[["fullsale","📝","Invoice","#0E7AD3"],["qrcpt","🧾","Receipt",T.ok],["qexp","💸","Expense",T.danger],["qsal","👷","Salary",T.acc2],["purchase","📦","Purchase","#5B6BD6"]];
  return(<div>
    <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
      <div><div style={{fontSize:13,color:T.dim}}>Vanakkam, {session.name}</div>
        <div style={{fontSize:22,fontWeight:800}}>Today: <span style={{color:T.acc}}>{inr(todaySales)}</span> <span style={{fontSize:12,color:T.dim,fontWeight:500}}>· {todayInvs.length} bills · Due {inr(receivables)}</span></div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(96px,1fr))",gap:10,marginBottom:14}}>
      {ACTIONS.map(([k,ic,l,c])=>(
        <button key={k} onClick={()=>setView(k)} style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:14,padding:"16px 8px",cursor:"pointer",boxShadow:"0 1px 3px rgba(20,30,60,.06)"}}>
          <div style={{fontSize:26}}>{ic}</div>
          <div style={{fontSize:12.5,fontWeight:700,color:c,marginTop:4}}>{l}</div>
        </button>))}
    </div>
    <Card>
      <div style={{fontWeight:800,marginBottom:8}}>🤖 AI Suggestions</div>
      {sugg.slice(0,4).map((s,i)=><div key={i} style={{fontSize:13,padding:"5px 0",borderBottom:i<Math.min(sugg.length,4)-1?`1px solid ${T.line}`:"none"}}>{s}</div>)}
    </Card>
    <Card>
      <div style={{fontWeight:800,marginBottom:8}}>💬 Ask AI</div>
      <div style={{display:"flex",gap:8}}>
        <input style={inp(0)} placeholder="Business question kelunga..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()}/>
        <button onClick={ask} disabled={busy} style={{...btn(T.acc),color:"#fff",fontWeight:700}}>{busy?"...":"Ask"}</button>
      </div>
      {ans&&<div style={{marginTop:10,background:T.panel2,borderRadius:10,padding:12,fontSize:13,whiteSpace:"pre-wrap"}}>{ans}</div>}
    </Card>
  </div>);
}
/* ---------- Quick Entry: Expense / Receipt / Daily Salary ---------- */
function QuickEntry({db,save,log,flash,kind}){
  const cfg={Expense:{title:"💸 Expense Entry",acctPh:"Expense name (Rent, Tea, EB...)",vtype:"Expense"},
    Receipt:{title:"🧾 Receipt (Payment In)",acctPh:"From (customer/party name)",vtype:"Receipt"},
    Salary:{title:"👷 Daily Salary / Wage",acctPh:"Worker name",vtype:"Expense"}}[kind];
  const [f,setF]=useState({account:"",amt:"",mode:"Cash",note:""});
  const vouchers=(db.vouchers||[]).filter(v=>kind==="Salary"?v.account.startsWith("Daily Wage:"):v.type===cfg.vtype&&!v.account.startsWith("Daily Wage:")).slice(0,10);
  const saveIt=()=>{
    if(!f.account.trim()||!(+f.amt>0))return flash("Name & amount required");
    const d=structuredClone(db);d.vouchers=d.vouchers||[];
    const account=kind==="Salary"?`Daily Wage: ${f.account.trim()}`:f.account.trim();
    const no=`${cfg.vtype.slice(0,3).toUpperCase()}-${String(d.vouchers.length+1).padStart(4,"0")}`;
    d.vouchers.unshift({id:uid(),no,ts:Date.now(),type:cfg.vtype,account,amt:+f.amt,mode:f.mode,note:f.note.trim()});
    log(d,`${kind}: ${account} ${inr(+f.amt)}`);
    save(d);setF({account:"",amt:"",mode:"Cash",note:""});flash(`${inr(+f.amt)} saved`);
  };
  return(<div>
    <H1>{cfg.title}</H1>
    <Card>
      <input style={inp()} placeholder={cfg.acctPh+" *"} value={f.account} onChange={e=>setF(s=>({...s,account:e.target.value}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 130px",gap:8}}>
        <input style={inp(0)} type="number" placeholder="Amount ₹ *" value={f.amt} onChange={e=>setF(s=>({...s,amt:e.target.value}))}/>
        <select style={inp(0)} value={f.mode} onChange={e=>setF(s=>({...s,mode:e.target.value}))}>{["Cash","UPI","Bank","Card"].map(m=><option key={m}>{m}</option>)}</select>
      </div>
      <input style={inp()} placeholder="Note (optional)" value={f.note} onChange={e=>setF(s=>({...s,note:e.target.value}))}/>
      <button onClick={saveIt} style={{...btn(T.acc),color:"#fff",fontWeight:800,width:"100%",padding:11}}>💾 Save {kind}</button>
    </Card>
    <div style={{fontWeight:700,margin:"12px 0 8px",fontSize:14}}>Recent</div>
    {vouchers.map(v=>(
      <Card key={v.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,fontSize:13}}><b>{v.account.replace("Daily Wage: ","")}</b>
          <div style={{fontSize:11,color:T.dim}}>{fmtTs(v.ts)} · {v.mode}{v.note?` · ${v.note}`:""}</div></div>
        <b style={{color:kind==="Receipt"?T.ok:T.danger}}>{inr(v.amt)}</b>
      </div></Card>))}
    {vouchers.length===0&&<div style={{color:T.dim,fontSize:13}}>No entries yet.</div>}
  </div>);
}
/* ---------- More grid (mobile) ---------- */
function MoreGrid({nav,setView,showAll,toggleAll}){
  const skip=new Set(["home","pos","purchase","reports"]);
  return(<div>
    <H1>More</H1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10}}>
      {nav.filter(n=>n[2]&&!skip.has(n[0])).map(([k,label])=>(
        <button key={k} onClick={()=>setView(k)} style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:12,padding:"14px 6px",cursor:"pointer",fontSize:12,fontWeight:600,color:T.text}}>{label}</button>))}
    </div>
    <button onClick={toggleAll} style={{...btn(T.panel2),width:"100%",marginTop:14,fontSize:12,color:T.dim}}>{showAll?"🔒 Simple mode":"🔓 All features (advanced)"}</button>
  </div>);
}
/* ---------- Excel export helper ---------- */
const xls=(rows,name)=>{const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Sheet1");
  XLSX.writeFile(wb,name);};

/* ---------- WhatsApp Center (queue-based, ToS-safe) ---------- */
function WhatsAppCenter({db,save,log,flash,company}){
  const wa=db.settings?.waAuto||{};
  const queue=db.waQueue||[];
  const norm=p=>(p||"").replace(/\D/g,"").slice(-10);
  const link=(phone,text)=>`https://wa.me/91${norm(phone)}?text=${encodeURIComponent(text)}`;

  // auto-populate due reminders (once per day per customer, dedupe by key)
  useEffect(()=>{
    if(wa.reminder===false)return;
    const day=new Date().toISOString().slice(0,10);
    const d=structuredClone(db);d.waQueue=d.waQueue||[];
    let added=0;
    d.customers.forEach(c=>{
      if(!c.phone)return;
      const due=d.invoices.filter(i=>i.customerId===c.id&&!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
      if(due<=0)return;
      const key=`rem-${c.id}-${day}`;
      if(d.waQueue.some(q=>q.key===key))return;
      d.waQueue.unshift({id:uid(),key,ts:Date.now(),type:"Reminder",phone:c.phone,name:c.name,
        text:`Vanakkam ${c.name},\nPending balance: ${inr(due)}\nKindly settle at your convenience. Nandri! 🙏\n— ${company?.name||"BillDNA"}`,sent:false});
      added++;
    });
    if(added>0)save(d);
  },[]); // eslint-disable-line

  const markSent=id=>{const d=structuredClone(db);
    const q=(d.waQueue||[]).find(x=>x.id===id);if(q)q.sent=true;
    d.waQueue=d.waQueue.slice(0,100);save(d);};
  const setToggle=k=>{const d=structuredClone(db);
    d.settings={...d.settings,waAuto:{...wa,[k]:wa[k]===false?true:false}};
    log(d,`WA auto ${k} toggled`);save(d);};
  const setOwn=v=>{const d=structuredClone(db);
    d.settings={...d.settings,ownPhone:v};save(d);};
  const clearSent=()=>{const d=structuredClone(db);
    d.waQueue=(d.waQueue||[]).filter(q=>!q.sent);save(d);flash("Cleared");};

  const pending=queue.filter(q=>!q.sent), done=queue.filter(q=>q.sent);
  const today=new Date().toDateString();
  const tInvs=db.invoices.filter(i=>new Date(i.ts).toDateString()===today&&i.type.includes("Invoice")&&!i.returned);
  const digest=`*${company?.name||"BillDNA"} — Daily Summary*\nSales: ${inr(tInvs.reduce((a,i)=>a+i.total,0))} (${tInvs.length} bills)\nPending collections: ${inr(db.invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0))}`;
  const TOG=[["invoice","🧾 Bill save aana → invoice message queue"],["reminder","⏰ Pending due → daily reminder queue"],["thanks","🙏 Payment vandha → thank-you queue"]];

  return(<div>
    <H1>📲 WhatsApp</H1>
    <Card>
      {TOG.map(([k,l])=>(
        <div key={k} style={{display:"flex",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.line}`}}>
          <span style={{flex:1,fontSize:13.5}}>{l}</span>
          <button onClick={()=>setToggle(k)} style={{...btn(wa[k]===false?T.panel2:T.ok),color:wa[k]===false?T.dim:"#fff",fontWeight:800,minWidth:52}}>{wa[k]===false?"OFF":"ON"}</button>
        </div>))}
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
        <input style={inp(0)} placeholder="Ungal WhatsApp number (digest-ku)" value={db.settings?.ownPhone||""} onChange={e=>setOwn(e.target.value)}/>
        {db.settings?.ownPhone&&<a href={link(db.settings.ownPhone,digest)} target="_blank" rel="noreferrer" style={{...btn(T.acc),color:"#fff",fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>📊 Digest</a>}
      </div>
    </Card>
    <div style={{display:"flex",alignItems:"center",margin:"12px 0 8px"}}>
      <div style={{fontWeight:800,fontSize:14}}>Send Queue ({pending.length})</div>
      {done.length>0&&<button onClick={clearSent} style={{...btn(T.panel2),marginLeft:"auto",fontSize:11,color:T.dim}}>Clear {done.length} sent</button>}
    </div>
    {pending.map(q=>(
      <Card key={q.id}><div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <b style={{fontSize:13}}>{q.name}</b> <span style={{fontSize:10,color:T.dim}}>· {q.type} · {fmtTs(q.ts)}</span>
          <div style={{fontSize:11,color:T.dim,whiteSpace:"pre-wrap",maxHeight:48,overflow:"hidden"}}>{q.text}</div>
        </div>
        <a href={link(q.phone,q.text)} target="_blank" rel="noreferrer" onClick={()=>markSent(q.id)}
          style={{...btn(T.ok),color:"#fff",fontWeight:800,textDecoration:"none"}}>Send ➤</a>
      </div></Card>))}
    {pending.length===0&&<Card><div style={{color:T.ok,fontSize:13}}>✓ Queue empty — bills pottadhum auto-ah inga varum.</div></Card>}
    <div style={{fontSize:11,color:T.dim,marginTop:8}}>One-tap send — WhatsApp open aagi message ready-ah irukkum. Full-auto (tap illama) backend phase-la varum. QR/linked-device method use pannala — number ban risk zero.</div>
  </div>);
}

/* ---------- Full Sale (B2B invoice form, v2.2) ---------- */
function FullSale({db,save,log,notify,flash,branch,company}){
  const isComp=company?.scheme==="composite";
  const compRate=company?.compRate||1;
  const blankRow=()=>({id:uid(),q:"",pid:null,name:"",qty:1,unit:"pcs",rate:"",taxMode:"excl",gst:18});
  const [mode,setMode]=useState("Cash");
  const [custId,setCustId]=useState("");
  const [addParty,setAddParty]=useState(false);
  const [np,setNp]=useState({name:"",phone:""});
  const [supply,setSupply]=useState("local");
  const [rows,setRows]=useState([blankRow(),blankRow()]);
  const [received,setReceived]=useState("");
  const [payAcct,setPayAcct]=useState("Cash");
  const [roundOff,setRoundOff]=useState(true);
  const [newBank,setNewBank]=useState("");
  const savingRef=useRef(false);

  const banks=db.settings?.banks||[];
  const custBal=id=>db.invoices.filter(i=>i.customerId===id&&!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
  const upd=(id,k,v)=>setRows(rs=>rs.map(r=>r.id===id?{...r,[k]:v}:r));
  const pick=(id,p)=>setRows(rs=>rs.map(r=>r.id===id?{...r,q:"",pid:p.id,name:p.name,unit:p.unit,rate:p.price,gst:p.gst}:r));
  const calc=r=>{const qty=+r.qty||0,rate=+r.rate||0,g=+r.gst||0;
    const base=r.taxMode==="incl"?rate*qty/(1+g/100):rate*qty;
    const tax=base*g/100;return{base,tax,amt:base+tax};};
  const live=rows.filter(r=>r.name.trim()&&+r.rate>0&&+r.qty>0);
  const sub=live.reduce((a,r)=>a+calc(r).base,0);
  const tax=live.reduce((a,r)=>a+calc(r).tax,0);
  const raw=sub+tax;
  const total=roundOff?Math.round(raw):Math.round(raw*100)/100;
  const rDiff=Math.round((total-raw)*100)/100;
  const paid=received===""?(mode==="Cash"?total:0):Math.min(+received||0,total);
  const balance=Math.round((total-paid)*100)/100;

  const addPartyNow=()=>{
    if(!np.name.trim())return flash("Party name required");
    const d=structuredClone(db);
    const c={id:uid(),name:np.name.trim(),phone:np.phone.trim(),gstin:"",city:"",ts:Date.now()};
    d.customers.push(c);log(d,`Party added: ${c.name}`);save(d);
    setCustId(c.id);setAddParty(false);setNp({name:"",phone:""});flash("Party added");
  };
  const addBank=()=>{
    if(!newBank.trim())return flash("Bank name?");
    const d=structuredClone(db);
    d.settings={...d.settings,banks:[...(d.settings?.banks||[]),newBank.trim()]};
    save(d);setPayAcct(newBank.trim());setNewBank("");flash("Bank added");
  };

  const doSave=(andNew)=>{
    if(live.length===0)return flash("Items add pannunga");
    if(mode==="Credit"&&!custId)return flash("Credit bill-ku customer must");
    if(savingRef.current)return;savingRef.current=true;setTimeout(()=>{savingRef.current=false;},0);
    const d=structuredClone(db);d.seq.inv++;
    const pfx=d.settings?.invPrefix?d.settings.invPrefix+"-":"";
    const no=`${pfx}GST-${String(d.seq.inv).padStart(4,"0")}`;
    const payMode=mode==="Credit"?"Credit":payAcct==="Cash"?"Cash":"Bank";
    const items=live.map(r=>{const c=calc(r);return{pid:r.pid,name:r.name.trim(),qty:+r.qty,unit:r.unit,
      rate:Math.round(c.base/+r.qty*100)/100,gst:+r.gst,hsn:r.pid?(d.products.find(p=>p.id===r.pid)?.hsn||""):""};});
    const compTotal=roundOff?Math.round(sub):Math.round(sub*100)/100;
    const inv=isComp?{id:uid(),no,type:"GST Invoice",billType:"Bill of Supply",comp:true,compRate,customerId:custId||null,
      items:items.map(it=>({...it,gst:0})),sub:Math.round(sub*100)/100,tax:0,total:compTotal,
      paid:received===""?(mode==="Cash"?compTotal:0):Math.min(+received||0,compTotal),payMode,
      ts:Date.now(),branchId:branch?.id||null,returned:false,igst:false}
      :{id:uid(),no,type:"GST Invoice",customerId:custId||null,items,
      sub:Math.round(sub*100)/100,tax:Math.round((tax+rDiff)*100)/100,total,paid,payMode,
      ts:Date.now(),branchId:branch?.id||null,returned:false,igst:supply==="inter"};
    d.invoices.unshift(inv);
    items.forEach(it=>{if(!it.pid)return;
      const p=d.products.find(x=>x.id===it.pid);if(!p)return;
      const wh=Object.keys(p.stock)[0]||"default";
      p.stock[wh]=(p.stock[wh]||0)-it.qty;
      d.stockMoves.unshift({id:uid(),ts:Date.now(),pid:it.pid,wh,qty:-it.qty,type:"Sale",ref:no});
      if(totalStock(p)<=p.low&&p.low>0)notify(d,`Low stock: ${p.name} (${totalStock(p)} left)`);});
    const waCust=d.customers.find(c=>c.id===custId);
    if(waCust?.phone&&(d.settings?.waAuto?.invoice!==false)){
      d.waQueue=d.waQueue||[];
      d.waQueue.unshift({id:uid(),key:`inv-${no}`,ts:Date.now(),type:"Invoice",phone:waCust.phone,name:waCust.name,
        text:`*${company?.name||"Bill"}*\n${isComp?"Bill of Supply":(supply==="inter"?"Tax Invoice (IGST)":"Tax Invoice")} ${no}\nTotal: ${inr(isComp?(roundOff?Math.round(sub):sub):total)}${balance>0?`\nBalance: ${inr(balance)}`:"\nPaid ✓"}\nNandri! 🙏`,sent:false});
    }
    log(d,`Full Sale ${no} — ${inr(total)} (${payMode}${supply==="inter"?", IGST":""})`);
    save(d);flash(`${no} saved`);
    setRows([blankRow(),blankRow()]);setReceived("");
    if(!andNew){setCustId("");setMode("Cash");}
  };

  const th={fontSize:10.5,color:T.dim,fontWeight:700,padding:"4px 6px",textAlign:"left"};
  return(<div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:10}}>
      <H1>Full Sale</H1>
      <div style={{display:"flex",background:T.panel2,borderRadius:20,padding:3,marginLeft:"auto"}}>
        {["Credit","Cash"].map(m=><button key={m} onClick={()=>setMode(m)}
          style={{...btn(mode===m?T.acc:"transparent"),color:mode===m?"#fff":T.dim,fontWeight:700,borderRadius:16,padding:"5px 16px"}}>{m}</button>)}
      </div>
    </div>
    <Card>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:8}}>
        <div>
          <select style={inp(0)} value={custId} onChange={e=>e.target.value==="__add"?setAddParty(true):setCustId(e.target.value)}>
            <option value="">{mode==="Credit"?"Customer * (Credit)":"Walk-in / select customer"}</option>
            <option value="__add">➕ Add Party</option>
            {db.customers.map(c=><option key={c.id} value={c.id}>{c.name} — Bal {inr(custBal(c.id))}</option>)}
          </select>
          {custId&&<div style={{fontSize:11,color:custBal(custId)>0?T.danger:T.ok,marginTop:3}}>BAL: {inr(custBal(custId))}</div>}
        </div>
        <select style={inp(0)} value={supply} onChange={e=>setSupply(e.target.value)}>
          <option value="local">Local (CGST+SGST)</option>
          <option value="inter">Inter-state (IGST)</option>
        </select>
      </div>
      {addParty&&<div style={{display:"flex",gap:8,marginTop:8}}>
        <input style={inp(0)} placeholder="Party name *" value={np.name} onChange={e=>setNp(s=>({...s,name:e.target.value}))}/>
        <input style={inp(0)} placeholder="Phone" value={np.phone} onChange={e=>setNp(s=>({...s,phone:e.target.value}))}/>
        <button onClick={addPartyNow} style={{...btn(T.acc),color:"#fff",fontWeight:700}}>Save</button>
        <button onClick={()=>setAddParty(false)} style={btn(T.panel2)}>✕</button>
      </div>}
    </Card>
    <Card>
      <div style={{overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(160px,2fr) 64px 70px 90px 110px 90px 90px 30px",gap:0,minWidth:720}}>
          {["ITEM","QTY","UNIT","PRICE/UNIT","TAX MODE","GST %","AMOUNT",""].map(h=><div key={h} style={th}>{h}</div>)}
          {rows.map(r=>{const c=calc(r);
            const sugg=r.q?db.products.filter(p=>p.name.toLowerCase().includes(r.q.toLowerCase())).slice(0,5):[];
            return(<React.Fragment key={r.id}>
              <div style={{position:"relative",padding:3}}>
                <input style={inp(0)} placeholder="Item name / search" value={r.q||r.name}
                  onChange={e=>{upd(r.id,"q",e.target.value);upd(r.id,"name",e.target.value);upd(r.id,"pid",null);}}/>
                {sugg.length>0&&<div style={{position:"absolute",zIndex:20,background:T.panel,border:`1px solid ${T.line}`,borderRadius:8,width:"100%",boxShadow:"0 4px 12px rgba(20,30,60,.12)"}}>
                  {sugg.map(p=><button key={p.id} onClick={()=>pick(r.id,p)}
                    style={{display:"flex",width:"100%",background:"transparent",border:"none",padding:"7px 10px",cursor:"pointer",fontSize:12,gap:8,alignItems:"center"}}>
                    <span style={{flex:1,textAlign:"left",color:T.text}}>{p.name}</span>
                    <span style={{color:T.acc}}>{inr(p.price)}</span>
                    <span style={{color:totalStock(p)<0?T.danger:T.dim}}>stk {totalStock(p)}</span>
                  </button>)}
                </div>}
              </div>
              <div style={{padding:3}}><input style={inp(0)} type="number" value={r.qty} onChange={e=>upd(r.id,"qty",e.target.value)}/></div>
              <div style={{padding:3}}><select style={inp(0)} value={r.unit} onChange={e=>upd(r.id,"unit",e.target.value)}>
                {["pcs","kg","sqft","mtr","ltr","box","set","nos"].map(u=><option key={u}>{u}</option>)}</select></div>
              <div style={{padding:3}}><input style={inp(0)} type="number" placeholder="0" value={r.rate} onChange={e=>upd(r.id,"rate",e.target.value)}/></div>
              <div style={{padding:3}}><select style={inp(0)} value={r.taxMode} onChange={e=>upd(r.id,"taxMode",e.target.value)}>
                <option value="excl">Without Tax</option><option value="incl">With Tax</option></select></div>
              <div style={{padding:3}}><select style={inp(0)} value={r.gst} onChange={e=>upd(r.id,"gst",e.target.value)}>
                {GST_RATES.map(g=><option key={g} value={g}>GST {g}%</option>)}</select></div>
              <div style={{padding:"10px 6px",fontSize:13,textAlign:"right",fontWeight:600}}>{c.amt?inr(c.amt):"—"}</div>
              <button onClick={()=>setRows(rs=>rs.length>1?rs.filter(x=>x.id!==r.id):rs)} style={{background:"transparent",border:"none",color:T.danger,cursor:"pointer"}}>🗑</button>
            </React.Fragment>);})}
        </div>
      </div>
      <button onClick={()=>setRows(rs=>[...rs,blankRow()])} style={{...btn(T.panel2),marginTop:8,fontWeight:700,color:T.acc}}>+ ADD ROW</button>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12,alignItems:"start"}}>
      <Card>
        <div style={{fontSize:12,color:T.dim,marginBottom:6}}>Payment</div>
        <select style={inp()} value={payAcct} onChange={e=>e.target.value==="__bank"?null:setPayAcct(e.target.value)} disabled={mode==="Credit"}>
          <option>Cash</option><option>Cheque</option>
          {banks.map(b=><option key={b}>{b}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          <input style={inp(0)} placeholder="+ Add bank A/C" value={newBank} onChange={e=>setNewBank(e.target.value)}/>
          <button onClick={addBank} style={btn(T.panel2)}>Add</button>
        </div>
      </Card>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:T.dim}}><span>Subtotal</span><span>{inr(sub)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:T.dim}}><span>{supply==="inter"?"IGST":"CGST+SGST"}</span><span>{inr(tax)}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.dim,margin:"4px 0"}}>
          <input type="checkbox" checked={roundOff} onChange={e=>setRoundOff(e.target.checked)} style={{accentColor:T.acc}}/>Round off {rDiff!==0&&roundOff?`(${rDiff>0?"+":""}${rDiff})`:""}</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:19,fontWeight:800,color:T.acc,margin:"4px 0"}}><span>Total</span><span>{inr(total)}</span></div>
        <input style={inp()} type="number" placeholder={mode==="Cash"?`Received (blank = full)`:"Received (blank = 0)"} value={received} onChange={e=>setReceived(e.target.value)}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,color:balance>0?T.danger:T.ok,marginBottom:8}}><span>Balance</span><span>{inr(balance)}</span></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>doSave(false)} style={{...btn(T.acc),color:"#fff",fontWeight:800,flex:1,padding:11}}>💾 Save</button>
          <button onClick={()=>doSave(true)} style={{...btn("#0E7AD3"),color:"#fff",fontWeight:800,flex:1,padding:11}}>Save & New</button>
        </div>
      </Card>
    </div>
  </div>);
}

/* ---------- Company Profile Modal (Create / Change / Edit) ---------- */
function CompanyModal({db,save,log,notify,flash,onClose}){
  const cur=db.companies.find(c=>c.id===db.activeCompanyId);
  const [tab,setTab]=useState(cur?"view":"create");
  const empty={name:"",gstin:"",email:"",phone:"",address:"",city:"",state:"",scheme:"regular",compRate:1};
  const [f,setF]=useState(cur?{name:cur.name,gstin:cur.gstin||"",email:cur.email||"",phone:cur.phone||"",address:cur.address||"",city:cur.city||"",state:cur.state||"",scheme:cur.scheme||"regular",compRate:cur.compRate||1}:empty);
  const set=(k,v)=>setF(s=>({...s,[k]:v}));

  const createCo=()=>{
    if(!f.name.trim())return flash("Company name required");
    const d=structuredClone(db);
    const c={id:uid(),name:f.name.trim(),gstin:f.gstin.trim().toUpperCase(),email:f.email.trim(),phone:f.phone.trim(),
      address:f.address.trim(),city:f.city.trim(),state:f.state.trim(),scheme:f.scheme,compRate:+f.compRate||1,branches:[{id:uid(),name:"Main Branch",city:f.city.trim()}]};
    d.companies.push(c);d.activeCompanyId=c.id;d.activeBranchId=c.branches[0].id;
    log(d,`Company created: ${c.name}`);notify(d,`Company "${c.name}" created`);
    save(d);flash("Company created");onClose();
  };
  const saveEdit=()=>{
    if(!f.name.trim())return flash("Company name required");
    const d=structuredClone(db);const c=d.companies.find(x=>x.id===cur.id);
    Object.assign(c,{name:f.name.trim(),gstin:f.gstin.trim().toUpperCase(),email:f.email.trim(),phone:f.phone.trim(),
      address:f.address.trim(),city:f.city.trim(),state:f.state.trim(),scheme:f.scheme,compRate:+f.compRate||1});
    log(d,`Company edited: ${c.name}`);save(d);flash("Saved");onClose();
  };
  const switchCo=(cId)=>{const d=structuredClone(db);const c=d.companies.find(x=>x.id===cId);
    d.activeCompanyId=cId;d.activeBranchId=c.branches[0]?.id||null;
    log(d,`Switched company: ${c.name}`);save(d);flash(`Now: ${c.name}`);onClose();};

  const Field=({label,k,ph,area})=>(
    <div style={{marginBottom:8}}>
      <div style={{fontSize:11,color:T.dim,marginBottom:3}}>{label}</div>
      {area?<textarea style={{...inp(0),minHeight:56}} placeholder={ph} value={f[k]} onChange={e=>set(k,e.target.value)}/>
        :<input style={inp(0)} placeholder={ph} value={f[k]} onChange={e=>set(k,e.target.value)}/>}
    </div>);
  const Row=({l,v})=>v?<div style={{display:"flex",fontSize:13,padding:"6px 0",borderBottom:`1px solid ${T.line}`}}>
    <span style={{color:T.dim,width:90}}>{l}</span><span style={{flex:1,fontWeight:600}}>{v}</span></div>:null;

  return(<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(20,30,50,.45)",zIndex:200,display:"flex",justifyContent:"flex-end"}}>
    <div onClick={e=>e.stopPropagation()} style={{width:420,maxWidth:"92vw",height:"100%",background:T.bg,overflowY:"auto",boxShadow:"-4px 0 20px rgba(0,0,0,.15)"}}>
      <div style={{display:"flex",alignItems:"center",padding:"14px 16px",borderBottom:`1px solid ${T.line}`,background:T.panel,position:"sticky",top:0}}>
        <div style={{fontWeight:800,fontSize:16}}>Company</div>
        <button onClick={onClose} style={{...btn(T.panel2),marginLeft:"auto"}}>✕</button>
      </div>
      <div style={{display:"flex",gap:6,padding:12,flexWrap:"wrap"}}>
        {cur&&<button onClick={()=>setTab("view")} style={{...btn(tab==="view"?T.acc:T.panel2),color:tab==="view"?"#fff":T.text,fontWeight:600,fontSize:12}}>Details</button>}
        <button onClick={()=>{setF(empty);setTab("create");}} style={{...btn(tab==="create"?T.acc:T.panel2),color:tab==="create"?"#fff":T.text,fontWeight:600,fontSize:12}}>➕ Create</button>
        {db.companies.length>1&&<button onClick={()=>setTab("change")} style={{...btn(tab==="change"?T.acc:T.panel2),color:tab==="change"?"#fff":T.text,fontWeight:600,fontSize:12}}>🔄 Change</button>}
        {cur&&<button onClick={()=>{setF({name:cur.name,gstin:cur.gstin||"",email:cur.email||"",phone:cur.phone||"",address:cur.address||"",city:cur.city||"",state:cur.state||""});setTab("edit");}} style={{...btn(tab==="edit"?T.acc:T.panel2),color:tab==="edit"?"#fff":T.text,fontWeight:600,fontSize:12}}>✏️ Edit</button>}
      </div>
      <div style={{padding:"0 16px 24px"}}>
        {tab==="view"&&cur&&<Card>
          <div style={{fontWeight:800,fontSize:17,marginBottom:8}}>{cur.name}</div>
          <Row l="Scheme" v={cur.scheme==="composite"?`Composition (${cur.compRate||1}%)`:"Regular GST"}/>
          <Row l="GSTIN" v={cur.gstin}/><Row l="Email" v={cur.email}/><Row l="Mobile" v={cur.phone}/>
          <Row l="Address" v={cur.address}/><Row l="City" v={cur.city}/><Row l="State" v={cur.state}/>
          <Row l="Branches" v={cur.branches.map(b=>b.name).join(", ")}/>
          {!cur.gstin&&!cur.email&&!cur.phone&&<div style={{fontSize:12,color:T.acc2,marginTop:8}}>Details empty — Edit tab-la fill pannunga.</div>}
        </Card>}
        {(tab==="create"||tab==="edit")&&<Card>
          <div style={{fontWeight:700,marginBottom:10}}>{tab==="create"?"New company":"Edit company"}</div>
          <Field label="Company name *" k="name" ph="e.g. Sree Enterprises"/>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,color:T.dim,marginBottom:4}}>GST Scheme *</div>
            <div style={{display:"flex",gap:8}}>
              {[["regular","Regular GST"],["composite","Composition"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("scheme",v)} style={{...btn(f.scheme===v?T.acc:T.panel2),color:f.scheme===v?"#fff":T.text,fontWeight:700,flex:1,fontSize:12.5}}>{l}</button>))}
            </div>
            {f.scheme==="composite"&&<div style={{marginTop:8}}>
              <div style={{fontSize:11,color:T.dim,marginBottom:4}}>Composition rate</div>
              <div style={{display:"flex",gap:6}}>
                {[[1,"1% Trade/Mfr"],[5,"5% Restaurant"],[6,"6% Service"]].map(([r,l])=>(
                  <button key={r} onClick={()=>set("compRate",r)} style={{...btn(+f.compRate===r?T.acc2:T.panel2),color:+f.compRate===r?"#fff":T.text,fontWeight:600,flex:1,fontSize:11}}>{l}</button>))}
              </div>
              <div style={{fontSize:10.5,color:T.acc2,marginTop:6}}>⚠ Composition: Bill of Supply · no tax from customer · intra-state only · CMP-08</div>
            </div>}
          </div>
          <Field label="GSTIN" k="gstin" ph="33ABCDE1234F1Z5"/>
          <Field label="Email" k="email" ph="business@email.com"/>
          <Field label="Mobile" k="phone" ph="98765 43210"/>
          <Field label="Address" k="address" ph="Shop / office address" area/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Field label="City" k="city" ph="City"/>
            <Field label="State" k="state" ph="Tamil Nadu"/>
          </div>
          <button onClick={tab==="create"?createCo:saveEdit} style={{...btn(T.acc),color:"#fff",fontWeight:800,width:"100%",padding:11,marginTop:6}}>
            {tab==="create"?"Create company":"Save changes"}</button>
        </Card>}
        {tab==="change"&&<Card>
          <div style={{fontWeight:700,marginBottom:8}}>Switch company</div>
          {db.companies.map(c=>(
            <button key={c.id} onClick={()=>switchCo(c.id)} style={{display:"flex",width:"100%",alignItems:"center",gap:10,background:c.id===db.activeCompanyId?T.panel2:"transparent",border:`1px solid ${T.line}`,borderRadius:10,padding:"10px 12px",marginBottom:6,cursor:"pointer"}}>
              <div style={{flex:1,textAlign:"left"}}><b style={{fontSize:13}}>{c.name}</b>
                <div style={{fontSize:11,color:T.dim}}>{c.gstin||"no GSTIN"} · {c.branches.length} branch</div></div>
              {c.id===db.activeCompanyId&&<span style={{fontSize:11,color:T.ok,fontWeight:700}}>✓ Active</span>}
            </button>))}
        </Card>}
      </div>
    </div>
  </div>);
}

/* ---------- UI primitives ---------- */
const H1=({children})=><div style={{fontSize:20,fontWeight:800,marginBottom:12}}>{children}</div>;
const Card=({children})=><div style={{background:T.panel,border:`1px solid ${T.line}`,borderRadius:10,padding:14,marginBottom:12}}>{children}</div>;
const btn=bg=>({background:bg,border:"none",borderRadius:8,padding:"8px 12px",color:T.text,cursor:"pointer",fontSize:13});
const inp=(mb=8)=>({background:T.panel2,border:`1px solid ${T.line}`,borderRadius:8,padding:"9px 10px",color:T.text,width:"100%",boxSizing:"border-box",marginBottom:mb,fontSize:13,display:"block"});
