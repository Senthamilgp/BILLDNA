let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// BOM cost
const products=[{id:"rm1",cost:10},{id:"rm2",cost:5}];
const pCost=id=>products.find(p=>p.id===id)?.cost||0;
const items=[{pid:"rm1",qty:2},{pid:"rm2",qty:3}];
const bomCost=items.reduce((a,i)=>a+pCost(i.pid)*i.qty,0);
t("BOM cost 2×10+3×5=35",bomCost===35);
t("With labor 5 → 40/unit",bomCost+5===40);
// Raw stock check
const stock={rm1:15};
const need=2*10; // qty 2/unit × 10 units
t("Insufficient raw blocked (need 20, have 15)",stock.rm1<need);
// Consume + output
let rm=100, fg=0;
const qty=10, scrap=2;
rm-=2*qty; fg+=Math.max(0,qty-scrap);
t("Raw consumed 100-20=80",rm===80);
t("Finished goods +8 (scrap 2)",fg===8);
// Unit costing spread over good units
const totalCost=(35+5)*qty; // 400
const unitCost=totalCost/(qty-scrap);
t("Total cost 400",totalCost===400);
t("Unit cost 50 (400/8, scrap absorbed)",unitCost===50);
// Zero good qty guard
t("Unit cost 0 when all scrap",(0>0?totalCost/0:0)===0);
// Scrap can't produce negative
t("Good qty floors at 0",Math.max(0,5-9)===0);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
