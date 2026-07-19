// Deeper check: is it the login screen (expected) or truly empty?
import { JSDOM } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', { url: "https://localhost" });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global,"navigator",{value:dom.window.navigator,configurable:true});
window.storage = { get: async()=>null, set: async()=>({}) };
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const App = (await import("./out-esm.js")).default;
const root = createRoot(document.getElementById("root"));
await act(async()=>{ root.render(React.createElement(App)); });
await act(async()=>{ await new Promise(r=>setTimeout(r,100)); });
const html = document.getElementById("root").innerHTML;
console.log("Has BillDNA logo:", html.includes("DNA"));
console.log("Has Sign in:", html.includes("Sign in"));
console.log("Has Loading:", html.includes("Loading"));
