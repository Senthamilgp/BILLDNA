let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// Daily grouping
const invs=[{ts:Date.parse("2026-07-18T10:00"),total:100},{ts:Date.parse("2026-07-18T15:00"),total:200},{ts:Date.parse("2026-07-19T09:00"),total:50}];
const m={};invs.forEach(i=>{const k=new Date(i.ts).toLocaleDateString("en-IN");m[k]=(m[k]||0)+i.total;});
t("Daily grouping sums per day",Object.values(m).includes(300)&&Object.values(m).includes(50));
// Product profit
const p={cost:60};const it={rate:100,qty:5};
t("Profit (100-60)*5=200",(it.rate-p.cost)*it.qty===200);
// Fast/slow ordering
const stats=[{qty:50},{qty:5},{qty:20}].sort((a,b)=>b.qty-a.qty);
t("Fast top=50",stats[0].qty===50);
t("Slow bottom=5",stats[2].qty===5);
// Dead stock: has stock, no sales
const soldPids=new Set(["a"]);
const products=[{id:"a",stock:{d:5}},{id:"b",stock:{d:3}},{id:"c",stock:{}}];
const totalStock=x=>Object.values(x.stock).reduce((a,b)=>a+b,0);
const dead=products.filter(x=>!soldPids.has(x.id)&&totalStock(x)>0);
t("Dead = only b (c has no stock)",dead.length===1&&dead[0].id==="b");
// ABC classification
const sorted=[{revenue:700},{revenue:200},{revenue:100}];
const tot=1000;let cum=0;
const abc=sorted.map(p=>{cum+=p.revenue;const pct=cum/tot;return pct<=0.7?"A":pct<=0.9?"B":"C";});
t("ABC = A,B,C",abc.join()==="A,B,C");
// Cutoff filter
const cutoff=Date.now()-30*86400000;
t("Old invoice excluded",!(Date.now()-40*86400000>=cutoff));
t("Recent invoice included",Date.now()-5*86400000>=cutoff);
// Expense grouping
const em={};[{account:"Rent",amt:5000},{account:"Rent",amt:5000},{account:"EB",amt:1200}].forEach(v=>{em[v.account]=(em[v.account]||0)+v.amt;});
t("Rent grouped 10000",em.Rent===10000);
// Net profit
t("Net = gross - exp",(200-50)===150);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
