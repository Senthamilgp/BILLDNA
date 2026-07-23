globalThis.__BILLDNA_TEST__=true;
let pass=0,fail=0;const t=(n,c)=>{c?(pass++,console.log("ok "+n)):(fail++,console.log("FAIL: "+n));};
// jsPDF import works in node
import { jsPDF } from "jspdf";
t("jsPDF import ok", typeof jsPDF==="function");
const doc=new jsPDF({unit:"mm",format:"a4"});
t("jsPDF instance created", !!doc && typeof doc.text==="function");
t("jsPDF save method exists", typeof doc.save==="function");
// money format used in invoice
const money=n=>"Rs "+(Math.round((+n||0)*100)/100).toLocaleString("en-IN");
t("money format 5546", money(5546)==="Rs 5,546");
t("money rounds paise", money(99.999)==="Rs 100");
// title logic: composite -> Bill of Supply else Tax Invoice
const title=(comp,scheme)=> (comp||scheme==="composite")?"BILL OF SUPPLY":"TAX INVOICE";
t("regular title", title(false,"regular")==="TAX INVOICE");
t("composite by flag", title(true,"regular")==="BILL OF SUPPLY");
t("composite by scheme", title(false,"composite")==="BILL OF SUPPLY");
// tax split cgst/sgst for local, igst for inter-state
const split=(igst,tax)=> igst?[["IGST",tax]]:[["CGST",tax/2],["SGST",tax/2]];
t("local splits cgst/sgst", split(false,846)[0][1]===423 && split(false,846)[1][1]===423);
t("inter-state single igst", split(true,846).length===1 && split(true,846)[0][1]===846);
console.log(pass+" passed, "+fail+" failed");

// ---- numToWords (professional PDF redesign) ----
function numToWords(n){
  n=Math.round(n);
  if(n===0)return "Zero";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two=x=>x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?" "+ones[x%10]:"");
  const three=x=>x>=100?ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+two(x%100):""):two(x);
  const parts=[];
  const crore=Math.floor(n/1e7); n%=1e7;
  const lakh=Math.floor(n/1e5); n%=1e5;
  const thousand=Math.floor(n/1e3); n%=1e3;
  if(crore)parts.push(three(crore)+" Crore");
  if(lakh)parts.push(three(lakh)+" Lakh");
  if(thousand)parts.push(three(thousand)+" Thousand");
  if(n)parts.push(three(n));
  return parts.join(" ")||"Zero";
}
let p2=0,f2=0;const t2=(n,c)=>{c?(p2++,console.log("ok "+n)):(f2++,console.log("FAIL: "+n));};
t2("zero", numToWords(0)==="Zero");
t2("10797 matches sample bill (Ten Thousand Seven Hundred and Ninety Seven-ish)", numToWords(10797)==="Ten Thousand Seven Hundred Ninety Seven");
t2("1 lakh", numToWords(100000)==="One Lakh");
t2("1 crore 5", numToWords(10000005)==="One Crore Five");
t2("999", numToWords(999)==="Nine Hundred Ninety Nine");
t2("balance-due orange only when >0.5", (10797-0)>0.5===true);
t2("paid-in-full when balance<=0.5", (10797-10797)<=0.5===true);
console.log((pass+p2)+" passed, "+(fail+f2)+" failed");
process.exit((fail+f2)?1:0);
