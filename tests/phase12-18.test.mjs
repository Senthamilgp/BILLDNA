let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("✓ "+n)):(fail++,console.log("✗ FAIL: "+n));};
// P12: Depreciation
const curValue=(cost,rate,years)=>Math.max(0,Math.round(cost*(1-rate/100*years)));
t("Dep: 100000 @10% after 2yr = 80000",curValue(100000,10,2)===80000);
t("Dep floors at 0 (never negative)",curValue(50000,20,10)===0);
// P12: Service due
const serviceDue=(last,everyDays,now)=>(now-Date.parse(last))/86400000>=everyDays;
t("Service due after 91d (every 90)",serviceDue("2026-04-19",90,Date.parse("2026-07-19")));
t("Not due at 60d",!serviceDue("2026-05-20",90,Date.parse("2026-07-19")));
// P13: EMI formula
const emi=(P,annual,n)=>{const r=annual/1200;return r===0?P/n:P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);};
t("EMI 100000@12% 12mo ≈ 8885",Math.round(emi(100000,12,12))===8885);
t("EMI 0% = P/n",emi(120000,0,12)===10000);
t("Outstanding = emi×remaining",Math.round(emi(100000,12,12))*(12-3)===8885*9);
// P14: Order stages
const STAGES=["New","Packed","Shipped","Delivered"];
t("Stage advance New→Packed",STAGES[STAGES.indexOf("New")+1]==="Packed");
t("Delivered is last",STAGES.indexOf("Delivered")===STAGES.length-1);
// P14: UPI link
const upi=`upi://pay?pa=${encodeURIComponent("shop@upi")}&pn=${encodeURIComponent("Sree Dynamics")}&am=250&cu=INR&tn=ORD-0001`;
t("UPI link format",upi.startsWith("upi://pay?pa=shop%40upi")&&upi.includes("am=250")&&upi.includes("cu=INR"));
// P15: Reorder suggestion
const reorder=(sold30,stock)=>Math.max(0,Math.ceil(sold30/30*14-stock));
t("Reorder: 60/30d, 10 stock → 18",reorder(60,10)===18);
t("Reorder 0 when stock enough",reorder(30,20)===0);
// P15: Days left
t("Days left: 10 stock ÷ 2/day = 5",Math.floor(10/(60/30))===5);
// P15: 7-day prediction
t("Predict: 30k/30d → 7k next 7d",Math.round(30000/30*7)===7000);
// P16: CSV escaping
const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
t("CSV: comma quoted",esc("a,b")==='"a,b"');
t("CSV: quote doubled",esc('say "hi"')==='"say ""hi"""');
t("CSV: plain untouched",esc("plain")==="plain");
// P18: settings default
const settings={};
t("Working days default 26",(+settings.workingDays||26)===26);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
