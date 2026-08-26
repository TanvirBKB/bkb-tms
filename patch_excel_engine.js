/**
 * patch_excel_engine.js
 * Patches borrower_list_engine.js to use ExcelJS for styled Excel exports.
 * Run once: node patch_excel_engine.js
 */

const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, 'assets/engines/borrower_list_engine.js');
let code = fs.readFileSync(enginePath, 'utf8');

// ─── Patch 1: Replace exportToExcel XLSX section ─────────────────────────────
const newExportBlock = `        if (typeof ExcelJS === 'undefined') {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('ExcelJS library not loaded.'); else alert('ExcelJS library not loaded.');
            return;
        }

        let filename = "Borrower_List";
        if (topN) filename += "_Top_" + topN;
        if (statusFilter !== 'all') filename += "_" + statusFilter;
        filename += ".xlsx";

        const wb = new ExcelJS.Workbook();
        wb.creator = 'BKB TMS';
        wb.created = new Date();
        const ws = wb.addWorksheet('Borrower List');

        ws.columns = [
            { key: 'c0',  width: 6  }, { key: 'c1',  width: 22 }, { key: 'c2',  width: 18 },
            { key: 'c3',  width: 30 }, { key: 'c4',  width: 28 }, { key: 'c5',  width: 16 },
            { key: 'c6',  width: 16 }, { key: 'c7',  width: 16 }, { key: 'c8',  width: 20 },
            { key: 'c9',  width: 18 }, { key: 'c10', width: 12 }, { key: 'c11', width: 16 },
            { key: 'c12', width: 16 }, { key: 'c13', width: 18 }, { key: 'c14', width: 20 },
            { key: 'c15', width: 22 },
        ];

        const headerStyle = {
            font: { name: 'SolaimanLipi', bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154360' } },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: {
                top:    { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                left:   { style: 'thin', color: { argb: 'FF000000' } },
                right:  { style: 'thin', color: { argb: 'FF000000' } }
            }
        };

        if (exportData.length > 0) {
            const headerRow = ws.addRow(Object.keys(exportData[0]));
            headerRow.height = 30;
            headerRow.eachCell(function(cell) { Object.assign(cell, headerStyle); });
        }

        const evenFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F4' } };
        const oddFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        const cellFont  = { name: 'SolaimanLipi', size: 10 };
        const cellBorder = {
            top:    { style: 'hair', color: { argb: 'FFAAB7B8' } },
            bottom: { style: 'hair', color: { argb: 'FFAAB7B8' } },
            left:   { style: 'hair', color: { argb: 'FFAAB7B8' } },
            right:  { style: 'hair', color: { argb: 'FFAAB7B8' } }
        };

        exportData.forEach(function(item, idx) {
            const row = ws.addRow(Object.values(item));
            row.height = 18;
            const fill = idx % 2 === 0 ? evenFill : oddFill;
            row.eachCell(function(cell) {
                cell.font   = cellFont;
                cell.fill   = fill;
                cell.border = cellBorder;
                cell.alignment = { vertical: 'middle', wrapText: false };
            });
            var slCell = row.getCell(1);
            if (slCell) slCell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

        if (exportData.length > 0) {
            ws.autoFilter = { from: 'A1', to: ws.getRow(1).getCell(Object.keys(exportData[0]).length).address };
        }

        wb.xlsx.writeBuffer().then(function(buffer) {
            var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel exported with full formatting!'); else alert('Excel exported successfully!');
        }).catch(function(err) {
            console.error('ExcelJS export error:', err);
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Export failed: ' + err.message, true);
        });
    }`;

// ─── Patch 2: downloadExcelFormat new block ───────────────────────────────────
const newFormatBlock = `function downloadExcelFormat() {
        if (typeof ExcelJS === 'undefined') { if(window.parent && window.parent.showAppToast) window.parent.showAppToast('ExcelJS library not loaded.'); else alert('ExcelJS library not loaded.'); return; }

        var headers = ['\u0995\u09cd\u09b0\u09ae','\u098b\u09a3 \u09a8\u09a5\u09bf \u09a8\u09ae\u09cd\u09ac\u09b0','\u098b\u09a3\u09c7\u09b0 \u09a7\u09b0\u09a3','\u09a8\u09be\u09ae','\u09aa\u09bf\u09a4\u09be\u09b0/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0\u09b0 \u09a8\u09be\u09ae','\u09ac\u09be\u09dc\u09bf','\u0997\u09cd\u09b0\u09be\u09ae','\u09aa\u09cb\u09b8\u09cd\u099f','\u09a5\u09be\u09a8\u09be/\u0989\u09aa\u099c\u09c7\u09b2\u09be','\u0985\u09b0\u09cd\u09a5\u09a8\u09c8\u09a4\u09bf\u0995 \u0996\u09be\u09a4','\u09b8\u09c1\u09a6\u09c7\u09b0 \u09b9\u09be\u09b0(%)','\u09ac\u09bf\u09a4\u09b0\u09a3\u09c7\u09b0 \u09a4\u09be\u09b0\u09bf\u0996','\u09ae\u09c7\u09af\u09bc\u09be\u09a6\u09cb\u09a4\u09cd\u09a4\u09c0\u09b0\u09cd\u09a3 \u09a4\u09be\u09b0\u09bf\u0996','\u098b\u09a3\u09c7\u09b0 \u09aa\u09b0\u09bf\u09ae\u09be\u09a3','\u098b\u09a3\u09c7\u09b0 \u09b8\u09cd\u099f\u09cd\u09af\u09be\u099f\u09be\u09b8','\u09ae\u09a8\u09cd\u09a4\u09ac\u09cd\u09af','\u09aa\u09cd\u09b0\u09a4\u09bf\u09b7\u09cd\u09a0\u09be\u09a8'];
        var colWidths = [6, 22, 18, 30, 28, 16, 16, 16, 16, 20, 12, 16, 16, 18, 20, 22, 22];

        var wb2 = new ExcelJS.Workbook();
        wb2.creator = 'BKB TMS';
        var ws2 = wb2.addWorksheet('Borrower List Format');

        ws2.columns = headers.map(function(h, i) { return { header: h, key: 'c' + i, width: colWidths[i] || 18 }; });

        var hStyle = {
            font: { name: 'SolaimanLipi', bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF154360' } },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: {
                top:    { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                left:   { style: 'thin', color: { argb: 'FF000000' } },
                right:  { style: 'thin', color: { argb: 'FF000000' } }
            }
        };

        var hr = ws2.getRow(1);
        hr.height = 32;
        hr.eachCell(function(cell) { Object.assign(cell, hStyle); });

        ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

        wb2.xlsx.writeBuffer().then(function(buffer) {
            var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href     = url;
            a.download = 'Borrower_List_Format.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Format downloaded with formatting!'); else alert('Format downloaded successfully!');
        }).catch(function(err) { console.error('ExcelJS format error:', err); });
    }`;

// Apply Patch 1 - exportToExcel block (replace from XLSX check to end of function)
const exportPatchRegex = /if \(typeof XLSX === 'undefined'\) \{\s*if\(window\.parent[\s\S]*?Check your default Downloads folder\.\'\);?\s*\}\s*\}/m;
if (exportPatchRegex.test(code)) {
    code = code.replace(exportPatchRegex, newExportBlock);
    console.log('Patched exportToExcel (regex match)');
} else {
    console.error('Could not find exportToExcel patch target');
}

// Apply Patch 2 - downloadExcelFormat (replace entire function)
const formatFnRegex = /function downloadExcelFormat\(\) \{[\s\S]*?XLSX\.writeFile\(wb, 'Borrower_List_Format\.xlsx'\);[\s\S]*?alert\('Format downloaded successfully!'\);\s*\}/m;
if (formatFnRegex.test(code)) {
    code = code.replace(formatFnRegex, newFormatBlock);
    console.log('Patched downloadExcelFormat (regex match)');
} else {
    console.error('Could not find downloadExcelFormat patch target');
}

fs.writeFileSync(enginePath, code, 'utf8');
console.log('Patch complete!');
