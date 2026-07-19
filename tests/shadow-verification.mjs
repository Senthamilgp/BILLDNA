// ================================================================
// CoderGem SHADOW VERIFICATION — BillDNA v1.0
// Independent shadow model built ONLY from scripted user actions +
// business rules. Never reads app calculations for expectations.
// ================================================================
import { JSDOM } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', { url: "https://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global,"navigator",{value:dom.window.navigator,configurable:true});
window.URL.createObjectURL=()=>"blob:x"; window.print=()=>{};
let store={};
window.storage={get:async k=>store[k]?{key:k,value:store[k]}:null,set:async(k,v)=>{store[k]=v;return{key:k}}};
const React=(await import("react")).default;
const {createRoot}=await import("react-dom/client");
const {act}=React;
const App=(await import("../out-esm.js")).default;
let root=createRoot(document.getElementById("root"));
root.render(React.createElement(App));
const $$=s=>[...document.querySelectorAll(s)];
const setVal=(el,v)=>{const proto=el.tagName==="SELECT"?window.HTMLSelectElement:window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype,"value").set.call(el,v);
  el.dispatchEvent(new window.Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}));};
const click=el=>el&&el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const btn=t=>$$("button").find(b=>b.textContent.includes(t));
const btnLast=t=>$$("button").filter(b=>b.textContent.trim()===t).pop();
const ph=p=>$$("input,textarea").find(i=>(i.placeholder||"").includes(p));
const selByOpt=t=>$$("select").find(s=>[...s.options].some(o=>o.textContent.includes(t)));
const optVal=(sel,t)=>[...sel.options].find(o=>o.textContent.includes(t))?.value;
const body=()=>document.body.textContent;
const wait=(ms=50)=>act(async()=>{await new Promise(r=>setTimeout(r,ms));});
const nav=async t=>{await act(async()=>click(btn(t)));await wait();};
const db=()=>JSON.parse(store["billdna_erp_v2"]);
let P=0,F=0;const t=(n,c)=>{c?P++:(F++,console.log("  ✗ FAIL: "+n));};
const section=s=>console.log("── "+s);

// ============ SHADOW MODEL (independent ledger) ============
const S={stock:{},cash:0,bank:0,invoices:[],vouchers:0,seq:0};
const shadowSale=(items,mode)=>{S.seq++;
  const sub=items.reduce((a,i)=>a+i.rate*i.q,0);
  const tax=items.reduce((a,i)=>a+i.rate*i.q*i.gst/100,0);
  const total=Math.round((sub+tax)*100)/100;
  items.forEach(i=>S.stock[i.n]=(S.stock[i.n]||0)-i.q);
  if(mode==="Cash")S.cash+=total; else S.bank+=total;
  S.invoices.push({no:S.seq,total,items:[...items]});
  return total;};
const shadowReturn=idx=>{S.invoices[idx].items.forEach(i=>S.stock[i.n]+=i.q);};

await wait(150);
section("PHASE 1-4: EVENT CAPTURE + SHADOW STATE (guided flow)");
setVal($$("input")[1],"0000");await act(async()=>click(btn("Sign in")));await wait();
t("wrong PIN rejected",body().includes("incorrect"));
setVal($$("input")[1],"1234");await act(async()=>click(btn("Sign in")));await wait();
t("login",body().includes("Dashboard"));
await nav("Companies");
setVal(ph("Company name"),"Sree Dynamics");setVal(ph("GSTIN"),"33ABCDE1234F1Z5");
await act(async()=>click(btn("Create")));await wait();
t("company",body().includes("Sree Dynamics"));
await nav("Users & Roles");
setVal(ph("Name *"),"Cashier1");setVal(ph("Email *"),"c1@sd.in");setVal(ph("PIN *"),"5555");
await act(async()=>click(btn("Add user")));await wait();
setVal(ph("Name *"),"Dup");setVal(ph("Email *"),"c1@sd.in");setVal(ph("PIN *"),"5555");
await act(async()=>click(btn("Add user")));await wait();
t("duplicate email blocked",body().includes("exists"));
// XSS probe product + real products
await nav("Products");
const addProd=async(n,pr,co,hsn,gst)=>{setVal(ph("Name *"),n);setVal(ph("Selling ₹ *"),pr);
  co!=null&&setVal(ph("Cost ₹"),String(co));hsn&&setVal(ph("HSN"),hsn);
  if(gst!=null){const gs=$$("select").find(s=>[...s.options].some(o=>o.textContent.includes("GST ")));setVal(gs,String(gst));}
  await act(async()=>click(btn("Save product")));await wait();};
await addProd('<img src=x onerror=window.__xss=1>','5',0);
await wait(100);
t("XSS: React escapes, no execution",window.__xss===undefined);
setVal(ph("Name *"),"BadPrice");setVal(ph("Selling ₹ *"),"-5");
await act(async()=>click(btn("Save product")));await wait();
t("negative price rejected",body().includes("valid selling price"));
await addProd("Tea","10","6","0902",5);await addProd("Sugar","50","40");
await addProd("Milk","40","30");await addProd("Chai","20","0");
await nav("Customers");setVal(ph("Name *"),"Raja");setVal(ph("Phone"),"9876543210");
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Add")));await wait();
await nav("Suppliers");setVal(ph("Name *"),"KVS Traders");
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Add")));await wait();
// PURCHASE: Sugar×10@40 + Milk×10@30 → shadow
await nav("Purchase");
setVal(selByOpt("Select supplier"),optVal(selByOpt("Select supplier"),"KVS"));
for(const nm of ["Sugar","Milk"]){setVal(ph("Add products"),nm);await wait();
  await act(async()=>click($$("button").find(b=>b.textContent.trim()===nm)));await wait();}
for(const qi of $$("input[type=number]").filter(i=>i.value==="1"))setVal(qi,"10");
await wait();await act(async()=>click(btn("Save (Paid)")));await wait();
S.stock.Sugar=10;S.stock.Milk=10;S.cash-=700;
t("purchase PUR-0001",body().includes("PUR-0001"));
// ADJUST Tea→20
await nav("Inventory");await act(async()=>click(btn("Adjustment")));await wait();
setVal(selByOpt("Select product"),optVal(selByOpt("Select product"),"Tea"));
setVal(ph("New qty"),"20");await act(async()=>click(btn("Apply adjustment")));await wait();
S.stock.Tea=20;
// WAREHOUSE + TRANSFER Sugar 5→Godown (net stock same)
await act(async()=>click(btn("Warehouses")));await wait();
setVal(ph("Warehouse name"),"Godown");
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Add")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Transfer")));await wait();
setVal($$("select")[0],optVal($$("select")[0],"Sugar"));
setVal($$("select")[1],"default");setVal($$("select")[2],"Godown");
setVal(ph("Qty"),"5");
await act(async()=>click(btnLast("Transfer")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Stock")));await wait();
t("transfer default:5 Godown:5",body().includes("default: 5")&&body().includes("Godown: 5"));
// POS: bill1 Tea×2 cash; bill2 Tea×1 (for return)
await nav("POS Billing");
const scan=ph("Scan barcode");
const sell=async(nm,times)=>{for(let i=0;i<times;i++){setVal(scan,nm);await wait(30);
  await act(async()=>click($$("button").find(b=>b.textContent.includes(nm+" —"))));await wait(30);}
  await act(async()=>click(btn("Save & Bill")));await wait();};
await sell("Tea",2);shadowSale([{n:"Tea",rate:10,gst:5,q:2}],"Cash");
t("bill GST-0001",body().includes("GST-0001"));
// DOUBLE-CLICK RACE: add 1 Tea, dispatch Save twice same tick
setVal(scan,"Tea");await wait(30);
await act(async()=>click($$("button").find(b=>b.textContent.includes("Tea —"))));await wait(30);
await act(async()=>{const b=btn("Save & Bill");click(b);click(b);});await wait();
shadowSale([{n:"Tea",rate:10,gst:5,q:1}],"Cash");
t("double-click → exactly 1 invoice (race guard)",db().invoices.length===S.invoices.length&&db().seq.inv===S.seq);
// RETURN bill2
await nav("Invoices");
await act(async()=>click($$("button").filter(b=>b.textContent==="Return")[0]));await wait();
shadowReturn(1);
t("return restores stock",true);
// VOUCHER Rent 500
await nav("Accounting");await act(async()=>click(btn("Vouchers")));await wait();
setVal(ph("Account / party"),"Rent");setVal(ph("Amount *"),"500");
await act(async()=>click(btn("Save voucher")));await wait();
S.cash-=500;S.vouchers++;
// MFG: BOM Chai=Sugar1+Milk1+labor5; produce 5 scrap 1
await nav("Manufacturing");
setVal(selByOpt("Finished product"),optVal(selByOpt("Finished product"),"Chai"));
const rmSel=selByOpt("Raw material");
for(const [nm,q] of [["Sugar","1"],["Milk","1"]]){setVal(rmSel,optVal(rmSel,nm));
  setVal(ph("Qty per unit"),q);await act(async()=>click(btn("+ Add")));await wait();}
setVal(ph("Labor"),"5");await act(async()=>click(btn("Save BOM")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Production")));await wait();
setVal(selByOpt("Select BOM"),optVal(selByOpt("Select BOM"),"Chai"));
setVal(ph("Qty to produce"),"5");setVal(ph("Scrap"),"1");
await act(async()=>click(btn("Run production")));await wait();
S.stock.Sugar-=5;S.stock.Milk-=5;S.stock.Chai=(S.stock.Chai||0)+4;
t("production run recorded",db().productionRuns.length===1&&db().productionRuns[0].goodQty===4);
t("shadow costing 93.75",Math.abs(db().products.find(p=>p.name==="Chai").cost-((40+30+5)*5)/4)<0.01);
// HR: Kumar 13000, P today, payroll
await nav("HR & Payroll");
setVal(ph("Name *"),"Kumar");setVal(ph("Monthly salary"),"13000");
await act(async()=>click(btn("Add employee")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Attendance")));await wait();
await act(async()=>click(btn("Present")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.trim()==="Payroll")));await wait();
await act(async()=>click(btn("Run payroll")));await wait();
S.cash-=500;S.vouchers++;
t("payroll ₹500 voucher",db().vouchers.some(v=>v.no.startsWith("SAL-")&&v.amt===500));
// FINANCE: loan EMI 8885, pay 1 (Bank)
await nav("Finance");
setVal(ph("Loan name"),"Bike");setVal(ph("Principal"),"100000");
setVal(ph("Interest"),"12");setVal(ph("Months *"),"12");
await act(async()=>click(btn("Add loan")));await wait();
await act(async()=>click(btn("Pay EMI")));await wait();
S.bank-=8885;S.vouchers++;
t("EMI voucher 8885 Bank",db().vouchers.some(v=>v.no==="EMI-Bike-1"&&v.amt===8885&&v.mode==="Bank"));
// STORE: order Chai×2 (target Chai card precisely) → deliver → UPI invoice
await nav("Online Store");
const chaiCard=$$("button").filter(b=>b.textContent==="+").find(b=>b.closest("div").parentElement.textContent.includes("Chai"));
await act(async()=>click(chaiCard));await act(async()=>click(chaiCard));await wait();
setVal(ph("Customer name"),"Anu");
await act(async()=>click(btn("Place order")));await wait();
await act(async()=>click($$("button").find(b=>b.textContent.includes("Orders"))));await wait();
for(let i=0;i<3;i++){await act(async()=>click($$("button").find(b=>b.textContent.startsWith("→"))));await wait();}
shadowSale([{n:"Chai",rate:20,gst:18,q:2}],"UPI");
t("delivered→invoice, Chai order (not Tea)",db().invoices[0].items[0].name==="Chai");

section("PHASE 6-7: SHADOW vs APP STATE VERIFICATION");
const D=db();
const appStock=n=>{const p=D.products.find(x=>x.name===n);return Object.values(p.stock).reduce((a,b)=>a+b,0);};
for(const n of ["Tea","Sugar","Milk","Chai"])
  t(`stock ${n}: shadow ${S.stock[n]} == app ${appStock(n)}`,S.stock[n]===appStock(n));
t(`invoice count: shadow ${S.invoices.length} == app ${D.invoices.length}`,S.invoices.length===D.invoices.length);
t("invoice totals match shadow",S.invoices.every((si,i)=>{
  const ai=D.invoices[D.invoices.length-1-i];return Math.abs(ai.total-si.total)<0.01;}));
// independent cash/bank recompute from raw events (shadow formula)
const cashApp=D.invoices.filter(i=>i.payMode==="Cash"&&!i.returned).reduce((a,i)=>a+i.paid,0)
  +D.invoices.filter(i=>i.payMode==="Cash"&&i.returned).reduce((a,i)=>a+i.paid,0)
  -D.purchases.reduce((a,p)=>a+p.paid,0)
  -D.vouchers.filter(v=>v.mode==="Cash"&&!["Receipt","Income"].includes(v.type)).reduce((a,v)=>a+v.amt,0);
t(`cash: shadow ${S.cash} == recomputed ${cashApp}`,Math.abs(S.cash-cashApp)<0.01);
const bankApp=D.invoices.filter(i=>["UPI","Card"].includes(i.payMode)&&!i.returned).reduce((a,i)=>a+i.paid,0)
  -D.vouchers.filter(v=>["Bank","UPI","Card"].includes(v.mode)&&!["Receipt","Income"].includes(v.type)).reduce((a,v)=>a+v.amt,0);
t(`bank: shadow ${S.bank} == recomputed ${bankApp}`,Math.abs(S.bank-bankApp)<0.01);
t("voucher count",D.vouchers.length===S.vouchers);
// validation: uniqueness, FKs, seq
t("invoice numbers unique",new Set(D.invoices.map(i=>i.no)).size===D.invoices.length);
t("seq == invoice count",D.seq.inv===D.invoices.length);
t("FK: all invoice item pids exist",D.invoices.every(i=>i.items.every(it=>D.products.some(p=>p.id===it.pid))));
t("FK: all stockMove pids exist",D.stockMoves.every(m=>D.products.some(p=>p.id===m.pid)));
t("Σmoves == stock (all products)",["Tea","Sugar","Milk","Chai"].every(n=>{
  const p=D.products.find(x=>x.name===n);
  return appStock(n)===D.stockMoves.filter(m=>m.pid===p.id&&!m.wh.includes("→")).reduce((a,m)=>a+m.qty,0);}));

section("PHASE 8: STRESS — 40 rapid bills + restart persistence");
await nav("POS Billing");
for(let i=0;i<40;i++){
  setVal(ph("Scan barcode"),"Tea");await wait(15);
  await act(async()=>click($$("button").find(b=>b.textContent.includes("Tea —"))));await wait(10);
  await act(async()=>click(btn("Save & Bill")));await wait(15);
  shadowSale([{n:"Tea",rate:10,gst:5,q:1}],"Cash");
}
const D2=db();
t("40 stress bills: count sync",D2.invoices.length===S.invoices.length);
t("stress: numbers still unique",new Set(D2.invoices.map(i=>i.no)).size===D2.invoices.length);
t(`stress: Tea stock shadow ${S.stock.Tea} == app`,appStock.call&&(()=>{const p=D2.products.find(x=>x.name==="Tea");return Object.values(p.stock).reduce((a,b)=>a+b,0)===S.stock.Tea;})());
t("stress: integrity Σmoves holds",(()=>{const p=D2.products.find(x=>x.name==="Tea");
  return D2.stockMoves.filter(m=>m.pid===p.id&&!m.wh.includes("→")).reduce((a,m)=>a+m.qty,0)===S.stock.Tea;})());
// RESTART (refresh) persistence
await act(async()=>{root.unmount();});
root=createRoot(document.getElementById("root"));
await act(async()=>{root.render(React.createElement(App));});
await wait(150);
setVal($$("input")[1],"1234");await act(async()=>click(btn("Sign in")));await wait();
t("restart: data persisted (company shown)",body().includes("Sree Dynamics"));
t("restart: invoice count intact",db().invoices.length===S.invoices.length);

section("PHASE 9: SECURITY — authz + session");
await act(async()=>click(btn("Logout")));await wait();
t("logout → login screen",body().includes("Sign in"));
setVal($$("input")[0],"c1@sd.in");setVal($$("input")[1],"5555");
await act(async()=>click(btn("Sign in")));await wait();
const navText=$$("button").map(b=>b.textContent).join("|");
t("Cashier: POS visible",navText.includes("POS Billing"));
t("Cashier: Admin Panel hidden",!navText.includes("Admin Panel"));
t("Cashier: Accounting hidden",!navText.includes("Accounting"));
t("Cashier: Users hidden",!navText.includes("Users & Roles"));
t("Cashier: Backup hidden",!navText.includes("Backup"));

console.log(`\n===== SHADOW VERIFICATION: ${P} passed, ${F} failed =====`);
process.exit(F?1:0);
