const fs = require("fs");
const path = require("path");

const htmlPath = String.raw`c:\Bank Project\bkb-tms\forms\reportgeneration\borrower_list.html`;

// Read as raw bytes
const rawBytes = fs.readFileSync(htmlPath);

// Skip BOM
let start = 0;
if (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) start = 3;

// Decode as latin1 (preserves raw bytes as codepoints)
const latin1 = rawBytes.slice(start).toString("latin1");

// Fix by treating latin1-encoded-UTF8 bytes as the raw bytes they are
// and decode as UTF-8 one more time
const fixedBuf = Buffer.from(latin1, "latin1");

// Check if this gives valid Bengali
let fixedStr = fixedBuf.toString("utf8");
console.log("Bengali present:", /[\u0980-\u09FF]/.test(fixedStr));

// Find thead section
const theadStart = fixedStr.indexOf("<thead");
const theadEnd = fixedStr.indexOf("</thead>") + 8;
if (theadStart > 0) {
    console.log("thead sample:", fixedStr.substring(theadStart, theadStart + 300));
}
