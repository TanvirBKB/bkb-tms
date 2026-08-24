/**
 * CMSME Engine
 * Centralizes all CMSME form logic to remove inline scripts.
 */
window.CmsmeEngine = {
    // Utilities
    enToBn: {
        '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
        '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    },

    toBanglaNumber: function (n) {
        if (n === null || n === undefined) return "";
        return n.toString().split('').map(digit => window.CmsmeEngine.enToBn[digit] || digit).join('');
    },

    toEnglishNumber: function (n) {
        if (n === null || n === undefined) return "";
        var englishDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
        return n.toString().split('').map(digit => englishDigits[digit] || digit).join('');
    },

    parseNum: function (str) {
        if (!str) return 0;
        const cleaned = window.CmsmeEngine.toEnglishNumber(str).replace(/,/g, '').trim();
        const val = parseFloat(cleaned);
        return isNaN(val) ? 0 : val;
    },

    formatCurrency: function (num) {
        const parsed = window.CmsmeEngine.parseNum(num);
        return window.CmsmeEngine.toBanglaNumber(parsed.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    },

    // Auto-Resize Input logic
    initAutoResizeAndSync: function () {
        const allInputs = document.querySelectorAll('.dotted-input:not(#title-field):not(.dotted-fill)');
        allInputs.forEach(input => {
            input.style.width = '1in';
            input.addEventListener('input', () => window.CmsmeEngine.resizeInput(input));
            if (input.value) window.CmsmeEngine.resizeInput(input);
        });

        const subjectClasses = ['sub-branch', 'sub-branch-under', 'sub-owner', 'sub-company', 'sub-sector', 'sub-amount', 'sub-words', 'sub-tenure'];
        subjectClasses.forEach(cls => {
            const syncedInputs = document.querySelectorAll('.' + cls);
            syncedInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    syncedInputs.forEach(otherInput => {
                        if (otherInput !== e.target) {
                            otherInput.value = e.target.value;
                            window.CmsmeEngine.resizeInput(otherInput);
                        }
                    });
                });
            });
        });
    },

    resizeInput: function (el) {
        if (!el.value) { el.style.width = '1in'; return; }
        const tempSpan = document.createElement('span');
        tempSpan.style.font = window.getComputedStyle(el).font;
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.textContent = el.value;
        document.body.appendChild(tempSpan);
        el.style.width = Math.max(96, tempSpan.getBoundingClientRect().width + 6) + 'px';
        document.body.removeChild(tempSpan);
    }
};

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // 1. Bangla Number Keyboard Conversion
    document.addEventListener('input', (e) => {
        if (e.target.hasAttribute('contenteditable') && e.target.classList.contains('bangla-numbers')) {
            let range = document.getSelection().getRangeAt(0);
            let currentPos = range.startOffset;

            let val = e.target.innerText;
            let converted = val.replace(/[0-9]/g, (match) => window.CmsmeEngine.enToBn[match]);

            if (val !== converted) {
                e.target.innerText = converted;

                // Restore cursor position seamlessly
                let newRange = document.createRange();
                let selection = window.getSelection();

                if (e.target.childNodes.length > 0) {
                    let textNode = e.target.childNodes[0];
                    newRange.setStart(textNode, Math.min(currentPos, textNode.length));
                } else {
                    newRange.setStart(e.target, 0);
                }
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    });

    // 2. Auto-resize init
    window.CmsmeEngine.initAutoResizeAndSync();
});

// Shared Global FILL router
window.addEventListener('message', function (event) {
    if (event.data && event.data.command === 'FILL') {
        const data = event.data.data;
        if (!data) return;

        // Auto-fill standard fields via data-db-field
        Object.keys(data).forEach(key => {
            const queryStr = '#' + key + ', .' + key + ', [data-db-field="' + key + '"]';
            const els = document.querySelectorAll(queryStr);
            els.forEach(el => {
                let val = data[key] || '';
                if (el.classList.contains('bangla-numbers') && val) {
                    val = val.toString().replace(/[0-9]/g, match => window.CmsmeEngine.enToBn[match]);
                }
                if (el.tagName === 'SPAN' || el.tagName === 'DIV') el.innerText = val;
                else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val;
            });
        });
    }
});

// ==========================================
// LF-05 & Profile Specific Module
// ==========================================
(function () {
    window.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('cmsme-lf-05') && !document.getElementById('cmsme-profile')) return;

        // LF-05 Page 1 Table Rows Gen
        const tbody1 = document.getElementById('page-1-table-body');
        if (tbody1) {
            let rowsHtml = '';
            for (let i = 1; i <= 13; i++) {
                rowsHtml += `
                    <tr class="h-6">
                        <td><input type="text" class="text-center"></td>
                        <td><input type="text" class="text-center"></td>
                        <td><input type="text" class="text-center"></td>
                        <td><input type="text" class="text-center"></td>
                        <td><input type="text" class="text-center"></td>
                        <td><input type="text"></td>
                    </tr>
                `;
            }
            tbody1.insertAdjacentHTML('afterbegin', rowsHtml);
        }

        // LF-05 Page 6 Ruled Lines Gen
        const ruledLinesContainer = document.getElementById('lf05-ruled-lines');
        if (ruledLinesContainer) {
            let linesHtml = '';
            for (let j = 1; j <= 20; j++) {
                linesHtml += `
                    <div class="ruled-line">
                        <input type="text" placeholder="">
                    </div>
                `;
            }
            ruledLinesContainer.innerHTML = linesHtml;
        }
    });

    window.addEventListener('message', function (event) {
        if (!document.getElementById('cmsme-lf-05') && !document.getElementById('cmsme-profile')) return;
        if (event.data && event.data.command === 'FILL') {
            const data = event.data.data;
            if (!data) return;

            const engine = window.CmsmeEngine;

            // --- PAGE 1: IDENTITY ---
            document.querySelectorAll('[data-field="businessInfo.nameBn"]').forEach(el => el.innerText = data.input_business_name || '');

            let propName = '';
            let fatherName = '';
            try {
                const coApps = JSON.parse(data.co_applicants_json || '[]');
                if (coApps.length > 0) {
                    propName = coApps[0].name;
                    fatherName = coApps[0].father;
                }
            } catch (e) { }

            if (!propName) propName = data.primaryName || '';

            document.querySelectorAll('[data-field="primaryName"]').forEach(el => el.innerText = propName);
            document.querySelectorAll('[data-field="fatherName"]').forEach(el => el.innerText = fatherName);
            document.querySelectorAll('[data-field="businessInfo.address"]').forEach(el => el.innerText = data.input_business_address || '');
            document.querySelectorAll('[data-field="mobile"]').forEach(el => el.innerText = engine.toBanglaNumber(data.mobile) || '');
            document.querySelectorAll('[data-field="businessInfo.nature"]').forEach(el => el.innerText = data.input_business_nature || '');
            document.querySelectorAll('[data-field="businessInfo.experience"]').forEach(el => el.innerText = engine.toBanglaNumber(data.input_business_experience) || '');

            const reqLimit = engine.parseNum(data.applied_amount);

            // --- PAGE 2: STOCK VALUATION & CAPACITY ---
            const stockTbody = document.getElementById('stock_tbody');
            if (stockTbody) {
                stockTbody.innerHTML = '';
                let totalStockVal = 0;
                try {
                    const stocks = JSON.parse(data.stock_details_json || '[]');
                    stocks.forEach(s => {
                        let price = engine.parseNum(s.price);
                        let total = engine.parseNum(s.total);
                        totalStockVal += total;

                        let tr = `<tr>
                            <td class="text-left">${s.desc}</td>
                            <td>${engine.toBanglaNumber(s.qty)}</td>
                            <td>${engine.formatCurrency(price)}</td>
                            <td>${engine.formatCurrency(total)}</td>
                        </tr>`;
                        stockTbody.innerHTML += tr;
                    });
                } catch (e) { }

                const totalValEl = document.getElementById('total_val_val');
                if (totalValEl) totalValEl.innerText = engine.formatCurrency(totalStockVal);

                let totalArea = 0;
                try {
                    const showrooms = JSON.parse(data.showrooms_json || '[]');
                    showrooms.forEach(s => totalArea += (engine.parseNum(s.length) * engine.parseNum(s.width)));
                    const godowns = JSON.parse(data.godowns_json || '[]');
                    godowns.forEach(g => totalArea += (engine.parseNum(g.length) * engine.parseNum(g.width)));
                } catch (e) { }

                const areaEl = document.getElementById('total_area_val');
                if (areaEl) areaEl.innerText = engine.formatCurrency(totalArea);

                // --- CAPITAL STRUCTURE ---
                const SV = totalStockVal;
                const CIH = 0;
                const FA = engine.parseNum(data.input_business_fixed_assets_value);
                const PC = SV + CIH + FA;
                const E = engine.parseNum(data.input_business_equity) || engine.parseNum(data.input_business_capital);
                const L_req = reqLimit;

                if (document.getElementById('pc_val')) {
                    document.getElementById('pc_val').innerText = engine.formatCurrency(PC);
                    document.getElementById('debt_val').innerText = engine.formatCurrency(L_req);
                    document.getElementById('debt_contrib_val').innerText = PC > 0 ? engine.toBanglaNumber(((L_req / PC) * 100).toFixed(2)) + '%' : '০%';

                    document.getElementById('equity_val').innerText = engine.formatCurrency(E);
                    document.getElementById('equity_contrib_val').innerText = PC > 0 ? engine.toBanglaNumber(((E / PC) * 100).toFixed(2)) + '%' : '০%';

                    const de_ratio = E > 0 ? engine.toBanglaNumber(((L_req / E) * 100).toFixed(2)) + '%' : 'প্রযোজ্য নয়';
                    document.getElementById('de_ratio_val').innerText = de_ratio;
                }

                // --- PAGE 3: CASH FLOW & PROFITABILITY ---
                const CC = 60;
                const Velocity = 300 / CC;
                const S_monthly = (SV * Velocity) / 12;
                const M = 15;
                const COGS_monthly = S_monthly * (1 - (M / 100));

                let bizInfo = {};
                try { bizInfo = JSON.parse(data.business_info_json || '{}'); } catch (e) { }
                let employeeSalary = engine.parseNum(bizInfo.employeeSalary) || engine.parseNum(data.input_business_monthly_salary);

                let showroomRent = 0, godownRent = 0, projectLandRent = 0;
                try {
                    const showrooms = JSON.parse(data.rent_showrooms_json || data.rent_showroom_json || '[]');
                    showrooms.forEach(s => { if (s.ownership === 'ভাড়া' || s.ownership === 'ভাড়াকৃত') showroomRent += engine.parseNum(s.rent || s.monthly); });
                    const godowns = JSON.parse(data.rent_godowns_json || data.rent_godown_json || '[]');
                    godowns.forEach(g => { if (g.ownership === 'ভাড়া' || g.ownership === 'ভাড়াকৃত') godownRent += engine.parseNum(g.rent || g.monthly); });
                    const projLands = JSON.parse(data.rent_project_lands_json || data.rent_project_land_json || '[]');
                    projLands.forEach(p => { if (p.ownership === 'ভাড়া' || p.ownership === 'ভাড়াকৃত') projectLandRent += engine.parseNum(p.rent || p.monthly); });
                } catch (e) { }

                let transport = S_monthly * 0.01;
                let utility = S_monthly * 0.005;
                let misc = S_monthly * 0.005;
                const OPEX_monthly = showroomRent + godownRent + projectLandRent + employeeSalary + transport + utility + misc;

                const OpexUI = [
                    ['opex_showroom', showroomRent], ['opex_godown', godownRent], ['opex_salary', employeeSalary],
                    ['opex_transport', transport], ['opex_utility', utility], ['opex_misc', misc], ['opex_total', OPEX_monthly]
                ];
                OpexUI.forEach(([id, val]) => { if (document.getElementById(id)) document.getElementById(id).innerText = engine.formatCurrency(val); });

                const loan_term_months = engine.parseNum(data.applied_term || '');
                const rate = 10;
                let EMI_monthly = 0, Annual_Interest = 0, Annual_Principal = 0;

                if (loan_term_months <= 12) {
                    EMI_monthly = (L_req * (rate / 100)) / 12;
                    Annual_Interest = EMI_monthly * 12;
                } else {
                    let r = (rate / 100) / 12;
                    let n = loan_term_months;
                    if (n > 0 && r > 0) EMI_monthly = L_req * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
                    Annual_Interest = (EMI_monthly * 12) - (L_req / (n / 12));
                    Annual_Principal = EMI_monthly * 12 - Annual_Interest;
                }

                const NCF = S_monthly - (COGS_monthly + OPEX_monthly + EMI_monthly);
                const CFUI = [
                    ['cf_revenue', S_monthly], ['cf_cogs', COGS_monthly], ['cf_opex', OPEX_monthly],
                    ['cf_emi', EMI_monthly], ['cf_ncf', NCF]
                ];
                CFUI.forEach(([id, val]) => { if (document.getElementById(id)) document.getElementById(id).innerText = engine.formatCurrency(val); });

                const S_annual = S_monthly * 12;
                const Gross_Annual = S_annual - (COGS_monthly * 12);
                const NPBT = Gross_Annual - (OPEX_monthly * 12) - Annual_Interest;

                if (document.getElementById('ap_sales')) {
                    document.getElementById('ap_sales').innerText = engine.formatCurrency(S_annual);
                    document.getElementById('ap_gross').innerText = engine.formatCurrency(Gross_Annual);
                    document.getElementById('ap_npbt').innerText = engine.formatCurrency(NPBT);
                }

                let DSCR = 0;
                const DSCR_denom = Annual_Principal + Annual_Interest;
                if (loan_term_months <= 12) {
                    DSCR = (NPBT + Annual_Interest) / Annual_Interest;
                } else if (DSCR_denom > 0) {
                    DSCR = (NPBT + Annual_Interest) / DSCR_denom;
                }

                if (document.getElementById('ap_dscr')) document.getElementById('ap_dscr').innerText = engine.toBanglaNumber(DSCR.toFixed(2));

                const dscrAlert = document.getElementById('dscr_alert_container');
                if (dscrAlert) {
                    if (DSCR >= 1.50) dscrAlert.innerHTML = `<div class="success-box" style="padding:10px; border:1px solid #16a34a; color:#15803d; background:#f0fdf4; border-radius:4px;">অত্যন্ত সন্তোষজনক (Highly Viable) - DSCR: ${engine.toBanglaNumber(DSCR.toFixed(2))}</div>`;
                    else if (DSCR >= 1.00) dscrAlert.innerHTML = `<div class="alert-box" style="padding:10px; border:1px solid #eab308; color:#a16207; background:#fefce8; border-radius:4px;">সন্তোষজনক (Satisfactory) - DSCR: ${engine.toBanglaNumber(DSCR.toFixed(2))}</div>`;
                    else dscrAlert.innerHTML = `<div class="alert-box" style="padding:10px; border:1px solid #dc2626; color:#991b1b; background:#fef2f2; border-radius:4px;">ঝুঁকিপূর্ণ (High Credit Risk) - DSCR: ${engine.toBanglaNumber(DSCR.toFixed(2))}</div>`;
                }
            }
        }
    });
})();
// /-- ================= JAVASCRIPT UTILITY FOR AUTOMATIC RESIZING ================= -->

function initAutoResize() {
    // Find all dotted inputs, excluding the main title field and stretched inputs
    const inputs = document.querySelectorAll('.dotted-input:not(#title-field):not(.dotted-fill)');

    inputs.forEach(input => {
        // Set initial default width of 1 inch (96px)
        input.style.width = '1in';

        // Track typing events to dynamically expand / shrink width
        input.addEventListener('input', () => resizeInput(input));

        // Initialize size in case values are pre-filled programmatically
        if (input.value) {
            resizeInput(input);
        }
    });
}

function resizeInput(el) {
    if (!el.value) {
        el.style.width = '1in';
        return;
    }

    // Create a temporary span offline to measure text width exactly
    const tempSpan = document.createElement('span');
    tempSpan.style.font = window.getComputedStyle(el).font;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.textContent = el.value;
    document.body.appendChild(tempSpan);

    const measuredWidth = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);

    const minWidthPixels = 96; // 1 inch at 96 dpi
    // Adjust input size to fit measured width with a comfortable 6px breathing room
    el.style.width = Math.max(minWidthPixels, measuredWidth + 6) + 'px';
}

// Initialize script after the DOM is fully parsed
window.addEventListener('DOMContentLoaded', initAutoResize);

window.addEventListener('message', function (event) {
    if (event.data && event.data.command === 'FILL') {
        const data = event.data.data;
        Object.keys(data).forEach(key => {
            const queryStr = '#' + key + ', .' + key + ', [data-db-field="' + key + '"]';
            const els = document.querySelectorAll(queryStr);
            els.forEach(el => {
                if (el.tagName === 'SPAN' || el.tagName === 'DIV') el.innerText = data[key] || '';
                else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = data[key] || '';
                }
            });
        });
    }
});



// ==========================================
// Stock Report Module
// ==========================================
(function () {
    window.addEventListener('message', function (event) {
        if (!document.getElementById('cmsme-stock-report')) return;
        if (event.data && event.data.command === 'FILL') {
            const data = event.data.data;
            if (!data) return;
            const engine = window.CmsmeEngine;

            const pagesContainer = document.getElementById('pages_container');
            if (!pagesContainer) return;
            pagesContainer.innerHTML = '';

            const bizName = 'মেসার্স ' + (data.input_business_name || '');
            const bizAddress = 'ঠিকানা: ' + (data.input_business_address || '');
            let propName = data.primaryName || '';
            let mobile = data.mobile || '';

            try {
                const coApps = JSON.parse(data.co_applicants_json || '[]');
                if (coApps.length > 0) {
                    propName = coApps[0].name || propName;
                    mobile = coApps[0].mobile || mobile;
                }
            } catch (e) { }

            const proprietorText = 'প্রোপরাইটর: ' + propName;
            const contactText = 'মোবাইল: ' + engine.toBanglaNumber(mobile);

            let dateString = '';
            let dateVal = data.input_application_date || '';
            if (dateVal) {
                const parts = dateVal.split('-');
                dateString = 'তারিখ: ' + engine.toBanglaNumber(parts[2] + '/' + parts[1] + '/' + parts[0]);
            } else {
                const today = new Date();
                dateString = 'তারিখ: ' + engine.toBanglaNumber(String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear());
            }

            let stocks = [];
            try { stocks = JSON.parse(data.stock_details_json || '[]'); } catch (e) { }

            let totalCost = 0;
            let totalSale = 0;
            stocks.forEach(item => {
                totalCost += engine.parseNum(item.total);
                totalSale += engine.parseNum(item.sale);
            });

            const pagesData = [];
            let currentPageItems = [];
            let isFirstPage = true;

            for (let i = 0; i < stocks.length; i++) {
                currentPageItems.push({ item: stocks[i], originalIndex: i });
                let limit = isFirstPage ? 10 : 15;
                if (currentPageItems.length === limit && i < stocks.length - 1) {
                    pagesData.push(currentPageItems);
                    currentPageItems = [];
                    isFirstPage = false;
                }
            }
            if (currentPageItems.length > 0) pagesData.push(currentPageItems);
            if (pagesData.length === 0) pagesData.push([]);

            pagesData.forEach((pageItems, pageIndex) => {
                const isFirst = pageIndex === 0;
                const isLast = pageIndex === pagesData.length - 1;

                const pageDiv = document.createElement('div');
                pageDiv.className = 'a4-page';

                if (isFirst) {
                    pageDiv.innerHTML = `
                        <div class="header">
                            <div class="business-name">${bizName}</div>
                            <div class="proprietor">${proprietorText}</div>
                            <div class="address">${bizAddress}</div>
                            <div class="contact">${contactText}</div>
                        </div>
                        <div class="report-title">মজুদ পণ্যের বিবরণী (স্টক রিপোর্ট)</div>
                        <div class="report-date">${dateString}</div>
                    `;
                } else {
                    pageDiv.innerHTML = `
                        <div class="report-title" style="margin-top: 0; font-size: 12pt;">
                            মজুদ পণ্যের বিবরণী (স্টক রিপোর্ট) - ${bizName}
                        </div>
                        <div class="report-date" style="margin-bottom: 10px;">${dateString} (চলমান...)</div>
                    `;
                }

                const table = document.createElement('table');
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th style="width: 50px;">ক্রম</th>
                            <th class="text-left">পণ্যের নাম / বিবরণ</th>
                            <th style="width: 85px;" class="text-right">পরিমাণ</th>
                            <th style="width: 100px;" class="text-right">ক্রয় মূল্য (টাকা)</th>
                            <th style="width: 130px;" class="text-right">মোট ক্রয় মূল্য (টাকা)</th>
                            <th style="width: 130px;" class="text-right">বিক্রয় মূল্য (টাকা)</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;

                const tbody = table.querySelector('tbody');
                pageItems.forEach(wrapped => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${engine.toBanglaNumber(wrapped.originalIndex + 1)}</td>
                        <td class="text-left">${wrapped.item.desc || ''}</td>
                        <td class="text-right">${engine.toBanglaNumber(wrapped.item.qty || '')}</td>
                        <td class="text-right">${engine.formatCurrency(wrapped.item.price)}</td>
                        <td class="text-right">${engine.formatCurrency(wrapped.item.total)}</td>
                        <td class="text-right">${engine.formatCurrency(wrapped.item.sale)}</td>
                    `;
                    tbody.appendChild(tr);
                });

                if (isLast) {
                    const tfoot = document.createElement('tfoot');
                    tfoot.innerHTML = `
                        <tr style="font-weight: bold; background-color: #fafafa;">
                            <td colspan="4" class="text-right">সর্বমোট:</td>
                            <td class="text-right">${engine.formatCurrency(totalCost)}</td>
                            <td class="text-right">${engine.formatCurrency(totalSale)}</td>
                        </tr>
                    `;
                    table.appendChild(tfoot);
                }
                pageDiv.appendChild(table);

                if (isLast) {
                    const sigSection = document.createElement('div');
                    sigSection.className = 'signature-section';
                    sigSection.innerHTML = `
                        <div class="signature-block"><div class="signature-line"></div><div class="signature-title">উদ্যোক্তা / মালিকের স্বাক্ষর</div></div>
                        <div class="signature-block"><div class="signature-line"></div><div class="signature-title">মূল্যায়নকারী কর্মকর্তার স্বাক্ষর</div></div>
                        <div class="signature-block"><div class="signature-line"></div><div class="signature-title">শাখা ব্যবস্থাপক</div></div>
                    `;
                    pageDiv.appendChild(sigSection);
                }

                const pageNoDiv = document.createElement('div');
                pageNoDiv.className = 'page-number';
                pageNoDiv.innerText = 'পৃষ্ঠা ' + engine.toBanglaNumber(pageIndex + 1) + ' / ' + engine.toBanglaNumber(pagesData.length);
                pageDiv.appendChild(pageNoDiv);
                pagesContainer.appendChild(pageDiv);
            });
        }
    });
})();

// ==========================================
// Profile Module
// ==========================================
(function () {
    window.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('cmsme-profile')) return;
        const coverPage = document.querySelector('.cover-page');
        if (coverPage) {
            const randomInt = Math.floor(Math.random() * 10) + 1;
            coverPage.style.backgroundImage = `url('../../../assets/img/profile_bg_${randomInt}.png')`;
        }
    });
})();

// ==========================================
        window.alert = function(msg) {
            const overlay = document.getElementById('globalCustomAlertOverlay');
            if (overlay) {
                document.getElementById('globalCustomAlertMessage').innerText = msg;
                overlay.style.display = 'flex';
            } else {
                console.log('ALERT:', msg);
            }
        };


        // Fallback for window.AppStorage
        if (typeof window.AppStorage === 'undefined') {
            if (window.parent && window.parent.AppStorage) {
                window.AppStorage = window.parent.AppStorage;
            } else {
                window.AppStorage = {
                    getItem: function (key) { return localStorage.getItem(key); },
                    setItem: function (key, val) { localStorage.setItem(key, val); }
                };
            }
        }

        function toBanglaNumber(n) {
            if (n === null || n === undefined) return "";
            var banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            return n.toString().split('').map(function (digit) { return banglaDigits[digit] || digit; }).join('');
        }

        function toEnglishNumber(n) {
            if (n === null || n === undefined) return "";
            var englishDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
            return n.toString().split('').map(function (digit) { return englishDigits[digit] || digit; }).join('');
        }

        function openTab(evt, tabId) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-pane");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabId).classList.add("active");
            evt.currentTarget.classList.add("active");
        }
        function openTab(evt, tabId) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-pane");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabId).classList.add("active");
            evt.currentTarget.classList.add("active");
        }

        function toBanglaNumber(n) {
            if (n === null || n === undefined) return "";
            var banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            return n.toString().split('').map(function (digit) { return banglaDigits[digit] || digit; }).join('');
        }

        function toEnglishNumber(n) {
            if (n === null || n === undefined) return "";
            var englishDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
            return n.toString().split('').map(function (digit) { return englishDigits[digit] || digit; }).join('');
        }

        function openTab(evt, tabId) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-pane");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabId).classList.add("active");
            evt.currentTarget.classList.add("active");
        }

        function setElementValue(id, val) {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = val;
            } else {
                el.innerText = val;
            }
        }

        function openModal() {
            document.getElementById('modalOverlay').style.display = 'flex';
            if (typeof toggleTradingSection === 'function') toggleTradingSection();
            if (typeof toggleCibLoanDetails === 'function') toggleCibLoanDetails();
        }
        function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

        function toggleCollateralSection(type) {
            if (type === 'land') {
                const isChecked = document.getElementById('checkbox_land_type').checked;
                const display = isChecked ? 'block' : 'none';
                document.getElementById('land_details_wrapper').style.display = display;
                document.getElementById('property_info_inner_wrapper').style.display = display;
                document.getElementById('land_registration_inner_wrapper').style.display = display;
                document.getElementById('valuation_inner_wrapper').style.display = display;
            } else if (type === 'check') {
                const isChecked = document.getElementById('checkbox_check_type').checked;
                document.getElementById('check_details_wrapper').style.display = isChecked ? 'block' : 'none';
            } else if (type === 'guarantee') {
                const isChecked = document.getElementById('checkbox_personal_guarantee').checked;
                document.getElementById('personal_guarantee_details_wrapper').style.display = isChecked ? 'block' : 'none';
            } else if (type === 'spouse') {
                const isChecked = document.getElementById('checkbox_spouse_guarantee').checked;
                document.getElementById('spouse_guarantee_details_wrapper').style.display = isChecked ? 'block' : 'none';
            }
        }

        function openLogModal() {
            populateLogTable();
            document.getElementById('logModalOverlay').style.display = 'flex';
        }
        function closeLogModal() { document.getElementById('logModalOverlay').style.display = 'none'; }

        function toggleSanctionType() {
            const type = document.getElementById('input_sanction_type').value;
            const prevDocSelect = document.getElementById('input_previous_doc');
            const prevDocSearch = document.getElementById('prev_doc_search');
            const renewalWrapper = document.getElementById('renewal_info_wrapper');
            const enhancementWrapper = document.getElementById('enhancement_info_wrapper');
            const lblPrevAmount = document.getElementById('lbl_prev_amount');
            const lblPrevAmountWords = document.getElementById('lbl_prev_amount_words');

            const loanWorkingCap = document.getElementById('loan_working_cap');
            const loanExpansion = document.getElementById('loan_expansion');
            const loanOther = document.getElementById('loan_other');

            if (type === 'নবায়ন' || type === 'বর্ধিতসহ নবায়ন') {
                prevDocSelect.disabled = false;
                if(prevDocSearch) prevDocSearch.disabled = false;
                if(prevDocSearch) prevDocSearch.value = "";
                refreshPreviousDocsDropdown();
                renewalWrapper.style.display = 'block';
                enhancementWrapper.style.display = (type === 'বর্ধিতসহ নবায়ন') ? 'flex' : 'none';
                
                if (type === 'বর্ধিতসহ নবায়ন') {
                    if(lblPrevAmount) lblPrevAmount.innerText = 'বর্তমান ঋণ সীমা';
                    if(lblPrevAmountWords) lblPrevAmountWords.innerText = 'বর্তমান ঋণ সীমা (কথায়)';

                    if(loanWorkingCap) { loanWorkingCap.readOnly = true; loanWorkingCap.style.background = '#f0f0f0'; }
                    if(loanExpansion) { loanExpansion.readOnly = true; loanExpansion.style.background = '#f0f0f0'; }
                    if(loanOther) { loanOther.readOnly = true; loanOther.style.background = '#f0f0f0'; }
                    calculateEnhancement();
                } else {
                    if(lblPrevAmount) lblPrevAmount.innerText = 'ঋণের পরিমাণ (অংকে)';
                    if(lblPrevAmountWords) lblPrevAmountWords.innerText = 'ঋণের পরিমাণ (কথায়)';

                    if(loanWorkingCap) { loanWorkingCap.readOnly = false; loanWorkingCap.style.background = ''; }
                    if(loanExpansion) { loanExpansion.readOnly = false; loanExpansion.style.background = ''; }
                    if(loanOther) { loanOther.readOnly = false; loanOther.style.background = ''; }
                }
            } else {
                prevDocSelect.disabled = true;
                prevDocSelect.value = "";
                if(prevDocSearch) {
                    prevDocSearch.disabled = true;
                    prevDocSearch.value = "";
                }
                renewalWrapper.style.display = 'none';
                enhancementWrapper.style.display = 'none';
                
                if(lblPrevAmount) lblPrevAmount.innerText = 'ঋণের পরিমাণ (অংকে)';
                if(lblPrevAmountWords) lblPrevAmountWords.innerText = 'ঋণের পরিমাণ (কথায়)';

                if(loanWorkingCap) { loanWorkingCap.readOnly = false; loanWorkingCap.style.background = ''; }
                if(loanExpansion) { loanExpansion.readOnly = false; loanExpansion.style.background = ''; }
                if(loanOther) { loanOther.readOnly = false; loanOther.style.background = ''; }
            }
        }

        function refreshPreviousDocsDropdown() {
            const dropdown = document.getElementById('input_previous_doc');
            dropdown.innerHTML = '<option value="">নথি নির্বাচন করুন</option>';
            const records = JSON.parse(window.AppStorage.getItem('cmsme_records') || '[]');
            
            const comboList = document.getElementById('prev_doc_list');
            if(comboList) comboList.innerHTML = '';
            
            records.forEach((rec, index) => {
                // Populate hidden select
                const option = document.createElement('option');
                option.value = index;
                option.text = `${ rec.caseNo || 'N/A' } - ${ rec.primaryName || 'Unknown' } `;
                dropdown.appendChild(option);
                
                // Populate custom combo list
                if(comboList) {
                    const item = document.createElement('div');
                    item.className = 'custom-combo-item';
                    const searchStr = `${ rec.primaryName || '' } ${ rec.mobile || '' } ${ rec.accountNo || '' } ${ rec.nid || '' } ${ rec.caseNo || '' } `.toLowerCase();
                    item.setAttribute('data-search', searchStr);
                    
                    item.innerHTML = `
                <span class="custom-combo-item-title" > ${ rec.caseNo || 'N/A' } - ${ rec.primaryName || 'Unknown' }</span>
                    <span class="custom-combo-item-subtitle">মোবাইল: ${rec.mobile || 'N/A'} | হিসাব নং: ${rec.accountNo || 'N/A'} | NID: ${rec.nid || 'N/A'}</span>
            `;
                    
                    item.addEventListener('click', () => {
                        document.getElementById('prev_doc_search').value = `${ rec.caseNo || 'N/A' } - ${ rec.primaryName || 'Unknown' } `;
                        comboList.style.display = 'none';
                        dropdown.value = index;
                        // Trigger onchange manually
                        const event = new Event('change');
                        dropdown.dispatchEvent(event);
                    });
                    comboList.appendChild(item);
                }
            });
        }

        function populateLogTable() {
            const tbody = document.querySelector('#logTable tbody');
            tbody.innerHTML = '';
            const records = JSON.parse(window.AppStorage.getItem('cmsme_records') || '[]');

            records.forEach((rec, index) => {
                const row = tbody.insertRow();
                row.innerHTML = `
                <td> ${ rec.primaryName || '' }</td>
            <td>${rec.caseNo || ''}</td>
            <td>${rec.appliedAmount || rec.amount || ''}</td>
            <td>${rec.appliedSanctionDate || rec.sanctionDate || ''}</td>
            <td>${rec.appliedDueDate || rec.dueDate || ''}</td>
            <td>${rec.mobile || ''}</td>
            <td>
                <button class="load-row-btn" onclick="loadFromLog(${index}); closeLogModal(); openModal();">লোড করুন</button>
                <button class="load-row-btn" style="background:#ef4444; margin-left:5px;" onclick="deleteRecord(${index})">মুছুন</button>
            </td>
            `;
            });
        }

        function deleteRecord(index) {
            if (!confirm('এই নথিটি কি মুছে ফেলতে চান?')) return;
            let records = JSON.parse(window.AppStorage.getItem('cmsme_records') || '[]');
            records.splice(index, 1);
            window.AppStorage.setItem('cmsme_records', JSON.stringify(records));
            populateLogTable();
        }


        function loadFromLog(caseNo) {
            if (!window.loadedLoans) return;
            const loan = window.loadedLoans.find(l => l.loan_case_no === caseNo);
            if (loan && loan.cmsme_data) {
                try {
                    let parsed = typeof loan.cmsme_data === 'string' ? JSON.parse(loan.cmsme_data) : loan.cmsme_data;
                    Object.keys(parsed).forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.value = parsed[id];
                        }
                    });
                    if (typeof updateBizNatureOptions === 'function') {
                        updateBizNatureOptions();
                    }
                    if (parsed.input_business_nature && document.getElementById('input_business_nature')) {
                        document.getElementById('input_business_nature').value = parsed.input_business_nature;
                    }
                    if (typeof flattenProductDatabase === 'function') {
                        flattenProductDatabase();
                    }
                    toggleRentDurationField();
                    calculateBusinessExperience();

                    // Re-construct and load co-applicants
                    const container = document.getElementById('applicantContainer');
                    const entries = container.querySelectorAll('.applicant-entry');
                    for (let i = 1; i < entries.length; i++) {
                        entries[i].remove();
                    }
                    if (parsed.co_applicants_json) {
                        try {
                            const coApplicants = JSON.parse(parsed.co_applicants_json);
                            coApplicants.forEach(co => {
                                addApplicantEntry();
                                const currentEntries = container.querySelectorAll('.applicant-entry');
                                const newEntry = currentEntries[currentEntries.length - 1];
                                if (newEntry) {
                                    newEntry.querySelector('.input_name').value = co.name || '';
                                    newEntry.querySelector('.input_father').value = co.father || '';
                                    newEntry.querySelector('.input_mother').value = co.mother || '';
                                    newEntry.querySelector('.input_nid').value = co.nid || '';
                                    newEntry.querySelector('.input_mobile').value = co.mobile || '';
                                }
                            });
                        } catch (e) {
                            console.error('Error parsing co-applicants JSON from log:', e);
                        }
                    }

                    // Re-construct and load guarantors
                    if (parsed.guarantors_json) {
                        try {
                            guarantorData = JSON.parse(parsed.guarantors_json);
                            if (typeof renderGuarantorTable === 'function') {
                                renderGuarantorTable();
                            }
                        } catch (e) {
                            console.error('Error parsing guarantors JSON from log:', e);
                        }
                    }

                    // Re-construct and load spouse guarantors
                    if (parsed.spouse_guarantors_json) {
                        try {
                            spouseGuarantorData = JSON.parse(parsed.spouse_guarantors_json);
                            if (typeof renderSpouseGuarantorTable === 'function') {
                                renderSpouseGuarantorTable();
                            }
                        } catch (e) {
                            console.error('Error parsing spouse guarantors JSON from log:', e);
                        }
                    }

                    // Re-construct and load licenses
                    if (parsed.licenses_json) {
                        try {
                            licenseData = JSON.parse(parsed.licenses_json);
                            renderLicenseTable();
                        } catch (e) {
                            console.error('Error parsing licenses JSON from log:', e);
                        }
                    } else {
                        licenseData = [];
                        renderLicenseTable();
                    }

                    // Re-construct and load liabilities
                    if (parsed.liabilities_json) {
                        try {
                            liabilityData = JSON.parse(parsed.liabilities_json);
                            renderLiabilityTable();
                        } catch (e) {
                            console.error('Error parsing liabilities JSON from log:', e);
                        }
                    } else {
                        liabilityData = [];
                        renderLiabilityTable();
                    }

                    // Re-construct and load stock details
                    if (parsed.stock_details_json) {
                        try {
                            const stockDetails = JSON.parse(parsed.stock_details_json);
                            const tbody = document.querySelector('#stock_details_table tbody');
                            tbody.innerHTML = '';
                            stockDetails.forEach((item, i) => {
                                const row = tbody.insertRow();
                                row.innerHTML = `
                <td style = "border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;" > ${ toBanglaNumber(i + 1) }</td>
                                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_desc" value="${item.desc || ''}" list="prelisted_grocery_items" oninput="handleStockItemChange(this)" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_qty" value="${item.qty || '১'}" oninput="handleGenericDigitInput(this); calculateStockRowTotal(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_unit_price" value="${item.price || '০'}" oninput="handleGenericDigitInput(this); calculateStockRowTotal(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_total_cost" value="${item.total || '০'}" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f0f0f0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_sale_price" value="${item.sale || '০'}" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
            `;
                            });
                            document.getElementById('stock_table_container').style.display = stockDetails.length > 0 ? 'block' : 'none';
                            calculateStockTableSummary();
                        } catch (e) {
                            console.error('Error parsing stock details JSON from log:', e);
                        }
                    } else {
                        document.getElementById('stock_table_container').style.display = 'none';
                    }

                    // Re-construct and load godowns
                    if (parsed.godowns_json) {
                        try {
                            const godowns = JSON.parse(parsed.godowns_json);
                            const tbody = document.querySelector('#godown_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                godowns.forEach(g => addGodownRow(g));
                            }
                        } catch (e) {
                            console.error('Error parsing godowns JSON from log:', e);
                        }
                    }

                    // Re-construct and load showrooms
                    if (parsed.showrooms_json) {
                        try {
                            const showrooms = JSON.parse(parsed.showrooms_json);
                            const tbody = document.querySelector('#showroom_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                showrooms.forEach(s => addShowroomRow(s));
                            }
                        } catch (e) {
                            console.error('Error parsing showrooms JSON from log:', e);
                        }
                    }

                    // Re-construct and load rent showroom details
                    if (parsed.rent_showroom_json) {
                        try {
                            const rentShowrooms = JSON.parse(parsed.rent_showroom_json);
                            const tbody = document.querySelector('#rent_showroom_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                rentShowrooms.forEach(r => addRentRow('rent_showroom_table', r));
                            }
                        } catch (e) {
                            console.error('Error parsing rent showroom JSON from log:', e);
                        }
                    }

                    // Re-construct and load rent godown details
                    if (parsed.rent_godown_json) {
                        try {
                            const rentGodowns = JSON.parse(parsed.rent_godown_json);
                            const tbody = document.querySelector('#rent_godown_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                rentGodowns.forEach(r => addRentRow('rent_godown_table', r));
                            }
                        } catch (e) {
                            console.error('Error parsing rent godown JSON from log:', e);
                        }
                    }

                    // Re-construct and load rent project land details
                    if (parsed.rent_project_land_json) {
                        try {
                            const rentProjectLands = JSON.parse(parsed.rent_project_land_json);
                            const tbody = document.querySelector('#rent_project_land_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                rentProjectLands.forEach(r => addRentRow('rent_project_land_table', r));
                            }
                        } catch (e) {
                            console.error('Error parsing rent project land JSON from log:', e);
                        }
                    }

                    // Re-construct and load project land dimensional details
                    if (parsed.project_land_dimensional_json) {
                        try {
                            const projectLandDims = JSON.parse(parsed.project_land_dimensional_json);
                            const tbody = document.querySelector('#project_land_dimensional_table tbody');
                            if (tbody) {
                                tbody.innerHTML = '';
                                projectLandDims.forEach(p => addProjectLandDimensionalRow(p));
                            }
                        } catch (e) {
                            console.error('Error parsing project land dimensional JSON from log:', e);
                        }
                    }
                    
                    // Trigger CIB toggle
                    if (typeof toggleCibLoanDetails === 'function') {
                        toggleCibLoanDetails();
                    }

                    toggleTradingSection();

                    alert('পূর্বের তথ্য সফলভাবে লোড হয়েছে।');
                } catch (e) {
                    console.error('Error parsing cmsme_data', e);
                }
            }
        }

        function toBanglaNumber(n) {
            const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            return n.toString().split('').map(digit => banglaDigits[digit] || digit).join('');
        }

        function toEnglishNumber(n) {
            const englishDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
            return n.toString().split('').map(digit => englishDigits[digit] || digit).join('');
        }

        function toggleRentDurationField() {
            const ownership = document.getElementById('input_business_land_ownership') ? document.getElementById('input_business_land_ownership').value : '';
            const durationInput = document.getElementById('input_business_rent_duration');
            if (durationInput) {
                if (ownership === 'ভাড়াকৃত') {
                    durationInput.disabled = false;
                    durationInput.style.background = '';
                } else {
                    durationInput.disabled = true;
                    durationInput.value = '';
                    durationInput.style.background = '#f0f0f0';
                }
            }
        }

        function calculateBusinessExperience() {
            const startDateVal = document.getElementById('input_business_start_date') ? document.getElementById('input_business_start_date').value : '';
            const expInput = document.getElementById('input_business_experience');
            if (!startDateVal || !expInput) return;

            const startDate = new Date(startDateVal);
            const today = new Date();

            let years = today.getFullYear() - startDate.getFullYear();
            const m = today.getMonth() - startDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < startDate.getDate())) {
                years--;
            }

            if (years < 0) {
                expInput.value = '';
                return;
            }

            expInput.value = 'প্রায় ' + toBanglaNumber(years) + ' বছর';
        }

        // --- Predefined Grocery Items Lookup Database ---
        let PRELISTED_GROCERY_ITEMS = {};

        function loadProductDatabase() {
            const ipc = window.parent.ipcRenderer || window.ipcRenderer;
            let dbData = null;
            if (ipc && typeof ipc.sendSync === 'function') {
                try {
                    const dbStr = ipc.sendSync('db-get-kv', 'cmsme_products_config');
                    if (dbStr) {
                        dbData = JSON.parse(dbStr);
                    }
                } catch (e) {
                    console.error('Error loading product database from Electron DB:', e);
                }
            }

            // Fallback default structure
            if (!dbData || Object.keys(dbData).length === 0) {
                dbData = {
                    "মুদি মনোহারী": {
                        "চাল (বস্তা)": { volume: 2400, unit: "বস্তা", costPrice: 2500 },
                        "ডাল (কেজি)": { volume: 60, unit: "কেজি", costPrice: 130 },
                        "তৈল (৫ লিটার)": { volume: 400, unit: "বোতল", costPrice: 800 },
                        "চিনি (কেজি)": { volume: 60, unit: "কেজি", costPrice: 135 },
                        "আটা (কেজি)": { volume: 70, unit: "কেজি", costPrice: 55 },
                        "পেঁয়াজ (কেজি)": { volume: 80, unit: "কেজি", costPrice: 70 },
                        "আলু (কেজি)": { volume: 90, unit: "কেজি", costPrice: 40 },
                        "লবণ (কেজি)": { volume: 50, unit: "কেজি", costPrice: 38 },
                        "মসলা (প্যাকেট)": { volume: 30, unit: "প্যাকেট", costPrice: 120 },
                        "সাবান (পিস)": { volume: 15, unit: "পিস", costPrice: 75 }
                    }
                };
            }


            window.GLOBAL_PRODUCTS_DATABASE = dbData;

            // Populate category selector in settings
            const catSelect = document.getElementById('settings_category_select');
            if (catSelect) {
                const currentVal = catSelect.value;
                catSelect.innerHTML = '';
                Object.keys(dbData).forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    catSelect.appendChild(opt);
                });
                if (currentVal && dbData[currentVal]) {
                    catSelect.value = currentVal;
                }
            }

            flattenProductDatabase();
        }

        function flattenProductDatabase() {
            PRELISTED_GROCERY_ITEMS = {};
            if (window.GLOBAL_PRODUCTS_DATABASE) {
                const currentNature = document.getElementById('input_business_nature') ? document.getElementById('input_business_nature').value : '';
                if (currentNature && window.GLOBAL_PRODUCTS_DATABASE[currentNature]) {
                    const items = window.GLOBAL_PRODUCTS_DATABASE[currentNature];
                    Object.keys(items).forEach(name => {
                        PRELISTED_GROCERY_ITEMS[name] = items[name];
                    });
                } else {
                    // Merge all categories if no active nature matches
                    Object.keys(window.GLOBAL_PRODUCTS_DATABASE).forEach(cat => {
                        const items = window.GLOBAL_PRODUCTS_DATABASE[cat];
                        Object.keys(items).forEach(name => {
                            PRELISTED_GROCERY_ITEMS[name] = items[name];
                        });
                    });
                }
            }
            updateStockDatalist();
        }

        function updateStockDatalist() {
            const datalist = document.getElementById('prelisted_grocery_items');
            if (datalist) {
                datalist.innerHTML = '';
                Object.keys(PRELISTED_GROCERY_ITEMS).forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    datalist.appendChild(opt);
                });
            }
        }

        function openProductSettingsModal() {
            loadProductDatabase();
            document.getElementById('productSettingsModalOverlay').style.display = 'flex';
            
            // Pre-select category in settings matching the selected nature of business in main form
            const currentNature = document.getElementById('input_business_nature') ? document.getElementById('input_business_nature').value : '';
            const catSelect = document.getElementById('settings_category_select');
            if (currentNature && catSelect && [...catSelect.options].some(o => o.value === currentNature)) {
                catSelect.value = currentNature;
            }
            
            loadCategoryProducts();
        }

        function closeProductSettingsModal() {
            document.getElementById('productSettingsModalOverlay').style.display = 'none';
        }

        function loadCategoryProducts() {
            const cat = document.getElementById('settings_category_select').value;
            const tbody = document.querySelector('#settings_product_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (window.GLOBAL_PRODUCTS_DATABASE && window.GLOBAL_PRODUCTS_DATABASE[cat]) {
                const items = window.GLOBAL_PRODUCTS_DATABASE[cat];
                Object.keys(items).forEach(name => {
                    const data = items[name];
                    addSettingsProductRow({
                        desc: name,
                        volume: data.volume,
                        unit: data.unit,
                        costPrice: data.costPrice
                    });
                });
            }
        }

        function addSettingsProductRow(data = {}) {
            const tbody = document.querySelector('#settings_product_table tbody');
            if (!tbody) return;
            const row = tbody.insertRow();

            // Format numbers to Bangla
            const volBn = toBanglaNumber((data.volume || 60).toString());
            const costBn = toBanglaNumber((data.costPrice || 0).toString());

            row.innerHTML = `
                <td style = "border: 1px solid #ddd; padding: 4px; font-family: inherit;" ><input type="text" class="setting_item_desc" value="${data.desc || ''}" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; font-family: inherit;"><input type="text" class="setting_item_volume" value="${volBn}" oninput="handleGenericDigitInput(this)" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; font-family: inherit;"><input type="text" class="setting_item_unit" value="${data.unit || 'কেজি'}" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; font-family: inherit;"><input type="text" class="setting_item_cost" value="${costBn}" oninput="handleGenericDigitInput(this)" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-family: inherit;">
                    <button type="button" onclick="deleteSettingsProductRow(this)" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-family: inherit;">মুছুন</button>
                </td>
            `;
        }

        function deleteSettingsProductRow(button) {
            const row = button.closest('tr');
            if (row) row.remove();
        }

        function addNewCategoryPrompt() {
            document.getElementById('new_category_input').value = '';
            document.getElementById('newCategoryModalOverlay').style.display = 'flex';
            setTimeout(() => document.getElementById('new_category_input').focus(), 100);
        }

        function saveNewCategory() {
            const cat = document.getElementById('new_category_input').value;
            if (cat && cat.trim()) {
                const cleanCat = cat.trim();
                if (!window.GLOBAL_PRODUCTS_DATABASE) window.GLOBAL_PRODUCTS_DATABASE = {};
                if (!window.GLOBAL_PRODUCTS_DATABASE[cleanCat]) {
                    window.GLOBAL_PRODUCTS_DATABASE[cleanCat] = {};
                }
                const catSelect = document.getElementById('settings_category_select');
                if (catSelect) {
                    const opt = document.createElement('option');
                    opt.value = cleanCat;
                    opt.textContent = cleanCat;
                    catSelect.appendChild(opt);
                    catSelect.value = cleanCat;
                }
                loadCategoryProducts();
                _saveGlobalProductsDB(); // persist to db
            }
            document.getElementById('newCategoryModalOverlay').style.display = 'none';
        }

        function editSelectedCategoryPrompt() {
            const catSelect = document.getElementById('settings_category_select');
            if (!catSelect || !catSelect.value) {
                alert('অনুগ্রহ করে একটি শ্রেণী নির্বাচন করুন।');
                return;
            }
            const currentCat = catSelect.value;
            document.getElementById('edit_category_old_name').value = currentCat;
            document.getElementById('edit_category_input').value = currentCat;
            document.getElementById('editCategoryModalOverlay').style.display = 'flex';
            setTimeout(() => document.getElementById('edit_category_input').focus(), 100);
        }

        function saveEditedCategory() {
            const oldCat = document.getElementById('edit_category_old_name').value;
            const newCat = document.getElementById('edit_category_input').value;
            
            if (newCat && newCat.trim() && oldCat && oldCat !== newCat.trim()) {
                const cleanNewCat = newCat.trim();
                if (!window.GLOBAL_PRODUCTS_DATABASE) window.GLOBAL_PRODUCTS_DATABASE = {};
                
                // Copy data to new category name
                window.GLOBAL_PRODUCTS_DATABASE[cleanNewCat] = window.GLOBAL_PRODUCTS_DATABASE[oldCat] || {};
                delete window.GLOBAL_PRODUCTS_DATABASE[oldCat];
                
                // Update the dropdown option
                const catSelect = document.getElementById('settings_category_select');
                if (catSelect) {
                    for (let i = 0; i < catSelect.options.length; i++) {
                        if (catSelect.options[i].value === oldCat) {
                            catSelect.options[i].value = cleanNewCat;
                            catSelect.options[i].textContent = cleanNewCat;
                            break;
                        }
                    }
                    catSelect.value = cleanNewCat;
                }
                _saveGlobalProductsDB(); // persist to db
                
                // Refresh list if needed (it already is selected)
            }
            document.getElementById('editCategoryModalOverlay').style.display = 'none';
        }

        function deleteSelectedCategoryPrompt() {
            const catSelect = document.getElementById('settings_category_select');
            if (!catSelect || !catSelect.value) {
                alert('অনুগ্রহ করে একটি শ্রেণী নির্বাচন করুন।');
                return;
            }
            const currentCat = catSelect.value;
            
            if (confirm(`আপনি কি সত্যিই '${currentCat}' শ্রেণীটি মুছতে চান ? `)) {
                if (window.GLOBAL_PRODUCTS_DATABASE && window.GLOBAL_PRODUCTS_DATABASE[currentCat]) {
                    delete window.GLOBAL_PRODUCTS_DATABASE[currentCat];
                }
                if (catSelect) {
                    for (let i = 0; i < catSelect.options.length; i++) {
                        if (catSelect.options[i].value === currentCat) {
                            catSelect.remove(i);
                            break;
                        }
                    }
                    if (catSelect.options.length > 0) {
                        catSelect.selectedIndex = 0;
                    }
                }
                loadCategoryProducts();
                _saveGlobalProductsDB(); // persist to db
            }
        }

        function _saveGlobalProductsDB() {
            const ipc = window.parent.ipcRenderer || window.ipcRenderer;
            if (ipc && typeof ipc.sendSync === 'function') {
                try {
                    // Update db
                    ipc.sendSync('db-set-kv', 'cmsme_products_config', JSON.stringify(window.GLOBAL_PRODUCTS_DATABASE));
                } catch (e) {
                    console.error('Error updating DB on category edit:', e);
                }
            }
        }

        function triggerExcelFileInput() {
            document.getElementById('excel_file_input').click();
        }

        function importExcelProductData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                let importedCount = 0;
                json.forEach((cols, index) => {
                    // Skip header row if it contains keywords
                    if (index === 0 && (!cols[0] || String(cols[0]) === 'পণ্যের বিবরণ' || String(cols[0]) === 'পণ্যের নাম' || String(cols[0]).toLowerCase() === 'product')) {
                        return;
                    }
                    if (cols.length >= 3 && cols[0]) {
                        const desc = String(cols[0]).trim();
                        if (!desc) return;
                        const volume = parseFloat(toEnglishNumber(cols[1])) || 60;
                        const unit = String(cols[2]).trim();
                        const costPrice = cols[3] ? parseFloat(toEnglishNumber(cols[3])) || 0 : 0;

                        addSettingsProductRow({
                            desc: desc,
                            volume: volume,
                            unit: unit,
                            costPrice: costPrice
                        });
                        importedCount++;
                    }
                });
                alert('সফলভাবে ' + toBanglaNumber(importedCount) + ' টি পণ্য ইম্পোর্ট করা হয়েছে। সংরক্ষণ করতে (Save to DB) বাটনে ক্লিক করুন।');
                event.target.value = '';
            };
            reader.readAsArrayBuffer(file);
        }

        function saveProductSettings() {
            const cat = document.getElementById('settings_category_select').value;
            if (!cat) return;

            const items = {};
            const rows = document.querySelectorAll('#settings_product_table tbody tr');
            let hasEmpty = false;
            rows.forEach(row => {
                const desc = row.querySelector('.setting_item_desc')?.value.trim();
                const volume = parseFloat(toEnglishNumber(row.querySelector('.setting_item_volume')?.value)) || 60;
                const unit = row.querySelector('.setting_item_unit')?.value.trim() || 'কেজি';
                const costPrice = parseFloat(toEnglishNumber(row.querySelector('.setting_item_cost')?.value)) || 0;

                if (desc) {
                    items[desc] = {
                        volume: volume,
                        unit: unit,
                        costPrice: costPrice
                    };
                } else {
                    hasEmpty = true;
                }
            });

            if (hasEmpty) {
                alert('সতর্কতা: বিবরণ ছাড়া পণ্য তালিকাভুক্ত করা হবে না।');
            }

            if (!window.GLOBAL_PRODUCTS_DATABASE) window.GLOBAL_PRODUCTS_DATABASE = {};
            window.GLOBAL_PRODUCTS_DATABASE[cat] = items;


            const ipc = window.parent.ipcRenderer || window.ipcRenderer;
            if (ipc && typeof ipc.sendSync === 'function') {
                try {
                    ipc.sendSync('db-set-kv', 'cmsme_products_config', JSON.stringify(window.GLOBAL_PRODUCTS_DATABASE));
                    alert('পণ্য তালিকা এবং মূল্যসমূহ সফলভাবে সংরক্ষণ করা হয়েছে।');
                } catch (e) {
                    console.error('Error saving products config to Electron DB:', e);
                    alert('সংরক্ষণ ব্যর্থ হয়েছে।');
                }
            } else {
                alert('সরাসরি ডেটাবেস সংযোগ পাওয়া যায়নি। ব্রাউজারের ক্যাশে সংরক্ষণ করা হল।');
            }

            flattenProductDatabase();
            if (typeof updateBizNatureOptions === 'function') {
                updateBizNatureOptions();
            }
        }


        function handleStockItemChange(input) {
            const desc = input.value.trim();
            const row = input.closest('tr');
            if (!row) return;

            const item = PRELISTED_GROCERY_ITEMS[desc];
            if (item) {
                const qtyInput = row.querySelector('.stock_row_qty');
                const priceInput = row.querySelector('.stock_row_unit_price');
                const saleInput = row.querySelector('.stock_row_sale_price');

                if (qtyInput) qtyInput.value = toBanglaNumber('১');
                if (priceInput) priceInput.value = toBanglaNumber(item.costPrice.toString());
                if (saleInput) saleInput.value = toBanglaNumber(item.salePrice.toString());

                calculateStockRowTotal(qtyInput || priceInput);
            }
        }

        function toggleTradingSection() {
            const bizType = document.getElementById('input_business_type') ? document.getElementById('input_business_type').value : '';
            const section = document.getElementById('trading_details_section');
            if (section) {
                // Section is now permanently display: block
                section.style.display = 'block';
                calculateTradingStorage();

                const godownContainer = document.getElementById('godown_table_container');
                const showroomContainer = document.getElementById('showroom_table_container');
                const projContainer = document.getElementById('project_land_dimensional_container');
                
                const rentShowroomContainer = document.getElementById('rent_showroom_container');
                const rentGodownContainer = document.getElementById('rent_godown_container');
                const rentProjContainer = document.getElementById('rent_project_land_container');

                // Show/hide tables based on selection rules:
                // Trading: Godown + Showroom
                // Manufacturing: Godown + Showroom + Project Land
                // Service: Godown + Showroom + Project Land
                if (bizType === 'ট্রেডিং') {
                    if (godownContainer) godownContainer.style.display = 'block';
                    if (showroomContainer) showroomContainer.style.display = 'block';
                    if (projContainer) projContainer.style.display = 'none';

                    if (rentGodownContainer) rentGodownContainer.style.display = 'block';
                    if (rentShowroomContainer) rentShowroomContainer.style.display = 'block';
                    if (rentProjContainer) rentProjContainer.style.display = 'none';
                } else if (bizType === 'ম্যানুফেকচারিং' || bizType === 'ম্যানুফ্যাকচারিং' || bizType === 'সার্ভিস') {
                    if (godownContainer) godownContainer.style.display = 'block';
                    if (showroomContainer) showroomContainer.style.display = 'block';
                    if (projContainer) projContainer.style.display = 'block';

                    if (rentGodownContainer) rentGodownContainer.style.display = 'block';
                    if (rentShowroomContainer) rentShowroomContainer.style.display = 'block';
                    if (rentProjContainer) rentProjContainer.style.display = 'block';
                } else {
                    // Default fallback: show godown + showroom, hide project land
                    if (godownContainer) godownContainer.style.display = 'block';
                    if (showroomContainer) showroomContainer.style.display = 'block';
                    if (projContainer) projContainer.style.display = 'none';

                    if (rentGodownContainer) rentGodownContainer.style.display = 'block';
                    if (rentShowroomContainer) rentShowroomContainer.style.display = 'block';
                    if (rentProjContainer) rentProjContainer.style.display = 'none';
                }

                // Show rent section for all business types
                const rentSection = document.getElementById('rent_details_section');
                if (rentSection) rentSection.style.display = 'block';
            }
        }

        function addGodownRow(data = {}) {
            const tbody = document.querySelector('#godown_table tbody');
            if (!tbody) return;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style = "border: 1px solid #ddd; padding: 4px;" ><input type="text" class="godown_loc" value="${data.loc || ''}" placeholder="যেমন: গোডাউন ১" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_length" value="${data.length || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_width" value="${data.width || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_height" value="${data.height || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_volume" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_cap_100" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_val_100" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_cap_80" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="godown_val_80" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">
                    <button type="button" onclick="deleteGodownRow(this)" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">মুছুন</button>
                </td>
            `;
            calculateTradingStorage();
        }

        function deleteGodownRow(button) {
            const row = button.closest('tr');
            if (row) row.remove();
            calculateTradingStorage();
        }

        function addShowroomRow(data = {}) {
            const tbody = document.querySelector('#showroom_table tbody');
            if (!tbody) return;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style = "border: 1px solid #ddd; padding: 4px;" ><input type="text" class="showroom_loc" value="${data.loc || ''}" placeholder="যেমন: শোরুম ১" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_length" value="${data.length || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_width" value="${data.width || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_height" value="${data.height || ''}" oninput="handleGenericDigitInput(this); calculateTradingStorage();" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_volume" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_cap_100" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_val_100" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_cap_80" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="showroom_val_80" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">
                    <button type="button" onclick="deleteShowroomRow(this)" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">মুছুন</button>
                </td>
            `;
            calculateTradingStorage();
        }

        function deleteShowroomRow(button) {
            const row = button.closest('tr');
            if (row) row.remove();
            calculateTradingStorage();
        }

        function addRentRow(tableId, data = {}) {
            const tbody = document.querySelector('#' + tableId + ' tbody');
            if (!tbody) return;
            const row = tbody.insertRow();
            const ownership = data.ownership || 'ভাড়াকৃত';
            const isOwned = ownership === 'নিজস্ব';
            row.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 4px;">
                    <select class="rent_ownership" onchange="handleRentOwnershipChange(this)" style="width: 100%; height: 32px; border-radius: 4px; border: 1px solid #ccc; padding: 3px;">
                        <option value="ভাড়াকৃত" ${ownership === 'ভাড়াকৃত' ? 'selected' : ''}>ভাড়াকৃত</option>
                        <option value="নিজস্ব" ${ownership === 'নিজস্ব' ? 'selected' : ''}>নিজস্ব</option>
                    </select>
                </td>
                <td style="border: 1px solid #ddd; padding: 4px;">
                    <input type="text" class="rent_monthly" value="${data.monthly || ''}" placeholder="যেমন: ১০০০০" oninput="handleGenericDigitInput(this)" ${isOwned ? 'disabled style="background:#f5f5f5;"' : ''} style="width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid #ccc; border-radius: 4px; text-align: right;">
                </td>
                <td style="border: 1px solid #ddd; padding: 4px;">
                    <input type="date" class="rent_start_date" value="${data.startDate || ''}" onchange="calculateRentExpiry(this)" ${isOwned ? 'disabled style="background:#f5f5f5;"' : ''} style="width: 100%; height: 32px; border-radius: 4px; border: 1px solid #ccc; padding: 3px; box-sizing: border-box;">
                </td>
                <td style="border: 1px solid #ddd; padding: 4px;">
                    <input type="text" class="rent_duration_years" value="${data.durationYears || ''}" placeholder="বছর" oninput="handleGenericDigitInput(this); calculateRentExpiry(this);" ${isOwned ? 'disabled style="background:#f5f5f5;"' : ''} style="width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid #ccc; border-radius: 4px; text-align: right;">
                </td>
                <td style="border: 1px solid #ddd; padding: 4px;">
                    <input type="date" class="rent_expiry_date" value="${data.expiryDate || ''}" readonly style="width: 100%; height: 32px; border-radius: 4px; border: 1px solid #ccc; padding: 3px; box-sizing: border-box; background: #f0f0f0;">
                </td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">
                    <button type="button" onclick="this.closest('tr').remove()" style="padding: 3px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">মুছুন</button>
                </td>
            `;
        }

        function handleRentOwnershipChange(selectEl) {
            const row = selectEl.closest('tr');
            const isOwned = selectEl.value === 'নিজস্ব';
            row.querySelectorAll('.rent_monthly, .rent_start_date, .rent_duration_years').forEach(el => {
                el.disabled = isOwned;
                el.style.background = isOwned ? '#f5f5f5' : '';
                if (isOwned) el.value = '';
            });
            const expiryEl = row.querySelector('.rent_expiry_date');
            if (expiryEl && isOwned) expiryEl.value = '';
        }

        function calculateRentExpiry(inputEl) {
            const row = inputEl.closest('tr');
            const startDateEl = row.querySelector('.rent_start_date');
            const durationEl = row.querySelector('.rent_duration_years');
            const expiryEl = row.querySelector('.rent_expiry_date');
            if (!startDateEl || !durationEl || !expiryEl) return;
            const startVal = startDateEl.value;
            const durationYears = toEnglishNumber(durationEl.value);
            if (startVal && durationYears && !isNaN(parseFloat(durationYears))) {
                const startDate = new Date(startVal);
                const totalMonths = parseFloat(durationYears) * 12;
                startDate.setMonth(startDate.getMonth() + totalMonths);
                const y = startDate.getFullYear();
                const m = String(startDate.getMonth() + 1).padStart(2, '0');
                const d = String(startDate.getDate()).padStart(2, '0');
                expiryEl.value = y + '-' + m + '-' + d;
            } else {
                expiryEl.value = '';
            }
        }

        function addProjectLandDimensionalRow(data = {}) {
            const tbody = document.querySelector('#project_land_dimensional_table tbody');
            if (!tbody) return;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style = "border: 1px solid #ddd; padding: 4px;" ><input type="text" class="proj_loc" value="${data.loc || ''}" placeholder="যেমন: কারখানা ১" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="proj_length" value="${data.length || ''}" oninput="handleGenericDigitInput(this); calculateProjectLandVolume(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="proj_width" value="${data.width || ''}" oninput="handleGenericDigitInput(this); calculateProjectLandVolume(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="proj_height" value="${data.height || ''}" oninput="handleGenericDigitInput(this); calculateProjectLandVolume(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="proj_volume" value="০" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">
                    <button type="button" onclick="this.closest('tr').remove()" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">মুছুন</button>
                </td>
            `;
        }

        function calculateProjectLandVolume(inputEl) {
            const row = inputEl.closest('tr');
            const len = parseFloat(toEnglishNumber(row.querySelector('.proj_length').value)) || 0;
            const wid = parseFloat(toEnglishNumber(row.querySelector('.proj_width').value)) || 0;
            const hgt = parseFloat(toEnglishNumber(row.querySelector('.proj_height').value)) || 0;
            const vol = len * wid * (hgt || 1);
            row.querySelector('.proj_volume').value = toBanglaNumber(vol.toFixed(2));
        }

        function toggleCibLoanDetails() {
            const val = document.getElementById('cib_other_loan') ? document.getElementById('cib_other_loan').value : '';
            document.querySelectorAll('.cib-detail-field').forEach(el => {
                el.style.display = val === 'আছে' ? 'block' : 'none';
            });
            if (val !== 'আছে') {
                ['cib_other_amount', 'cib_other_status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                const dateEl = document.getElementById('cib_other_receive_date');
                if (dateEl) dateEl.value = '';
            }
        }

        function calculateTradingStorage() {
            // 1. Calculate average size and unit price from Stock details table
            let totalQty = 0;
            let totalVolumeCi = 0;
            let totalCostSum = 0;

            const stockRows = document.querySelectorAll('#stock_details_table tbody tr');
            stockRows.forEach(row => {
                const desc = row.querySelector('.stock_row_desc')?.value || '';
                const qtyVal = row.querySelector('.stock_row_qty')?.value || '০';
                const priceVal = row.querySelector('.stock_row_unit_price')?.value || '০';

                const qty = parseFloat(toEnglishNumber(qtyVal)) || 0;
                const price = parseFloat(toEnglishNumber(priceVal)) || 0;

                // Lookup item volume in cubic inches
                let itemVolumeCi = 60; // Default fallback
                if (PRELISTED_GROCERY_ITEMS[desc]) {
                    itemVolumeCi = PRELISTED_GROCERY_ITEMS[desc].volume;
                } else {
                    // Search if name contains key items
                    Object.keys(PRELISTED_GROCERY_ITEMS).forEach(k => {
                        if (desc.includes(k.split(' ')[0])) {
                            itemVolumeCi = PRELISTED_GROCERY_ITEMS[k].volume;
                        }
                    });
                }

                totalQty += qty;
                totalVolumeCi += itemVolumeCi * qty;
                totalCostSum += qty * price;
            });

            let avgVolumeCi = 325; // Default average fallback
            let avgPrice = 450;    // Default average fallback

            if (totalQty > 0) {
                avgVolumeCi = totalVolumeCi / totalQty;
                avgPrice = totalCostSum / totalQty;
            }
            const avgVolumeCft = avgVolumeCi / 1728; // convert cubic inch to cubic feet

            let totalCap100 = 0;
            let totalCap80 = 0;
            let totalVal100 = 0;
            let totalVal80 = 0;

            // 2. Calculate Godown rows
            const godownRows = document.querySelectorAll('#godown_table tbody tr');
            godownRows.forEach(row => {
                const lenVal = row.querySelector('.godown_length').value;
                const widVal = row.querySelector('.godown_width').value;
                const heiVal = row.querySelector('.godown_height').value;

                const l = parseFloat(toEnglishNumber(lenVal)) || 0;
                const w = parseFloat(toEnglishNumber(widVal)) || 0;
                const h = parseFloat(toEnglishNumber(heiVal)) || 0;

                const volumeCft = l * w * h;
                row.querySelector('.godown_volume').value = toBanglaNumber(volumeCft);

                const cap100 = avgVolumeCft > 0 ? Math.round(volumeCft / avgVolumeCft) : 0;
                const val100 = Math.round(cap100 * avgPrice);
                const cap80 = Math.round(cap100 * 0.8);
                const val80 = Math.round(val100 * 0.8);

                row.querySelector('.godown_cap_100').value = toBanglaNumber(cap100);
                row.querySelector('.godown_val_100').value = toBanglaNumber(val100);
                row.querySelector('.godown_cap_80').value = toBanglaNumber(cap80);
                row.querySelector('.godown_val_80').value = toBanglaNumber(val80);

                totalCap100 += cap100;
                totalCap80 += cap80;
                totalVal100 += val100;
                totalVal80 += val80;
            });

            // 3. Calculate Showroom rows
            const showroomRows = document.querySelectorAll('#showroom_table tbody tr');
            showroomRows.forEach(row => {
                const lenVal = row.querySelector('.showroom_length').value;
                const widVal = row.querySelector('.showroom_width').value;
                const heiVal = row.querySelector('.showroom_height').value;

                const l = parseFloat(toEnglishNumber(lenVal)) || 0;
                const w = parseFloat(toEnglishNumber(widVal)) || 0;
                const h = parseFloat(toEnglishNumber(heiVal)) || 0;

                const volumeCft = l * w * h;
                row.querySelector('.showroom_volume').value = toBanglaNumber(volumeCft);

                const cap100 = avgVolumeCft > 0 ? Math.round(volumeCft / avgVolumeCft) : 0;
                const val100 = Math.round(cap100 * avgPrice);
                const cap80 = Math.round(cap100 * 0.8);
                const val80 = Math.round(val100 * 0.8);

                row.querySelector('.showroom_cap_100').value = toBanglaNumber(cap100);
                row.querySelector('.showroom_val_100').value = toBanglaNumber(val100);
                row.querySelector('.showroom_cap_80').value = toBanglaNumber(cap80);
                row.querySelector('.showroom_val_80').value = toBanglaNumber(val80);

                totalCap100 += cap100;
                totalCap80 += cap80;
                totalVal100 += val100;
                totalVal80 += val80;
            });

            // 4. Update summation row
            if (document.getElementById('input_total_trading_capacity')) {
                document.getElementById('input_total_trading_capacity').value = toBanglaNumber(totalCap100) + ' / ' + toBanglaNumber(totalCap80);
            }
            if (document.getElementById('input_total_trading_value_100')) {
                document.getElementById('input_total_trading_value_100').value = toBanglaNumber(totalVal100);
            }
            if (document.getElementById('input_total_trading_value_80')) {
                document.getElementById('input_total_trading_value_80').value = toBanglaNumber(totalVal80);
            }
        }

        // --- Stock Report & Business Profile Helpers ---
        function syncStockInputs() {
            const sector = document.getElementById('input_business_sector') ? document.getElementById('input_business_sector').value : '';
            const nature = document.getElementById('input_business_nature') ? document.getElementById('input_business_nature').value : '';
            const cap = document.getElementById('input_business_capital') ? document.getElementById('input_business_capital').value : '';
            const loan = document.getElementById('applied_amount') ? document.getElementById('applied_amount').value : '';

            if (document.getElementById('stock_business_sector')) document.getElementById('stock_business_sector').value = sector;
            if (document.getElementById('stock_business_nature')) document.getElementById('stock_business_nature').value = nature;
            if (document.getElementById('stock_entrepreneur_investment')) {
                document.getElementById('stock_entrepreneur_investment').value = cap;
            }
            if (document.getElementById('stock_loan_amount')) {
                document.getElementById('stock_loan_amount').value = loan;
            }
            calculateStockInvestmentRatio();
        }

        function calculateStockInvestmentRatio() {
            const entVal = document.getElementById('stock_entrepreneur_investment')?.value || '';
            const loanVal = document.getElementById('stock_loan_amount')?.value || '';
            const ent = parseFloat(toEnglishNumber(entVal)) || 0;
            const loan = parseFloat(toEnglishNumber(loanVal)) || 0;
            const total = ent + loan;
            
            const ratioEl = document.getElementById('stock_investment_ratio');
            if (!ratioEl) return;
            
            if (total === 0) {
                ratioEl.value = '';
                return;
            }
            const entPct = Math.round((ent / total) * 100);
            const loanPct = 100 - entPct;
            ratioEl.value = toBanglaNumber(entPct) + ':' + toBanglaNumber(loanPct);
        }

        function generateRecommendationText() {
            const nameInputs = document.querySelectorAll('.input_name');
            let names = [];
            nameInputs.forEach(input => {
                if(input.value.trim() !== '') names.push(input.value.trim());
            });
            const applicantName = names.length > 0 ? names.join(' এবং ') : '[আবেদনকারীর নাম]';

            const businessName = document.getElementById('input_business_name') && document.getElementById('input_business_name').value.trim() !== '' ? document.getElementById('input_business_name').value : '[প্রতিষ্ঠানের নাম]';
            const loanSector = document.getElementById('input_loan_sector') && document.getElementById('input_loan_sector').value !== '' ? document.getElementById('input_loan_sector').value : '[খাত]';
            const loanPurpose = document.getElementById('input_loan_purpose') && document.getElementById('input_loan_purpose').value.trim() !== '' ? document.getElementById('input_loan_purpose').value : '[উদ্দেশ্য]';
            
            let interestRate = document.getElementById('input_interest_rate') ? document.getElementById('input_interest_rate').value.trim() : '';
            if(interestRate && !interestRate.includes('%')) interestRate += '%';
            if(!interestRate) interestRate = '[সুদের হার]';

            const appliedAmount = document.getElementById('applied_amount') && document.getElementById('applied_amount').value !== '' ? document.getElementById('applied_amount').value : '[পরিমাণ]';
            const appliedAmountWords = document.getElementById('applied_amount_words') && document.getElementById('applied_amount_words').value !== '' ? document.getElementById('applied_amount_words').value : '[কথায়]';
            const loanType = document.getElementById('input_loan_type') && document.getElementById('input_loan_type').value !== '' ? document.getElementById('input_loan_type').value : '[ধরণ]';
            
            const sanctionType = document.getElementById('input_sanction_type') ? document.getElementById('input_sanction_type').value : '';
            const sanctionAuthority = document.getElementById('input_authority') ? document.getElementById('input_authority').value : '';
            const isManager = (sanctionAuthority === 'ব্যবস্থাপক');
            
            const currentLimit = document.getElementById('prev_amount') && document.getElementById('prev_amount').value !== '' ? document.getElementById('prev_amount').value : '[বর্তমান ঋণ সীমা]';
            const enhancedAmount = document.getElementById('enhanced_amount') && document.getElementById('enhanced_amount').value !== '' ? document.getElementById('enhanced_amount').value : '[বর্ধিত ঋণের পরিমাণ]';

            let officerText = '';
            let managerText = '';

            if (sanctionType === 'বর্ধিতসহ নবায়ন') {
                officerText = `আবেদনকারীর আবেদন, ব্যবসায়িক অভিজ্ঞতা, সরেজমিন তদন্তে সন্তোষজনক ব্যবসায়িক অবস্থা পরিলক্ষিত হবার প্রেক্ষিতে ঋণ আবেদনকারী - ${ applicantName } কর্তৃক পরিচালিত ${ businessName } -এর অনুকুলে ${ loanSector } খাতে ${ loanPurpose } পরিচালনা করার জন্য ${ interestRate } সুদে ভোগরত মং = ${ currentLimit } এর সাথে অতিরিক্ত ${ enhancedAmount } টাকা সহ মং - ${ appliedAmount } (${ appliedAmountWords })মাত্র ${ loanType } বর্ধিতসহ নবায়ন মঞ্জুর করার সুপারিশ করা হলো।`;
                managerText = `মাঠ কর্মকর্তার সুপারিশ মোতাবেক ঋণ আবেদনকারী - ${ applicantName } কর্তৃক পরিচালিত ${ businessName } -এর অনুকুলে ${ loanSector } খাতে ${ loanPurpose } পরিচালনা করার জন্য ${ interestRate } সুদে মং = ${ appliedAmount } (${ appliedAmountWords })মাত্র ${ loanType } বর্ধিতসহ নবায়ন ${ isManager ? 'মঞ্জুর করা হলো' : 'মঞ্জুর করার সুপারিশ করা হলো' }।`;
            } else {
                let actionText = 'ঋণ মঞ্জুরীর সুপারিশ করা হলো।';
                let actionTextManager = isManager ? 'ঋণ মঞ্জুর করা হলো।' : 'ঋণ মঞ্জুরীর সুপারিশ করা হলো।';
                if(sanctionType === 'নবায়ন') {
                    actionText = 'নবায়ন মঞ্জুরীর সুপারিশ করা হলো।';
                    actionTextManager = isManager ? 'নবায়ন মঞ্জুর করা হলো।' : 'নবায়ন মঞ্জুরীর সুপারিশ করা হলো।';
                }

                officerText = `আবেদনকারীর আবেদন, ব্যবসায়িক অভিজ্ঞতা, সরেজমিন তদন্তে সন্তোষজনক ব্যবসায়িক অবস্থা পরিলক্ষিত হবার প্রেক্ষিতে ঋণ আবেদনকারী - ${ applicantName } কর্তৃক পরিচালিত ${ businessName } -এর অনুকুলে ${ loanSector } খাতে ${ loanPurpose } পরিচালনা করার জন্য ${ interestRate } সুদে মং = ${ appliedAmount } (${ appliedAmountWords }) টাকা মাত্র ${ loanType } ${ actionText } `;
                managerText = `মাঠ কর্মকর্তার সুপারিশ মোতাবেক ঋণ আবেদনকারী - ${ applicantName } কর্তৃক পরিচালিত ${ businessName } -এর অনুকুলে ${ loanSector } খাতে ${ loanPurpose } পরিচালনা করার জন্য ${ interestRate } সুদে মং = ${ appliedAmount } (${ appliedAmountWords }) টাকা মাত্র ${ loanType } ${ actionTextManager } `;
            }

            document.getElementById('officer_recommendation').value = officerText;
            document.getElementById('manager_recommendation').value = managerText;
        }

        function generateBizProfile() {
            const entries = document.querySelectorAll('.applicant-entry');
            const primaryApplicant = entries[0];
            
            const cmsmeData = {};
            const allInputs = document.querySelectorAll('#modalOverlay input, #modalOverlay select, #modalOverlay textarea');
            allInputs.forEach(el => {
                if (el.id) {
                    cmsmeData[el.id] = el.value;
                }
            });

            // Collect co-applicants list
            const coApplicantsList = [];
            const coEntriesList = document.querySelectorAll('.applicant-entry');
            for (let i = 1; i < coEntriesList.length; i++) {
                const entry = coEntriesList[i];
                coApplicantsList.push({
                    name: entry.querySelector('.input_name')?.value || '',
                    father: entry.querySelector('.input_father')?.value || '',
                    mother: entry.querySelector('.input_mother')?.value || '',
                    nid: entry.querySelector('.input_nid')?.value || '',
                    mobile: entry.querySelector('.input_mobile')?.value || ''
                });
            }
            cmsmeData['co_applicants_json'] = JSON.stringify(coApplicantsList);
            cmsmeData['primaryName'] = primaryApplicant?.querySelector('.input_name')?.value || '';
            cmsmeData['mobile'] = primaryApplicant?.querySelector('.input_mobile')?.value || '';

            // Collect stock details
            const stockDetailsList = [];
            const stockRows = document.querySelectorAll('#stock_details_table tbody tr');
            stockRows.forEach(row => {
                stockDetailsList.push({
                    desc: row.querySelector('.stock_row_desc')?.value || '',
                    qty: row.querySelector('.stock_row_qty')?.value || '',
                    price: row.querySelector('.stock_row_unit_price')?.value || '',
                    total: row.querySelector('.stock_row_total_cost')?.value || '',
                    sale: row.querySelector('.stock_row_sale_price')?.value || ''
                });
            });
            cmsmeData['stock_details_json'] = JSON.stringify(stockDetailsList);

            // Collect godown details
            const godownList = [];
            const godownRows = document.querySelectorAll('#godown_table tbody tr');
            godownRows.forEach(row => {
                godownList.push({
                    loc: row.querySelector('.godown_loc')?.value || '',
                    length: row.querySelector('.godown_length')?.value || '',
                    width: row.querySelector('.godown_width')?.value || '',
                    height: row.querySelector('.godown_height')?.value || ''
                });
            });
            cmsmeData['godowns_json'] = JSON.stringify(godownList);

            // Collect showroom details
            const showroomList = [];
            const showroomRows = document.querySelectorAll('#showroom_table tbody tr');
            showroomRows.forEach(row => {
                showroomList.push({
                    length: row.querySelector('.showroom_length')?.value || '',
                    width: row.querySelector('.showroom_width')?.value || '',
                    height: row.querySelector('.showroom_height')?.value || ''
                });
            });
            cmsmeData['showrooms_json'] = JSON.stringify(showroomList);
            
            // Collect rent tables
            const rentShowroomList = [];
            document.querySelectorAll('#rent_showroom_table tbody tr').forEach(row => {
                rentShowroomList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_showroom_json'] = JSON.stringify(rentShowroomList);

            const rentGodownList = [];
            document.querySelectorAll('#rent_godown_table tbody tr').forEach(row => {
                rentGodownList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_godown_json'] = JSON.stringify(rentGodownList);

            const rentProjectLandList = [];
            document.querySelectorAll('#rent_project_land_table tbody tr').forEach(row => {
                rentProjectLandList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_project_land_json'] = JSON.stringify(rentProjectLandList);

            // Collect project land dimensional details
            const projectLandDimList = [];
            document.querySelectorAll('#project_land_dimensional_table tbody tr').forEach(row => {
                projectLandDimList.push({
                    loc: row.querySelector('.proj_loc')?.value || '',
                    length: row.querySelector('.proj_length')?.value || '',
                    width: row.querySelector('.proj_width')?.value || '',
                    height: row.querySelector('.proj_height')?.value || '',
                    volume: row.querySelector('.proj_volume')?.value || ''
                });
            });
            cmsmeData['project_land_dimensional_json'] = JSON.stringify(projectLandDimList);

            // Broadcast to all child iframes (Profile, Stock Report, etc.)
            const iframes = document.querySelectorAll('iframe');
            let profileSent = false;
            iframes.forEach(iframe => {
                try {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ command: 'FILL', data: cmsmeData }, '*');
                        profileSent = true;
                    }
                } catch (e) {}
            });

            if (profileSent) {
                alert('ব্যবসায়িক প্রোফাইল সফলভাবে জেনারেট করা হয়েছে। অনুগ্রহ করে "ব্যবসায়িক প্রোফাইল" ট্যাবটি দেখুন।');
            } else {
                alert('ব্যবসায়িক প্রোফাইল ট্যাবটি লোড হতে পারেনি।');
            }
        }

        function autoGenerateStockReport() {
            const countInput = document.getElementById('stock_product_count');
            let count = parseInt(toEnglishNumber(countInput.value)) || 0;
            if (count < 1) {
                alert("পণ্য ও সেবার সংখ্যা প্রদান করুন।");
                return;
            }

            const divRateVal = document.getElementById('stock_dividend_rate') ? document.getElementById('stock_dividend_rate').value : '';
            if (!divRateVal.trim()) {
                alert("গড় লভ্যাংশের হার (%) প্রদান করুন।");
                return;
            }
            const divRate = parseFloat(toEnglishNumber(divRateVal)) || 0;

            const entVal = document.getElementById('stock_entrepreneur_investment').value || '';
            const loanVal = document.getElementById('stock_loan_amount').value || '';
            const ent = parseFloat(toEnglishNumber(entVal)) || 0;
            const loan = parseFloat(toEnglishNumber(loanVal)) || 0;
            const totalInvestment = ent + loan;
            
            if (totalInvestment <= 0) {
                alert("উদ্যোক্তার বিনিয়োগ অথবা ঋণের পরিমাণ প্রদান করুন। (ব্যবসা সংক্রান্ত তথ্য থেকে)");
                return;
            }

            // Calculate max available volume
            let totalMaxVol = 0;
            const godownVols = document.querySelectorAll('.godown_volume');
            godownVols.forEach(el => {
                totalMaxVol += parseFloat(toEnglishNumber(el.value)) || 0;
            });
            const showroomVols = document.querySelectorAll('.showroom_volume');
            showroomVols.forEach(el => {
                totalMaxVol += parseFloat(toEnglishNumber(el.value)) || 0;
            });

            if (totalMaxVol <= 0) {
                alert("গোডাউন এবং শোরুমের কোনো আয়তন পাওয়া যায়নি। দয়া করে গোডাউন/শোরুমের তথ্য হালনাগাদ করুন।");
                return;
            }

            // Get available products from PRELISTED_GROCERY_ITEMS
            const availableProducts = Object.keys(PRELISTED_GROCERY_ITEMS);
            if (availableProducts.length === 0) {
                alert("এই প্রকৃতির জন্য কোনো পণ্য পাওয়া যায়নি। দয়া করে সেটিংসে পণ্য যোগ করুন।");
                return;
            }

            // Randomly select N products
            const selectedProducts = [];
            let shuffled = [...availableProducts].sort(() => 0.5 - Math.random());
            for (let i = 0; i < count; i++) {
                selectedProducts.push(shuffled[i % shuffled.length]);
            }

            // Distribute investment using randomized weights
            const weights = selectedProducts.map(() => Math.random() * 0.8 + 0.2); // Random weight between 0.2 and 1.0
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);

            let totalRequiredVolumeCft = 0;
            const generatedRows = [];

            for (let i = 0; i < count; i++) {
                const productName = selectedProducts[i];
                const productData = PRELISTED_GROCERY_ITEMS[productName];
                // Max 80% of total investment can be spent on product purchase for trading loan
                const stockPurchasingCapital = totalInvestment * 0.8;
                const allocatedInvestment = stockPurchasingCapital * (weights[i] / totalWeight);
                
                const costPrice = productData.costPrice > 0 ? productData.costPrice : 100; // fallback
                const qty = allocatedInvestment / costPrice;
                
                // Volume is in cubic inches. 1 cft = 1728 cubic inches
                const unitVolInches = productData.volume || 0;
                const unitVolCft = unitVolInches / 1728;
                
                const itemTotalVol = qty * unitVolCft;
                totalRequiredVolumeCft += itemTotalVol;

                generatedRows.push({
                    desc: productName,
                    qty: qty,
                    costPrice: costPrice,
                    salePrice: Math.round(costPrice * (1 + divRate / 100)),
                    totalCost: qty * costPrice
                });
            }

            if (totalRequiredVolumeCft > totalMaxVol) {
                alert(`সতর্কতা: গোডাউন ও শোরুম উল্লেখিত পণ্যসমূহ ধারণ করতে অক্ষম! nপ্রয়োজনীয় আয়তন: ${ toBanglaNumber(Math.round(totalRequiredVolumeCft)) } ঘনফুটnআপনার ধারণক্ষমতা: ${ toBanglaNumber(Math.round(totalMaxVol)) } ঘনফুটnnদয়া করে গোডাউন / শোরুমের আয়তন বৃদ্ধি করুন অথবা বিনিয়োগের পরিমাণ কমান।`);
                return;
            }

            // Populate the table
            const tbody = document.querySelector('#stock_details_table tbody');
            tbody.innerHTML = '';

            for (let i = 0; i < count; i++) {
                const row = generatedRows[i];
                const displayQty = toBanglaNumber(row.qty % 1 === 0 ? row.qty : row.qty.toFixed(2));
                const tr = tbody.insertRow();
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;" > ${ toBanglaNumber(i + 1) }</td>
                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_desc" list="prelisted_grocery_items" oninput="handleStockItemChange(this)" value="${row.desc}" style="width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_qty" value="${displayQty}" oninput="handleGenericDigitInput(this); calculateStockRowTotal(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_unit_price" value="${toBanglaNumber(row.costPrice)}" oninput="handleGenericDigitInput(this); calculateStockRowTotal(this);" style="width: 100%; box-sizing: border-box; text-align: right; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_total_cost" value="${toBanglaNumber(Math.round(row.totalCost))}" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f0f0f0; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                    <td style="border: 1px solid #ddd; padding: 4px;"><input type="text" class="stock_row_sale_price" value="${toBanglaNumber(row.salePrice)}" readonly style="width: 100%; box-sizing: border-box; text-align: right; background: #f5f5f5; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
    `;
            }
            document.getElementById('stock_table_container').style.display = 'block';
            recalculateSalePrices();
            calculateTradingStorage();
        }

        function recalculateSalePrices() {
            const divRateVal = document.getElementById('stock_dividend_rate') ? document.getElementById('stock_dividend_rate').value : '০';
            const divRate = parseFloat(toEnglishNumber(divRateVal)) || 0;

            const rows = document.querySelectorAll('#stock_details_table tbody tr');
            rows.forEach(row => {
                const totalCostVal = row.querySelector('.stock_row_total_cost').value;
                const totalCost = parseFloat(toEnglishNumber(totalCostVal)) || 0;

                // Calculate TOTAL sale price based on total cost and profit dividend rate
                const totalSalePrice = Math.round(totalCost * (1 + divRate / 100));
                row.querySelector('.stock_row_sale_price').value = toBanglaNumber(totalSalePrice);
            });
            calculateStockTableSummary();
        }

        function calculateStockRowTotal(input) {
            const row = input.closest('tr');
            const qtyVal = row.querySelector('.stock_row_qty').value;
            const priceVal = row.querySelector('.stock_row_unit_price').value;

            const qty = parseFloat(toEnglishNumber(qtyVal)) || 0;
            const price = parseFloat(toEnglishNumber(priceVal)) || 0;
            const total = qty * price;

            row.querySelector('.stock_row_total_cost').value = toBanglaNumber(total);
            recalculateSalePrices();
        }

        function calculateStockTableSummary() {
            let totalCost = 0;
            let totalSale = 0;

            const rows = document.querySelectorAll('#stock_details_table tbody tr');
            rows.forEach(row => {
                const costVal = row.querySelector('.stock_row_total_cost').value;
                const saleVal = row.querySelector('.stock_row_sale_price').value;

                totalCost += parseFloat(toEnglishNumber(costVal)) || 0;
                totalSale += parseFloat(toEnglishNumber(saleVal)) || 0;
            });

            document.getElementById('stock_total_cost').innerText = toBanglaNumber(totalCost);
            document.getElementById('stock_total_sale').innerText = toBanglaNumber(totalSale);

            // Auto sync inventory value to the business inventory input
            const invInput = document.getElementById('input_business_inventory_value');
            if (invInput) {
                invInput.value = toBanglaNumber(totalCost);
                invInput.dispatchEvent(new Event('input'));
            }
            if (typeof calculateTradingStorage === 'function') {
                calculateTradingStorage();
            }
        }
        // ----------------------------------------------

        function handleAmountInput(el, wordsId) {
            const inputVal = toEnglishNumber(el.value);
            const engValue = inputVal.replace(/[^0-9]/g, '');
            el.value = toBanglaNumber(engValue);
            updateWords(engValue, wordsId);
        }

        function handleNidInput(el) {
            const engValue = toEnglishNumber(el.value).replace(/[^0-9]/g, '');
            el.value = toBanglaNumber(engValue);
        }

        function handleGenericDigitInput(el) {
            const engValue = toEnglishNumber(el.value).replace(/[^0-9]/g, '');
            el.value = toBanglaNumber(engValue);
        }

        function handleDecimalInput(el) {
            let engValue = toEnglishNumber(el.value).replace(/[^0-9.]/g, '');
            if (engValue.startsWith('.')) {
                engValue = '0' + engValue;
            }
            const parts = engValue.split('.');
            const filteredVal = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
            el.value = toBanglaNumber(filteredVal);
        }

        function toggleSpouse(el) {
            const entry = el.closest('.applicant-entry');
            const marital = el.value;
            entry.querySelector('.spouse-group').style.display = marital === 'বিবাহিত' ? 'block' : 'none';
        }

        function calculateAge(el) {
            const entry = el.closest('.applicant-entry');
            const dob = el.value;
            if (!dob) return;
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            entry.querySelector('.input_age').value = toBanglaNumber(age) + ' বছর';
        }

        function addApplicantEntry() {
            const container = document.getElementById('applicantContainer');
            const firstEntry = container.querySelector('.applicant-entry');
            const newEntry = firstEntry.cloneNode(true);

            // Strip IDs to avoid duplicates in DOM
            newEntry.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            // Update applicant number
            const applicantCount = container.querySelectorAll('.applicant-entry').length + 1;
            const numberHeading = newEntry.querySelector('.applicant-number');
            if (numberHeading) {
                numberHeading.innerText = 'আবেদনকারী -' + toBanglaNumber(String(applicantCount).padStart(2, '0'));
            }

            // Reset values in cloned entry
            newEntry.querySelectorAll('input').forEach(input => {
                input.value = '';
                if (input.classList.contains('input_age')) input.placeholder = 'অটোমেটিক';
            });
            newEntry.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
            newEntry.querySelector('.spouse-group').style.display = 'none';

            // Remove old remove button and container if they exist
            const oldRemoveBtn = newEntry.querySelector('.remove-btn');
            if (oldRemoveBtn) oldRemoveBtn.closest('.remove-btn-container')?.remove();
            const oldRemoveBtnContainer = newEntry.querySelector('.remove-btn-container');
            if (oldRemoveBtnContainer) oldRemoveBtnContainer.remove();

            // Add a remove button
            const removeBtnContainer = document.createElement('div');
            removeBtnContainer.className = 'remove-btn-container';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'fbtn fbtn-new remove-btn';
            removeBtn.style.padding = '5px 15px';
            removeBtn.innerText = 'মুছুন (-)';
            removeBtn.onclick = function () {
                if (document.querySelectorAll('.applicant-entry').length > 1) {
                    this.closest('.applicant-entry').remove();
                    // Update applicant numbers
                    const entries = container.querySelectorAll('.applicant-entry');
                    entries.forEach((entry, index) => {
                        const numHeading = entry.querySelector('.applicant-number');
                        if (numHeading) {
                            numHeading.innerText = 'আবেদনকারী -' + toBanglaNumber(String(index + 1).padStart(2, '0'));
                        }
                    });
                } else {
                    alert("কমপক্ষে একজন আবেদনকারী থাকতে হবে।");
                }
            };
            // Add a "Pull Customer Data" button for the new co-applicant entry
            const pullBtnContainer = document.createElement('div');
            pullBtnContainer.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:8px;';
            const pullBtn = document.createElement('button');
            pullBtn.type = 'button';
            pullBtn.className = 'fbtn';
            pullBtn.style.cssText = 'background:#1a5c38; color:white; border:none; padding:5px 14px; border-radius:4px; cursor:pointer; font-size:0.82rem;';
            pullBtn.innerHTML = '&#128269; Co-applicant ডেটা আনুন';
            pullBtn.onclick = function () { pullCmsmeApplicantSlot(this); };
            pullBtnContainer.appendChild(pullBtn);
            newEntry.insertBefore(pullBtnContainer, newEntry.firstChild);

            removeBtnContainer.appendChild(removeBtn);
            newEntry.appendChild(removeBtnContainer);
            container.appendChild(newEntry);
        }

        // Context-aware customer pull for a specific CMSME co-applicant slot
        function pullCmsmeApplicantSlot(btn) {
            const entry = btn.closest('.applicant-entry');
            const container = document.getElementById('applicantContainer');
            const entries = Array.from(container.querySelectorAll('.applicant-entry'));
            const index = entries.indexOf(entry);
            window.parent.postMessage({
                command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
                targetContext: 'cmsme_applicant_' + index
            }, '*');
        }

        // Pull a customer from DB directly into guarantor fields
        function pullCmsmeGuarantorFromDB() {
            window.parent.postMessage({
                command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
                targetContext: 'cmsme_guarantor_new'
            }, '*');
        }

        // Land Details Functions
        var landData = [];
        var valuationData = [];
        var chequeData = [];
        var mutationData = [];
        var guarantorData = [];
        var spouseGuarantorData = [];
        var deedData = [];
        var boundaryData = [];
        var licenseData = [];
        var liabilityData = [];

        function renderBoundaryTable() {
            var tbody = document.querySelector('#modal_boundary_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            boundaryData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                var boundaryStr = `উঃ ${ item.north || '-' }, দঃ ${ item.south || '-' }, পূঃ ${ item.east || '-' }, পঃ ${ item.west || '-' } `;
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 6px;" > ${ item.dagType || '' } ${ item.dagNo || '' }</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${boundaryStr}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">
                <button onclick="editBoundary(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteBoundary(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addBoundary() {
            var dagType = document.getElementById('prop_boundary_dag_type').value;
            var dagNo = document.getElementById('prop_boundary_dag_no').value;
            var north = document.getElementById('prop_boundary_north').value;
            var south = document.getElementById('prop_boundary_south').value;
            var east = document.getElementById('prop_boundary_east').value;
            var west = document.getElementById('prop_boundary_west').value;

            if (dagNo || north || south || east || west) {
                boundaryData.push({ dagType: dagType, dagNo: dagNo, north: north, south: south, east: east, west: west });
                renderBoundaryTable();
                ['prop_boundary_dag_type', 'prop_boundary_dag_no', 'prop_boundary_north', 'prop_boundary_south', 'prop_boundary_east', 'prop_boundary_west'].forEach(id => document.getElementById(id).value = '');
            } else { alert('অনুগ্রহ করে দাগ নং অথবা অন্তত একটি সীমানা প্রদান করুন।'); }
        }

        function editBoundary(index) {
            var item = boundaryData[index];
            document.getElementById('prop_boundary_dag_type').value = item.dagType;
            document.getElementById('prop_boundary_dag_no').value = item.dagNo;
            document.getElementById('prop_boundary_north').value = item.north;
            document.getElementById('prop_boundary_south').value = item.south;
            document.getElementById('prop_boundary_east').value = item.east;
            document.getElementById('prop_boundary_west').value = item.west;
            deleteBoundary(index);
        }

        function deleteBoundary(index) {
            boundaryData.splice(index, 1);
            renderBoundaryTable();
        }

        function renderDeedTable() {
            var tbody = document.querySelector('#modal_deed_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            deedData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 6px;" > ${ item.no } ${ item.date ? '(' + toBanglaNumber(item.date.split('-').reverse().join('/')) + ')' : '' }</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.porchaType || ''} ${item.porchaNo || ''}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">
                <button onclick="editDeed(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteDeed(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addDeed() {
            var no = document.getElementById('prop_deed_no').value;
            if (!no) { alert('দলিল নম্বর প্রদান করুন।'); return; }
            deedData.push({
                no: no,
                date: document.getElementById('prop_deed_date').value,
                porchaType: document.getElementById('prop_porcha_type').value,
                porchaNo: document.getElementById('prop_porcha_no').value
            });
            renderDeedTable();
            ['prop_deed_no', 'prop_deed_date', 'prop_porcha_type', 'prop_porcha_no'].forEach(id => document.getElementById(id).value = '');
        }

        function editDeed(index) {
            var item = deedData[index];
            document.getElementById('prop_deed_no').value = item.no;
            document.getElementById('prop_deed_date').value = item.date;
            document.getElementById('prop_porcha_type').value = item.porchaType;
            document.getElementById('prop_porcha_no').value = item.porchaNo;
            deleteDeed(index);
        }

        function deleteDeed(index) {
            deedData.splice(index, 1);
            renderDeedTable();
        }

        function renderSpouseTable() {
            var tbody = document.querySelector('#modal_spouse_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            spouseGuarantorData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px;" > ${ item.nameBn }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.nid}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.mobile}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">
                <button onclick="editSpouseGuarantor(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteSpouseGuarantor(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addSpouseGuarantor() {
            var nameBn = document.getElementById('spouse_name_bn').value;
            var nid = document.getElementById('spouse_nid').value;
            var mobile = document.getElementById('spouse_mobile').value;

            if (nameBn || nid) {
                spouseGuarantorData.push({
                    nameBn: nameBn,
                    fatherBn: document.getElementById('spouse_father_bn').value,
                    addressBn: document.getElementById('spouse_address_bn').value,
                    thanaBn: document.getElementById('spouse_thana_bn').value,
                    districtBn: document.getElementById('spouse_district_bn').value,
                    nameEn: document.getElementById('spouse_name_en').value,
                    fatherEn: document.getElementById('spouse_father_en').value,
                    villageEn: document.getElementById('spouse_village_en').value,
                    thanaEn: document.getElementById('spouse_thana_en').value,
                    districtEn: document.getElementById('spouse_district_en').value,
                    nid: nid,
                    mobile: mobile
                });
                renderSpouseTable();
                // Clear fields
                ['spouse_name_bn', 'spouse_father_bn', 'spouse_mobile', 'spouse_address_bn', 'spouse_thana_bn', 'spouse_district_bn', 'spouse_name_en', 'spouse_father_en', 'spouse_nid', 'spouse_village_en', 'spouse_thana_en', 'spouse_district_en'].forEach(id => {
                    document.getElementById(id).value = '';
                });
            } else {
                alert('অনুগ্রহ করে স্বামী/স্ত্রীর নাম অথবা এনআইডি প্রদান করুন।');
            }
        }

        function editSpouseGuarantor(index) {
            var item = spouseGuarantorData[index];
            document.getElementById('spouse_name_bn').value = item.nameBn;
            document.getElementById('spouse_father_bn').value = item.fatherBn;
            document.getElementById('spouse_mobile').value = item.mobile;
            document.getElementById('spouse_address_bn').value = item.addressBn;
            document.getElementById('spouse_thana_bn').value = item.thanaBn;
            document.getElementById('spouse_district_bn').value = item.districtBn;
            document.getElementById('spouse_name_en').value = item.nameEn;
            document.getElementById('spouse_father_en').value = item.fatherEn;
            document.getElementById('spouse_nid').value = item.nid;
            document.getElementById('spouse_village_en').value = item.villageEn;
            document.getElementById('spouse_thana_en').value = item.thanaEn;
            document.getElementById('spouse_district_en').value = item.districtEn;
            deleteSpouseGuarantor(index);
        }

        function deleteSpouseGuarantor(index) {
            spouseGuarantorData.splice(index, 1);
            renderSpouseTable();
        }

        function renderGuarantorTable() {
            var tbody = document.querySelector('#modal_guarantor_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            guarantorData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px;" > ${ item.nameBn }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.nid}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.mobile}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">
                <button onclick="editGuarantor(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteGuarantor(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addGuarantor() {
            var nameBn = document.getElementById('guarantor_name_bn').value;
            var nid = document.getElementById('guarantor_nid').value;
            var mobile = document.getElementById('guarantor_mobile').value;

            if (nameBn || nid) {
                guarantorData.push({
                    nameBn: nameBn,
                    fatherBn: document.getElementById('guarantor_father_bn').value,
                    addressBn: document.getElementById('guarantor_address_bn').value,
                    thanaBn: document.getElementById('guarantor_thana_bn').value,
                    districtBn: document.getElementById('guarantor_district_bn').value,
                    nameEn: document.getElementById('guarantor_name_en').value,
                    fatherEn: document.getElementById('guarantor_father_en').value,
                    villageEn: document.getElementById('guarantor_village_en').value,
                    thanaEn: document.getElementById('guarantor_thana_en').value,
                    districtEn: document.getElementById('guarantor_district_en').value,
                    nid: nid,
                    mobile: mobile,
                    relationship: document.getElementById('guarantor_relationship').value
                });
                renderGuarantorTable();
                // Clear fields
                ['guarantor_name_bn', 'guarantor_father_bn', 'guarantor_mobile', 'guarantor_address_bn', 'guarantor_thana_bn', 'guarantor_district_bn', 'guarantor_name_en', 'guarantor_father_en', 'guarantor_nid', 'guarantor_village_en', 'guarantor_thana_en', 'guarantor_district_en', 'guarantor_relationship'].forEach(id => {
                    document.getElementById(id).value = '';
                });
            } else {
                alert('অনুগ্রহ করে গ্যারান্টরের নাম অথবা এনআইডি প্রদান করুন।');
            }
        }

        function editGuarantor(index) {
            var item = guarantorData[index];
            document.getElementById('guarantor_name_bn').value = item.nameBn;
            document.getElementById('guarantor_father_bn').value = item.fatherBn;
            document.getElementById('guarantor_mobile').value = item.mobile;
            document.getElementById('guarantor_address_bn').value = item.addressBn;
            document.getElementById('guarantor_thana_bn').value = item.thanaBn;
            document.getElementById('guarantor_district_bn').value = item.districtBn;
            document.getElementById('guarantor_name_en').value = item.nameEn;
            document.getElementById('guarantor_father_en').value = item.fatherEn;
            document.getElementById('guarantor_nid').value = item.nid;
            document.getElementById('guarantor_village_en').value = item.villageEn;
            document.getElementById('guarantor_thana_en').value = item.thanaEn;
            document.getElementById('guarantor_district_en').value = item.districtEn;
            document.getElementById('guarantor_relationship').value = item.relationship || '';
            deleteGuarantor(index);
        }

        function deleteGuarantor(index) {
            guarantorData.splice(index, 1);
            renderGuarantorTable();
        }

        function renderChequeTable() {
            var tbody = document.querySelector('#modal_cheque_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            chequeData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px;" > ${ item.bankName }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.noFrom}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.noTo}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.leafCount}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">
                <button onclick="editCheque(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteCheque(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addCheque() {
            var bankName = document.getElementById('check_bank_name').value;
            var noFrom = document.getElementById('check_no_from').value;
            var noTo = document.getElementById('check_no_to').value;
            var leafCount = document.getElementById('check_leaf_count').value;

            if (bankName || noFrom) {
                chequeData.push({
                    bankName: bankName,
                    noFrom: noFrom,
                    noTo: noTo,
                    leafCount: leafCount
                });
                renderChequeTable();
                document.getElementById('check_bank_name').value = '';
                document.getElementById('check_no_from').value = '';
                document.getElementById('check_no_to').value = '';
                document.getElementById('check_leaf_count').value = '';
            } else {
                alert('অনুগ্রহ করে ব্যাংকের নাম অথবা চেক নম্বর প্রদান করুন।');
            }
        }

        function editCheque(index) {
            var item = chequeData[index];
            document.getElementById('check_bank_name').value = item.bankName;
            document.getElementById('check_no_from').value = item.noFrom;
            document.getElementById('check_no_to').value = item.noTo;
            document.getElementById('check_leaf_count').value = item.leafCount;
            deleteCheque(index);
        }

        function deleteCheque(index) {
            chequeData.splice(index, 1);
            renderChequeTable();
        }

        function renderLicenseTable() {
            var tbody = document.querySelector('#modal_license_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            licenseData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px; text-align: center;" > ${ toBanglaNumber(index + 1) }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.type || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.authority || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.firstIssueDate ? toBanglaNumber(item.firstIssueDate.split('-').reverse().join('/')) : ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.renewalDate ? toBanglaNumber(item.renewalDate.split('-').reverse().join('/')) : ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.validity ? toBanglaNumber(item.validity) : ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.expiryDate ? toBanglaNumber(item.expiryDate.split('-').reverse().join('/')) : ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                <button type="button" onclick="editLicense(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 4px;">সম্পাদন</button>
                <button type="button" onclick="deleteLicense(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer;">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addLicense() {
            var type = document.getElementById('lic_input_type').value;
            var authority = document.getElementById('lic_input_authority').value;
            var firstIssueDate = document.getElementById('lic_input_first_issue').value;
            var renewalDate = document.getElementById('lic_input_renewal').value;
            var validity = document.getElementById('lic_input_validity').value;
            var expiryDate = document.getElementById('lic_input_expiry').value;

            if (type || authority) {
                licenseData.push({
                    type: type,
                    authority: authority,
                    firstIssueDate: firstIssueDate,
                    renewalDate: renewalDate,
                    validity: validity,
                    expiryDate: expiryDate
                });
                renderLicenseTable();
                document.getElementById('lic_input_type').value = '';
                document.getElementById('lic_input_authority').value = '';
                document.getElementById('lic_input_first_issue').value = '';
                document.getElementById('lic_input_renewal').value = '';
                document.getElementById('lic_input_validity').value = '';
                document.getElementById('lic_input_expiry').value = '';
            } else {
                alert('অনুগ্রহ করে লাইসেন্স এর ধরণ অথবা ইস্যুকারী কর্তৃপক্ষ প্রদান করুন।');
            }
        }

        function editLicense(index) {
            var item = licenseData[index];
            document.getElementById('lic_input_type').value = item.type || '';
            document.getElementById('lic_input_authority').value = item.authority || '';
            document.getElementById('lic_input_first_issue').value = item.firstIssueDate || '';
            document.getElementById('lic_input_renewal').value = item.renewalDate || '';
            document.getElementById('lic_input_validity').value = item.validity || '';
            document.getElementById('lic_input_expiry').value = item.expiryDate || '';
            deleteLicense(index);
        }

        function deleteLicense(index) {
            licenseData.splice(index, 1);
            renderLicenseTable();
        }

        function calculateExpiryDate() {
            var firstIssue = document.getElementById('lic_input_first_issue').value;
            var renewal = document.getElementById('lic_input_renewal').value;
            var validityYears = parseFloat(toEnglishNumber(document.getElementById('lic_input_validity').value)) || 0;
            var validityMonths = Math.round(validityYears * 12);
            var baseDateStr = renewal || firstIssue;
            var expiryField = document.getElementById('lic_input_expiry');

            if (baseDateStr && validityMonths > 0 && expiryField) {
                var baseDate = new Date(baseDateStr);
                baseDate.setMonth(baseDate.getMonth() + validityMonths);
                var yyyy = baseDate.getFullYear();
                var mm = String(baseDate.getMonth() + 1).padStart(2, '0');
                var dd = String(baseDate.getDate()).padStart(2, '0');
                expiryField.value = yyyy + '-' + mm + '-' + dd;
            } else if (expiryField) {
                expiryField.value = '';
            }
        }
        window.calculateExpiryDate = calculateExpiryDate;

        function calculateAppliedAmount() {
            var workingCap = parseFloat(toEnglishNumber(document.getElementById('loan_working_cap').value)) || 0;
            var expansion = parseFloat(toEnglishNumber(document.getElementById('loan_expansion').value)) || 0;
            var other = parseFloat(toEnglishNumber(document.getElementById('loan_other').value)) || 0;

            var total = workingCap + expansion + other;
            var appliedAmountField = document.getElementById('applied_amount');
            if (appliedAmountField) {
                if (total > 0) {
                    appliedAmountField.value = toBanglaNumber(total.toString());
                } else {
                    appliedAmountField.value = '';
                }
                // Update the words using the existing updateWords function
                updateWords(total.toString(), 'applied_amount_words');
            }
            syncStockInputs();
        }
        window.calculateAppliedAmount = calculateAppliedAmount;

        function calculateDueDate(sanctionDateId, termId, dueDateId) {
            var sanctionDateVal = document.getElementById(sanctionDateId).value;
            var termVal = document.getElementById(termId).value;
            var dueDateField = document.getElementById(dueDateId);

            if (sanctionDateVal && termVal && dueDateField) {
                var engTerm = parseFloat(toEnglishNumber(termVal)) || 0;
                var validityMonths = Math.round(engTerm * 12);

                if (validityMonths > 0) {
                    var baseDate = new Date(sanctionDateVal);
                    baseDate.setMonth(baseDate.getMonth() + validityMonths);
                    var yyyy = baseDate.getFullYear();
                    var mm = String(baseDate.getMonth() + 1).padStart(2, '0');
                    var dd = String(baseDate.getDate()).padStart(2, '0');
                    dueDateField.value = yyyy + '-' + mm + '-' + dd;
                } else {
                    dueDateField.value = '';
                }
            } else if (dueDateField) {
                dueDateField.value = '';
            }
            if (typeof applyData === 'function') {
                applyData();
            }
        }
        window.calculateDueDate = calculateDueDate;

        function syncBusinessSector() {
            var sector = document.getElementById('input_loan_sector').value;
            var type = document.getElementById('input_business_type').value;
            var targetSector = document.getElementById('input_business_sector');

            if (sector && type && targetSector) {
                var targetVal = sector + ' (' + type + ')';
                var exists = Array.from(targetSector.options).some(function (opt) {
                    return opt.value === targetVal;
                });
                if (exists) {
                    targetSector.value = targetVal;
                    if (typeof updateBizNatureOptions === 'function') {
                        updateBizNatureOptions();
                    }
                }
            }
        }
        window.syncBusinessSector = syncBusinessSector;

        function renderLiabilityTable() {
            var tbody = document.querySelector('#modal_liability_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            liabilityData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 8px; text-align: center;" > ${ toBanglaNumber(index + 1) }</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.type || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.nature || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.bankName || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${toBanglaNumber(item.amount || '')}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.status || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                <button type="button" onclick="editLiability(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 4px;">সম্পাদন</button>
                <button type="button" onclick="deleteLiability(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer;">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function addLiability() {
            var type = document.getElementById('lia_input_type').value;
            var nature = document.getElementById('lia_input_nature').value;
            var bankName = document.getElementById('lia_input_bank_name').value;
            var amount = document.getElementById('lia_input_amount').value;
            var status = document.getElementById('lia_input_status').value;

            if (bankName || amount) {
                liabilityData.push({
                    type: type,
                    nature: nature,
                    bankName: bankName,
                    amount: amount,
                    status: status
                });
                renderLiabilityTable();
                document.getElementById('lia_input_type').value = 'ব্যক্তিগত';
                document.getElementById('lia_input_nature').value = 'ব্যক্তি হতে';
                document.getElementById('lia_input_bank_name').value = '';
                document.getElementById('lia_input_amount').value = '';
                document.getElementById('lia_input_status').value = '';
            } else {
                alert('অনুগ্রহ করে ব্যাংক/প্রতিষ্ঠানের নাম অথবা পরিমাণ প্রদান করুন।');
            }
        }

        function editLiability(index) {
            var item = liabilityData[index];
            document.getElementById('lia_input_type').value = item.type || 'ব্যক্তিগত';
            document.getElementById('lia_input_nature').value = item.nature || 'ব্যক্তি হতে';
            document.getElementById('lia_input_bank_name').value = item.bankName || '';
            document.getElementById('lia_input_amount').value = item.amount || '';
            document.getElementById('lia_input_status').value = item.status || '';
            deleteLiability(index);
        }

        function deleteLiability(index) {
            liabilityData.splice(index, 1);
            renderLiabilityTable();
        }

        function updateMutationOwnership() {
            var ownership = document.getElementById('land_ownership_type').value;
            var field = document.getElementById('land_mutation_ownership');
            if (!field) return;

            if (ownership === 'একক') {
                var firstAppName = document.querySelector('.input_name')?.value || '';
                field.value = firstAppName || 'একক';
            } else if (ownership === 'যৌথ') {
                var selectedOwners = [];
                var allCheckbox = document.getElementById('land_owner_all');
                if (allCheckbox && allCheckbox.checked) {
                    selectedOwners.push('সকল আবেদনকারী');
                } else {
                    var checkboxes = document.querySelectorAll('#applicant_checkboxes input[type="checkbox"]:checked');
                    checkboxes.forEach(cb => {
                        if (cb.id !== 'land_owner_all') {
                            selectedOwners.push(cb.value);
                        }
                    });
                }
                field.value = selectedOwners.length > 0 ? 'যৌথ - ' + selectedOwners.join(', ') : '';
            } else {
                field.value = '';
            }
        }

        function updateApplicantCheckboxes() {
            var ownershipType = document.getElementById('land_ownership_type').value;
            var container = document.getElementById('applicant_selection_container');
            var checkboxes = document.getElementById('applicant_checkboxes');

            if (ownershipType === 'যৌথ') {
                container.style.display = 'block';
                var entries = document.querySelectorAll('.applicant-entry');
                checkboxes.innerHTML = '';

                // Add "All Applicants" checkbox
                var allLabel = document.createElement('label');
                allLabel.style.display = 'flex';
                allLabel.style.alignItems = 'center';
                allLabel.style.gap = '8px';
                allLabel.style.cursor = 'pointer';
                var allCheckbox = document.createElement('input');
                allCheckbox.type = 'checkbox';
                allCheckbox.id = 'land_owner_all';
                allCheckbox.value = 'সকল আবেদনকারী';
                allCheckbox.onchange = function () {
                    var allChecked = this.checked;
                    var otherCheckboxes = checkboxes.querySelectorAll('input[type="checkbox"][id^="land_owner_"]');
                    otherCheckboxes.forEach(cb => {
                        if (cb.id !== 'land_owner_all') cb.checked = allChecked;
                    });
                    updateMutationOwnership();
                };
                allLabel.appendChild(allCheckbox);
                allLabel.appendChild(document.createTextNode('সকল আবেদনকারী'));
                checkboxes.appendChild(allLabel);

                // Add individual applicant checkboxes
                entries.forEach((entry, index) => {
                    var nameEl = entry.querySelector('.input_name');
                    var name = nameEl ? nameEl.value || 'আবেদনকারী-' + toBanglaNumber(String(index + 1).padStart(2, '0')) : 'আবেদনকারী-' + toBanglaNumber(String(index + 1).padStart(2, '0'));

                    var label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '8px';
                    label.style.cursor = 'pointer';

                    var checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.onclick = updateMutationOwnership;
                    checkbox.id = 'land_owner_' + (index + 1);
                    checkbox.value = name;
                    checkbox.dataset.applicantIndex = index;

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode('আবেদনকারী-' + toBanglaNumber(String(index + 1).padStart(2, '0')) + ' (' + name + ')'));
                    checkboxes.appendChild(label);
                });
            } else {
                container.style.display = 'none';
            }
            updateMutationOwnership();
        }

        function renderLandTable() {
            var tbody = document.querySelector('#modal_land_table tbody');
            tbody.innerHTML = '';
            landData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 6px;" > ${ item.ownership }</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.mouza}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.landClass}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.khatian}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.dag}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.totalDagAmount || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.amount}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">
                <button onclick="editLand(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteLand(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });

            var totalAmountEng = 0;
            landData.forEach(function (item) {
                var qty = parseFloat(toEnglishNumber(item.amount).replace(/[^0-9.]/g, '')) || 0;
                totalAmountEng += qty;
            });

            var tfoot = document.querySelector('#modal_land_table tfoot');
            if (!tfoot) {
                tfoot = document.createElement('tfoot');
                document.querySelector('#modal_land_table').appendChild(tfoot);
            }

            let totalBangla = toBanglaNumber(totalAmountEng > 0 ? (totalAmountEng % 1 === 0 ? totalAmountEng.toString() : totalAmountEng.toFixed(2).replace(/.00$/, '')) : '0');
            tfoot.innerHTML = `
        <tr style = "background: #f9f9f9; font-weight: bold; font-size: 14px;" >
                    <td colspan="6" style="border: 1px solid #ddd; padding: 6px; text-align: right;">সর্বমোট:</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; color: #10b981;">${totalBangla}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;"></td>
                </tr>
        `;

            renderValuationTable();
        }

        function renderMutationTable() {
            var tbody = document.querySelector('#modal_mutation_table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            mutationData.forEach(function (item, index) {
                var tr = document.createElement('tr');
                tr.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 6px;" > ${ item.ownership }</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.mutationNo || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.mutationKhatian || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.mutationDate ? toBanglaNumber(item.mutationDate.split('-').reverse().join('/')) : '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${item.dcrNo || '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">
                <button onclick="editMutation(${index})" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; ">সম্পাদন</button>
                <button onclick="deleteMutation(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 3px; cursor: pointer; ">মুছুন</button>
            </td>
    `;
                tbody.appendChild(tr);
            });
        }

        function editMutation(index) {
            var item = mutationData[index];
            document.getElementById('land_mutation_no').value = item.mutationNo || '';
            document.getElementById('land_mutation_khatian').value = item.mutationKhatian || '';
            document.getElementById('land_mutation_date').value = item.mutationDate || '';
            document.getElementById('land_dcr_no').value = item.dcrNo || '';
            deleteMutation(index);
        }

        function deleteMutation(index) {
            mutationData.splice(index, 1);
            renderMutationTable();
        }

        function addMutation() {
            var ownership = document.getElementById('land_mutation_ownership').value;
            var mutationNo = document.getElementById('land_mutation_no').value;
            var mutationKhatian = document.getElementById('land_mutation_khatian').value;
            var mutationDate = document.getElementById('land_mutation_date').value;
            var dcrNo = document.getElementById('land_dcr_no').value;

            if (mutationNo || mutationKhatian || dcrNo) {
                mutationData.push({
                    ownership: ownership,
                    mutationNo: mutationNo,
                    mutationKhatian: mutationKhatian,
                    mutationDate: mutationDate,
                    dcrNo: dcrNo
                });
                renderMutationTable();
                ['land_mutation_no', 'land_mutation_khatian', 'land_mutation_date', 'land_dcr_no'].forEach(id => document.getElementById(id).value = '');
            } else {
                alert('অনুগ্রহ করে নামজারি তথ্য প্রদান করুন।');
            }
        }

        function editMutation(index) {
            var item = mutationData[index];
            document.getElementById('land_mutation_ownership').value = item.ownership;
            document.getElementById('land_mutation_no').value = item.mutationNo;
            document.getElementById('land_mutation_khatian').value = item.mutationKhatian;
            document.getElementById('land_mutation_date').value = item.mutationDate;
            document.getElementById('land_dcr_no').value = item.dcrNo;
            deleteMutation(index);
        }

        function deleteMutation(index) {
            mutationData.splice(index, 1);
            renderMutationTable();
        }


        var dynamicDagCount = 0;
        function addDynamicDagRow() {
            dynamicDagCount++;
            var container = document.getElementById('dynamic_dag_container');
            var row = document.createElement('div');
            row.className = 'dynamic-dag-row dense-land-row';
            row.style.display = 'flex';
            row.style.gap = '6px';
            row.style.flexWrap = 'nowrap';
            row.style.alignItems = 'flex-end';
            row.style.marginBottom = '10px';
            row.style.padding = '8px 12px';
            row.style.background = '#f9f9f9';
            row.style.border = '1px dashed #ccc';
            row.style.borderRadius = '6px';
            row.style.fontFamily = "'SolaimanLipi', sans-serif";

            row.innerHTML = `
        <!--Empty spacer to align with parent-->
                <div style="flex: 5.3;"></div>
                <!--Dag No-->
                <div style="display:flex; flex-direction:column; flex: 1.5;">
                    <div style="display:flex; justify-content:center; align-items:center; gap: 4px; margin-bottom: 4px;">
                        <label style="margin: 0; font-size: 12px;">দাগ নং</label>
                        <button type="button" class="row-bata-dag-btn" style="font-size: 9px; padding: 1px 4px; cursor: pointer; border: 1px solid #bbb; background: #f0f0f0; border-radius: 3px; font-family: 'SolaimanLipi', sans-serif;">বাটা</button>
                    </div>
                    <div style="width: 100%;">
                        <div class="row-dag-normal-container" style="display:flex; align-items:center; gap:2px;">
                            <input class="row-input-dag-no-1" type="text" style="padding: 6px; width: 48%; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-family: 'SolaimanLipi', sans-serif; font-size: 13px;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                            <span style="font-size: 14px; color: #999;">/</span>
                            <input class="row-input-dag-no-2" type="text" style="padding: 6px; width: 48%; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-family: 'SolaimanLipi', sans-serif; font-size: 13px;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                        </div>
                        <div class="row-dag-bata-container" style="display:none; align-items:center; gap:2px;">
                            <div style="display:flex; flex-direction:column; width: 48%; border: 1px solid #ccc; border-radius: 4px; background: white;">
                                <input class="row-input-dag-batta-1-num" type="text" style="width: 100%; border: none; border-bottom: 1px solid #eee; padding: 3px; text-align: center; font-size: 12px; background: transparent; font-family: 'SolaimanLipi', sans-serif;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                                <input class="row-input-dag-batta-1-den" type="text" style="width: 100%; border: none; padding: 3px; text-align: center; font-size: 12px; background: transparent; font-family: 'SolaimanLipi', sans-serif;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                            </div>
                            <span style="font-size: 14px; color: #999;">/</span>
                            <div style="display:flex; flex-direction:column; width: 48%; border: 1px solid #ccc; border-radius: 4px; background: white;">
                                <input class="row-input-dag-batta-2-num" type="text" style="width: 100%; border: none; border-bottom: 1px solid #eee; padding: 3px; text-align: center; font-size: 12px; background: transparent; font-family: 'SolaimanLipi', sans-serif;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                                <input class="row-input-dag-batta-2-den" type="text" style="width: 100%; border: none; padding: 3px; text-align: center; font-size: 12px; background: transparent; font-family: 'SolaimanLipi', sans-serif;"  oninput="this.value = typeof toBanglaNumber !== 'undefined' ? toBanglaNumber(this.value) : this.value.replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m])" />
                            </div>
                        </div>
                    </div>
                </div>
                <!--Land Class-->
                <div style="display:flex; flex-direction:column; flex: 0.8;">
                    <label style="margin-bottom: 4px; text-align: center; font-size: 12px; font-family: 'SolaimanLipi', sans-serif; color: #333; font-weight: bold;">জমির শ্রেণী</label>
                    <input class="row-input-land-class" list="land_class_suggestions" type="text" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-family: 'SolaimanLipi', sans-serif; font-size: 13px;" />
                </div>
                <!--Total Dag Area-->
                <div style="display:flex; flex-direction:column; flex: 0.8;">
                    <label style="margin-bottom: 4px; text-align: center; font-size: 12px;">দাগে মোট</label>
                    <input class="row-input-total-dag" type="text" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-family: 'SolaimanLipi', sans-serif; font-size: 13px;" placeholder="একর" oninput="handleDecimalInput(this)" />
                </div>
                <!--Area -->
                <div style="display:flex; flex-direction:column; flex: 0.8;">
                    <label style="margin-bottom: 4px; text-align: center; font-size: 12px;">পরিমাণ</label>
                    <input class="row-input-land-area" type="text" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-family: 'SolaimanLipi', sans-serif; font-size: 13px;" placeholder="একর" oninput="handleDecimalInput(this)" />
                </div>
                <div style="padding-bottom: 1px; display: flex; justify-content: center; flex: none;">
                    <button type="button" class="remove-dynamic-dag-btn" style="width: 32px; height: 32px; background: #e53935; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(229, 57, 53, 0.3);">×</button>
                </div>
    `;

            row.querySelector('.row-bata-dag-btn').addEventListener('click', function () {
                var normal = row.querySelector('.row-dag-normal-container');
                var bata = row.querySelector('.row-dag-bata-container');
                if (bata.style.display === 'none') {
                    normal.style.display = 'none';
                    bata.style.display = 'flex';
                } else {
                    normal.style.display = 'flex';
                    bata.style.display = 'none';
                }
            });

            row.querySelector('.remove-dynamic-dag-btn').addEventListener('click', function () {
                row.remove();
            });

            container.appendChild(row);
        }

        function addLand() {
            var ownership = document.getElementById('land_ownership_type').value;
            var mouza = document.getElementById('land_mouza_input').value;
            var landClass = document.getElementById('land_class_input').value;
            var acquisitionType = document.getElementById('land_acquisition_type').value;
            var kType1 = document.getElementById('land_khatian_type_1').value;
            var kType2 = document.getElementById('land_khatian_type_2').value;
            var kNo1 = document.getElementById('land_khatian_no_1').value;
            var kNo2 = document.getElementById('land_khatian_no_2').value;
            var khatian = (kType1 ? kType1 : '') + (kType2 ? '/' + kType2 : '') + ' - ' + kNo1 + (kNo2 ? '/' + kNo2 : '');

            var dType1 = document.getElementById('land_dag_type_1').value;
            var dType2 = document.getElementById('land_dag_type_2').value;

            // Get selected owners
            var selectedOwners = [];
            if (ownership === 'যৌথ') {
                var allCheckbox = document.getElementById('land_owner_all');
                if (allCheckbox && allCheckbox.checked) {
                    selectedOwners.push('সকল আবেদনকারী');
                } else {
                    var checkboxes = document.querySelectorAll('#applicant_checkboxes input[type="checkbox"]:checked');
                    checkboxes.forEach(cb => {
                        if (cb.id !== 'land_owner_all') {
                            selectedOwners.push(cb.value);
                        }
                    });
                }
                if (selectedOwners.length === 0) {
                    if (window.parent && typeof window.parent.showAppToast === 'function') {
                        window.parent.showAppToast('যৌথ মালিকানার জন্য কমপক্ষে একজন মালিক নির্বাচন করুন।', true);
                    } else if (typeof window.showAppToast === 'function') {
                        window.showAppToast('যৌথ মালিকানার জন্য কমপক্ষে একজন মালিক নির্বাচন করুন।', true);
                    }
                    return;
                }
            }

            var ownershipDisplay = '';
            if (ownership === 'একক') {
                var firstAppName = document.querySelector('.input_name')?.value || '';
                ownershipDisplay = firstAppName || 'একক';
            } else {
                ownershipDisplay = 'যৌথ - ' + selectedOwners.join(', ');
            }

            function getDagNo(context) {
                var d_no = '';
                var amount = '';
                var totalDag = '';
                var raw = {
                    ownership: ownership,
                    mouza: mouza,
                    landClass: landClass,
                    acquisitionType: acquisitionType,
                    khajnaYear: document.getElementById('land_khajna_year').value,
                    kType1: kType1,
                    kType2: kType2,
                    kNo1: kNo1,
                    kNo2: kNo2,
                    dType1: dType1,
                    dType2: dType2
                };
                if (ownership === 'যৌথ') raw.selectedOwners = selectedOwners;

                if (context === 'main') {
                    if (document.getElementById('land_dag_bata_container').style.display !== 'none') {
                        var b1n = document.getElementById('land_dag_batta_1_num').value;
                        var b1d = document.getElementById('land_dag_batta_1_den').value;
                        var b2n = document.getElementById('land_dag_batta_2_num').value;
                        var b2d = document.getElementById('land_dag_batta_2_den').value;

                        function formatBataDagFrac(n, d) {
                            let hasN = n && n !== '০' && n !== '0';
                            let hasD = d && d !== '০' && d !== '0';
                            if (hasN && hasD) {
                                return '<div style="display:inline-block; vertical-align:middle; text-align:center; line-height:1.1; font-size:12px; margin:0 2px;"><div style="border-bottom:1px solid #333; padding:0 2px;">' + n + '</div><div style="padding:0 2px;">' + d + '</div></div>';
                            } else if (hasN) {
                                return '<span style="display:inline-block; vertical-align:middle; font-size:13px; margin:0 2px;">' + n + '</span>';
                            } else if (hasD) {
                                return '<span style="display:inline-block; vertical-align:middle; font-size:13px; margin:0 2px;">' + d + '</span>';
                            }
                            return '';
                        }
                        if (b1n || b1d || b2n || b2d) {
                            let f1 = formatBataDagFrac(b1n, b1d);
                            let f2 = formatBataDagFrac(b2n, b2d);
                            if (f1 && f2) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f1 + ' <span style="margin:0 4px; font-size:14px;">/</span> ' + f2 + '</div>';
                            } else if (f1) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f1 + '</div>';
                            } else if (f2) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f2 + '</div>';
                            }
                        }

                        raw.isBata = true;
                        raw.b1n = b1n; raw.b1d = b1d; raw.b2n = b2n; raw.b2d = b2d;
                    } else {
                        var d1 = document.getElementById('land_dag_no_1').value;
                        var d2 = document.getElementById('land_dag_no_2').value;
                        if (d1 || d2) d_no = d1 + (d2 ? '/' + d2 : '');
                        raw.dag1 = d1; raw.dag2 = d2;
                    }
                    amount = document.getElementById('land_amount_input').value;
                    var localLandClass = document.getElementById('land_class_input').value;
                    totalDag = document.getElementById('land_total_dag_amount').value;
                } else {
                    if (context.querySelector('.row-dag-bata-container').style.display !== 'none') {
                        var b1n = context.querySelector('.row-input-dag-batta-1-num').value;
                        var b1d = context.querySelector('.row-input-dag-batta-1-den').value;
                        var b2n = context.querySelector('.row-input-dag-batta-2-num').value;
                        var b2d = context.querySelector('.row-input-dag-batta-2-den').value;

                        function formatBataDagFrac(n, d) {
                            let hasN = n && n !== '০' && n !== '0';
                            let hasD = d && d !== '০' && d !== '0';
                            if (hasN && hasD) {
                                return '<div style="display:inline-block; vertical-align:middle; text-align:center; line-height:1.1; font-size:12px; margin:0 2px;"><div style="border-bottom:1px solid #333; padding:0 2px;">' + n + '</div><div style="padding:0 2px;">' + d + '</div></div>';
                            } else if (hasN) {
                                return '<span style="display:inline-block; vertical-align:middle; font-size:13px; margin:0 2px;">' + n + '</span>';
                            } else if (hasD) {
                                return '<span style="display:inline-block; vertical-align:middle; font-size:13px; margin:0 2px;">' + d + '</span>';
                            }
                            return '';
                        }
                        if (b1n || b1d || b2n || b2d) {
                            let f1 = formatBataDagFrac(b1n, b1d);
                            let f2 = formatBataDagFrac(b2n, b2d);
                            if (f1 && f2) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f1 + ' <span style="margin:0 4px; font-size:14px;">/</span> ' + f2 + '</div>';
                            } else if (f1) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f1 + '</div>';
                            } else if (f2) {
                                d_no = '<div style="display:inline-flex; align-items:center;">' + f2 + '</div>';
                            }
                        }

                        raw.isBata = true;
                        raw.b1n = b1n; raw.b1d = b1d; raw.b2n = b2n; raw.b2d = b2d;
                    } else {
                        var d1 = context.querySelector('.row-input-dag-no-1').value;
                        var d2 = context.querySelector('.row-input-dag-no-2').value;
                        if (d1 || d2) d_no = d1 + (d2 ? '/' + d2 : '');
                        raw.dag1 = d1; raw.dag2 = d2;
                    }
                    amount = context.querySelector('.row-input-land-area').value;
                    var localLandClass = context.querySelector('.row-input-land-class') ? context.querySelector('.row-input-land-class').value : document.getElementById('land_class_input').value;
                    totalDag = context.querySelector('.row-input-total-dag').value;
                }
                raw.amount = amount;
                raw.totalDagAmount = totalDag;
                return { no: d_no, amount: amount, totalDag: totalDag, landClass: localLandClass, raw: raw };
            }

            var d_type = (dType1 ? dType1 : '') + (dType2 ? '/' + dType2 : '');
            var addedAny = false;

            var main = getDagNo('main');
            if (mouza || kNo1 || main.no || main.amount) {
                landData.push({
                    ownership: ownershipDisplay,
                    mouza: mouza,
                    landClass: main.landClass,
                    acquisitionType: acquisitionType,
                    khajnaYear: document.getElementById('land_khajna_year').value,
                    khatian: khatian,
                    dag: (d_type + (main.no ? ' দাগ: ' + main.no : '')).trim(),
                    amount: main.amount,
                    totalDagAmount: main.totalDag,
                    raw: main.raw,
                    priceMouza: '', mclRateMouza: '৭৫', priceMarket: '', mclRateMarket: '৭৫'
                });
                addedAny = true;
            }

            document.querySelectorAll('#dynamic_dag_container .dynamic-dag-row').forEach(function (row) {
                var res = getDagNo(row);
                if (mouza || kNo1 || res.no || res.amount) {
                    landData.push({
                        ownership: ownershipDisplay,
                        mouza: mouza,
                        landClass: res.landClass,
                        acquisitionType: acquisitionType,
                        khajnaYear: document.getElementById('land_khajna_year').value,
                        khatian: khatian,
                        dag: (d_type + (res.no ? ' দাগ: ' + res.no : '')).trim(),
                        amount: res.amount,
                        totalDagAmount: res.totalDag,
                        raw: res.raw,
                        priceMouza: '', mclRateMouza: '৭৫', priceMarket: '', mclRateMarket: '৭৫'
                    });
                    addedAny = true;
                }
            });

            if (addedAny) {
                renderLandTable();

                // Clear form
                document.getElementById('land_ownership_type').value = '';
                document.getElementById('land_mouza_input').value = '';
                document.getElementById('land_class_input').value = '';
                document.getElementById('land_acquisition_type').value = '';
                document.getElementById('land_khajna_year').value = '';
                document.getElementById('land_khatian_type_1').value = '';
                document.getElementById('land_khatian_type_2').value = '';
                document.getElementById('land_khatian_no_1').value = '';
                document.getElementById('land_khatian_no_2').value = '';
                document.getElementById('land_dag_type_1').value = '';
                document.getElementById('land_dag_type_2').value = '';
                document.getElementById('land_dag_no_1').value = '';
                document.getElementById('land_dag_no_2').value = '';
                document.getElementById('land_amount_input').value = '';
                document.getElementById('land_total_dag_amount').value = '';

                // Clear Bata fields
                if (document.getElementById('land_dag_batta_1_num')) document.getElementById('land_dag_batta_1_num').value = '';
                if (document.getElementById('land_dag_batta_1_den')) document.getElementById('land_dag_batta_1_den').value = '';
                if (document.getElementById('land_dag_batta_2_num')) document.getElementById('land_dag_batta_2_num').value = '';
                if (document.getElementById('land_dag_batta_2_den')) document.getElementById('land_dag_batta_2_den').value = '';

                // Clear Mutation fields
                ['land_mutation_ownership', 'land_mutation_no', 'land_mutation_khatian', 'land_mutation_date', 'land_dcr_no'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; });

                // Reset checkboxes
                document.querySelectorAll('#applicant_checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
                if (typeof updateApplicantCheckboxes === 'function') updateApplicantCheckboxes();

                // Reset bata container
                document.getElementById('land_dag_normal_container').style.display = 'flex';
                document.getElementById('land_dag_bata_container').style.display = 'none';

                // Reset dropdown option states
                if (typeof updateDropdownOptions === 'function') {
                    updateDropdownOptions('land_khatian_type_1');
                    updateDropdownOptions('land_khatian_type_2');
                    updateDropdownOptions('land_dag_type_1');
                    updateDropdownOptions('land_dag_type_2');
                }

                // Clear dynamic container
                document.getElementById('dynamic_dag_container').innerHTML = '';
            } else {
                alert('অনুগ্রহ করে সমস্ত জমির তথ্য পূরণ করুন।');
            }
        }

        function editLand(index) {
            var item = landData[index];
            if (!item.raw) return;

            var r = item.raw;

            document.getElementById('land_ownership_type').value = r.ownership;
            document.getElementById('land_mouza_input').value = r.mouza;
            document.getElementById('land_class_input').value = r.landClass;
            document.getElementById('land_acquisition_type').value = r.acquisitionType;
            document.getElementById('land_khajna_year').value = r.khajnaYear || '';
            document.getElementById('land_khatian_type_1').value = r.kType1;
            document.getElementById('land_khatian_type_2').value = r.kType2;
            document.getElementById('land_khatian_no_1').value = r.kNo1;
            document.getElementById('land_khatian_no_2').value = r.kNo2;
            document.getElementById('land_dag_type_1').value = r.dType1;
            document.getElementById('land_dag_type_2').value = r.dType2;
            document.getElementById('land_amount_input').value = r.amount;
            document.getElementById('land_total_dag_amount').value = r.totalDagAmount || '';

            // Update dropdown option states
            updateDropdownOptions('land_khatian_type_1');
            updateDropdownOptions('land_khatian_type_2');
            updateDropdownOptions('land_dag_type_1');
            updateDropdownOptions('land_dag_type_2');

            // Update and check applicants if যৌথ
            updateApplicantCheckboxes();
            if (r.ownership === 'যৌথ' && r.selectedOwners) {
                if (r.selectedOwners.includes('সকল আবেদনকারী')) {
                    document.getElementById('land_owner_all').checked = true;
                    document.querySelectorAll('#applicant_checkboxes input[type="checkbox"][id^="land_owner_"]').forEach(cb => {
                        if (cb.id !== 'land_owner_all') cb.checked = true;
                    });
                } else {
                    r.selectedOwners.forEach(ownerName => {
                        var checkboxes = document.querySelectorAll('#applicant_checkboxes input[type="checkbox"]');
                        checkboxes.forEach(cb => {
                            if (cb.value === ownerName) cb.checked = true;
                        });
                    });
                }
            }

            var normalContainer = document.getElementById('land_dag_normal_container');
            var bataContainer = document.getElementById('land_dag_bata_container');

            if (r.isBata) {
                normalContainer.style.display = 'none';
                bataContainer.style.display = 'flex';
                document.getElementById('land_dag_batta_1_num').value = r.b1n;
                document.getElementById('land_dag_batta_1_den').value = r.b1d;
                document.getElementById('land_dag_batta_2_num').value = r.b2n;
                document.getElementById('land_dag_batta_2_den').value = r.b2d;
            } else {
                normalContainer.style.display = 'flex';
                bataContainer.style.display = 'none';
                document.getElementById('land_dag_no_1').value = r.dag1;
                document.getElementById('land_dag_no_2').value = r.dag2;
            }

            deleteLand(index);
        }

        function generateValuationData() {
            const groupMap = {};
            landData.forEach(item => {
                const key = item.mouza + '|' + item.landClass;
                if (!groupMap[key]) {
                    // Find existing valuation data to preserve prices
                    let existing = valuationData.find(v => v.mouza === item.mouza && v.landClass === item.landClass);
                    groupMap[key] = {
                        mouza: item.mouza,
                        landClass: item.landClass,
                        amountEng: 0,
                        priceMouza: existing ? existing.priceMouza : '',
                        mclRateMouza: existing ? existing.mclRateMouza : '৭৫',
                        priceMarket: existing ? existing.priceMarket : '',
                        mclRateMarket: existing ? existing.mclRateMarket : '৭৫'
                    };
                }
                const qty = parseFloat(toEnglishNumber(item.amount).replace(/[^0-9.]/g, '')) || 0;
                groupMap[key].amountEng += qty;
            });

            valuationData = Object.values(groupMap).map(v => {
                let amountStr = v.amountEng.toString();
                // format back to proper decimal
                if (amountStr.includes('.')) {
                    amountStr = parseFloat(amountStr).toFixed(2).replace(/.00$/, '');
                }
                v.amount = toBanglaNumber(amountStr);
                return v;
            });
        }


        function updateAcceptedMCL() {
            const selectedType = document.querySelector('input[name="accepted_mcl_type"]:checked')?.value;
            let totalMCL = 0;

            if (selectedType === 'mouza' || selectedType === 'market') {
                valuationData.forEach((item, index) => {
                    const qty = parseFloat(toEnglishNumber(item.amount).replace(/[^0-9.]/g, '')) || 0;
                    const price = parseFloat(toEnglishNumber(selectedType === 'mouza' ? item.priceMouza : item.priceMarket).replace(/[^0-9.]/g, '')) || 0;
                    const rate = parseFloat(toEnglishNumber(selectedType === 'mouza' ? item.mclRateMouza : item.mclRateMarket).replace(/[^0-9.]/g, '')) || 0;
                    const mcl = (qty * price) * (rate / 100);
                    totalMCL += mcl;
                });
            }

            const displayEl = document.getElementById('display_accepted_mcl');
            if (displayEl) {
                displayEl.innerText = totalMCL > 0 ? toBanglaNumber(Math.round(totalMCL).toLocaleString('en-IN')) : '০';
            }
        }

        function renderValuationTable() {
            const mouzaBody = document.querySelector('#valuation_mouza_table tbody');
            const marketBody = document.querySelector('#valuation_market_table tbody');
            if (!mouzaBody || !marketBody) return;

            generateValuationData();

            mouzaBody.innerHTML = '';
            marketBody.innerHTML = '';

            valuationData.forEach((item, index) => {
                // Mouza Table Row
                const trMouza = document.createElement('tr');
                trMouza.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 5px;" > ${ item.mouza }</td>
            <td style="border: 1px solid #ddd; padding: 5px;">${item.amount}</td>
            <td style="border: 1px solid #ddd; padding: 5px;">${item.landClass}</td>
            <td style="border: 1px solid #ddd; padding: 5px;"><input type="text" value="${item.priceMouza}" style="width: 90%; border:1px solid #eee; text-align: center; font-size: 14px;" oninput="updateRowValuation(${index}, 'mouza', this, 'price')"></td>
            <td style="border: 1px solid #ddd; padding: 5px; font-weight:bold;" class="total-mouza-${index}">-</td>
            <td style="border: 1px solid #ddd; padding: 5px;"><input type="text" value="${item.mclRateMouza}" style="width: 40px; border:1px solid #eee; text-align: center; font-size: 14px;" oninput="updateRowValuation(${index}, 'mouza', this, 'rate')"></td>
            <td style="border: 1px solid #ddd; padding: 5px; font-weight:bold; color:#10b981;" class="mcl-mouza-${index}">-</td>
    `;
                mouzaBody.appendChild(trMouza);

                // Market Table Row
                const trMarket = document.createElement('tr');
                trMarket.innerHTML = `
        <td style = "border: 1px solid #ddd; padding: 5px;" > ${ item.mouza }</td>
            <td style="border: 1px solid #ddd; padding: 5px;">${item.amount}</td>
            <td style="border: 1px solid #ddd; padding: 5px;">${item.landClass}</td>
            <td style="border: 1px solid #ddd; padding: 5px;"><input type="text" value="${item.priceMarket}" style="width: 90%; border:1px solid #eee; text-align: center; font-size: 14px;" oninput="updateRowValuation(${index}, 'market', this, 'price')"></td>
            <td style="border: 1px solid #ddd; padding: 5px; font-weight:bold;" class="total-market-${index}">-</td>
            <td style="border: 1px solid #ddd; padding: 5px;"><input type="text" value="${item.mclRateMarket}" style="width: 40px; border:1px solid #eee; text-align: center; font-size: 14px;" oninput="updateRowValuation(${index}, 'market', this, 'rate')"></td>
            <td style="border: 1px solid #ddd; padding: 5px; font-weight:bold; color:#10b981;" class="mcl-market-${index}">-</td>
    `;
                marketBody.appendChild(trMarket);

                calculateRow(index, 'mouza');
                calculateRow(index, 'market');
            });
            updateAcceptedMCL();
        }

        const bizNatureMap = {
            "সিএমএসএমই (ট্রেডিং)": [
                "মুদি মনোহারী পণ্য বিক্রয়",
                "ঔষধালয়",
                "ইলেক্ট্রনিক্স পণ্য বিক্রয়",
                "কাঠের আসবাবপত্র বিক্রয়",
                "মোবাইল ফোন বিক্রয়",
                "কম্পিউটার ও একসেসরিজ বিক্রয়",
                "হার্ডওয়্যার দোকান"
            ],
            "সিএমএসএমই (ম্যানুফেকচারিং)": [
                "ওয়ার্কশপ",
                "গাভীর খামার",
                "গরু মোটাতাজাকরণ খামার",
                "মিশ্র কৃষি খামার",
                "নার্সারী",
                "পোল্ট্রি ফার্ম",
                "লেয়ার ফার্ম",
                "মৎস খামার",
                "তৈরী পোশাক"
            ],
            "সিএমএসএমই (সার্ভিস)": [
                "হোটেল-রেস্টুরেন্ট",
                "মোটরগাড়ি সার্ভিসিং"
            ]
        };

        function updateBizNatureOptions() {
            const sector = document.getElementById('input_business_sector').value;
            const natureSelect = document.getElementById('input_business_nature');
            const currentValue = natureSelect.value;
            natureSelect.innerHTML = '<option value="">সিলেক্ট</option>';
            
            if (sector === "সিএমএসএমই (ট্রেডিং)") {
                if (window.GLOBAL_PRODUCTS_DATABASE) {
                    Object.keys(window.GLOBAL_PRODUCTS_DATABASE).forEach(cat => {
                        const opt = document.createElement('option');
                        opt.value = cat;
                        opt.textContent = cat;
                        natureSelect.appendChild(opt);
                    });
                }
            } else if (sector && bizNatureMap[sector]) {
                bizNatureMap[sector].forEach(nature => {
                    const opt = document.createElement('option');
                    opt.value = nature; opt.text = nature;
                    natureSelect.appendChild(opt);
                });
            }
            natureSelect.insertAdjacentHTML('beforeend', '<option value="অন্যান্য">অন্যান্য</option>');
            if ([...natureSelect.options].some(o => o.value === currentValue)) natureSelect.value = currentValue;
        }

        function updateRowValuation(index, tableType, el, field) {
            const item = valuationData[index];
            const engVal = toEnglishNumber(el.value).replace(field === 'rate' ? /[^0-9.]/g : /[^0-9]/g, '');
            const bnVal = toBanglaNumber(engVal);
            el.value = bnVal;

            if (tableType === 'mouza') {
                if (field === 'price') item.priceMouza = bnVal;
                if (field === 'rate') item.mclRateMouza = bnVal;
            } else {
                if (field === 'price') item.priceMarket = bnVal;
                if (field === 'rate') item.mclRateMarket = bnVal;
            }
            calculateRow(index, tableType);
        }

        function calculateRow(index, type) {
            const item = valuationData[index];
            const qty = parseFloat(toEnglishNumber(item.amount).replace(/[^0-9.]/g, '')) || 0;
            const price = parseFloat(toEnglishNumber(type === 'mouza' ? item.priceMouza : item.priceMarket).replace(/[^0-9.]/g, '')) || 0;
            const rate = parseFloat(toEnglishNumber(type === 'mouza' ? item.mclRateMouza : item.mclRateMarket).replace(/[^0-9.]/g, '')) || 0;

            const total = qty * price;
            const mcl = total * (rate / 100);

            const totalEl = document.querySelector(`.total - ${ type } -${ index } `);
            const mclEl = document.querySelector(`.mcl - ${ type } -${ index } `);

            if (totalEl) totalEl.innerText = total > 0 ? toBanglaNumber(Math.round(total).toLocaleString('en-IN')) : '-';
            if (mclEl) mclEl.innerText = mcl > 0 ? toBanglaNumber(Math.round(mcl).toLocaleString('en-IN')) : '-';

            updateAcceptedMCL();
        }

        function deleteLand(index) {
            landData.splice(index, 1);
            renderLandTable();
            renderValuationTable();
        }

        function numberToBanglaWords(n) {
            if (n < 0) return 'মাইনাস ' + numberToBanglaWords(Math.abs(n));
            const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'ঊনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
            if (n === 0) return 'শূন্য';
            function convert(n) {
                let res = "";
                if (n < 100) {
                    res = units[n];
                } else if (n < 1000) {
                    res = units[Math.floor(n / 100)] + " শত" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
                } else if (n < 100000) { // Up to 99,999
                    res = convert(Math.floor(n / 1000)) + " হাজার" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
                } else if (n < 10000000) { // Up to 99,99,999 (99 Lakh)
                    res = convert(Math.floor(n / 100000)) + " লক্ষ" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
                } else { // Handle 1 Crore and above recursively
                    res = convert(Math.floor(n / 10000000)) + " কোটি" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
                }
                return res.trim();
            }
            return convert(n);
        }

        function updateWords(val, wordsId) {
            const wordsEl = document.getElementById(wordsId);
            if (val && wordsEl) {
                const num = parseInt(val);
                wordsEl.value = isNaN(num) ? "" : numberToBanglaWords(num) + " টাকা মাত্র";
            } else if (wordsEl) {
                wordsEl.value = "";
            }
        }

        function calculateEnhancement() {
            const currentVal = parseInt(toEnglishNumber(document.getElementById('prev_amount').value)) || 0;
            const enhancedVal = parseInt(toEnglishNumber(document.getElementById('enhanced_amount').value)) || 0;
            const total = currentVal + enhancedVal;
            
            if (total > 0) {
                document.getElementById('total_limit').value = toBanglaNumber(total);
                if (typeof numberToBanglaWords === 'function') {
                    const words = numberToBanglaWords(total);
                    const totalLimitWords = document.getElementById('total_limit_words');
                    if(totalLimitWords) totalLimitWords.value = words;
                    
                    if (document.getElementById('input_sanction_type').value === 'বর্ধিতসহ নবায়ন') {
                        document.getElementById('applied_amount').value = toBanglaNumber(total);
                        document.getElementById('applied_amount_words').value = words;
                        
                        document.getElementById('loan_working_cap').value = currentVal > 0 ? toBanglaNumber(currentVal) : '';
                        document.getElementById('loan_expansion').value = enhancedVal > 0 ? toBanglaNumber(enhancedVal) : '';
                        document.getElementById('loan_other').value = '';
                    }
                }
            } else {
                document.getElementById('total_limit').value = '';
                const totalLimitWords = document.getElementById('total_limit_words');
                if(totalLimitWords) totalLimitWords.value = '';
                
                if (document.getElementById('input_sanction_type').value === 'বর্ধিতসহ নবায়ন') {
                    document.getElementById('applied_amount').value = '';
                    document.getElementById('applied_amount_words').value = '';
                    
                    document.getElementById('loan_working_cap').value = '';
                    document.getElementById('loan_expansion').value = '';
                    document.getElementById('loan_other').value = '';
                }
            }
        }

        function applyData() {
            // Sync simple 1:1 ID to data-db-field mappings
            const mapping = {
                'applied_sanction_date': 'applied_sanction_date',
                'branch_name': 'input_branch_name',
                'input_business_nature': 'input_business_nature',
                'input_business_name': 'input_business_name',
                'input_business_name_en': 'input_business_name_en',
                'input_business_address': 'input_business_address',
                'input_business_ownership_type': 'input_business_ownership_type',
                'input_application_date': 'input_application_date',
                'input_business_capital': 'input_business_capital',
                'input_business_start_date': 'input_business_start_date',
                'input_business_tin': 'input_business_tin',
                'input_business_bank_account_info': 'input_business_bank_account_info',
                'input_business_annual_sales': 'input_business_annual_sales',
                'input_business_annual_income': 'input_business_annual_income',
                'input_business_annual_expense': 'input_business_annual_expense',
                'input_business_fixed_assets_value': 'input_business_fixed_assets_value'
            };

            Object.keys(mapping).forEach(dbField => {
                const source = document.getElementById(mapping[dbField]);
                const target = document.querySelector('#Application [data-db-field="' + dbField + '"]');
                if (source && target) {
                    if (dbField === 'applied_sanction_date' || dbField === 'input_business_start_date' || dbField === 'input_application_date') {
                        if (source.value) {
                            const dateParts = source.value.split('-');
                            target.innerText = toBanglaNumber(dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0]);
                        } else target.innerText = '';
                    } else {
                        target.innerText = source.value;
                    }
                }
            });

            // Sync Loan Purpose Section 5 elements
            const f5_1 = document.querySelector('#Application #f_5_1 p');
            if (f5_1) f5_1.innerText = document.getElementById('loan_working_cap')?.value || '';
            const f5_2 = document.querySelector('#Application #f_5_2 p');
            if (f5_2) f5_2.innerText = document.getElementById('loan_expansion')?.value || '';
            const f5_3 = document.querySelector('#Application #f_5_3 p');
            if (f5_3) f5_3.innerText = document.getElementById('loan_other')?.value || '';

            // Special handling for Trade License
            const tlTarget = document.querySelector('#Application [data-db-field="biz_trade_license"]');
            if (tlTarget) {
                const tradeLic = licenseData.find(l => l.type.includes('ট্রেড') || l.type.toUpperCase().includes('TRADE')) || licenseData[0];
                if (tradeLic) {
                    let tlStr = (tradeLic.authority ? tradeLic.authority + ': ' : '') + (tradeLic.type || '');
                    if (tradeLic.validity) tlStr += ' (মেয়াদ: ' + tradeLic.validity + ')';
                    tlTarget.innerText = tlStr;
                } else {
                    tlTarget.innerText = '';
                }
            }

            // Sync Applicant Data
            const entries = document.querySelectorAll('.applicant-entry');
            if (entries.length > 0) {
                const first = entries[0];
                const fields = {
                    'app_name': '.input_name',
                    'app_father': '.input_father',
                    'app_mother': '.input_mother',
                    'app_marital': '.input_marital',
                    'app_spouse': '.input_spouse',
                    'app_nid': '.input_nid',
                    'app_edu': '.input_education',
                    'app_training': '.input_training',
                    'app_tin': '.input_tin',
                    'app_mobile': '.input_mobile'
                };

                Object.keys(fields).forEach(dbField => {
                    const source = first.querySelector(fields[dbField]);
                    const target = document.querySelector('#Application [data-db-field="' + dbField + '"]');
                    if (source && target) target.innerText = source.value;
                });

                // Complex fields
                const dob = first.querySelector('.input_dob')?.value;
                const age = first.querySelector('.input_age')?.value;
                const birthplace = first.querySelector('.input_birthplace')?.value;
                const dobTarget = document.querySelector('#Application [data-db-field="app_dob_full"]');
                if (dobTarget && dob) {
                    const dateParts = dob.split('-');
                    dobTarget.innerText = toBanglaNumber(dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0]) + (age ? ' (বয়স: ' + age + ')' : '') + (birthplace ? ', জন্মস্থান: ' + birthplace : '');
                }

                // Auto-sync Same Address
                const sameCheckbox = first.querySelector('input[type="checkbox"][onchange*="toggleSameAddress"]');
                if (sameCheckbox && sameCheckbox.checked) {
                    first.querySelector('.input_perm_village').value = first.querySelector('.input_curr_village').value;
                    first.querySelector('.input_perm_post').value = first.querySelector('.input_curr_post').value;
                    first.querySelector('.input_perm_upazila').value = first.querySelector('.input_curr_upazila').value;
                    first.querySelector('.input_perm_city_corp').value = first.querySelector('.input_curr_city_corp').value;
                    first.querySelector('.input_perm_district').value = first.querySelector('.input_curr_district').value;
                }

                const mobile = first.querySelector('.input_mobile')?.value;
                const email = first.querySelector('.input_email')?.value;

                const makeAddressStr = (prefix) => {
                    let parts = [];
                    const house = first.querySelector('.input_' + prefix + '_house')?.value;
                    const vill = first.querySelector('.input_' + prefix + '_village')?.value;
                    const post = first.querySelector('.input_' + prefix + '_post')?.value;
                    const upz = first.querySelector('.input_' + prefix + '_upazila')?.value;
                    const cc = first.querySelector('.input_' + prefix + '_city_corp')?.value;
                    const dist = first.querySelector('.input_' + prefix + '_district')?.value;

                    if (house) parts.push('বাড়ি/হোল্ডিং: ' + house);
                    if (vill) parts.push('গ্রাম/রাস্তা: ' + vill);
                    if (post) parts.push('পোস্ট: ' + post);
                    if (upz) parts.push('থানা/উপজেলা: ' + upz);
                    if (cc) parts.push('সিটি কর্পোরেশন: ' + cc);
                    if (dist) parts.push('জেলা: ' + dist);
                    if (mobile) parts.push('মোবাইল: ' + mobile);
                    if (email) parts.push('ইমেইল: ' + email);
                    return parts.join(', ');
                };

                const currAddressTarget = document.querySelector('#Application [data-db-field="app_present_address"]');
                if (currAddressTarget) currAddressTarget.innerText = makeAddressStr('curr');

                const permAddressTarget = document.querySelector('#Application [data-db-field="app_permanent_address"]');
                if (permAddressTarget) permAddressTarget.innerText = makeAddressStr('perm');
            }

            // 1. Remove all previously generated dynamic pages inside Application tab
            const appTab = document.getElementById('Application');
            appTab.querySelectorAll('.dynamic-page').forEach(el => el.remove());

            // 2. Sync Co-applicants Data to Section 6.1 on Page 2 (if multiple exist, write 'নিচে বিস্তারিত পৃষ্ঠা দ্রষ্টব্য')
            const coApplicantsTarget = document.querySelector('#Application [id="f_co_applicants"] p');
            if (coApplicantsTarget) {
                if (entries.length > 1) {
                    coApplicantsTarget.innerHTML = 'পরবর্তী পৃষ্ঠাগুলোতে বিস্তারিত বিবরণ দ্রষ্টব্য';
                } else {
                    coApplicantsTarget.innerHTML = 'নেই';
                }
            }

            // 3. Render Co-applicant details dynamically on separate pages
            const coTemplate = document.getElementById('template-co-applicant-page');
            for (let i = 1; i < entries.length; i++) {
                const entry = entries[i];
                const clone = coTemplate.content.cloneNode(true).querySelector('.dynamic-page');

                const nameBn = entry.querySelector('.input_name')?.value || '';
                const nameEn = entry.querySelector('.input_name_english')?.value || '';
                const father = entry.querySelector('.input_father')?.value || '';
                const mother = entry.querySelector('.input_mother')?.value || '';
                const dob = entry.querySelector('.input_dob')?.value || '';
                const age = entry.querySelector('.input_age')?.value || '';
                const nid = entry.querySelector('.input_nid')?.value || '';
                const mobile = entry.querySelector('.input_mobile')?.value || '';

                // Formulate address strings
                const makeAddressStrLocal = (prefix) => {
                    let parts = [];
                    const house = entry.querySelector('.input_' + prefix + '_house')?.value;
                    const vill = entry.querySelector('.input_' + prefix + '_village')?.value;
                    const post = entry.querySelector('.input_' + prefix + '_post')?.value;
                    const upz = entry.querySelector('.input_' + prefix + '_upazila')?.value;
                    const dist = entry.querySelector('.input_' + prefix + '_district')?.value;
                    if (house) parts.push('বাড়ি/হোল্ডিং: ' + house);
                    if (vill) parts.push('গ্রাম: ' + vill);
                    if (post) parts.push('পোস্ট: ' + post);
                    if (upz) parts.push('উপজেলা: ' + upz);
                    if (dist) parts.push('জেলা: ' + dist);
                    return parts.join(', ');
                };

                clone.innerHTML = clone.innerHTML.replace(/{index}/g, toBanglaNumber(i + 1));
                clone.querySelector('.val-name-bn').innerText = nameBn;
                clone.querySelector('.val-name-en').innerText = nameEn;
                clone.querySelector('.val-father').innerText = father;
                clone.querySelector('.val-mother').innerText = mother;
                clone.querySelector('.val-dob').innerText = dob ? dob.split('-').reverse().join('/') : '';
                clone.querySelector('.val-age').innerText = age;
                clone.querySelector('.val-nid').innerText = toBanglaNumber(nid);
                clone.querySelector('.val-mobile').innerText = toBanglaNumber(mobile);
                clone.querySelector('.val-present-addr').innerText = makeAddressStrLocal('curr');
                clone.querySelector('.val-permanent-addr').innerText = makeAddressStrLocal('perm');

                appTab.appendChild(clone);
            }

            // 4. Render Additional Guarantor details dynamically on separate pages
            const guTemplate = document.getElementById('template-guarantor-page');

            // Map first guarantor to Section 7 on Page 2
            if (guarantorData.length > 0) {
                const g1 = guarantorData[0];
                document.querySelector('#Application [id="f_7_1"] p').innerText = g1.nameBn || '';
                document.querySelector('#Application [id="f_7_1_1"] p').innerText = (g1.nameBn || '') + ' / ' + (g1.nameEn || '');
                document.querySelector('#Application [id="f_7_1_2"] p').innerText = g1.dob || '';
                document.querySelector('#Application [id="f_7_1_3"] p').innerText = g1.edu || '';
                document.querySelector('#Application [id="f_7_1_4"] p').innerText = g1.fatherBn || '';
                document.querySelector('#Application [id="f_7_1_5"] p').innerText = g1.motherBn || '';
                document.querySelector('#Application [id="f_7_1_6"] p').innerText = g1.spouse || '';
                document.querySelector('#Application [id="f_7_1_7"] p').innerText = g1.addressBn || '';
                document.querySelector('#Application [id="f_7_1_8"] p').innerText = g1.permanentAddressBn || '';
                document.querySelector('#Application [id="f_7_1_9"] p').innerText = g1.income || '';
                document.querySelector('#Application [id="f_7_1_10"] p').innerText = g1.asset || '';
                document.querySelector('#Application [id="f_7_1_11"] p').innerText = g1.tin || '';
                document.querySelector('#Application [id="f_7_1_12"] p').innerText = toBanglaNumber(g1.nid || '');
                document.querySelector('#Application [id="f_7_1_13"] p').innerText = g1.bankInfo || '';
                document.querySelector('#Application [id="f_7_1_14"] p').innerText = g1.loanAmt || '';
                document.querySelector('#Application [id="f_7_1_15"] p').innerText = g1.other || '';
                document.querySelector('#Application [id="f_7_rel"] p').innerText = g1.relationship || '';
            } else {
                // Clear Section 7 fields
                ['f_7_1', 'f_7_1_1', 'f_7_1_2', 'f_7_1_3', 'f_7_1_4', 'f_7_1_5', 'f_7_1_6', 'f_7_1_7', 'f_7_1_8', 'f_7_1_9', 'f_7_1_10', 'f_7_1_11', 'f_7_1_12', 'f_7_1_13', 'f_7_1_14', 'f_7_1_15', 'f_7_rel'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.querySelector('p').innerHTML = '&nbsp;';
                });
            }

            // Loop and add dynamic pages for guarantor 2, 3, etc.
            for (let j = 1; j < guarantorData.length; j++) {
                const g = guarantorData[j];
                const clone = guTemplate.content.cloneNode(true).querySelector('.dynamic-page');

                clone.innerHTML = clone.innerHTML.replace(/{index}/g, toBanglaNumber(j + 1));
                clone.querySelector('.val-name-bn').innerText = g.nameBn || '';
                clone.querySelector('.val-name-en').innerText = g.nameEn || '';
                clone.querySelector('.val-dob').innerText = g.dob || '';
                clone.querySelector('.val-edu').innerText = g.edu || '';
                clone.querySelector('.val-father').innerText = g.fatherBn || '';
                clone.querySelector('.val-mother').innerText = g.motherBn || '';
                clone.querySelector('.val-spouse').innerText = g.spouse || '';
                clone.querySelector('.val-present-addr').innerText = g.addressBn || '';
                clone.querySelector('.val-permanent-addr').innerText = g.permanentAddressBn || g.addressBn || '';
                clone.querySelector('.val-income').innerText = g.income || '';
                clone.querySelector('.val-asset').innerText = g.asset || '';
                clone.querySelector('.val-tin').innerText = g.tin || '';
                clone.querySelector('.val-nid').innerText = toBanglaNumber(g.nid || '');
                clone.querySelector('.val-bank-info').innerText = g.bankInfo || '';
                clone.querySelector('.val-loan-amt').innerText = g.loanAmt || '';
                clone.querySelector('.val-other').innerText = g.other || '';
                clone.querySelector('.val-relationship').innerText = g.relationship || '';

                appTab.appendChild(clone);
            }

            // 5. Update footer page numbers dynamically (e.g. পৃষ্ঠা X / Y)
            const allPages = appTab.querySelectorAll('.page');
            const totalPages = allPages.length;
            allPages.forEach((page, index) => {
                const pageNumDisp = page.querySelector('.page-number-display');
                const pgNumText = 'পৃষ্ঠা ' + toBanglaNumber(index + 1) + ' / ' + toBanglaNumber(totalPages);
                if (pageNumDisp) {
                    pageNumDisp.innerText = pgNumText;
                } else {
                    // Try to find the default page-info block at bottom of static page 1 & 2
                    const pageInfo = page.querySelector('.page-info');
                    if (pageInfo) {
                        let existingText = pageInfo.innerText;
                        // Add page number to page-info text dynamically
                        pageInfo.innerText = existingText.split(' | ')[0] + ' | ' + pgNumText;
                    }
                }
            });
        }


        window.addEventListener('DOMContentLoaded', () => {
            const inputs = document.querySelectorAll('#modalOverlay input, #modalOverlay select');
            inputs.forEach(input => {
                input.addEventListener('input', applyData);
                input.addEventListener('change', applyData);
            });
        });

        function saveData() {
            const entries = document.querySelectorAll('.applicant-entry');
            if (entries.length === 0) return;

            const primaryApplicant = entries[0];
            const record = {
                timestamp: new Date().toISOString(),
                authority: document.getElementById('input_authority').value,
                sanctionType: document.getElementById('input_sanction_type').value,
                caseNo: document.getElementById('input_case_no').value,
                appliedAmount: document.getElementById('applied_amount').value,
                appliedSanctionDate: document.getElementById('applied_sanction_date').value,
                appliedDueDate: document.getElementById('applied_due_date').value,
                appliedTerm: document.getElementById('applied_term').value,
                prevSanctionDate: document.getElementById('prev_sanction_date').value,
                prevDueDate: document.getElementById('prev_due_date').value,
                prevTerm: document.getElementById('prev_term').value,
                prevAmount: document.getElementById('prev_amount').value,
                currentLimit: document.getElementById('current_limit').value,
                enhancedAmount: document.getElementById('enhanced_amount').value,
                totalLimit: document.getElementById('total_limit').value,
                mutationData: mutationData,
                branchName: document.getElementById('input_branch_name').value,
                regionalOffice: document.getElementById('input_regional_office').value,
                managerName: document.getElementById('input_manager_name').value,
                branch_location_1: document.getElementById('input_branch_location_1').value,
                branch_location_2: document.getElementById('input_branch_location_2').value,
                branch_mobile: document.getElementById('input_branch_mobile').value,
                branch_email: document.getElementById('input_branch_email').value,
                applicationDate: document.getElementById('input_application_date').value,
                primaryName: primaryApplicant.querySelector('.input_name').value,
                mobile: primaryApplicant.querySelector('.input_mobile').value,
                businessInfo: {
                    name: document.getElementById('input_business_name').value,
                    nameEn: document.getElementById('input_business_name_en').value,
                    sector: document.getElementById('input_business_sector').value,
                    nature: document.getElementById('input_business_nature').value,
                    address: document.getElementById('input_business_address').value,
                    distance: document.getElementById('input_business_distance_from_branch').value,
                    route: document.getElementById('input_business_route_map').value,
                    ownershipType: document.getElementById('input_business_ownership_type').value,
                    capital: document.getElementById('input_business_capital').value,
                    startDate: document.getElementById('input_business_start_date').value,
                    tin: document.getElementById('input_business_tin').value,
                    bankAcc: document.getElementById('input_business_bank_account_info').value,
                    annualSales: document.getElementById('input_business_annual_sales').value,
                    annualIncome: document.getElementById('input_business_annual_income').value,
                    annualExpense: document.getElementById('input_business_annual_expense').value,
                    fixedAssets: document.getElementById('input_business_fixed_assets_value').value,
                    manpower: document.getElementById('input_business_manpower_count').value,
                    inventory: document.getElementById('input_business_inventory_value').value,
                    liabilities: liabilityData,
                    licenses: licenseData,
                    monthlySalary: document.getElementById('input_business_monthly_salary') ? document.getElementById('input_business_monthly_salary').value : '',
                    cib: {
                        sendDate: document.getElementById('cib_send_date') ? document.getElementById('cib_send_date').value : '',
                        receiveDate: document.getElementById('cib_receive_date') ? document.getElementById('cib_receive_date').value : '',
                        otherLoan: document.getElementById('cib_other_loan') ? document.getElementById('cib_other_loan').value : '',
                        otherAmount: document.getElementById('cib_other_amount') ? document.getElementById('cib_other_amount').value : '',
                        otherReceiveDate: document.getElementById('cib_other_receive_date') ? document.getElementById('cib_other_receive_date').value : '',
                        otherStatus: document.getElementById('cib_other_status') ? document.getElementById('cib_other_status').value : ''
                    },
                    rentShowroom: (() => {
                        const rows = [];
                        document.querySelectorAll('#rent_showroom_table tbody tr').forEach(tr => {
                            rows.push({
                                ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                                monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                                startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                                durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                                expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                            });
                        });
                        return rows;
                    })(),
                    rentGodown: (() => {
                        const rows = [];
                        document.querySelectorAll('#rent_godown_table tbody tr').forEach(tr => {
                            rows.push({
                                ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                                monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                                startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                                durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                                expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                            });
                        });
                        return rows;
                    })(),
                    rentProjectLand: (() => {
                        const rows = [];
                        document.querySelectorAll('#rent_project_land_table tbody tr').forEach(tr => {
                            rows.push({
                                ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                                monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                                startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                                durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                                expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                            });
                        });
                        return rows;
                    })(),
                    projectLandDimensional: (() => {
                        const rows = [];
                        document.querySelectorAll('#project_land_dimensional_table tbody tr').forEach(tr => {
                            rows.push({
                                loc: tr.querySelector('.proj_loc') ? tr.querySelector('.proj_loc').value : '',
                                length: tr.querySelector('.proj_length') ? tr.querySelector('.proj_length').value : '',
                                width: tr.querySelector('.proj_width') ? tr.querySelector('.proj_width').value : '',
                                height: tr.querySelector('.proj_height') ? tr.querySelector('.proj_height').value : '',
                                volume: tr.querySelector('.proj_volume') ? tr.querySelector('.proj_volume').value : ''
                            });
                        });
                        return rows;
                    })()
                },
                personalLiabilityBank: '',
                personalLiabilityOther: '',
                loanBreakdown: {
                    workingCap: document.getElementById('loan_working_cap').value,
                    expansion: document.getElementById('loan_expansion').value,
                    other: document.getElementById('loan_other').value
                },
                applicants: [],
                landData: landData,
                deedData: deedData,
                boundaryData: boundaryData,
                checkData: {
                    enabled: document.getElementById('checkbox_check_type').checked,
                    cheques: chequeData
                },
                guarantorData: {
                    enabled: document.getElementById('checkbox_personal_guarantee').checked,
                    guarantors: guarantorData
                },
                spouseGuarantorData: {
                    enabled: document.getElementById('checkbox_spouse_guarantee').checked,
                    guarantors: spouseGuarantorData
                },
                acceptedMclType: document.querySelector('input[name="accepted_mcl_type"]:checked')?.value || '',
                forcedSaleValue: document.getElementById('input_forced_sale_value').value,
                propertyInfo: {
                    utilGas: document.getElementById('prop_util_gas').checked,
                    utilWater: document.getElementById('prop_util_water').checked,
                    utilElec: document.getElementById('prop_util_elec').checked,
                    utilNone: document.getElementById('prop_util_none').checked,
                    disasterErosion: document.getElementById('prop_disaster_erosion').checked,
                    disasterFlood: document.getElementById('prop_disaster_flood').checked,
                    disasterQuake: document.getElementById('prop_disaster_quake').checked,
                    disasterNone: document.getElementById('prop_disaster_none').checked,
                    locMuni: document.getElementById('prop_loc_muni').checked,
                    locVill: document.getElementById('prop_loc_vill').checked,
                    locCity: document.getElementById('prop_loc_city').checked,
                    commDirt: document.getElementById('prop_comm_dirt').checked,
                    commPaved: document.getElementById('prop_comm_paved').checked,
                    commMain: document.getElementById('prop_comm_main').checked,
                    structBuild: document.getElementById('prop_struct_build').checked,
                    structSemi: document.getElementById('prop_struct_semi').checked,
                    structLand: document.getElementById('prop_struct_land').checked,
                    structOtherCheck: document.getElementById('prop_struct_other_check').checked,
                    structOtherText: document.getElementById('prop_struct_other_text').value,
                    boundaryNorth: document.getElementById('prop_boundary_north').value,
                    boundarySouth: document.getElementById('prop_boundary_south').value,
                    boundaryEast: document.getElementById('prop_boundary_east').value,
                    boundaryWest: document.getElementById('prop_boundary_west').value,
                    boundaryDagType: document.getElementById('prop_boundary_dag_type').value,
                    boundaryDagNo: document.getElementById('prop_boundary_dag_no').value,
                    mortgageType: document.getElementById('prop_mortgage_type').value,
                    lawyerOpinion: document.getElementById('prop_lawyer_opinion').checked,
                    searchReport: document.getElementById('prop_search_report').checked,
                    eligibility: document.getElementById('prop_eligibility').value,
                },
                godowns_json: (() => {
                    const list = [];
                    document.querySelectorAll('#godown_table tbody tr').forEach(row => {
                        list.push({
                            loc: row.querySelector('.godown_loc')?.value || '',
                            length: row.querySelector('.godown_length')?.value || '',
                            width: row.querySelector('.godown_width')?.value || '',
                            height: row.querySelector('.godown_height')?.value || ''
                        });
                    });
                    return JSON.stringify(list);
                })(),
                showrooms_json: (() => {
                    const list = [];
                    document.querySelectorAll('#showroom_table tbody tr').forEach(row => {
                        list.push({
                            length: row.querySelector('.showroom_length')?.value || '',
                            width: row.querySelector('.showroom_width')?.value || '',
                            height: row.querySelector('.showroom_height')?.value || ''
                        });
                    });
                    return JSON.stringify(list);
                })(),
                stock_details_json: (() => {
                    const list = [];
                    document.querySelectorAll('#stock_details_table tbody tr').forEach(row => {
                        list.push({
                            desc: row.querySelector('.stock_row_desc')?.value || '',
                            qty: row.querySelector('.stock_row_qty')?.value || '',
                            price: row.querySelector('.stock_row_unit_price')?.value || '',
                            total: row.querySelector('.stock_row_total_cost')?.value || '',
                            sale: row.querySelector('.stock_row_sale_price')?.value || ''
                        });
                    });
                    return JSON.stringify(list);
                })(),
                rent_godown_json: (() => {
                    const rows = [];
                    document.querySelectorAll('#rent_godown_table tbody tr').forEach(tr => {
                        rows.push({
                            ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                            monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                            startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                            durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                            expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                        });
                    });
                    return JSON.stringify(rows);
                })(),
                rent_showroom_json: (() => {
                    const rows = [];
                    document.querySelectorAll('#rent_showroom_table tbody tr').forEach(tr => {
                        rows.push({
                            ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                            monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                            startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                            durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                            expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                        });
                    });
                    return JSON.stringify(rows);
                })(),
                rent_project_land_json: (() => {
                    const rows = [];
                    document.querySelectorAll('#rent_project_land_table tbody tr').forEach(tr => {
                        rows.push({
                            ownership: tr.querySelector('.rent_ownership') ? tr.querySelector('.rent_ownership').value : '',
                            monthly: tr.querySelector('.rent_monthly') ? tr.querySelector('.rent_monthly').value : '',
                            startDate: tr.querySelector('.rent_start_date') ? tr.querySelector('.rent_start_date').value : '',
                            durationYears: tr.querySelector('.rent_duration_years') ? tr.querySelector('.rent_duration_years').value : '',
                            expiryDate: tr.querySelector('.rent_expiry_date') ? tr.querySelector('.rent_expiry_date').value : ''
                        });
                    });
                    return JSON.stringify(rows);
                })(),
                project_land_dimensional_json: (() => {
                    const rows = [];
                    document.querySelectorAll('#project_land_dimensional_table tbody tr').forEach(tr => {
                        rows.push({
                            loc: tr.querySelector('.proj_loc') ? tr.querySelector('.proj_loc').value : '',
                            length: tr.querySelector('.proj_length') ? tr.querySelector('.proj_length').value : '',
                            width: tr.querySelector('.proj_width') ? tr.querySelector('.proj_width').value : '',
                            height: tr.querySelector('.proj_height') ? tr.querySelector('.proj_height').value : '',
                            volume: tr.querySelector('.proj_volume') ? tr.querySelector('.proj_volume').value : ''
                        });
                    });
                    return JSON.stringify(rows);
                })()
            };

            entries.forEach(entry => {
                record.applicants.push({
                    name: entry.querySelector('.input_name').value,
                    father: entry.querySelector('.input_father').value,
                    mother: entry.querySelector('.input_mother').value,
                    marital: entry.querySelector('.input_marital').value,
                    spouse: entry.querySelector('.input_spouse').value,
                    nid: entry.querySelector('.input_nid').value,
                    mobile: entry.querySelector('.input_mobile') ? entry.querySelector('.input_mobile').value : ''
                });
            });

            if (record.applicants && record.applicants.length > 0) {
                record.primaryName = record.applicants[0].name;
                record.nid = record.applicants[0].nid;
                record.mobile = record.applicants[0].mobile;
            }

            let records = JSON.parse(window.AppStorage.getItem('cmsme_records') || '[]');
            records.push(record);
            window.AppStorage.setItem('cmsme_records', JSON.stringify(records));
            alert('নথিটি সফলভাবে সংরক্ষিত হয়েছে।');
        }
        function loadData() {
            try {
                let records = JSON.parse(window.AppStorage.getItem('cmsme_records') || '[]');
                if (records.length === 0) {
                    alert('কোনো সংরক্ষিত নথি নেই।');
                    return;
                }

                // Show list of saved records
                let recordList = records.map((r, idx) => `${ idx + 1 }. ${ r.primaryName } - ${ r.date } `).join('n');
                alert('সংরক্ষিত নথি:nn' + recordList + 'nnমোট: ' + records.length);

                if (window.electronAPI && window.electronAPI.loadRecords) {
                    window.electronAPI.loadRecords().then(electronRecords => {
                        if (electronRecords && electronRecords.length > 0) {
                            console.log('Electron records loaded:', electronRecords);
                            alert('Electron থেকে ' + electronRecords.length + 'টি নথি লোড হয়েছে।');
                        }
                    }).catch(err => console.error('Load error:', err));
                }
            } catch (e) {
                console.error('Load error:', e);
                alert('লোডিংয়ে সমস্যা হয়েছে: ' + e.message);
            }
        }
        function startNew() { if (confirm('সব তথ‌্য মুছে নতুন ফরম শুরু করতে চান?')) location.reload(); }

        function printForm() {
            // Create print dialog with paper size options
            const dialog = document.createElement('div');
            dialog.style.cssText = `
    position: fixed; top: 50 %; left: 50 %; transform: translate(-50 %, -50 %);
    background: white; padding: 30px; border - radius: 10px;
    box - shadow: 0 10px 40px rgba(0, 0, 0, 0.3); z - index: 5000;
    font - family: 'SolaimanLipi', Arial; text - align: center;
    `;

            dialog.innerHTML = `
        < h3 style = "margin: 0 0 20px 0; color: #333;" > প্রিন্ট সাইজ নির্বাচন করুন</h3 >
        <p style="color: #666; margin-bottom: 20px;">কাগজের আকার পছন্দ করুন:</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="executePrint('A4')" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-family: 'SolaimanLipi', Arial;">A4</button>
            <button onclick="executePrint('Legal')" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-family: 'SolaimanLipi', Arial;">Legal</button>
            <button onclick="closeDialogAndCancel()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-family: 'SolaimanLipi', Arial;">বাতিল</button>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #10b981;">
            <h2 style="color: #333; font-size: 1.2rem; border-bottom: 2px solid #10b981; padding-bottom: 5px; margin-bottom: 15px;">ঋণ সংক্রান্ত তথ্য</h2>
            <div class="modal-row">
                <div class="form-group">
                    <label>আবেদনকৃত ঋণের পরিমাণ (অংকে)</label>
                    <input type="text" id="applied_amount" placeholder="যেমন: ৫০০০০০" oninput="handleAmountInput(this, 'applied_amount_words')">
                </div>
                <div class="form-group">
                    <label>আবেদনকৃত ঋণের পরিমাণ (কথায়)</label>
                    <input type="text" id="applied_amount_words" readonly placeholder="স্বয়ংক্রিয়ভাবে পূরণ হবে">
                </div>
            </div>
            <div class="modal-row">
                <div class="form-group">
                    <label>মঞ্জুরীর তারিখ</label>
                    <input type="date" id="applied_sanction_date">
                </div>
                <div class="form-group">
                    <label>মেয়াদোত্তীর্ণের তারিখ</label>
                    <input type="date" id="applied_due_date">
                </div>
                <div class="form-group">
                    <label>মেয়াদ (বছর)</label>
                    <input type="text" id="applied_term" placeholder="যেমন: ১">
                </div>
            </div>
        </div>
    `;

            document.body.appendChild(dialog);
        }

        function executePrint(paperSize) {
            // Remove the dialog
            const dialogs = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 5000"]');
            dialogs.forEach(d => d.remove());

            // Find the active iframe to print
            const visibleIframes = Array.from(document.querySelectorAll('iframe')).filter(iframe => {
                return iframe.offsetParent !== null; // Is visible on screen
            });

            if (visibleIframes.length === 0) {
                alert('No active form found to print.');
                return;
            }

            const activeIframe = visibleIframes[0];

            // Set paper size CSS on the iframe
            let pageSize = paperSize === 'Legal' ? 'legal' : 'A4';
            let style = activeIframe.contentDocument.createElement('style');
            style.innerHTML = "@page { size: " + pageSize + " portrait; margin: 0.5in; } @media print { body { background: none; margin: 0; padding: 0; } .page { width: 100%; height: 100%; margin: 0; padding: 0.5in; border: none; page-break-after: always; } .page:last-child { page-break-after: auto; } }";

            activeIframe.contentDocument.head.appendChild(style);

            // Trigger print on the iframe
            setTimeout(() => {
                activeIframe.contentWindow.focus();
                activeIframe.contentWindow.print();

                // Cleanup
                setTimeout(() => {
                    if (activeIframe.contentDocument.head.contains(style)) {
                        activeIframe.contentDocument.head.removeChild(style);
                    }
                }, 1000);
            }, 250);
        }

        function closeDialogAndCancel() {
            const dialogs = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 5000"]');
            dialogs.forEach(d => d.remove());
        }

        // Handle interdependent dropdowns - disable right option when left is selected
        function updateDropdownOptions(sourceId) {
            var sourceDropdown = document.getElementById(sourceId);
            var sourceValue = sourceDropdown ? sourceDropdown.value : '';

            // Determine which pair of dropdowns this is and update accordingly
            if (sourceId === 'land_khatian_type_1') {
                var targetDropdown = document.getElementById('land_khatian_type_2');
                if (targetDropdown) {
                    var options = targetDropdown.querySelectorAll('option');
                    options.forEach(function (option) {
                        if (option.value === sourceValue && sourceValue !== '') {
                            option.disabled = true;
                        } else {
                            option.disabled = false;
                        }
                    });
                }
            } else if (sourceId === 'land_khatian_type_2') {
                var targetDropdown = document.getElementById('land_khatian_type_1');
                if (targetDropdown) {
                    var options = targetDropdown.querySelectorAll('option');
                    options.forEach(function (option) {
                        if (option.value === sourceValue && sourceValue !== '') {
                            option.disabled = true;
                        } else {
                            option.disabled = false;
                        }
                    });
                }
            } else if (sourceId === 'land_dag_type_1') {
                var targetDropdown = document.getElementById('land_dag_type_2');
                if (targetDropdown) {
                    var options = targetDropdown.querySelectorAll('option');
                    options.forEach(function (option) {
                        if (option.value === sourceValue && sourceValue !== '') {
                            option.disabled = true;
                        } else {
                            option.disabled = false;
                        }
                    });
                }
            } else if (sourceId === 'land_dag_type_2') {
                var targetDropdown = document.getElementById('land_dag_type_1');
                if (targetDropdown) {
                    var options = targetDropdown.querySelectorAll('option');
                    options.forEach(function (option) {
                        if (option.value === sourceValue && sourceValue !== '') {
                            option.disabled = true;
                        } else {
                            option.disabled = false;
                        }
                    });
                }
            }
        }

        // Electron IPC Integration
        document.addEventListener('DOMContentLoaded', function () {
            // Load product database configuration
            if (typeof loadProductDatabase === 'function') {
                loadProductDatabase();
            }

            // Set up Searchable Combo Box interactions
            const searchInput = document.getElementById('prev_doc_search');
            const comboList = document.getElementById('prev_doc_list');
            
            if (searchInput && comboList) {
                searchInput.addEventListener('focus', () => {
                    if (!searchInput.disabled) {
                        comboList.style.display = 'block';
                        const items = comboList.querySelectorAll('.custom-combo-item');
                        items.forEach(item => item.style.display = 'block');
                    }
                });
                
                searchInput.addEventListener('blur', () => {
                    setTimeout(() => comboList.style.display = 'none', 200);
                });
                
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const items = comboList.querySelectorAll('.custom-combo-item');
                    items.forEach(item => {
                        const searchStr = item.getAttribute('data-search');
                        if (searchStr && searchStr.includes(term)) {
                            item.style.display = 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            }

            // Export Logic Object as per Migration Rules
            window.CmsmeLoanLogic = {
                openModal: openModal,
                openLog: openLogModal,
                startNew: startNew,
                saveForm: saveData,
                print: printForm
            };

            // Backward compatibility for existing internal calls
            window.cmsmeApp = window.CmsmeLoanLogic;

            // Load global branch settings


            function populateGlobalSettings() {
                try {

                    const settingsStr = window.AppStorage.getItem('bkb_tms_settings');

                    if (settingsStr) {
                        const settings = JSON.parse(settingsStr);
                        const globalData = {
                            branch_name: settings.branchNameBn || '',
                            branch_location_1: settings.branchLocationBn || '',
                            branch_location_2: settings.branchDistrictBn || '',
                            branch_mobile: settings.branchMobile || '',
                            branch_email: settings.branchEmail || ''
                        };
                        window.postMessage({ command: 'FILL', data: globalData }, '*');
                    }
                } catch (e) { }
            }

            // Wait for all iframes to finish loading before propagating
            window.addEventListener('load', () => {
                populateGlobalSettings();
                setTimeout(populateGlobalSettings, 1000); // safety net
            });// Setup Land Details event listeners
            var addLandBtn = document.getElementById('add_land_btn');
            if (addLandBtn) addLandBtn.addEventListener('click', addLand);
            var addMoreDagBtn = document.getElementById('add_more_dag_btn');
            if (addMoreDagBtn) addMoreDagBtn.addEventListener('click', addDynamicDagRow);

            var addMutationBtn = document.getElementById('add_mutation_btn');
            if (addMutationBtn) addMutationBtn.addEventListener('click', addMutation);

            var addDeedBtn = document.getElementById('add_deed_btn');
            if (addDeedBtn) addDeedBtn.addEventListener('click', addDeed);

            var addBoundaryBtn = document.getElementById('add_boundary_btn');
            if (addBoundaryBtn) addBoundaryBtn.addEventListener('click', addBoundary);

            var addChequeBtn = document.getElementById('add_cheque_btn');
            if (addChequeBtn) addChequeBtn.addEventListener('click', addCheque);

            var addLicenseBtn = document.getElementById('add_license_btn');
            if (addLicenseBtn) addLicenseBtn.addEventListener('click', addLicense);

            var addLiabilityBtn = document.getElementById('add_liability_btn');
            if (addLiabilityBtn) addLiabilityBtn.addEventListener('click', addLiability);

            var firstIssueInput = document.getElementById('lic_input_first_issue');
            if (firstIssueInput) {
                firstIssueInput.addEventListener('change', calculateExpiryDate);
                firstIssueInput.addEventListener('input', calculateExpiryDate);
            }

            var renewalInput = document.getElementById('lic_input_renewal');
            if (renewalInput) {
                renewalInput.addEventListener('change', calculateExpiryDate);
                renewalInput.addEventListener('input', calculateExpiryDate);
            }

            var validityInput = document.getElementById('lic_input_validity');
            if (validityInput) {
                validityInput.addEventListener('change', calculateExpiryDate);
                validityInput.addEventListener('input', calculateExpiryDate);
            }

            var addGuarantorBtn = document.getElementById('add_guarantor_btn');
            if (addGuarantorBtn) addGuarantorBtn.addEventListener('click', addGuarantor);

            var addSpouseBtn = document.getElementById('add_spouse_btn');
            if (addSpouseBtn) addSpouseBtn.addEventListener('click', addSpouseGuarantor);

            var ownershipTypeSelect = document.getElementById('land_ownership_type');
            if (ownershipTypeSelect) {
                ownershipTypeSelect.addEventListener('change', updateApplicantCheckboxes);
            }

            // Sync ownership field when primary applicant name changes
            var firstAppNameInput = document.querySelector('.input_name');
            if (firstAppNameInput) {
                firstAppNameInput.addEventListener('input', updateMutationOwnership);
            }

            var bataDagBtn = document.getElementById('bata_dag_btn');
            if (bataDagBtn) {
                bataDagBtn.addEventListener('click', function () {
                    var normalContainer = document.getElementById('land_dag_normal_container');
                    var bataContainer = document.getElementById('land_dag_bata_container');
                    if (bataContainer.style.display === 'none') {
                        normalContainer.style.display = 'none';
                        bataContainer.style.display = 'flex';
                    } else {
                        normalContainer.style.display = 'flex';
                        bataContainer.style.display = 'none';
                    }
                });
            }

            // Khatian dropdown interdependency listeners
            var khatianType1 = document.getElementById('land_khatian_type_1');
            if (khatianType1) {
                khatianType1.addEventListener('change', function () {
                    var dagType1 = document.getElementById('land_dag_type_1');
                    if (dagType1) dagType1.value = this.value;
                    updateDropdownOptions('land_khatian_type_1');
                    updateDropdownOptions('land_dag_type_1');
                });
            }

            var khatianType2 = document.getElementById('land_khatian_type_2');
            if (khatianType2) {
                khatianType2.addEventListener('change', function () {
                    var dagType2 = document.getElementById('land_dag_type_2');
                    if (dagType2) dagType2.value = this.value;
                    updateDropdownOptions('land_khatian_type_2');
                    updateDropdownOptions('land_dag_type_2');
                });
            }

            // Dag dropdown interdependency listeners
            var dagType1 = document.getElementById('land_dag_type_1');
            if (dagType1) {
                dagType1.addEventListener('change', function () {
                    var khatianType1 = document.getElementById('land_khatian_type_1');
                    if (khatianType1) khatianType1.value = this.value;
                    updateDropdownOptions('land_dag_type_1');
                    updateDropdownOptions('land_khatian_type_1');
                });
            }

            var dagType2 = document.getElementById('land_dag_type_2');
            if (dagType2) {
                dagType2.addEventListener('change', function () {
                    var khatianType2 = document.getElementById('land_khatian_type_2');
                    if (khatianType2) khatianType2.value = this.value;
                    updateDropdownOptions('land_dag_type_2');
                    updateDropdownOptions('land_khatian_type_2');
                });
            }

            if (window.electronAPI) {
                // Listen for commands from Electron main process
                if (window.electronAPI.onPrint) {
                    window.electronAPI.onPrint(() => {
                        printForm();
                    });
                }

                if (window.electronAPI.onSave) {
                    window.electronAPI.onSave((data) => {
                        saveData();
                    });
                }
            }
        });

        // Handle postMessage commands from parent Electron UI
        window.addEventListener('message', function (event) {
            if (!event.data) return;

            if (event.data.command === 'FILL') {
                const data = event.data.data;
                if (data.loans) {
                    try {
                        const loans = typeof data.loans === 'string' ? JSON.parse(data.loans) : data.loans;
                        window.loadedLoans = loans.filter(l => l.product === 'CMSME');
                        const dropdown = document.getElementById('input_previous_doc');
                        if (dropdown && window.loadedLoans.length > 0) {
                            dropdown.innerHTML = '<option value="">সিলেক্ট</option>';
                            window.loadedLoans.forEach(loan => {
                                const opt = document.createElement('option');
                                opt.value = loan.loan_case_no;
                                opt.text = loan.loan_case_no;
                                dropdown.appendChild(opt);
                            });
                            dropdown.disabled = false;
                        }
                    } catch (e) { }
                }

                // Handle Post Code Hyphenation
                if (data.applicant_curr_addr_post || data.applicant_curr_addr_post_code) {
                    let p = data.applicant_curr_addr_post || '';
                    let c = data.applicant_curr_addr_post_code || '';
                    if (c) c = c.toString().replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m]);
                    let comb = p;
                    if (c) comb += (p && p !== c ? '-' : '') + c;
                    data.applicant_curr_addr_post = comb;
                }
                if (data.applicant_perm_addr_post || data.applicant_perm_addr_post_code) {
                    let p = data.applicant_perm_addr_post || '';
                    let c = data.applicant_perm_addr_post_code || '';
                    if (c) c = c.toString().replace(/[0-9]/g, m => '০১২৩৪৫৬৭৮৯'[m]);
                    let comb = p;
                    if (c) comb += (p && p !== c ? '-' : '') + c;
                    data.applicant_perm_addr_post = comb;
                }

                // Map Gender to Bangla options
                if (data.applicant_gender) {
                    let g = data.applicant_gender.toLowerCase();
                    if (g === 'male') data.applicant_gender = 'পুরুষ';
                    else if (g === 'female') data.applicant_gender = 'মহিলা';
                    else if (g === 'third gender' || g === 'third') data.applicant_gender = 'তৃতীয় লিঙ্গ';
                }

                // Map Marital Status to Bangla options
                if (data.applicant_marital_status) {
                    let m = data.applicant_marital_status.toLowerCase();
                    if (m === 'single' || m === 'unmarried') data.applicant_marital_status = 'অবিবাহিত';
                    else if (m === 'married') data.applicant_marital_status = 'বিবাহিত';
                    else if (m !== 'অবিবাহিত' && m !== 'বিবাহিত') data.applicant_marital_status = 'অন্যান্য';
                }

                // Map Birthplace from Permanent District
                if (data.applicant_permanent_district) {
                    const bp = document.getElementById('input_applicant_birth_place');
                    if (bp && !bp.value) {
                        bp.value = data.applicant_permanent_district;
                        bp.dispatchEvent(new Event('input'));
                    }
                }

                Object.keys(data).forEach(key => {
                    // Fill standardized inputs
                    const inputEl = document.getElementById('input_' + key);
                    if (inputEl) {
                        inputEl.value = data[key];
                        inputEl.dispatchEvent(new Event('input'));
                        if (inputEl.tagName === 'SELECT') inputEl.dispatchEvent(new Event('change'));
                    }

                    // Fill document spans (matches IDs or Classes for repeating fields like branch_name)
                    const queryStr = '#' + key + ', .' + key + ', [data-db-field="' + key + '"]';
                    const els = document.querySelectorAll(queryStr);
                    els.forEach(el => {
                        if (el.tagName === 'SPAN' || el.tagName === 'DIV') el.innerText = data[key];
                        else if (el.tagName === 'INPUT') el.value = data[key];
                        else if (el.tagName === 'IMG') {
                            if (data[key]) {
                                el.src = data[key];
                                el.style.display = 'block';
                                const phText = el.parentElement?.querySelector('.photo-placeholder-text');
                                if (phText) phText.style.display = 'none';
                            }
                        }
                    });

                    // Propagate to all child iframes via standard postMessage broadcast
                    const iframes = document.querySelectorAll('iframe');
                    iframes.forEach(iframe => {
                        try {
                            if (iframe.contentWindow) {
                                iframe.contentWindow.postMessage({ command: 'FILL', data: data }, '*');
                            }
                        } catch (e) { }
                    });
                });

                if (data.relationships && data.relationships.length > 0) {
                    // Clear any dynamic applicant entries first (except first)
                    const appContainer = document.getElementById('applicantContainer');
                    if (appContainer) {
                        const entries = appContainer.querySelectorAll('.applicant-entry');
                        for (let i = 1; i < entries.length; i++) {
                            entries[i].remove();
                        }

                        // Filter relations for Co-applicants
                        const coApplicants = data.relationships.filter(r =>
                            r.relation_type === 'Co-applicant' ||
                            r.relation_type === 'Spouse' ||
                            r.relation_type === 'Brother' ||
                            r.relation_type === 'Sister' ||
                            r.relation_type === 'Partner' ||
                            r.relation_type === 'Director'
                        );

                        coApplicants.forEach(co => {
                            if (typeof addApplicantEntry === 'function') addApplicantEntry();
                            const currentEntries = appContainer.querySelectorAll('.applicant-entry');
                            const newEntry = currentEntries[currentEntries.length - 1];
                            if (newEntry) {
                                if (newEntry.querySelector('.input_name')) newEntry.querySelector('.input_name').value = co.applicant_name_bn || '';
                                if (newEntry.querySelector('.input_father')) newEntry.querySelector('.input_father').value = co.applicant_father_name_bn || '';
                                if (newEntry.querySelector('.input_mother')) newEntry.querySelector('.input_mother').value = co.applicant_mother_name_bn || '';
                                if (newEntry.querySelector('.input_nid')) newEntry.querySelector('.input_nid').value = co.applicant_nid || '';
                                if (newEntry.querySelector('.input_mobile')) newEntry.querySelector('.input_mobile').value = co.applicant_mobile || '';
                                const dobInput = newEntry.querySelector('.input_dob');
                                if (dobInput) {
                                    dobInput.value = co.applicant_dob || '';
                                    if (typeof calculateAge === 'function') calculateAge(dobInput);
                                }
                            }
                        });
                    }

                    // Filter relations for Guarantors
                    const guarantors = data.relationships.filter(r => r.relation_type === 'Guarantor');
                    if (guarantors.length > 0) {
                        guarantorData = [];
                        guarantors.forEach(g => {
                            guarantorData.push({
                                nameBn: g.applicant_name_bn || '',
                                fatherBn: g.applicant_father_name_bn || '',
                                mobile: g.applicant_mobile || '',
                                addressBn: g.applicant_curr_addr_village || '',
                                thanaBn: g.applicant_present_upozila || '',
                                districtBn: g.applicant_present_district || '',
                                nameEn: g.applicant_name_en || '',
                                fatherEn: g.applicant_father_name_en || g.applicant_father_name_bn || '',
                                nid: g.applicant_nid || '',
                                villageEn: g.applicant_curr_addr_village || '',
                                thanaEn: g.applicant_present_upozila || '',
                                districtEn: g.applicant_present_district || '',
                                relationship: 'জামিনদার'
                            });
                        });
                        if (typeof renderGuarantorTable === 'function') {
                            renderGuarantorTable();
                        }
                    }
                }

                // Re-run age and validation
                const dobInp = document.getElementById('input_applicant_dob');
                if (dobInp) calculateAge(dobInp);
                syncStockInputs();
                calculateBusinessExperience();
                toggleRentDurationField();
                toggleTradingSection();
            }

            // Targeted slot fill for co-applicant or guarantor
            if (event.data.command === 'FILL_SLOT') {
                const ctx = event.data.targetContext;
                const d = event.data.data;
                if (!ctx || !d) return;

                if (ctx.startsWith('cmsme_applicant_')) {
                    const idx = parseInt(ctx.split('_')[2]);
                    const container = document.getElementById('applicantContainer');
                    // Ensure enough entries exist
                    const entries = container.querySelectorAll('.applicant-entry');
                    let targetEntry = entries[idx];
                    if (!targetEntry) {
                        for (let i = entries.length; i <= idx; i++) {
                            addApplicantEntry();
                        }
                        targetEntry = container.querySelectorAll('.applicant-entry')[idx];
                    }
                    if (targetEntry) {
                        if (targetEntry.querySelector('.input_name')) targetEntry.querySelector('.input_name').value = d.applicant_name_bn || '';
                        if (targetEntry.querySelector('.input_father')) targetEntry.querySelector('.input_father').value = d.applicant_father_name_bn || '';
                        if (targetEntry.querySelector('.input_mother')) targetEntry.querySelector('.input_mother').value = d.applicant_mother_name_bn || '';
                        if (targetEntry.querySelector('.input_nid')) targetEntry.querySelector('.input_nid').value = d.applicant_nid || d.applicant_nid_17 || d.applicant_nid_10 || '';
                        if (targetEntry.querySelector('.input_mobile')) targetEntry.querySelector('.input_mobile').value = d.applicant_mobile || '';
                        const dobEl = targetEntry.querySelector('.input_dob');
                        if (dobEl) { dobEl.value = d.applicant_dob || ''; if (typeof calculateAge === 'function') calculateAge(dobEl); }
                    }
                } else if (ctx === 'cmsme_guarantor_new') {
                    // Pre-fill guarantor form fields from pulled customer
                    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
                    setVal('guarantor_name_bn', d.applicant_name_bn);
                    setVal('guarantor_father_bn', d.applicant_father_name_bn);
                    setVal('guarantor_mobile', d.applicant_mobile);
                    setVal('guarantor_address_bn', d.applicant_curr_addr_village);
                    setVal('guarantor_thana_bn', d.applicant_present_upozila);
                    setVal('guarantor_district_bn', d.applicant_present_district);
                    setVal('guarantor_name_en', d.applicant_name_en);
                    setVal('guarantor_father_en', d.applicant_father_name_en || d.applicant_father_name_bn);
                    setVal('guarantor_nid', d.applicant_nid || d.applicant_nid_17 || d.applicant_nid_10);
                    setVal('guarantor_village_en', d.applicant_curr_addr_village);
                    setVal('guarantor_thana_en', d.applicant_present_upozila);
                    setVal('guarantor_district_en', d.applicant_present_district);
                }
                return;
            }

            if (event.data.command === 'GET_FORM_DATA') {
                const formData = {
                    caseNo: document.getElementById('input_loan_case_no') ? document.getElementById('input_loan_case_no').value : '',
                    applicant_name_bn: document.getElementById('input_applicant_name_bn') ? document.getElementById('input_applicant_name_bn').value : '',
                    applicant_nid: document.getElementById('input_applicant_nid') ? document.getElementById('input_applicant_nid').value : '',
                    // ... extend as needed for DB persistence
                };
                event.source.postMessage({ command: 'FORM_DATA_RESPONSE', data: formData }, event.origin);
            }

            if (event.data.command === 'EXECUTE_ACTION') {
                switch (event.data.actionId) {
                    case 'btn-data-entry': openModal(); break;
                    case 'btn-start-new':
                    case 'btn-clear-form': startNew(); break;
                    case 'btn-print-form': printForm(); break;
                    case 'btn-save-form': saveData(); break;
                    case 'btn-import-customer': /* Handled by Shell Search */ break;
                }
            }
        });

        function openTab(evt, tabId) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-pane");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabId).classList.add("active");
            evt.currentTarget.classList.add("active");
        }
        function updateTabVisibility() {
            const auth = document.getElementById('input_authority') ? document.getElementById('input_authority').value : '';
            const forwardingBtn = document.getElementById('tab-btn-forwarding');

            if (auth === 'ব্যবস্থাপক' || auth === '') {
                if (forwardingBtn) forwardingBtn.style.display = 'none';
                
                // If Forwarding was active, switch back to Application
                const tab = document.getElementById('Forwarding');
                if (tab && tab.classList.contains('active')) {
                    const appBtn = document.querySelector('.tab-btn[onclick*="Application"]');
                    if(appBtn) appBtn.click();
                }
            } else {
                if (forwardingBtn) forwardingBtn.style.display = 'inline-block';
            }
        }

        function populateData() {
            // Collect all modal inputs
            const cmsmeData = {};
            const allInputs = document.querySelectorAll('.modal input, .modal select, .modal textarea');
            allInputs.forEach(el => {
                if (el.id) {
                    cmsmeData[el.id] = el.value;
                }
            });

            // Map data to the main application tab
            if(typeof applyData === 'function') applyData();

            // Broadcast data to all iframes
            const frames = document.querySelectorAll('iframe');
            frames.forEach(frame => {
                if(frame.contentWindow) {
                    frame.contentWindow.postMessage({ command: 'FILL', data: cmsmeData }, '*');
                }
            });

            // Conditionally show/hide tabs (also triggers immediately when the user clicks populate in case onchange didn't fire)
            updateTabVisibility();

            closeModal();
        }

        function saveToCustomerDb() {
            const nid = document.getElementById('input_applicant_nid') ? document.getElementById('input_applicant_nid').value : '';
            const name = document.getElementById('input_applicant_name_bn') ? document.getElementById('input_applicant_name_bn').value : '';
            if (!nid || !name) {
                alert('অনুগ্রহপূর্বক এনআইডি (NID) এবং নাম প্রদান করুন।');
                return;
            }

            const cmsmeData = {};
            const allInputs = document.querySelectorAll('.modal input, .modal select, .modal textarea');
            allInputs.forEach(el => {
                if (el.id) {
                    cmsmeData[el.id] = el.value;
                }
            });

            // Collect co-applicants details
            const coApplicantsList = [];
            const coEntriesList = document.querySelectorAll('.applicant-entry');
            for (let i = 1; i < coEntriesList.length; i++) {
                const entry = coEntriesList[i];
                coApplicantsList.push({
                    name: entry.querySelector('.input_name')?.value || '',
                    father: entry.querySelector('.input_father')?.value || '',
                    mother: entry.querySelector('.input_mother')?.value || '',
                    nid: entry.querySelector('.input_nid')?.value || '',
                    mobile: entry.querySelector('.input_mobile')?.value || ''
                });
            }
            cmsmeData['co_applicants_json'] = JSON.stringify(coApplicantsList);
            cmsmeData['guarantors_json'] = JSON.stringify(guarantorData);
            cmsmeData['spouse_guarantors_json'] = JSON.stringify(spouseGuarantorData);
            cmsmeData['licenses_json'] = JSON.stringify(licenseData);
            cmsmeData['liabilities_json'] = JSON.stringify(liabilityData);

            // Collect stock details
            const stockDetailsList = [];
            const stockRows = document.querySelectorAll('#stock_details_table tbody tr');
            stockRows.forEach(row => {
                stockDetailsList.push({
                    desc: row.querySelector('.stock_row_desc')?.value || '',
                    qty: row.querySelector('.stock_row_qty')?.value || '',
                    price: row.querySelector('.stock_row_unit_price')?.value || '',
                    total: row.querySelector('.stock_row_total_cost')?.value || '',
                    sale: row.querySelector('.stock_row_sale_price')?.value || ''
                });
            });
            cmsmeData['stock_details_json'] = JSON.stringify(stockDetailsList);

            // Collect godown details
            const godownList = [];
            const godownRows = document.querySelectorAll('#godown_table tbody tr');
            godownRows.forEach(row => {
                godownList.push({
                    loc: row.querySelector('.godown_loc')?.value || '',
                    length: row.querySelector('.godown_length')?.value || '',
                    width: row.querySelector('.godown_width')?.value || '',
                    height: row.querySelector('.godown_height')?.value || ''
                });
            });
            cmsmeData['godowns_json'] = JSON.stringify(godownList);

            // Collect showroom details
            const showroomList = [];
            const showroomRows = document.querySelectorAll('#showroom_table tbody tr');
            showroomRows.forEach(row => {
                showroomList.push({
                    length: row.querySelector('.showroom_length')?.value || '',
                    width: row.querySelector('.showroom_width')?.value || '',
                    height: row.querySelector('.showroom_height')?.value || ''
                });
            });
            cmsmeData['showrooms_json'] = JSON.stringify(showroomList);

            // Collect rent showroom details
            const rentShowroomList = [];
            document.querySelectorAll('#rent_showroom_table tbody tr').forEach(row => {
                rentShowroomList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_showroom_json'] = JSON.stringify(rentShowroomList);

            // Collect rent godown details
            const rentGodownList = [];
            document.querySelectorAll('#rent_godown_table tbody tr').forEach(row => {
                rentGodownList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_godown_json'] = JSON.stringify(rentGodownList);

            // Collect rent project land details
            const rentProjectLandList = [];
            document.querySelectorAll('#rent_project_land_table tbody tr').forEach(row => {
                rentProjectLandList.push({
                    ownership: row.querySelector('.rent_ownership')?.value || '',
                    monthly: row.querySelector('.rent_monthly')?.value || '',
                    startDate: row.querySelector('.rent_start_date')?.value || '',
                    durationYears: row.querySelector('.rent_duration_years')?.value || '',
                    expiryDate: row.querySelector('.rent_expiry_date')?.value || ''
                });
            });
            cmsmeData['rent_project_land_json'] = JSON.stringify(rentProjectLandList);

            // Collect project land dimensional details
            const projectLandDimList = [];
            document.querySelectorAll('#project_land_dimensional_table tbody tr').forEach(row => {
                projectLandDimList.push({
                    loc: row.querySelector('.proj_loc')?.value || '',
                    length: row.querySelector('.proj_length')?.value || '',
                    width: row.querySelector('.proj_width')?.value || '',
                    height: row.querySelector('.proj_height')?.value || '',
                    volume: row.querySelector('.proj_volume')?.value || ''
                });
            });
            cmsmeData['project_land_dimensional_json'] = JSON.stringify(projectLandDimList);


            const caseNo = document.getElementById('input_loan_case_no') ? document.getElementById('input_loan_case_no').value : 'CMSME-' + Date.now();

            const loanType = document.getElementById('input_loan_type') ? document.getElementById('input_loan_type').value : '';
            const businessType = document.getElementById('input_business_type') ? document.getElementById('input_business_type').value : '';
            const resolvedType = (loanType && businessType) ? `${loanType} - ${businessType}` : (loanType || businessType || 'CMSME Loan');
            const rawDate = document.getElementById('input_application_date') ? document.getElementById('input_application_date').value : '';
            const amount = document.getElementById('applied_amount') ? document.getElementById('applied_amount').value : '';
            const interest = document.getElementById('input_interest_rate') ? document.getElementById('input_interest_rate').value : '';

            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : '';
            const customerPayload = {
                applicant_nid: nid,
                applicant_name_bn: name,
                applicant_father_name_bn: getVal('input_applicant_father_name_bn'),
                applicant_mother_name_bn: getVal('input_applicant_mother_name_bn'),
                applicant_spouse_name_bn: getVal('input_applicant_spouse_name_bn'),
                applicant_dob: getVal('input_applicant_dob'),
                applicant_mobile: getVal('input_applicant_mobile'),
                applicant_curr_addr_house: getVal('input_applicant_curr_addr_house'),
                applicant_curr_addr_village: getVal('input_applicant_curr_addr_village'),
                applicant_curr_addr_post: getVal('input_applicant_curr_addr_post'),
                applicant_curr_addr_post_code: getVal('input_applicant_curr_addr_post_code'),
                applicant_curr_addr_union: getVal('input_applicant_curr_addr_union'),
                applicant_curr_city_corp: getVal('input_applicant_curr_city_corp'),
                applicant_present_upozila: getVal('input_applicant_present_upozila') || getVal('input_applicant_present_upazila'),
                applicant_present_district: getVal('input_applicant_present_district'),
                applicant_present_division: getVal('input_applicant_present_division'),
                applicant_perm_addr_house: getVal('input_applicant_perm_addr_house'),
                applicant_perm_addr_village: getVal('input_applicant_perm_addr_village'),
                applicant_perm_addr_post: getVal('input_applicant_perm_addr_post'),
                applicant_perm_addr_post_code: getVal('input_applicant_perm_addr_post_code'),
                applicant_perm_addr_union: getVal('input_applicant_perm_addr_union'),
                applicant_perm_city_corp: getVal('input_applicant_perm_city_corp'),
                applicant_permanent_upozila: getVal('input_applicant_permanent_upozila') || getVal('input_applicant_permanent_upazila'),
                applicant_permanent_district: getVal('input_applicant_permanent_district'),
                applicant_permanent_division: getVal('input_applicant_permanent_division'),
                new_loan: {
                    product: resolvedType,
                    account_no: caseNo,
                    loan_case_no: caseNo,
                    sanctioned_amount: amount,
                    outstanding_amount: amount,
                    interest_rate: interest,
                    sanction_date: rawDate ? rawDate.split('-').reverse().join('/') : new Date().toLocaleDateString('en-GB'),
                    expiry_date: '',
                    status: 'active',
                    cmsme_data: JSON.stringify(cmsmeData)
                }
            };
            window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', customer: customerPayload }, '*');
        }


        window.populate = function (customer) {
            window.postMessage({ command: 'FILL', data: customer }, '*');
        };

        window.CmsmeLoanLogic = {
            populate: function (customer) {
                window.postMessage({ command: 'FILL', data: customer }, '*');
            }
        };

        window.applyBranchInfo = function () {
            if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
                const central = window.parent.getCentralBranchData();
                const branchData = {
                    branch_name: central.nameBn || '',
                    branch_location_1: central.locationBn || central.upazilaBn || '',
                    branch_location_2: central.districtBn || '',
                    branch_mobile: central.mobile || '',
                    branch_email: central.email || '',
                    branch_name_en: central.nameEn || '',
                    routing_no: central.code || ''
                };
                window.postMessage({ command: 'FILL', data: branchData }, '*');
            }
        };

        if (window.CmsmeLoanLogic) {
            window.CmsmeLoanLogic.applyBranchInfo = window.applyBranchInfo;
        } else {
            window.CmsmeLoanLogic = { applyBranchInfo: window.applyBranchInfo };
        }

        // Execute immediately to fetch branch data on load
        setTimeout(() => {
            if (typeof window.applyBranchInfo === 'function') {
                window.applyBranchInfo();
            }
        }, 500);


        function autoFetchInterestRate() {
            if (typeof window.InterestRateManager === 'undefined') return;
            var sector = document.getElementById('input_business_type') ? document.getElementById('input_business_type').value : '';
            var loanType = document.getElementById('input_loan_type') ? document.getElementById('input_loan_type').value : '';
            var loanMode = document.getElementById('input_loan_mode') ? document.getElementById('input_loan_mode').value : '';
            
            // If loanType is chosen or sector is chosen, but both are needed.
            // Also determine if it's Term or Continuous based on input_loan_mode (কিস্তি = term)
            var resolvedType = loanType;
            if (loanMode === 'কিস্তি') {
                resolvedType = 'term';
            }

            if (!sector || !resolvedType) return;

            var rate = InterestRateManager.getLatestRateForCmsme(sector, resolvedType);
            if (rate !== null && rate !== undefined) {
                var rateField = document.getElementById('input_interest_rate');
                if (rateField) {
                    rateField.value = toBanglaNumber(rate.toString()) + "%";
                }
            }
        }

        function generateLoanCaseNo() {
            let num = document.getElementById('input_loan_case_num').value || '';
            let sector = document.getElementById('input_loan_sector').value || '';
            let biz = document.getElementById('input_business_type').value || '';
            let year = document.getElementById('input_fiscal_year').value || '';

            let result = "";
            let bNum = typeof toBanglaNumber === 'function' ? toBanglaNumber(num) : num;
            let bYear = typeof toBanglaNumber === 'function' ? toBanglaNumber(year) : year;

            if (bNum) result += bNum;
            if (sector) result += "(" + sector + ")";
            if (biz) result += "(" + biz + ")";
            if (bYear) result += "/" + bYear;

            document.getElementById('input_loan_case_no').value = result;
        }

    
