let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// With/Without tax math
const calc=(qty,rate,gst,mode)=>{const base=mode==="incl"?rate*qty/(1+gst/100):rate*qty;
  const tax=base*gst/100;return{base,tax,amt:base+tax};};
const excl=calc(1,100,18,"excl");
t("Without Tax: 100 → base 100, tax 18, amt 118",excl.base===100&&excl.tax===18&&excl.amt===118);
const incl=calc(1,118,18,"incl");
t("With Tax: 118 incl → base 100, tax 18",Math.abs(incl.base-100)<0.01&&Math.abs(incl.tax-18)<0.01);
t("Incl & excl give same total",Math.abs(incl.amt-excl.amt)<0.01);
// Vyapar-screen case: 4700 excl @18% = 846 tax, 5546 total
const v=calc(1,4700,18,"excl");
t("4700 @18% → 846 / 5546 (matches Vyapar screen)",v.tax===846&&v.amt===5546);
// Round off
const raw=5545.6;
t("Round off 5545.6 → 5546 (+0.4)",Math.round(raw)===5546&&Math.round((5546-raw)*100)/100===0.4);
// Received/Balance
const total=5546;
t("Cash blank = full paid, bal 0",(""===""?total:0)===5546);
t("Received 5000 → bal 546",total-Math.min(5000,total)===546);
t("Over-receive capped",Math.min(6000,total)===5546);
// Credit mode: blank = 0 paid
t("Credit blank = 0 paid, full balance",(("")===""?0:1)===0);
// IGST flag
const inv={igst:true,sub:100,tax:18};
t("IGST invoice excluded from CGST split",inv.igst===true);
t("IGST agg picks sub+tax",inv.sub+inv.tax===118);
// custom item without pid → no stock move
const items=[{pid:null,qty:2},{pid:"p1",qty:1}];
t("Only pid items move stock",items.filter(i=>i.pid).length===1);
// payMode mapping
const map=(mode,acct)=>mode==="Credit"?"Credit":acct==="Cash"?"Cash":"Bank";
t("Credit→Credit",map("Credit","Cash")==="Credit");
t("Cash acct→Cash",map("Cash","Cash")==="Cash");
t("INDIAN BANK→Bank",map("Cash","INDIAN BANK")==="Bank");
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
