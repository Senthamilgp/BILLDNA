let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
const iso=d=>new Date(d).toISOString().slice(0,10);
const inRange=(ts,f,to)=>{const d=iso(ts);return d>=f&&d<=to;};
// date range filter
const f="2026-07-01",to="2026-07-21";
t("in-range included",inRange(Date.parse("2026-07-10"),f,to));
t("before-range excluded",!inRange(Date.parse("2026-06-30"),f,to));
t("after-range excluded",!inRange(Date.parse("2026-07-22"),f,to));
t("boundary from inclusive",inRange(Date.parse("2026-07-01T05:00"),f,to));
// party statement running balance
const txns=[{debit:1000,credit:0},{debit:0,credit:400},{debit:500,credit:0}];
let run=0;const bals=txns.map(r=>{run+=r.debit-r.credit;return run;});
t("running balance 1000,600,1100",bals.join()==="1000,600,1100");
t("closing balance 1100",run===1100);
// bill-wise profit
const bill={items:[{pid:"a",qty:2},{pid:"b",qty:1}]};
const cost={a:60,b:100};const sub=1000;
const c=bill.items.reduce((x,it)=>x+cost[it.pid]*it.qty,0);
t("bill cost 220",c===220);
t("bill profit 780",sub-c===780);
// stock value
const products=[{stock:{d:10},cost:60},{stock:{d:-2},cost:100}];
const ts=x=>Object.values(x.stock).reduce((a,b)=>a+b,0);
const val=products.reduce((a,p)=>a+ts(p)*p.cost,0);
t("stock value 10*60 + (-2)*100 = 400",val===400);
// bank running (deposit-withdraw)
const bank=[{in:5000,out:0},{in:0,out:2000},{in:3000,out:0}];
let br=0;const brs=bank.map(x=>{br+=x.in-x.out;return br;});
t("bank running 5000,3000,6000",brs.join()==="5000,3000,6000");
// day book in/out totals
const stream=[{inAmt:1000,outAmt:0},{inAmt:0,outAmt:500},{inAmt:200,outAmt:0}];
t("total in 1200",stream.reduce((a,x)=>a+x.inAmt,0)===1200);
t("total out 500",stream.reduce((a,x)=>a+x.outAmt,0)===500);
// quick range: this month start
const n=new Date("2026-07-21");
t("this-month start = 1st",iso(new Date(n.getFullYear(),n.getMonth(),1))==="2026-07-01");
t("this-year start = Jan 1",iso(new Date(n.getFullYear(),0,1))==="2026-01-01");
// CSV/xls escaping still used
const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
t("xls row escape",esc("a,b")==='"a,b"');
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
