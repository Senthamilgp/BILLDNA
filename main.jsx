import React from "react";
import { createRoot } from "react-dom/client";
import App from "./billdna-erp.jsx";
// Standalone storage shim (Netlify): localStorage-backed window.storage
if(!window.storage){
  window.storage={
    get:async k=>{const v=localStorage.getItem("bdna:"+k);return v==null?null:{key:k,value:v};},
    set:async(k,v)=>{localStorage.setItem("bdna:"+k,v);return{key:k,value:v};},
    delete:async k=>{localStorage.removeItem("bdna:"+k);return{key:k,deleted:true};},
    list:async p=>({keys:Object.keys(localStorage).filter(x=>x.startsWith("bdna:"+(p||""))).map(x=>x.slice(5))}),
  };
}
createRoot(document.getElementById("root")).render(React.createElement(App));
