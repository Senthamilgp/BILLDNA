let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// Loyalty points
const spent=1250;
t("₹1250 = 12 points",Math.floor(spent/100)===12);
t("₹99 = 0 points",Math.floor(99/100)===0);
// Due calc excludes returned
const invs=[{total:500,paid:200,returned:false},{total:300,paid:0,returned:true}];
const due=invs.filter(i=>!i.returned).reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
t("Due 300 (returned excluded)",due===300);
// Debtor sort desc
const debtors=[{d:100},{d:500},{d:250}].sort((a,b)=>b.d-a.d);
t("Debtor sort desc",debtors[0].d===500&&debtors[2].d===100);
// WhatsApp phone normalize
const norm=p=>(p||"").replace(/\D/g,"").slice(-10);
t("Phone +91 98765-43210 → 9876543210",norm("+91 98765-43210")==="9876543210");
t("Phone 09876543210 → 9876543210",norm("09876543210")==="9876543210");
// Overdue detection
const overdue=f=>!f.done&&f.due&&Date.parse(f.due)<Date.now();
t("Past date overdue",overdue({done:false,due:"2020-01-01"}));
t("Done not overdue",!overdue({done:true,due:"2020-01-01"}));
t("No due-date not overdue",!overdue({done:false,due:""}));
// Follow-up sort: pending first, then by due
const fus=[{done:true,due:"2026-01-01"},{done:false,due:"2026-08-01"},{done:false,due:"2026-07-20"}]
  .sort((a,b)=>(a.done-b.done)||(Date.parse(a.due||"2099")-Date.parse(b.due||"2099")));
t("Pending-first, earliest-due-first",fus[0].due==="2026-07-20"&&fus[2].done===true);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
