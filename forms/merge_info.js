const fs = require('fs');

const file = 'd:/Tanvir/bkb_tms/forms/info_sheet_hq.html';
const html = fs.readFileSync(file, 'utf8');

const docRegex = /<html[^>]*>([\s\S]*?)<\/html>/gi;
const docs = [...html.matchAll(docRegex)];

let headStyle = '';
let headOther = '';
let bodyContent = '';

for (let i = 0; i < docs.length; i++) {
    const doc = docs[i][1];
    
    // Extract Head
    const headMatch = doc.match(/<head>([\s\S]*?)<\/head>/i);
    if (headMatch) {
        const head = headMatch[1];
        
        // Extract styles
        const styleRegex = /<style>([\s\S]*?)<\/style>/gi;
        const styles = [...head.matchAll(styleRegex)];
        styles.forEach(s => {
            headStyle += s[1] + '\n';
        });

        // First doc gets all other head content (scripts, meta, title, tailwind) minus styles
        if (i === 0) {
            headOther = head.replace(styleRegex, '');
        }
    }
    
    // Extract Body
    const bodyMatch = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        bodyContent += `\n<div class="page" id="page-${i+1}">\n`;
        bodyContent += bodyMatch[1].trim();
        bodyContent += `\n</div>\n`;
    }
}

const finalHtml = `<!DOCTYPE html>
<html lang="bn">
<head>
${headOther}
<style>
${headStyle}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

fs.writeFileSync(file, finalHtml);
console.log('Merged successfully.');
