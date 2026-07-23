globalThis.__BILLDNA_TEST__=true;
let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("ok "+n)):(fail++,console.log("FAIL: "+n));};

function upiLink(upiId, name, amount, note){
  if(!upiId) return null;
  const p=new URLSearchParams({pa:upiId, pn:name||"BillDNA", am:(Math.round((+amount||0)*100)/100).toFixed(2), cu:"INR"});
  if(note) p.set("tn",note);
  return "upi://pay?"+p.toString();
}

t("no upiId returns null", upiLink("","Shop",100)===null);
const link=upiLink("shop@oksbi","Sree Enterprises",5546,"Invoice GST-0001");
t("link starts with upi://pay?", link.startsWith("upi://pay?"));
t("link contains pa=", link.includes("pa=shop%40oksbi"));
t("link contains correct amount", link.includes("am=5546.00"));
t("link contains cu=INR", link.includes("cu=INR"));
t("link contains tn note", link.includes("tn=Invoice"));

// hasBank / hasUPI gating logic
const hasBank=(c)=>!!(c?.bankName||c?.bankHolder||c?.bankAccount||c?.bankIfsc);
t("hasBank true when bankName set", hasBank({bankName:"SBI"})===true);
t("hasBank false when all empty", hasBank({})===false);
t("hasBank false when company null", hasBank(null)===false);

const hasUPI=(c,balance)=>!!(c?.upiId) && balance>0.5;
t("hasUPI true when upiId + balance>0", hasUPI({upiId:"x@ok"},100)===true);
t("hasUPI false when balance is 0 (fully paid)", hasUPI({upiId:"x@ok"},0)===false);
t("hasUPI false when no upiId", hasUPI({},100)===false);
t("hasUPI false when balance negative/rounding", hasUPI({upiId:"x@ok"},0.4)===false);

console.log(pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
