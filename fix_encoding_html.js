const fs = require('fs');

const filePath = String.raw`c:\Bank Project\bkb-tms\forms\reportgeneration\borrower_list.html`;

// Read raw bytes
const rawBytes = fs.readFileSync(filePath);

// Skip BOM if present (EF BB BF)
let start = 0;
if (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
    start = 3;
    console.log('BOM detected and skipped');
}

// The file was saved as UTF-8 but the Bengali characters were already double-encoded
// (UTF-8 bytes interpreted as Latin-1, then re-encoded as UTF-8)
// To fix: read as Latin-1 (which preserves the raw bytes), then reinterpret as UTF-8

const latin1Content = rawBytes.slice(start).toString('latin1');

// Now the string contains the original UTF-8 bytes as Latin-1 code points
// Re-encode as UTF-8 by treating each char code as a byte
const fixedBytes = Buffer.from(latin1Content, 'latin1');

// Verify: try to decode as UTF-8
const decoded = fixedBytes.toString('utf8');

// Check if Bengali chars are now present
const hasBengali = /[\u0980-\u09FF]/.test(decoded);
console.log('Contains Bengali after fix:', hasBengali);
console.log('Sample:', decoded.substring(decoded.indexOf('<th>') + 4, decoded.indexOf('<th>') + 50));

// Write back with UTF-8 BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync(filePath, Buffer.concat([bom, fixedBytes]));
console.log('File fixed and saved!');
