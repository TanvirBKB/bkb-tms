const fs = require("fs");
const path = require("path");
const enginePath = path.join("c:\\Bank Project\\bkb-tms", "assets/engines/borrower_list_engine.js");
const code = fs.readFileSync(enginePath, "utf8");

const match = code.match(/const exportData = filtered\.map\([\s\S]*?return \{([\s\S]*?)\};/);
if (match) {
    console.log(match[1]);
}
