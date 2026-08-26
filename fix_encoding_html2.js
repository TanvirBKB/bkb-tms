const fs = require("fs");
const filePath = String.raw`c:\Bank Project\bkb-tms\forms\reportgeneration\borrower_list.html`;

// Read raw bytes
const rawBytes = fs.readFileSync(filePath);
let start = 0;
if (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) { start = 3; }

// The content has been triple-encoded. Let us decode pass by pass.
// Pass 1: raw bytes as latin1 string -> gives back the bytes as chars
let content = rawBytes.slice(start).toString("latin1");
// Pass 2: those chars as a Buffer -> decode as UTF-8
let buf2 = Buffer.from(content, "latin1");
let str2 = buf2.toString("utf8");
// Check if Bengali now
const hasBengali = /[\u0980-\u09FF]/.test(str2);
console.log("Has Bengali after 2 passes:", hasBengali);
console.log("Sample:", str2.substring(str2.indexOf("<th>") + 4, str2.indexOf("<th>") + 50));

if (!hasBengali) {
    // Try pass 3: decode str2 as latin1 bytes again
    let buf3 = Buffer.from(str2, "latin1");
    let str3 = buf3.toString("utf8");
    const hasBengali3 = /[\u0980-\u09FF]/.test(str3);
    console.log("Has Bengali after 3 passes:", hasBengali3);
    console.log("Sample3:", str3.substring(str3.indexOf("<th>") + 4, str3.indexOf("<th>") + 50));
    if (hasBengali3) {
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        fs.writeFileSync(filePath, Buffer.concat([bom, buf3]));
        console.log("Saved after 3 passes!");
    }
}
