const fs = require('fs');
let code = fs.readFileSync('assets/engines/borrower_list_engine.js', 'utf8');

const regexAcc = /const accNo = \(item\['[^']*'\] \|\| ''\)\.toString\(\)\.trim\(\);/g;
code = code.replace(regexAcc, "const accNo = (item['হিসাব নম্বর'] || '').toString().trim();");

const regexBal1 = /item\['[^']*'\] = Math\.abs\(balVal\);/g;
code = code.replace(regexBal1, "item['বর্তমান স্থিতি'] = Math.abs(balVal);");

const regexBal2 = /item\['[^']*'\] = statusRow\['AMTBAL_TK'\];/g;
code = code.replace(regexBal2, "item['বর্তমান স্থিতি'] = statusRow['AMTBAL_TK'];");

const regexStatus = /item\['[^']*'\] = statusRow\['CLASSIFIED'\];/g;
code = code.replace(regexStatus, "item['স্ট্যাটাস'] = statusRow['CLASSIFIED'];");

fs.writeFileSync('assets/engines/borrower_list_engine.js', code, 'utf8');
console.log('Regex replacements executed.');