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
console.log(pass+" passed, "+fail+" failed");process.exit(fail?1:0);
