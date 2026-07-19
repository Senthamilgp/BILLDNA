// Simulate full POS billing flow with DOM events
import { JSDOM } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', { url: "https://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global,"navigator",{value:dom.window.navigator,configurable:true});
let store={};
window.storage = { get:async k=>store[k]?{key:k,value:store[k]}:null, set:async(k,v)=>{store[k]=v;return{key:k}} };
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = React;
const App = (await import("./out-esm.js")).default;
const root = createRoot(document.getElementById("root"));
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const type=(el,v)=>{const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;set.call(el,v);el.dispatchEvent(new window.Event("input",{bubbles:true}));};
const click=el=>el.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const btnByText=t=>$$("button").find(b=>b.textContent.includes(t));
const wait=()=>act(async()=>{await new Promise(r=>setTimeout(r,50));});

await act(async()=>{root.render(React.createElement(App));});
await wait();

// LOGIN
type($$("input")[1],"1234");
await act(async()=>{click(btnByText("Sign in"));});
await wait();
console.log("1. Logged in:", document.body.textContent.includes("Dashboard"));

// ADD PRODUCT
await act(async()=>{click(btnByText("Products"));}); await wait();
const inputs=$$("input");
type(inputs.find(i=>i.placeholder==="Name *"),"Tea");
type(inputs.find(i=>i.placeholder==="Selling ₹ *"),"10");
await act(async()=>{click(btnByText("Save product"));}); await wait();
console.log("2. Product saved:", document.body.textContent.includes("Tea"));

// POS
await act(async()=>{click(btnByText("POS Billing"));}); await wait();
const search=$$("input").find(i=>i.placeholder.includes("Scan"));
type(search,"Tea"); await wait();
const suggestion=$$("button").find(b=>b.textContent.includes("Tea —"));
console.log("3. Search suggestion appears:", !!suggestion);
if(suggestion){await act(async()=>{click(suggestion);}); await wait();}
console.log("4. Cart has Tea:", !document.body.textContent.includes("Cart empty"));

// SAVE BILL
await act(async()=>{click(btnByText("Save & Bill"));}); await wait();
console.log("5. Bill saved (Last bill shown):", document.body.textContent.includes("Last bill"));

// INVOICES LIST
await act(async()=>{click(btnByText("Invoices"));}); await wait();
console.log("6. Invoice in list:", document.body.textContent.includes("GST-0001"));
