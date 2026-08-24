const fs = require('fs');
let content = fs.readFileSync('forms/deposit/dps_mss_form.html', 'utf8');

content = content.replace(/\.a4-page \{/g, '.a4-half-page {');
content = content.replace(/height: 297mm;/g, 'height: 148.5mm;\n            page-break-after: always;\n            page-break-inside: avoid;');
content = content.replace(/\.half-page-divider \{[\s\S]*?\}/g, '');
content = content.replace(/<div class=\"a4-page\">/g, '<div class=\"a4-half-page\">');

const oldHtml =             <div class="half-page-divider"></div>
            <div class="fdr-cheque-print-area" id="fdr-cheque-container"></div>
        </div>
    </div>;

const newHtml =         </div>
    </div>

    <!-- CONDITIONAL FDR CHEQUE PAGE -->
    <div id="fdr_cheque_page_container" style="display: none;">
        <div class="a4-half-page" style="padding: 0;">
            <div class="fdr-cheque-print-area" id="fdr-cheque-container" style="top: 0; left: 0; width: 100%; height: 100%;"></div>
        </div>
    </div>;

content = content.replace(oldHtml, newHtml);
fs.writeFileSync('forms/deposit/dps_mss_form.html', content);
console.log('done replacing');
