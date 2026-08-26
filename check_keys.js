const fs = require("fs");
const path = require("path");
const enginePath = path.join("c:\\Bank Project\\bkb-tms", "assets/engines/borrower_list_engine.js");
const code = fs.readFileSync(enginePath, "utf8");
const match = code.match(/return \{([^}]+)\}/);
if (match) {
    console.log("exportData return block:");
    console.log(match[1]);
} else {
    console.log("Not found");
}

const matchFormat = code.match(/var headers = \[(.*?)\]/);
if (matchFormat) {
    console.log("downloadExcelFormat headers:");
    console.log(matchFormat[1]);
}
