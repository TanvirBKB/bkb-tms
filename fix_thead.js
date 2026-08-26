const fs = require("fs");

const htmlPath = String.raw`c:\Bank Project\bkb-tms\forms\reportgeneration\borrower_list.html`;

// Read raw bytes
const rawBytes = fs.readFileSync(htmlPath);
let start = 0;
if (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) start = 3;

// Decode as Latin-1 to get a byte-accurate string, then re-interpret as UTF-8
const latin1Str = rawBytes.slice(start).toString("latin1");
let content = Buffer.from(latin1Str, "latin1").toString("utf8");

// Find the entire <thead> block and replace with correct Bengali headers
const theadRegex = /<thead[\s\S]*?<\/thead>/;

const correctThead = `<thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <tr>
                        <th style="width:30px;"><input type="checkbox" id="ui-selectAll" onchange="toggleAllCheckboxes(this)"></th>
                        <th>ক্রম</th>
                        <th>হিসাব নম্বর</th>
                        <th>ঋণের ধরণ</th>
                        <th>নাম ও পিতার নাম</th>
                        <th>বাড়ি ও গ্রাম (পোস্ট, থানা/উপজেলা, জেলা)</th>
                        <th style="min-width:85px; white-space:nowrap;">পোস্ট অফিস <button id="btn-sort-by-post" onclick="sortByColumn('post')" title="Sort by Post Office" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th style="min-width:85px; white-space:nowrap;">থানা/উপজেলা <button onclick="sortByColumn('thana')" title="Sort by Thana" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th style="min-width:85px; white-space:nowrap;">জেলা <button onclick="sortByColumn('district')" title="Sort by District" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th>ঋণের খাত</th>
                        <th style="min-width:130px; white-space:nowrap;">ঋণের পরিমাণ (টাকা) <button onclick="sortByColumn('amount')" title="Sort by Amount" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th>সুদের হার (%)</th>
                        <th style="min-width:100px; white-space:nowrap;">বিতরণের তারিখ <button onclick="sortByColumn('distDate')" title="Sort by Distribution Date" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th style="min-width:110px; white-space:nowrap;">মেয়াদোত্তীর্ণের তারিখ <button onclick="sortByColumn('expDate')" title="Sort by Expiry Date" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th style="min-width:130px; white-space:nowrap;">ঋণের পরিমাণ (টাকা) <button onclick="sortByColumn('due')" title="Sort by Due Amount" style="background:none;border:none;cursor:pointer;font-size:10px;padding:0 2px;">⇅</button></th>
                        <th>ঋণের স্ট্যাটাস</th>
                        <th>শ্রেণী</th>
                        <th>প্রতিষ্ঠান/ব্যবসা</th>
                        <th style="width:40px; text-align:center;">মুছুন</th>
                    </tr>
                </thead>`;

const matched = theadRegex.test(content);
console.log("thead regex matched:", matched);

if (matched) {
    // Show what we're replacing
    const oldThead = content.match(theadRegex)[0];
    console.log("Old thead (first 200):", oldThead.substring(0, 200));
    content = content.replace(theadRegex, correctThead);
    console.log("Replacement done.");
}

// Write back as UTF-8 with BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const outputBuf = Buffer.from(content, "utf8");
fs.writeFileSync(htmlPath, Buffer.concat([bom, outputBuf]));
console.log("File saved. Size:", Buffer.concat([bom, outputBuf]).length, "bytes");
