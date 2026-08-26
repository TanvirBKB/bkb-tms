const fs = require("fs");
const path = require("path");
const enginePath = path.join("c:\\Bank Project\\bkb-tms", "assets/engines/borrower_list_engine.js");
let code = fs.readFileSync(enginePath, "utf8");

const oldBlock = `                const name = (row['\u09a8\u09be\u09ae'] || '').toString().trim();
                const fname = (row['\u09aa\u09bf\u09a4\u09be/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0\u09b0 \u09a8\u09be\u09ae'] || '').toString().trim();
                const recombinedName = name + (fname ? '\\n' + fname : '');

                let newItem = { ...row };
                newItem['\u09a8\u09be\u09ae \u0993 \u09aa\u09bf\u09a4\u09be\u09b0 \u09a8\u09be\u09ae'] = recombinedName;`;

// We must construct the replacement using raw string to avoid escaping issues
const newBlock = `                let name = (row['\u09a8\u09be\u09ae'] || '').toString().trim();
                let fname = (row['\u09aa\u09bf\u09a4\u09be/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0\u09b0 \u09a8\u09be\u09ae'] || '').toString().trim();
                const protisthan = (row['\u09aa\u09cd\u09b0\u09a4\u09bf\u09b7\u09cd\u09a0\u09be\u09a8'] || '').toString().trim();
                
                if (protisthan) {
                    name = protisthan + ', \u09aa\u09cd\u09b0\u09cb: ' + name;
                    if (fname && !fname.startsWith('\u09aa\u09bf\u09a4\u09be/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0:')) {
                        fname = '\u09aa\u09bf\u09a4\u09be/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0: ' + fname;
                    }
                }

                const recombinedName = name + (fname ? '\\n' + fname : '');

                let newItem = { ...row };
                newItem['\u09a8\u09be\u09ae'] = name;
                newItem['\u09aa\u09bf\u09a4\u09be/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0\u09b0 \u09a8\u09be\u09ae'] = fname;
                newItem['\u09a8\u09be\u09ae \u0993 \u09aa\u09bf\u09a4\u09be\u09b0 \u09a8\u09be\u09ae'] = recombinedName;`;

if (code.includes(oldBlock)) {
    code = code.replace(oldBlock, newBlock);
    fs.writeFileSync(enginePath, code, "utf8");
    console.log("Successfully patched borrower mapping logic.");
} else {
    console.log("Could not find the target block. Let's do a regex replacement.");
    
    // Fallback regex
    const regex = /const name = \(row\['\u09a8\u09be\u09ae'\] \|\| ''\)\.toString\(\)\.trim\(\);\s*const fname = \(row\['\u09aa\u09bf\u09a4\u09be\/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0\u09b0 \u09a8\u09be\u09ae'\] \|\| ''\)\.toString\(\)\.trim\(\);\s*const recombinedName = name \+ \(fname \? '\\n' \+ fname : ''\);\s*let newItem = \{ \.\.\.row \};\s*newItem\['\u09a8\u09be\u09ae \u0993 \u09aa\u09bf\u09a4\u09be\u09b0 \u09a8\u09be\u09ae'\] = recombinedName;/m;
    
    if (regex.test(code)) {
        code = code.replace(regex, newBlock);
        fs.writeFileSync(enginePath, code, "utf8");
        console.log("Successfully patched borrower mapping logic using regex.");
    } else {
        console.log("Regex also failed to match.");
    }
}
