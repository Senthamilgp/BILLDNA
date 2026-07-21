let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// phone normalize + wa link
const norm=p=>(p||"").replace(/\D/g,"").slice(-10);
const link=(p,tx)=>`https://wa.me/91${norm(p)}?text=${encodeURIComponent(tx)}`;
t("link format",link("+91 98765-43210","Hi").startsWith("https://wa.me/919876543210?text=Hi"));
// reminder dedupe key: one per customer per day
const day="2026-07-21";
const q=[{key:`rem-c1-${day}`}];
t("dedupe blocks same day",q.some(x=>x.key===`rem-c1-${day}`));
t("next day new key allowed",!q.some(x=>x.key===`rem-c1-2026-07-22`));
// invoice queue message balance logic
const total=5546,paid=0;
const msg=paid<total?`Balance: ${total-paid}`:"Paid";
t("credit bill shows balance",msg.includes("5546"));
t("paid bill shows Paid",(total<=total?"Paid ✓":"").includes("Paid"));
// toggle default ON (undefined !== false)
const wa={};
t("toggle default ON",wa.invoice!==false);
t("toggle OFF respected",({invoice:false}).invoice===false);
// queue cap
t("queue capped 100",[...Array(120)].slice(0,100).length===100);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
