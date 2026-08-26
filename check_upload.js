const fs = require("fs");
const path = require("path");
const enginePath = path.join("c:\\Bank Project\\bkb-tms", "assets/engines/borrower_list_engine.js");
const code = fs.readFileSync(enginePath, "utf8");

const startIdx = code.indexOf("function handleFilledExcelUpload(e)");
if (startIdx > -1) {
    const snippet = code.substring(startIdx, startIdx + 2000);
    console.log(snippet);
} else {
    console.log("Not found.");
}
