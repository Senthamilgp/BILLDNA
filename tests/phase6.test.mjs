let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// P&L
const sales=[{sub:1000,items:[{pid:"a",qty:10}]}];
const products=[{id:"a",cost:60}];
const revenue=sales.reduce((a,i)=>a+i.sub,0);
const cogs=sales.reduce((a,i)=>a+i.items.reduce((x,it)=>x+(products.find(p=>p.id===it.pid)?.cost||0)*it.qty,0),0);
const expenses=200, otherInc=50;
const gross=revenue-cogs, net=gross-expenses+otherInc;
t("Revenue 1000",revenue===1000);
t("COGS 600",cogs===600);
t("Gross 400",gross===400);
t("Net 250 (400-200+50)",net===250);
// Cash/Bank split
const txns=[{dir:"in",mode:"Cash",amt:500},{dir:"out",mode:"Cash",amt:200},{dir:"in",mode:"UPI",amt:300},{dir:"out",mode:"Card",amt:100}];
const cashBal=txns.filter(t=>t.dir==="in"&&t.mode==="Cash").reduce((a,x)=>a+x.amt,0)-txns.filter(t=>t.dir==="out"&&t.mode==="Cash").reduce((a,x)=>a+x.amt,0);
const bankBal=txns.filter(t=>t.dir==="in"&&["UPI","Card","Bank"].includes(t.mode)).reduce((a,x)=>a+x.amt,0)-txns.filter(t=>t.dir==="out"&&["UPI","Card","Bank"].includes(t.mode)).reduce((a,x)=>a+x.amt,0);
t("Cash book 300",cashBal===300);
t("Bank book 200",bankBal===200);
// Trial balance debit=credit check structure
const dr=Math.max(cashBal,0)+Math.max(bankBal,0);
t("TB debit side positive",dr===500);
// Voucher numbering
const no=`EXP-${String(1).padStart(4,"0")}`;
t("Voucher no EXP-0001",no==="EXP-0001");
// Voucher direction
const dir=v=>["Receipt","Income"].includes(v)?"in":v==="Contra"?"contra":"out";
t("Income=in",dir("Income")==="in");
t("Expense=out",dir("Expense")==="out");
t("Contra flagged",dir("Contra")==="contra");
// Ledger net
const lt=[{dir:"in",amt:500},{dir:"out",amt:200}];
t("Ledger net 300",lt.reduce((a,x)=>a+(x.dir==="in"?x.amt:-x.amt),0)===300);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
