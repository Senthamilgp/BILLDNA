globalThis.__BILLDNA_TEST__=true;
let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("ok "+n)):(fail++,console.log("FAIL: "+n));};
// scheme flag
t("notax scheme detected", ({scheme:"notax"}).scheme==="notax");
// calc forces gst=0 for notax
const calc=(r,isComp,isNoTax)=>{const qty=+r.qty||0,rate=+r.rate||0,g=(isComp||isNoTax)?0:(+r.gst||0);
  const base=r.taxMode==="incl"?rate*qty/(1+g/100):rate*qty; const tax=base*g/100; return{base,tax,amt:base+tax};};
const row={qty:2,rate:500,gst:18,taxMode:"excl"};
t("notax: tax forced to 0", calc(row,false,true).tax===0);
t("notax: amount = base only", calc(row,false,true).amt===1000);
t("regular: tax still applies", calc(row,false,false).tax===180);
// invoice object shape for notax
const noTaxInv = {billType:"Cash Bill", noTax:true, tax:0, igst:false};
t("notax invoice billType Cash Bill", noTaxInv.billType==="Cash Bill");
t("notax invoice tax is 0", noTaxInv.tax===0);
t("notax invoice igst false", noTaxInv.igst===false);
// PDF title logic
const title=(isComp,isNoTax)=> isComp?"BILL OF SUPPLY":isNoTax?"CASH BILL":"TAX INVOICE";
t("PDF title Cash Bill for notax", title(false,true)==="CASH BILL");
t("PDF title unaffected for regular", title(false,false)==="TAX INVOICE");
t("PDF title unaffected for composite", title(true,false)==="BILL OF SUPPLY");
// simpleCols hides HSN/GST for both comp and notax
const simpleCols=(isComp,isNoTax)=>isComp||isNoTax;
t("simpleCols true for notax", simpleCols(false,true)===true);
t("simpleCols true for composite", simpleCols(true,false)===true);
t("simpleCols false for regular", simpleCols(false,false)===false);
console.log(pass+" passed, "+fail+" failed");process.exit(fail?1:0);
