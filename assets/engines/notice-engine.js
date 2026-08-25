/**
 * Notice Engine
 * Handles dynamically generating notice pages based on selected loans from the Borrower List.
 */

(function() {
    const enToBn = {
        '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
        '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };

    function toBangla(val) {
        if (!val && val !== 0) return '';
        return String(val).replace(/[0-9]/g, match => enToBn[match]);
    }

    function getSavedManagerName() {
        let name = '';
        try {
            name = localStorage.getItem('bkb_manager_name') || '';
            if (!name && window.parent && window.parent.localStorage) {
                name = window.parent.localStorage.getItem('bkb_manager_name') || '';
            }
        } catch (e) {}
        return name;
    }

    function saveManagerName(name) {
        if (!name && name !== '') return;
        try {
            localStorage.setItem('bkb_manager_name', name);
        } catch (e) {}
        try {
            if (window.parent && window.parent.localStorage) {
                window.parent.localStorage.setItem('bkb_manager_name', name);
            }
        } catch (e) {}
    }

    // Auto-save manager name and real-time sync for camp date/day
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el) return;
        if (el.id === 'manager_name' || el.getAttribute('data-db-field') === 'manager_name') {
            const val = el.innerText.trim();
            saveManagerName(val);
            document.querySelectorAll('[data-db-field="manager_name"], #manager_name').forEach(target => {
                if (target !== el) target.innerText = val;
            });
        } else {
            const field = el.getAttribute('data-db-field');
            const id = el.id || '';
            if (field === 'camp_date' || id.startsWith('camp_date')) {
                const val = el.innerText;
                document.querySelectorAll('[data-db-field="camp_date"], [id^="camp_date_"]').forEach(target => {
                    if (target !== el && !target.id.includes('bottom')) target.innerText = val;
                });
            } else if (field === 'camp_day' || id.startsWith('camp_day')) {
                const val = el.innerText;
                document.querySelectorAll('[data-db-field="camp_day"], [id^="camp_day_"]').forEach(target => {
                    if (target !== el) target.innerText = val;
                });
            }
        }
    });

    // Attempt to load pending notice data from sessionStorage (via window.parent if in iframe)
    let pendingDataStr = null;
    try {
        pendingDataStr = window.parent.sessionStorage.getItem('pending_notice_data') || window.sessionStorage.getItem('pending_notice_data');
    } catch (e) {
        console.warn("Could not access sessionStorage.");
    }

    // Intelligent key & alias resolver supporting unicode normalization and alternate Bangla spellings
    function resolveDataValue(data, key) {
        if (!data || !key) return '';
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            return data[key];
        }

        const normKey = (typeof key.normalize === 'function') ? key.normalize('NFC') : key;

        const aliases = {
            'বাড়ি': ['বাড়ি', 'house', 'বাড়ি ও গ্রাম', 'ঠিকানা', 'বাড়ি নং', 'বাড়ি নং', 'recipient_house'],
            'বাড়ি': ['বাড়ি', 'house', 'বাড়ি ও গ্রাম', 'ঠিকানা', 'বাড়ি নং', 'বাড়ি নং', 'recipient_house'],
            'ইউনিয়ন': ['ইউনিয়ন', 'ইউ/পৌর', 'ইউ/পৌরসভা', 'পৌরসভা', 'ইউপি', 'ইউ.পি', 'union', 'পৌর', 'recipient_union'],
            'ইউনিয়ন': ['ইউনিয়ন', 'ইউ/পৌর', 'ইউ/পৌরসভা', 'পৌরসভা', 'ইউপি', 'ইউ.পি', 'union', 'পৌর', 'recipient_union'],
            'ইউ/পৌর': ['ইউনিয়ন', 'ইউনিয়ন', 'ইউ/পৌরসভা', 'পৌরসভা', 'ইউপি', 'ইউ.পি', 'union', 'পৌর', 'recipient_union'],
            'গ্রাম': ['village', 'গ্রাম/মহল্লা', 'মহল্লা', 'recipient_village'],
            'পোস্ট': ['ডাকঘর', 'ডাক', 'post', 'পো:', 'recipient_post'],
            'থানা/উপজেলা': ['উপজেলা', 'থানা', 'upazila', 'thana', 'recipient_thana'],
            'উপজেলা': ['থানা/উপজেলা', 'থানা', 'upazila', 'thana', 'recipient_thana'],
            'থানা': ['থানা/উপজেলা', 'উপজেলা', 'upazila', 'thana', 'recipient_thana'],
            'জেলা': ['district', 'branch_location_2', 'recipient_district'],
            'নাম': ['recipient_name', 'borrower_name', 'গ্রাহকের নাম', 'নাম ও পিতার নাম'],
            'পিতা/স্বামীর নাম': ['পিতার নাম', 'পিতা', 'স্বামী', 'father_name', 'recipient_father'],
            'হিসাব নম্বর': ['account_no', 'হিসাব নং', 'হিসাব_নম্বর', '_caseNo', 'folio_no'],
            'বর্তমান স্থিতি': ['total_due', 'বকেয়া স্থিতি', 'cbs_balance', 'স্থিতি', 'upcoming_total_num'],
            'ঋণের পরিমাণ': ['loan_amount', 'মঞ্জুরীকৃত পরিমাণ', 'মঞ্জুরিকৃত পরিমাণ'],
            'notice_date': ['তারিখ', 'date'],
            'manager_name': ['ব্যবস্থাপক']
        };

        if (aliases[normKey]) {
            for (const alt of aliases[normKey]) {
                if (data[alt] !== undefined && data[alt] !== null && data[alt] !== '') {
                    return data[alt];
                }
            }
        }

        // Search in case-insensitive / normalized keys
        for (const dKey of Object.keys(data)) {
            const normDKey = (typeof dKey.normalize === 'function') ? dKey.normalize('NFC') : dKey;
            if (normDKey === normKey && data[dKey] !== undefined && data[dKey] !== null && data[dKey] !== '') {
                return data[dKey];
            }
        }

        // Check if ID matches after stripping trailing digits (e.g., recipient_house_1 -> recipient_house)
        const strippedId = key.replace(/_\d+$/, '');
        if (strippedId !== key && aliases[strippedId]) {
            for (const alt of aliases[strippedId]) {
                if (data[alt] !== undefined && data[alt] !== null && data[alt] !== '') {
                    return data[alt];
                }
            }
        }

        return '';
    }

    // Helper to safely populate a container (page or slip) with a loan data object
    function fillContainer(container, data) {
        if (!container || !data) return;

        // Default manager_name if missing in data object
        if (!data['manager_name']) {
            data['manager_name'] = getSavedManagerName();
        }

        // 1. Fill all elements with data-db-field
        const dbElements = container.querySelectorAll('[data-db-field]');
        dbElements.forEach(el => {
            const key = el.getAttribute('data-db-field');
            let val = resolveDataValue(data, key);
            if (val !== undefined && val !== null && val !== '') {
                if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const parts = val.split('-');
                    val = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                if (el.classList.contains('bangla-numbers') && val) {
                    val = toBangla(val);
                }
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    el.value = val;
                } else {
                    el.innerText = val;
                }
            }
        });

        // 2. Fill elements by ID if present and not already filled
        const idElements = container.querySelectorAll('[id]');
        idElements.forEach(el => {
            const key = el.id;
            if (key) {
                let val = resolveDataValue(data, key);
                if (val !== undefined && val !== null && val !== '') {
                    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const parts = val.split('-');
                        val = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    if (el.classList.contains('bangla-numbers') && val) {
                        val = toBangla(val);
                    }
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                        el.value = val;
                    } else {
                        el.innerText = val;
                    }
                }
            }
        });
    }

    if (pendingDataStr) {
        try {
            const loansArray = JSON.parse(pendingDataStr);
            if (Array.isArray(loansArray) && loansArray.length > 0) {
                const originalPage = document.querySelector('.page');
                if (!originalPage) return;

                const templateSlips = originalPage.querySelectorAll('.notice-slip');
                const slipsPerPage = templateSlips.length > 0 ? templateSlips.length : 1;

                if (slipsPerPage > 1) {
                    // Multi-slip notice (e.g. Camp Notice: 3 slips per A4 sheet)
                    const totalPages = Math.ceil(loansArray.length / slipsPerPage);
                    const pages = [originalPage];
                    for (let p = 1; p < totalPages; p++) {
                        const newPage = originalPage.cloneNode(true);
                        newPage.removeAttribute('id');
                        document.body.appendChild(newPage);
                        pages.push(newPage);
                    }

                    pages.forEach((page, pIdx) => {
                        const slips = page.querySelectorAll('.notice-slip');
                        slips.forEach((slip, sIdx) => {
                            const loanIdx = pIdx * slipsPerPage + sIdx;
                            if (loanIdx < loansArray.length) {
                                fillContainer(slip, loansArray[loanIdx]);
                            } else {
                                // Clear unused slip fields on the last page
                                slip.querySelectorAll('[contenteditable="true"]').forEach(el => {
                                    const dbf = el.getAttribute('data-db-field');
                                    if (!dbf || (!dbf.startsWith('branch_') && dbf !== 'manager_name')) {
                                        el.innerText = '';
                                    }
                                });
                            }
                        });
                    });
                } else {
                    // Single notice per page (e.g. Demand Notice)
                    const pages = [originalPage];
                    for (let i = 1; i < loansArray.length; i++) {
                        const newPage = originalPage.cloneNode(true);
                        newPage.removeAttribute('id');
                        document.body.appendChild(newPage);
                        pages.push(newPage);
                    }

                    loansArray.forEach((loan, idx) => {
                        fillContainer(pages[idx], loan);
                    });
                }
            }
        } catch (e) {
            console.error("Error processing pending_notice_data:", e);
        }
    } else {
        // If single form opened directly, pre-fill saved manager name on initial page
        const savedManager = getSavedManagerName();
        if (savedManager) {
            document.querySelectorAll('[data-db-field="manager_name"], #manager_name').forEach(el => {
                el.innerText = savedManager;
            });
        }
    }

    // Also listen for Central DB / Branch Info postMessage FILL commands
    window.addEventListener('message', function (event) {
        if (event.data && event.data.command === 'FILL') {
            const data = event.data.data;
            if (!data) return;
            const allPages = document.querySelectorAll('.page');
            allPages.forEach(page => {
                const dbEls = page.querySelectorAll('[data-db-field]');
                dbEls.forEach(el => {
                    const key = el.getAttribute('data-db-field');
                    if (key && data[key] !== undefined) {
                        let val = data[key];
                        if (el.classList.contains('bangla-numbers') && val) {
                            val = toBangla(val);
                        }
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                            el.value = val;
                        } else {
                            el.innerText = val;
                        }
                    }
                });
            });
        }
    });

})();

// Utility functions
window.clearForm = function() {
    if (confirm('Are you sure you want to clear all data?')) {
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            if (el.id !== 'manager_name' && el.getAttribute('data-db-field') !== 'manager_name') {
                el.innerText = '';
            }
        });
    }
};

window.startNewForm = function() {
    if (confirm('Start a new notice? Unsaved data will be lost.')) {
        location.reload();
    }
};
