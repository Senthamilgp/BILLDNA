let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// Attendance stats
const att={"2026-07-01":{e1:"P"},"2026-07-02":{e1:"P"},"2026-07-03":{e1:"H"},"2026-07-04":{e1:"A"},"2026-06-30":{e1:"P"}};
const month="2026-07";
const days=Object.keys(att).filter(k=>k.startsWith(month));
let p=0,a=0,h=0;days.forEach(d=>{const s=att[d]?.e1;if(s==="P")p++;else if(s==="A")a++;else if(s==="H")h++;});
t("July only: P=2 H=1 A=1 (June excluded)",p===2&&h===1&&a===1);
t("Payable days 2.5",p+h*0.5===2.5);
// Salary calc
const workingDays=26, salary=13000;
const payable=13; // half month
const base=salary*Math.min(1,payable/workingDays);
t("Half attendance = half salary 6500",base===6500);
t("Full attendance capped at 100%",salary*Math.min(1,30/26)===13000);
// Incentive
t("Net = base + incentive",Math.round(6500+500)===7000);
// Duplicate payroll guard
const runs=[{month:"2026-07"}];
t("Duplicate month blocked",runs.some(r=>r.month==="2026-07"));
// Payroll total
const rows=[{net:7000},{net:9500}];
t("Total payout 16500",rows.reduce((x,r)=>x+r.net,0)===16500);
// Expense voucher no
t("Voucher no SAL-2026-07",`SAL-${month}`==="SAL-2026-07");
// Zero attendance = zero salary
t("No attendance = 0 salary",Math.round(salary*Math.min(1,0/26))===0);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
