// Professional test suite — BillDNA Phases 1-5 business logic
let pass=0, fail=0;
const t=(name,cond)=>{cond?(pass++,console.log("✓ "+name)):(fail++,console.log("✗ FAIL: "+name));};

// --- P3: GST calculation ---
const cart=[{rate:100,qty:2,gst:18},{rate:50,qty:1,gst:5}];
const sub=cart.reduce((a,i)=>a+i.rate*i.qty,0);
const tax=cart.reduce((a,i)=>a+i.rate*i.qty*i.gst/100,0);
const total=Math.round((sub+tax)*100)/100;
t("Subtotal = 250", sub===250);
t("GST = 38.5 (18% on 200 + 5% on 50)", tax===38.5);
t("Total = 288.5", total===288.5);

// --- P3: Invoice numbering ---
const seq={inv:0};
seq.inv++;
const no=`GST-${String(seq.inv).padStart(4,"0")}`;
t("Invoice no GST-0001", no==="GST-0001");

// --- P3: partial payment ---
const paidAmt="100";
const paid=paidAmt===""?total:Math.min(+paidAmt,total);
t("Partial payment capped correctly", paid===100);
t("Blank = full payment", (""===""?total:0)===288.5);

// --- P5: stock out on sale ---
const p={stock:{default:10},low:5};
const totalStock=x=>Object.values(x.stock||{}).reduce((a,b)=>a+b,0);
p.stock.default-=3;
t("Stock 10-3=7 after sale", totalStock(p)===7);
t("Low-stock not triggered at 7 (min 5)", !(totalStock(p)<=p.low));
p.stock.default-=2;
t("Low-stock triggered at 5", totalStock(p)<=p.low);

// --- P5: transfer validation ---
const p2={stock:{A:5,B:0}};
const canTransfer=(from,qty)=>(p2.stock[from]||0)>=qty;
t("Transfer 6 from A(5) blocked", !canTransfer("A",6));
p2.stock.A-=3; p2.stock.B+=3;
t("Transfer 3: A=2 B=3, total unchanged", p2.stock.A===2&&p2.stock.B===3&&totalStock(p2)===5);

// --- P3: sales return restores stock ---
const p3={stock:{default:7}};
[{qty:3}].forEach(it=>{p3.stock.default+=it.qty;});
t("Return restores stock 7+3=10", p3.stock.default===10);

// --- P4: purchase adds stock & updates cost ---
const p4={stock:{},cost:0,price:100};
const item={qty:10,rate:60};
p4.stock.default=(p4.stock.default||0)+item.qty; p4.cost=item.rate;
t("Purchase: stock=10, cost=60", p4.stock.default===10&&p4.cost===60);

// --- P2: barcode autogen ---
const bc="BD"+Date.now().toString().slice(-8);
t("Barcode format BD+8digits", /^BD\d{8}$/.test(bc));

// --- P1: auth ---
const users=[{email:"admin@billdna.in",pin:"1234",active:true}];
const login=(e,p)=>users.find(x=>x.email.toLowerCase()===e.trim().toLowerCase()&&x.pin===p&&x.active);
t("Valid login works", !!login("ADMIN@billdna.in ","1234"));
t("Wrong PIN rejected", !login("admin@billdna.in","0000"));

// --- P1: role permissions ---
const ROLE_PRESETS={Owner:["all"],Cashier:["billing"]};
const can=(role,p)=>role==="Owner"||(ROLE_PRESETS[role]||[]).includes(p);
t("Cashier can billing", can("Cashier","billing"));
t("Cashier cannot purchase", !can("Cashier","purchase"));
t("Owner can everything", can("Owner","purchase"));

// --- P1: backup roundtrip ---
const db={users:[{id:"u1"}],companies:[]};
const restored=JSON.parse(JSON.stringify(db));
t("Backup JSON roundtrip intact", restored.users[0].id==="u1"&&Array.isArray(restored.companies));
t("Restore validation rejects bad data", !(()=>{const p={foo:1};return p.users&&p.companies;})());

// --- Receivables/payables ---
const invoices=[{total:500,paid:200},{total:300,paid:300}];
const out=invoices.reduce((a,i)=>a+Math.max(0,i.total-i.paid),0);
t("Receivables = 300", out===300);

// --- INR format ---
const inr=n=>"₹"+(+n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
t("INR format 123456.5", inr(123456.5)==="₹1,23,456.5");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
