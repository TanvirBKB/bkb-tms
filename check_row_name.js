const fs = require("fs");
const path = require("path");
const enginePath = path.join("c:\\Bank Project\\bkb-tms", "assets/engines/borrower_list_engine.js");
const code = fs.readFileSync(enginePath, "utf8");

const matches = code.matchAll(/(const|let)\s+(name|fname)\s*=\s*\(row\['(.*?)'\]/g);
for (const match of matches) {
    console.log(`Found: ${match[0]} at index ${match.index}`);
}
