let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// Rate-wise CGST/SGST split
const items=[{rate:100,qty:2,gst:18},{rate:100,qty:1,gst:18},{rate:50,qty:2,gst:5}];
const m={};
items.forEach(it=>{const tx=it.rate*it.qty,r=it.gst;m[r]=m[r]||{taxable:0,cgst:0,sgst:0};m[r].taxable+=tx;m[r].cgst+=tx*r/200;m[r].sgst+=tx*r/200;});
t("18% taxable 300",m[18].taxable===300);
t("18% CGST 27 (9%)",m[18].cgst===27);
t("18% SGST 27",m[18].sgst===27);
t("5% CGST 2.5",m[5].cgst===2.5);
t("CGST+SGST = full tax",(m[18].cgst+m[18].sgst)===300*0.18);
// B2B vs B2C classification
const customers=[{id:"c1",gstin:"33AAAAA0000A1Z5"},{id:"c2",gstin:""}];
const invs=[{customerId:"c1"},{customerId:"c2"},{customerId:null}];
const b2b=invs.filter(i=>customers.find(c=>c.id===i.customerId)?.gstin);
t("B2B count 1",b2b.length===1);
t("B2C count 2",invs.length-b2b.length===2);
// GSTR-3B net payable
const out=54, itc=30;
t("Net payable 24",Math.max(0,out-itc)===24);
t("Net payable floors at 0",Math.max(0,10-30)===0);
// HSN grouping
const h={};
[{hsn:"0902",qty:2,rate:100,gst:5},{hsn:"0902",qty:1,rate:100,gst:5},{hsn:"",qty:1,rate:50,gst:18}].forEach(it=>{
  const k=it.hsn||"—";h[k]=h[k]||{qty:0,taxable:0};h[k].qty+=it.qty;h[k].taxable+=it.rate*it.qty;});
t("HSN 0902 qty 3, taxable 300",h["0902"].qty===3&&h["0902"].taxable===300);
t("Blank HSN grouped as —",h["—"].taxable===50);
// Month filter
const inMonth=(ts,mo)=>new Date(ts).toISOString().slice(0,7)===mo;
t("Month filter works",inMonth(Date.parse("2026-07-15"),"2026-07")&&!inMonth(Date.parse("2026-06-15"),"2026-07"));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
