// PHASE 10: Performance — 300 products + 400 invoices seeded, measure render times
import { JSDOM } from "jsdom";
const dom=new JSDOM('<div id="root"></div>',{url:"https://localhost"});
global.window=dom.window;global.document=dom.window.document;
Object.defineProperty(global,"navigator",{value:dom.window.navigator,configurable:true});
const uid=()=>Math.random().toString(36).slice(2,9);
const products=Array.from({length:300},(_,i)=>({id:"p"+i,name:"Item "+i,sku:"",barcode:"BD"+i,category:"Cat"+(i%10),brand:"",unit:"pcs",hsn:"0000",gst:18,price:100+i,cost:60,low:5,stock:{default:50}}));
const invoices=Array.from({length:400},(_,i)=>({id:"i"+i,no:"GST-"+String(i+1).padStart(4,"0"),type:"GST Invoice",customerId:null,
  items:[{pid:"p"+(i%300),name:"Item "+(i%300),rate:100,qty:2,gst:18,hsn:"0000",unit:"pcs"}],
  sub:200,tax:36,total:236,paid:236,payMode:i%2?"Cash":"UPI",ts:Date.now()-i*3600000,branchId:null,returned:false}));
const seedDb={users:[{id:"u1",name:"Admin",email:"admin@billdna.in",pin:"1234",role:"Owner",active:true}],
  companies:[{id:"c1",name:"PerfCo",gstin:"",city:"",branches:[{id:"b1",name:"Main"}]}],
  activeCompanyId:"c1",activeBranchId:"b1",customers:[],suppliers:[],products,warehouses:[],
  invoices,purchases:[],payments:[],stockMoves:[],vouchers:[],seq:{inv:400,pur:0},
  notifications:[],logs:[{id:"l1",ts:Date.now(),user:"System",action:"init"}]};
let store={billdna_erp_v2:JSON.stringify(seedDb)};
window.storage={get:async k=>store[k]?{key:k,value:store[k]}:null,set:async(k,v)=>{store[k]=v;return{key:k}}};
const React=(await import("react")).default;
const {createRoot}=await import("react-dom/client");
const {act}=React;
const App=(await import("../out-esm.js")).default;
const $$=s=>[...document.querySelectorAll(s)];
const setVal=(el,v)=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new window.Event("input",{bubbles:true}));};
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const btn=t=>$$("button").find(b=>b.textContent.includes(t));
const wait=(ms=30)=>act(async()=>{await new Promise(r=>setTimeout(r,ms));});
const t0=Date.now();
createRoot(document.getElementById("root")).render(React.createElement(App));
await wait(100);
setVal($$("input")[1],"1234");
const t1=Date.now();
await act(async()=>click(btn("Sign in")));await wait(20);
const dashMs=Date.now()-t1;
const t2=Date.now();
await act(async()=>click(btn("📈 Reports")));await wait(20);
const repMs=Date.now()-t2;
const t3=Date.now();
await act(async()=>click(btn("Products")));await wait(20);
const prodMs=Date.now()-t3;
const kb=Math.round(store["billdna_erp_v2"].length/1024);
console.log(JSON.stringify({boot:t1-t0,dashboard:dashMs,reports400inv:repMs,products300:prodMs,dbKB:kb}));
const ok=dashMs<2000&&repMs<2000&&prodMs<2000;
console.log(ok?"PERF PASS":"PERF FAIL");
process.exit(ok?0:1);
