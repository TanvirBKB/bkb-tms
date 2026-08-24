/**
 * Loan Engine
 * Centralizes all business logic for merging and saving loan data.
 */

// ── Toast helper ──────────────────────────────────────────────────────────────
// Routes toast messages to the parent window's showAppToast so they appear
// in the main UI without triggering a focus-stealing alert() dialog.
function appToast(msg, isError = false) {
    try {
        if (window.parent && typeof window.parent.showAppToast === 'function') {
            window.parent.showAppToast(msg, isError);
        } else {
            // Fallback: render in-page toast
            let t = document.getElementById('_loan_toast');
            if (!t) {
                t = document.createElement('div');
                t.id = '_loan_toast';
                Object.assign(t.style, {
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    padding: '11px 24px', borderRadius: '8px', color: 'white', fontWeight: 'bold',
                    zIndex: '99999', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', opacity: '0',
                    transition: 'opacity 0.3s', pointerEvents: 'none',
                    fontFamily: "'SolaimanLipi', Arial, sans-serif", fontSize: '0.95rem',
                    maxWidth: '80vw', textAlign: 'center'
                });
                document.body.appendChild(t);
            }
            t.textContent = msg;
            t.style.backgroundColor = isError ? '#dc3545' : '#28a745';
            t.style.opacity = '1';
            clearTimeout(t._tid);
            t._tid = setTimeout(() => { t.style.opacity = '0'; }, 3200);
        }
    } catch (e) { console.warn('appToast failed:', e); }
}
window.showAppToast = window.showAppToast || appToast;
// ─────────────────────────────────────────────────────────────────────────────


window.LoanEngine = {
    /**
     * Process and save a customer from a form, handling loans, accounts, and relationship synchronization.
     * @param {Object} customerData
     * @returns {Promise<Object>} { success: true/false, error?: string }
     */
    processFormSave: async function (customerData) {
        const newAccount = customerData.new_account;
        delete customerData.new_account;
        const newLoan = customerData.new_loan;
        delete customerData.new_loan;

        let dataToSave = customerData;

        if ((newAccount || newLoan) && customerData.applicant_nid) {
            const existing = await window.DB.getCustomer(customerData.applicant_nid);
            if (existing) {
                dataToSave = { ...existing, ...customerData };

                // Handle Accounts
                if (newAccount) {
                    try {
                        const accounts = existing.accounts ? JSON.parse(existing.accounts) : [];
                        const existingIdx = accounts.findIndex(a => a.account_no === newAccount.account_no);
                        if (existingIdx >= 0) {
                            accounts[existingIdx] = { ...accounts[existingIdx], ...newAccount };
                        } else {
                            accounts.push(newAccount);
                        }
                        dataToSave.accounts = JSON.stringify(accounts);
                    } catch (e) {
                        dataToSave.accounts = JSON.stringify([newAccount]);
                    }
                }

                // Handle Loans
                if (newLoan) {
                    try {
                        const loans = existing.loans ? JSON.parse(existing.loans) : [];
                        const existingIdx = loans.findIndex(l => l.loan_case_no === newLoan.loan_case_no);
                        if (existingIdx >= 0) {
                            loans[existingIdx] = { ...loans[existingIdx], ...newLoan };
                        } else {
                            loans.push(newLoan);
                        }
                        dataToSave.loans = JSON.stringify(loans);
                    } catch (e) {
                        dataToSave.loans = JSON.stringify([newLoan]);
                    }
                }
            } else {
                if (newAccount) dataToSave.accounts = JSON.stringify([newAccount]);
                if (newLoan) dataToSave.loans = JSON.stringify([newLoan]);
            }
        }

        const res = await window.DB.saveCustomer(dataToSave);
        if (res && res.success !== false) {
            await this.syncRelationships(dataToSave);
        }
        return res;
    },

    syncRelationships: async function (dataToSave) {
        if (!dataToSave.loans) return;
        try {
            let loansList = [];
            if (Array.isArray(dataToSave.loans)) {
                loansList = dataToSave.loans;
            } else if (typeof dataToSave.loans === 'string') {
                loansList = JSON.parse(dataToSave.loans);
            }

            const cmsmeLoan = loansList.find(l => l.product === 'CMSME');
            if (cmsmeLoan && cmsmeLoan.cmsme_data) {
                const cmsmeData = JSON.parse(cmsmeLoan.cmsme_data);
                const mainNid = dataToSave.applicant_nid;

                // 1. Process Co-applicants
                if (cmsmeData.co_applicants_json) {
                    const coApplicants = JSON.parse(cmsmeData.co_applicants_json);
                    for (const co of coApplicants) {
                        if (co.nid) {
                            const exists = await window.DB.getCustomer(co.nid);
                            if (exists) {
                                await window.DB.saveRelationship(mainNid, co.nid, 'Co-applicant', 'সহ-আবেদনকারী');
                                await window.DB.saveRelationship(co.nid, mainNid, 'Co-applicant', 'Co-applicant of this customer');
                            }
                        }
                    }
                }

                // 2. Process Guarantors
                if (cmsmeData.guarantors_json) {
                    const guarantors = JSON.parse(cmsmeData.guarantors_json);
                    for (const g of guarantors) {
                        if (g.nid) {
                            const exists = await window.DB.getCustomer(g.nid);
                            if (exists) {
                                await window.DB.saveRelationship(mainNid, g.nid, 'Guarantor', 'জামানতদাতা');
                                await window.DB.saveRelationship(g.nid, mainNid, 'Guarantor', 'Guarantor of this customer');
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Error syncing relationships:', e);
        }
    },

    /**
     * Dynamically fetch and inject common external stamp forms into the active document.
     * @param {Array<string>} stampUrls Array of relative URLs to fetch.
     */
    loadExternalStamps: async function (stampUrls) {
        const container = document.getElementById('external_stamps_container');
        if (!container) return;
        
        const runId = Symbol();
        this._currentLoadId = runId;

        // Clear container to prevent duplicate stamps during PDF worker rendering
        container.innerHTML = '';

        for (const url of stampUrls) {
            if (this._currentLoadId !== runId) return; // Abort if a new load started
            try {
                const response = await fetch(url);
                if (this._currentLoadId !== runId) return; // Abort if a new load started
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const htmlString = await response.text();
                if (this._currentLoadId !== runId) return; // Abort if a new load started
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');

                // Extract all styles and inject into head if not already present
                const styles = doc.querySelectorAll('style');
                styles.forEach(style => {
                    const existingStyles = document.querySelectorAll('style');
                    let exists = false;
                    existingStyles.forEach(es => {
                        if (es.innerHTML.trim() === style.innerHTML.trim()) exists = true;
                    });
                    if (!exists) {
                        document.head.appendChild(style.cloneNode(true));
                    }
                });

                // Extract and append stamp pages
                const stampPages = doc.querySelectorAll('.stamp-page');
                
                // Fix relative paths for images in CMSME loan which is 1 level deeper
                const isCmsme = window.location.href.includes('/cmsme/');

                stampPages.forEach(page => {
                    if (isCmsme) {
                        const images = page.querySelectorAll('img');
                        images.forEach(img => {
                            const src = img.getAttribute('src');
                            if (src && src.startsWith('../../assets/')) {
                                img.setAttribute('src', '../' + src);
                            }
                        });
                    }
                    container.appendChild(page.cloneNode(true));
                });

            } catch (err) {
                console.error(`Failed to load external stamp ${url}:`, err);
            }
        }
        
        // Setup listeners to automatically push data to stamps whenever inputs change
        this.setupAutoFillExternalStamps();
    },

    setupAutoFillExternalStamps: function() {
        const updateFields = () => {
            const container = document.getElementById('external_stamps_container');
            if (!container) return;

            // Get standard branch data from the parent if available
            let branchName = '';
            let branchLocation = '';
            try {
                if (window.parent && window.parent.document) {
                    branchName = window.parent.document.getElementById('display-branch-name')?.innerText || '';
                    branchLocation = window.parent.document.getElementById('display-branch-location')?.innerText || '';
                }
            } catch (e) {}

            const tryGetVal = (ids) => {
                for (const id of ids) {
                    const el = document.getElementById(id);
                    if (el && (el.value || el.innerText)) return el.value || el.innerText;
                }
                return '';
            };

            const dbFieldSources = {
                'branch_name': [branchName],
                'branch_upazila': [branchLocation],
                'applicant_name_en': ['input_applicant_name_en'],
                'loan_amount': ['input_loan_amount_num', 'applied_amount'],
                'loan_amount_words': ['input_loan_total_amount_words', 'applied_amount_words']
            };

            for (const [dbField, sourceIds] of Object.entries(dbFieldSources)) {
                const spans = container.querySelectorAll(`.dotted-input[data-db-field="${dbField}"]`);
                if (spans.length === 0) continue;

                let val = '';
                if (dbField.startsWith('branch_')) val = sourceIds[0];
                else val = tryGetVal(sourceIds);

                spans.forEach(span => {
                    span.innerText = val;
                });
            }
        };

        // Run once initially
        setTimeout(updateFields, 500);

        // Attach listeners to source inputs
        const allSourceIds = ['input_applicant_name_en', 'input_loan_amount_num', 'applied_amount', 'input_loan_total_amount_words', 'applied_amount_words'];
        for (const id of allSourceIds) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateFields);
                el.addEventListener('change', updateFields);
            }
        }
    }
};


/* Agri Loan Logic */

function toggleStampPages() {
    const category = document.getElementById('input_loan_category')?.value;
    const isUnsecured = document.querySelector('input[name="collateral_type"]:checked')?.value === 'unsecured';

    let stampsToLoad = [];
    
    // 1. Sector-based stamps
    if (category === 'মৎস') {
        stampsToLoad.push('../stamps/fish_stamp.html');
    } else if (category === 'প্রাণীসম্পদ' || category === 'কৃষি যন্ত্রপাতি' || category === 'শস্য ও কৃষি যন্ত্রপাতি') {
        stampsToLoad.push('../stamps/agri_mrtg_stamp.html');
    }

    // 2. Collateral-based stamps
    if (isUnsecured) {
        // Memorandum cheque is always included for unsecured
        stampsToLoad.push('../stamps/memorandum_cheque.html');
        stampsToLoad.push('../stamps/spouse_gurantee.html');
        stampsToLoad.push('../stamps/personal_gurantee.html');
    }

    // Load them via LoanEngine
    if (window.LoanEngine && typeof window.LoanEngine.loadExternalStamps === 'function') {
        window.LoanEngine.loadExternalStamps(stampsToLoad);
    }
}

function toggleCollateralType() {
    const isUnsecured = document.querySelector('input[name="collateral_type"]:checked')?.value === 'unsecured';
    document.getElementById('modal_land_details_section').style.display = isUnsecured ? 'none' : 'block';
    document.getElementById('modal_unsecured_details_section').style.display = isUnsecured ? 'block' : 'none';
    if (typeof toggleStampPages === 'function') toggleStampPages();
}

function autoFetchInterestRate() {
    if (typeof window.InterestRateManager === 'undefined') return;
    // Agricultural Loan short-term general
    var rate = InterestRateManager.getLatestRate('AGRI (SHORT TERM) GENERAL');
    if (rate !== null && rate !== undefined) {
        var rateField = document.getElementById('input_loan_interest_rate');
        if (rateField) {
            rateField.value = toBanglaDigits(rate.toString()) + "%";
            rateField.dispatchEvent(new Event('input'));
        }
    }
}

function numberToBanglaWords(n) {
    n = parseInt(n) || 0;
    const bngWords = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
        'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ',
        'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট',
        'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি',
        'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'অষ্টআশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

    if (n < 100) return bngWords[n] || '';
    let words = '';
    let crore = Math.floor(n / 10000000);
    n -= crore * 10000000;
    let lakh = Math.floor(n / 100000);
    n -= lakh * 100000;
    let thousand = Math.floor(n / 1000);
    n -= thousand * 1000;
    let hundred = Math.floor(n / 100);
    n -= hundred * 100;

    if (crore > 0) words += numberToBanglaWords(crore) + ' কোটি ';
    if (lakh > 0) words += bngWords[lakh] + ' লক্ষ ';
    if (thousand > 0) words += bngWords[thousand] + ' হাজার ';
    if (hundred > 0) words += bngWords[hundred] + ' শত ';
    if (n > 0) words += bngWords[n];

    return words.trim();
}

function numberToEnglishWords(n) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if ((n = n.toString()).length > 9) return 'Overflow';
    let num = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!num) return '';
    let str = '';
    str += (num[1] != 0) ? (a[Number(num[1])] || b[num[1][0]] + ' ' + a[num[1][1]]) + 'Crore ' : '';
    str += (num[2] != 0) ? (a[Number(num[2])] || b[num[2][0]] + ' ' + a[num[2][1]]) + 'Lakh ' : '';
    str += (num[3] != 0) ? (a[Number(num[3])] || b[num[3][0]] + ' ' + a[num[3][1]]) + 'Thousand ' : '';
    str += (num[4] != 0) ? (a[Number(num[4])] || b[num[4][0]] + ' ' + a[num[4][1]]) + 'Hundred ' : '';
    str += (num[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(num[5])] || b[num[5][0]] + ' ' + a[num[5][1]]) : '';
    return str ? str.trim() + ' Only' : '';
}

// Polyfill AppStorage within iframe context
window.AppStorage = window.AppStorage || window.parent.AppStorage || {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
    clear: () => localStorage.clear(),
    getAll: () => {
        const all = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            all[key] = localStorage.getItem(key);
        }
        return all;
    }
};

var landData = [];

function applyBranchInfo() {
    let branchNameBn = '';
    let branchNameEn = '';
    let regionEn = '';
    let branchDistrict = '';
    if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
        const central = window.parent.getCentralBranchData();
        branchNameBn = central.nameBn || '';
        branchNameEn = central.nameEn || '';
        regionEn = central.locationEn || '';
        branchDistrict = central.districtBn || '';
    }
    if (!branchNameBn) {
        branchNameBn = window.AppStorage.getItem('branch_name') || '';
    }
    if (!branchNameEn) {
        branchNameEn = window.AppStorage.getItem('branch_name_en') || branchNameBn;
    }
    if (!branchDistrict) {
        branchDistrict = window.AppStorage.getItem('branch_district') || '';
    }

    if (branchNameBn) {
        const classEls = document.getElementsByClassName('branch_name');
        Array.from(classEls).forEach(el => { el.innerText = branchNameBn; });

        const pgBranch = document.getElementById('personal_guarantee_branch_name');
        if (pgBranch) pgBranch.innerText = branchNameBn;

        const rcBranch = document.getElementById('repayment_commit_branch_name');
        if (rcBranch) rcBranch.innerText = branchNameBn;

        const ackBranch = document.getElementById('acknowledgement_branch_name');
        if (ackBranch) ackBranch.innerText = branchNameBn;
    }
    if (branchDistrict) {
        const distEls = document.getElementsByClassName('branch_district');
        Array.from(distEls).forEach(el => { el.innerText = branchDistrict; });
    }
    if (branchNameEn) {
        const locBranch = document.getElementById('loc_branch_name_en');
        if (locBranch) locBranch.innerText = branchNameEn;
        const revBranch = document.getElementById('rev_branch_name_en');
        if (revBranch) revBranch.innerText = branchNameEn;
    }
    if (regionEn) {
        const locRegion = document.getElementById('loc_region_name_en');
        if (locRegion) locRegion.innerText = regionEn;
        const revRegion = document.getElementById('rev_region_name_en');
        if (revRegion) revRegion.innerText = regionEn;
    }
}

let currentLoadedNid = null;
window.saveCustomerToDB = function () {
    const nameBn = (document.getElementById('input_applicant_name_bn').value || '').trim();
    const nameEn = (document.getElementById('input_applicant_name_en').value || '').trim().toUpperCase();
    let rawNid = (document.getElementById('input_applicant_nid').value || '').trim();
    let nid = rawNid.startsWith('TEMP-') ? rawNid : rawNid.replace(/[^0-9০-৯]/g, '');

    if (!nameBn && !nameEn) {
        appToast('অনুগ্রহ করে কমপক্ষে নাম প্রদান করুন।', true);
        return;
    }

    if (!nid) {
        const nameKey = (nameBn || nameEn).replace(/\s+/g, '_').substring(0, 20);
        nid = 'TEMP-' + nameKey + '-' + Date.now();
    }

    const fhRaw = (document.getElementById('input_applicant_father_name_bn')?.value || '').trim();
    const isHusband = fhRaw.includes('স্বামী') || fhRaw.includes('স্বামীর');
    const fhClean = fhRaw.replace(/^(স্বামী|স্বামীর)[\s:\-]*/, '').trim();

    const customer = {
        applicant_name_bn: nameBn,
        applicant_name_en: nameEn,
        applicant_father_name_bn: isHusband ? '' : fhClean,
        applicant_spouse_name_bn: isHusband ? fhClean : '',
        applicant_mother_name_bn: (document.getElementById('input_applicant_mother_name_bn')?.value || '').trim(),
        applicant_nid: nid,
        original_nid: currentLoadedNid,
        applicant_nid_10: (nid.length === 10) ? nid : '',
        applicant_nid_17: (nid.length === 17) ? nid : '',
        applicant_dob: (document.getElementById('input_applicant_dob').value || '').trim(),
        applicant_curr_addr_house: (document.getElementById('input_applicant_curr_addr_house').value || '').trim(),
        applicant_curr_addr_village: (document.getElementById('input_applicant_curr_addr_village').value || '').trim(),
        applicant_curr_addr_post: (document.getElementById('input_applicant_curr_addr_post').value || '').trim(),
        applicant_curr_addr_union: (document.getElementById('input_applicant_curr_addr_union').value || '').trim(),
        applicant_present_upozila: (document.getElementById('input_applicant_curr_addr_thana').value || '').trim(),
        applicant_present_district: (document.getElementById('input_applicant_curr_addr_district').value || '').trim(),
        applicant_mobile: (document.getElementById('input_applicant_mobile').value || '').trim(),
        previous_loan_folio: (document.getElementById('input_previous_loan_folio')?.value || '').trim(),
        previous_loan_status: (document.getElementById('input_previous_loan_status')?.value || '').trim(),
        previous_loan_close_date: (document.getElementById('input_previous_loan_close_date')?.value || '').trim(),
        // Convert loan-form land data to the customer profile agri_lands format
        agri_lands: JSON.stringify((function() {
            if (!landData || landData.length === 0) return [];
            const cropName = (document.getElementById('input_উৎপাদিতব্য ফসল')?.value || document.getElementById('input_section_12_crop_name')?.value || '').trim();
            const loanAmt = (document.getElementById('input_loan_amount_num')?.value || '').trim();
            return landData.map(function(ld) {
                return {
                    land_type: ld.type === 'own' ? 'নিজ' : ld.type === 'share' ? 'বর্গা' : 'লিজ',
                    mouza: ld.mouza || '',
                    khatian: ld.khatian || ld.k_no || '',
                    dag: ld.dag || ld.d_no || '',
                    area: ld.amount || '',
                    crop: cropName,
                    loan: loanAmt
                };
            });
        })())
    };

    const accountNo = (document.getElementById('input_deposit_account_no')?.value || '').trim();
    if (accountNo) {
        customer.new_account = {
            account_no: accountNo,
            account_title: nameEn || nameBn || '',
            account_type: 'SB',
            opened_at: ''
        };
    }

    const formatDateToDDMMYYYY = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return dateStr;
    };

    const unsecuredAccountNo = (document.getElementById('input_unsecured_account_no')?.value || '').trim();
    const loanCaseNo = (document.getElementById('input_loan_case_no')?.value || '').trim() || accountNo || unsecuredAccountNo;

    if (loanCaseNo) {
        customer.new_loan = {
            loan_case_no: loanCaseNo,
            loan_type: 'কৃষি ঋণ (শস্য)',
            sanction_date: formatDateToDDMMYYYY((document.getElementById('input_loan_approval_date')?.value || '').trim()),
            expiry_date: formatDateToDDMMYYYY((document.getElementById('input_loan_expiry_date')?.value || '').trim()),
            sanction_amount: (document.getElementById('input_loan_amount_num')?.value || '').trim(),
            interest_rate: (document.getElementById('input_loan_interest_rate')?.value || '').trim(),
            sector: (document.getElementById('input_section_12_crop_name')?.value || document.getElementById('input_উৎপাদিতব‌্য ফসল')?.value || '').trim(),
            applicant_name: nameBn,
            father_name: (document.getElementById('input_applicant_father_name_bn').value || '').trim(),
            mobile: (document.getElementById('input_applicant_mobile').value || '').trim(),
            nid: nid
        };
    }

    window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', customer: customer }, '*');
};

// --- Logic Export for App Shell ---
// This object allows the index.html Control Panel to trigger internal form actions
window.AgriLoanLogic = {
    openModal: openDataEntryModal,
    openDataInput: openDataEntryModal,
    startNewForm: () => { if (confirm('সব তথ্য মুছে নতুন ফরম শুরু করতে চান?')) location.reload(); },
    startNew: () => { if (confirm('সব তথ্য মুছে নতুন ফরম শুরু করতে চান?')) location.reload(); },
    applyBranchInfo: applyBranchInfo,
    saveForm: () => { window.saveCustomerToDB(); saveDataEntry(); },
    saveWork: () => {
        const data = collectFormData();
        window.AppStorage.setItem('agri_loan_saved_work', JSON.stringify(data));
        appToast('✅ Work saved successfully!');
    },
    loadWork: () => {
        const saved = window.AppStorage.getItem('agri_loan_saved_work');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                window.postMessage({ command: 'FILL', data: data }, '*');
                appToast('✅ Work loaded successfully!');
            } catch (e) { console.error('Error loading saved work', e); }
        }
    },
    populate: function (data) {
        if (data && data.applicant_nid) currentLoadedNid = data.applicant_nid;
        if (!data) return;
        const gender = (data.applicant_gender || '').toLowerCase();
        const isFemale = gender === 'female' || gender === 'মহিলা';
        
        let fatherOrSpouse = data.applicant_father_name_bn || '';
        if (isFemale && data.applicant_spouse_name_bn) {
            fatherOrSpouse = data.applicant_spouse_name_bn;
            if (!fatherOrSpouse.includes('স্বামী')) fatherOrSpouse = 'স্বামী: ' + fatherOrSpouse;
        }
        data.custom_father_spouse = fatherOrSpouse;

        const mapping = {
            'applicant_name_bn': 'input_applicant_name_bn',
            'applicant_name_en': 'input_applicant_name_en',
            'applicant_dob': 'input_applicant_dob',
            'custom_father_spouse': 'input_applicant_father_name_bn',
            'applicant_mother_name_bn': 'input_applicant_mother_name_bn',
            'applicant_nid': 'input_applicant_nid',
            'applicant_nid_10': 'input_applicant_nid',
            'applicant_nid_17': 'input_applicant_nid',
            'applicant_mobile': 'input_applicant_mobile',
            'applicant_curr_addr_house': 'input_applicant_curr_addr_house',
            'applicant_curr_addr_village': 'input_applicant_curr_addr_village',
            'applicant_curr_addr_post': 'input_applicant_curr_addr_post',
            'applicant_curr_addr_union': 'input_applicant_curr_addr_union',
            'applicant_present_upozila': 'input_applicant_curr_addr_thana',
            'applicant_present_district': 'input_applicant_curr_addr_district',
            'photo': 'input_photo',
            'previous_loan_folio': 'input_previous_loan_folio',
            'previous_loan_status': 'input_previous_loan_status',
            'previous_loan_close_date': 'input_previous_loan_close_date'
        };
        Object.keys(mapping).forEach(key => {
            const val = data[key] || data[key.replace('_10', '')] || data[key.replace('_17', '')];
            if (val !== undefined && val !== null && val !== '') {
                const el = document.getElementById(mapping[key]);
                if (el) {
                    el.value = (key === 'applicant_name_en') ? val.toUpperCase() : val;
                    el.dispatchEvent(new Event('input'));
                    el.dispatchEvent(new Event('change'));
                }
            }
        });
        // Auto-calculate age from DOB when populating from customer DB
        if (data.applicant_dob) {
            recalcAgeFromDob(data.applicant_dob);
        }
        // Restore agri land data if available in customer record
        if (data.agri_lands) {
            try {
                const agriArr = (typeof data.agri_lands === 'string') ? JSON.parse(data.agri_lands) : data.agri_lands;
                if (Array.isArray(agriArr) && agriArr.length > 0) {
                    landData = agriArr.map(al => ({
                        type: al.land_type === 'নিজ' ? 'own' : al.land_type === 'বর্গা' ? 'share' : 'lease',
                        mouza: al.mouza || '',
                        khatian: al.khatian || '',
                        k_type: '', k_no: al.khatian || '',
                        dag: al.dag || '',
                        d_type: '', d_no: al.dag || '',
                        amount: al.area || ''
                    }));
                    renderLandTable();
                    renderLandPage2();
                }
            } catch(e) { console.warn('Could not restore agri_lands from customer:', e); }
        }
        updateSuggestions();
        openDataEntryModal();
    }
};

// --- Shell Communication ---
// Helper: compute age from a DOB string and update both the hidden input and visible span
function recalcAgeFromDob(dobStr) {
    if (!dobStr) return;
    const dob = parseAnyDate ? parseAnyDate(dobStr) : new Date(dobStr);
    if (!dob || isNaN(dob)) return;
    const age = Math.floor((new Date() - dob) / 31557600000);
    const ageInput = document.getElementById('input_applicant_age');
    if (ageInput) ageInput.value = toBanglaDigits(age);
    updateFormattedSpan('applicant_age', toBanglaDigits(age) + ' বছর');
}

window.addEventListener('message', function (event) {
    if (!event.data) return;

    if (event.data.command === 'FILL') {
        const data = event.data.data;
        // Universal Population Loop: 
        // Matches standardized database keys to standardized Form IDs/Classes and Input IDs
        const dateKeys = ['applicant_dob', 'application_date', 'inspection_date', 'loan_approval_date', 'previous_loan_close_date'];

        Object.keys(data).forEach(key => {
            let displayVal = data[key];
            if (dateKeys.includes(key)) {
                displayVal = formatToBanglaDate(displayVal);
            }

            // Specific formatting mapping
            if (key === 'loan_sector') {
                updateFormattedSpan('section_13_loan_purpose', displayVal);
            }
            if (key === 'loan_term_months') {
                const val = toBanglaDigits(displayVal);
                updateFormattedSpan('loan_term_display', val + ' মাস');
                let years = (parseFloat(toEnglishDigits(val)) || 0) / 12;
                let yearsStr = years % 1 === 0 ? years.toString() : years.toFixed(2);
                const finalYearsStr = toBanglaDigits(yearsStr);
                updateFormattedSpan('loan_term_inline_page2', finalYearsStr);
                updateFormattedSpan('section_13_term_repayment', 'মেয়াদ- বিতরণের তারিখ হতে ' + finalYearsStr + ' বছর। মেয়াদান্তে পরিশোধ/নবায়নযোগ্য।');
            }
            if (key === 'applicant_age') {
                updateFormattedSpan('applicant_age', toBanglaDigits(displayVal) + ' বছর');
            }
            if (key === 'applicant_type') {
                const sn = document.getElementById('loan_type_new');
                const sr = document.getElementById('loan_type_repeat');
                if (sn) sn.style.textDecoration = (displayVal === 'repeat') ? 'line-through' : 'none';
                if (sr) sr.style.textDecoration = (displayVal === 'new') ? 'line-through' : 'none';
            }
            if (key === 'loan_amount_num') {
                const rawAmount = displayVal || '';
                const bdAmount = toBanglaDigits(rawAmount) + (rawAmount ? '/-' : '');
                updateFormattedSpan('rcc_limit_bottom', bdAmount);
                updateFormattedSpan('rcc_limit_top', bdAmount);
                updateFormattedSpan('section_6_loan_amount', bdAmount);
                updateFormattedSpan('section_7_disbursement_amount_num', bdAmount);
                updateFormattedSpan('section_12_loan_amount', bdAmount);
                updateFormattedSpan('section_13_loan_amount_num', bdAmount);
                updateFormattedSpan('section_14_loan_amount_num_1', bdAmount);
                updateFormattedSpan('section_14_loan_amount_num_2', bdAmount);
                updateFormattedSpan('section_15a_guarantor_amount_num', bdAmount);
                updateFormattedSpan('dp_note_amount_num_top', bdAmount);
                updateFormattedSpan('dp_note_amount_num_body', bdAmount);

                // Also populate the single crop disbursement breakdown with the full amount for now
                updateFormattedSpan('section_13_crop_1_total', bdAmount);
                updateFormattedSpan('section_13_crop_1_loan', bdAmount);
            }
            if (key === 'loan_amount_words' || key === 'loan_total_amount_words') {
                updateFormattedSpan('loan_amount_words', displayVal);
                updateFormattedSpan('section_7_disbursement_amount_words', displayVal);
                updateFormattedSpan('section_13_loan_amount_words', displayVal);
                updateFormattedSpan('section_14_loan_amount_words_1', displayVal);
                updateFormattedSpan('section_14_loan_amount_words_2', displayVal);
                updateFormattedSpan('section_15a_guarantor_amount_words', displayVal);
                updateFormattedSpan('dp_note_amount_words', displayVal);
            }
            if (key === 'per_acre_limit') {
                updateFormattedSpan('section_6_rcc_limit', displayVal);
            }
            if (key === 'section_12_crop_name' || key === 'উৎপাদিতব‌্য ফসল') {
                updateFormattedSpan('উৎপাদিতব‌্য ফসল', displayVal);
                updateFormattedSpan('section_13_crop_1_name', displayVal);
                updateFormattedSpan('section_6_loan_purpose', displayVal);
            }
            if (key === 'loan_approval_date') {
                updateFormattedSpan('section_13_sanction_date', displayVal); // displayVal is already translated to Bangla Date
            }
            if (key === 'loan_disbursement_cash_amount' || key === 'loan_disbursement_materials_amount') {
                const bd = toBanglaDigits(displayVal || '');
                if (key === 'loan_disbursement_cash_amount') updateFormattedSpan('section_13_crop_1_cash', bd);
                if (key === 'loan_disbursement_materials_amount') updateFormattedSpan('section_13_crop_1_materials', bd);
            }
            if (key === 'applicant_nid' || key === 'applicant_nid_10' || key === 'applicant_nid_17' || key === 'applicant_mobile') {
                displayVal = toBanglaDigits(displayVal || '');
            }

            // 1. Update Display Elements (by ID and Class)
            const displayEl = document.getElementById(key);
            if (displayEl) {
                if (displayEl.classList.contains('english') || displayEl.classList.contains('english-text')) {
                    displayEl.innerText = data[key];
                } else {
                    displayEl.innerText = displayVal;
                }
            }

            const classEls = document.getElementsByClassName(key);
            Array.from(classEls).forEach(el => {
                if (el.classList.contains('english') || el.classList.contains('english-text')) {
                    el.innerText = data[key];
                } else {
                    el.innerText = displayVal;
                }
            });

            // 2. Update Data Entry Inputs
            let inputId = 'input_' + key;
            // Handle known standardized variations
            if (key === 'loan_amount_words') inputId = 'input_loan_total_amount_words';
            if (key === 'loan_total_amount_words') inputId = 'input_loan_total_amount_words';

            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                inputEl.value = data[key];
                inputEl.dispatchEvent(new Event('input'));
                inputEl.dispatchEvent(new Event('change'));
            }
        });

        if (data.collateral_type) {
            const radio = document.querySelector(`input[name="collateral_type"][value="${data.collateral_type}"]`);
            if (radio) radio.checked = true;
            if (typeof toggleCollateralType === 'function') toggleCollateralType();
        }

        // Special handling for Land Data restoration
        if (data.land_data_json) {
            try {
                landData = JSON.parse(data.land_data_json);
                renderLandTable();
                renderLandPage2();
            } catch (e) { console.error("Error parsing injected land data", e); }
        }

        // Auto-calculate age if DOB was part of the FILL payload
        if (data.applicant_dob) {
            recalcAgeFromDob(data.applicant_dob);
        }

        // Map custom details for Page 4, 5, 6 Sections
        const fatherName = data.applicant_father_name_bn || '';
        const village = data.applicant_curr_addr_village || '';
        const thana = data.applicant_present_upozila || data.applicant_curr_addr_thana || '';
        const address = (village && thana) ? `${village}, ${thana}` : (village || thana || '');

        const dpNoteFather = document.getElementById('dp_note_applicant_father_name');
        if (dpNoteFather) dpNoteFather.innerText = fatherName;
        const dpNoteAddr = document.getElementById('dp_note_applicant_address');
        if (dpNoteAddr) dpNoteAddr.innerText = address;

        // Page 5 - personal_guarantee fields
        updateFormattedSpan('personal_guarantee_father_name', fatherName);
        updateFormattedSpan('personal_guarantee_mother_name', data.applicant_mother_name_bn || '');
        updateFormattedSpan('personal_guarantee_village', village);
        updateFormattedSpan('personal_guarantee_house', data.applicant_curr_addr_house || '');
        updateFormattedSpan('personal_guarantee_union', data.applicant_curr_addr_union || '');
        updateFormattedSpan('personal_guarantee_post', data.applicant_curr_addr_post || '');
        updateFormattedSpan('personal_guarantee_upazila', thana);
        updateFormattedSpan('personal_guarantee_district', data.applicant_present_district || data.applicant_curr_addr_district || '');
        updateFormattedSpan('personal_guarantee_mobile', data.applicant_mobile ? toBanglaDigits(data.applicant_mobile) : '');
        updateFormattedSpan('personal_guarantee_nid', data.applicant_nid ? toBanglaDigits(data.applicant_nid) : '');
        updateFormattedSpan('personal_guarantee_farmer_card_no', data.applicant_farmer_card_no ? toBanglaDigits(data.applicant_farmer_card_no) : '');
        updateFormattedSpan('personal_guarantee_amount_num', data.loan_amount_num ? toBanglaDigits(data.loan_amount_num) : '');
        updateFormattedSpan('personal_guarantee_amount_words', data.loan_amount_words || data.loan_total_amount_words || '');

        // Repayment commitment slip fields (Page 5)
        updateFormattedSpan('repayment_commit_amount_num', data.loan_amount_num ? toBanglaDigits(data.loan_amount_num) : '');
        updateFormattedSpan('repayment_commit_applicant_father_name', fatherName);
        updateFormattedSpan('repayment_commit_applicant_address', address);

        if (data.loan_approval_date) {
            const dateObj = parseAnyDate(data.loan_approval_date);
            if (dateObj) {
                updateFormattedSpan('repayment_commit_sanction_year', toBanglaDigits(dateObj.getFullYear()));
            }
        } else if (data.fiscal_year) {
            updateFormattedSpan('repayment_commit_sanction_year', toBanglaDigits(data.fiscal_year));
        }

        // Page 6 - loc / rev (Letter of Continuity and Revival Letter)
        updateFormattedSpan('loc_amount_num', data.loan_amount_num ? toEnglishDigits(data.loan_amount_num) + '/-' : '');
        const enWords = data.loan_amount_num ? numberToEnglishWords(data.loan_amount_num).toUpperCase() : '';
        updateFormattedSpan('loc_amount_words', data.loan_amount_words_en || enWords || (data.loan_amount_words ? data.loan_amount_words.toUpperCase() : ''));
        updateFormattedSpan('loc_dp_note_date', data.loan_approval_date ? formatToEnglishDate(data.loan_approval_date) : '');
        updateFormattedSpan('loc_maker_name_en', data.applicant_name_en ? data.applicant_name_en.toUpperCase() : '');

        updateFormattedSpan('rev_amount_num', data.loan_amount_num ? toEnglishDigits(data.loan_amount_num) + '/-' : '');
        updateFormattedSpan('rev_dp_note_date', data.loan_approval_date ? formatToEnglishDate(data.loan_approval_date) : '');
        updateFormattedSpan('rev_date', data.loan_approval_date ? formatToEnglishDate(data.loan_approval_date) : '');

        // --- Dynamic Arrays Handling ---
        document.querySelectorAll('.annexure-page').forEach(el => el.remove());

        const processArray = (type, title, prefix) => {
            if (data[type + 's_json']) {
                try {
                    const arr = JSON.parse(data[type + 's_json']);
                    if (arr.length > 0) {
                        // Populate first entry into main form
                        updateFormattedSpan(prefix + '_name_bn', arr[0].name_bn);
                        updateFormattedSpan(prefix + '_father_name_bn', arr[0].father_name);
                        updateFormattedSpan(prefix + '_mother_name_bn', arr[0].mother_name);
                        updateFormattedSpan(prefix + '_spouse_name_bn', arr[0].spouse_name);
                        updateFormattedSpan(prefix + '_dob', toBanglaDigits(arr[0].dob));
                        updateFormattedSpan(prefix + '_address', arr[0].address);
                        updateFormattedSpan(prefix + '_nid', toBanglaDigits(arr[0].nid));
                        updateFormattedSpan(prefix + '_mobile', toBanglaDigits(arr[0].mobile));

                        if (type === 'guarantor') {
                            const sharecropper = arr.find(g => g.guarantor_type === 'sharecropper');
                            if (sharecropper) {
                                updateFormattedSpan('guarantor_1_name_bn', sharecropper.name_bn);
                                updateFormattedSpan('guarantor_1_father_name_bn', sharecropper.father_name);
                            } else {
                                updateFormattedSpan('guarantor_1_name_bn', '');
                                updateFormattedSpan('guarantor_1_father_name_bn', '');
                            }
                        }

                        // Re-render modal entries to match what we loaded
                        const container = document.getElementById(type + '_container');
                        if (container) {
                            container.innerHTML = '';
                            arr.forEach(entry => {
                                addDynamicEntry(type);
                                const domEntries = container.querySelectorAll('.dynamic-entry');
                                const last = domEntries[domEntries.length - 1];
                                if (last) {
                                    const setVal = (cls, val) => { const el = last.querySelector(cls); if (el) el.value = val || ''; };
                                    setVal('.input_name', entry.name_bn);
                                    setVal('.input_father', entry.father_name);
                                    setVal('.input_mother', entry.mother_name);
                                    setVal('.input_spouse', entry.spouse_name);
                                    setVal('.input_dob', entry.dob);
                                    setVal('.input_address', entry.address);
                                    setVal('.input_nid', entry.nid);
                                    setVal('.input_mobile', entry.mobile);
                                    if (type === 'guarantor') {
                                        setVal('.input_identifier_name', entry.identifier_name);
                                        setVal('.input_identifier_address', entry.identifier_address);
                                        setVal('.input_guarantor_type', entry.guarantor_type);
                                    }
                                }
                            });
                        }
                        // Generate overflow pages
                        generateAnnexurePage(type, title, arr);
                    } else {
                        // Clear main form fields if empty
                        updateFormattedSpan(prefix + '_name_bn', '');
                        updateFormattedSpan(prefix + '_father_name_bn', '');
                        updateFormattedSpan(prefix + '_mother_name_bn', '');
                        updateFormattedSpan(prefix + '_spouse_name_bn', '');
                        updateFormattedSpan(prefix + '_dob', '');
                        updateFormattedSpan(prefix + '_address', '');
                        updateFormattedSpan(prefix + '_nid', '');
                        updateFormattedSpan(prefix + '_mobile', '');
                        if (type === 'guarantor') {
                            updateFormattedSpan('guarantor_1_name_bn', '');
                            updateFormattedSpan('guarantor_1_father_name_bn', '');
                        }
                    }
                } catch (e) { console.error('Error parsing ' + type, e); }
            }
        };

        processArray('co_applicant', 'সহ-আবেদনকারী', 'co_applicant');
        processArray('guarantor', 'জামিনদার/প্রত্যয়নকারী', 'guarantor');
        processArray('partner', 'অংশীদার', 'partner');

        // --- Collateral (Unsecured / Land) Population ---
        const collateralType = data.collateral_type || 'land';
        if (collateralType === 'unsecured') {
            const textContainer = document.getElementById('unsecured_collateral_text_container');
            if (textContainer) textContainer.style.display = 'block';
            updateFormattedSpan('doc_unsecured_bank_name', data.unsecured_bank_name || '');
            updateFormattedSpan('doc_unsecured_branch_name', data.unsecured_branch_name || '');
            updateFormattedSpan('doc_unsecured_check_from', toBanglaDigits(data.unsecured_check_from || ''));
            updateFormattedSpan('doc_unsecured_check_to', toBanglaDigits(data.unsecured_check_to || ''));

            updateFormattedSpan('recommendation_1_land_area', 'জামানতবিহীন');
            ['own', 'share', 'lease'].forEach(t => {
                updateFormattedSpan(`land_${t}_dag`, 'জামানতবিহীন');
                updateFormattedSpan(`land_${t}_amount`, 'জামানতবিহীন');
            });
            updateFormattedSpan('land_total_area', 'জামানতবিহীন');
        } else {
            const textContainer = document.getElementById('unsecured_collateral_text_container');
            if (textContainer) textContainer.style.display = 'none';
        }
    }

    if (event.data.command === 'GET_FORM_DATA') {
        // Collect all current form data to send back to the Shell for the central database
        const formData = collectFormData();
        event.source.postMessage({ command: 'FORM_DATA_RESPONSE', data: formData }, event.origin);
    }

    if (event.data.command === 'EXECUTE_ACTION') {
        switch (event.data.actionId) {
            case 'btn-data-entry': openDataEntryModal(); break;
            case 'btn-print-form': 
                if (window.top !== window.self) {
                    window.top.document.getElementById('btn-print-form').click();
                } else {
                    window.print();
                }
                break;
            case 'btn-start-new':
            case 'btn-clear-form':
                if (confirm('সব তথ্য মুছে নতুন ফরম শুরু করতে চান?')) location.reload();
                break;
            case 'btn-save-form': window.saveCustomerToDB(); saveDataEntry(); break;
        }
    }
});

window.handleFormPhotoUpload = function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            const imgEl = document.getElementById('applicant_photo');
            const textEl = document.getElementById('applicant_photo_text');
            const hiddenInput = document.getElementById('input_photo');
            if (imgEl) {
                imgEl.src = dataUrl;
                imgEl.style.display = 'block';
            }
            if (textEl) {
                textEl.style.display = 'none';
            }
            if (hiddenInput) {
                hiddenInput.value = dataUrl;
                hiddenInput.dispatchEvent(new Event('input'));
                hiddenInput.dispatchEvent(new Event('change'));
            }
        };
        reader.readAsDataURL(file);
    }
};

// If the photo is populated programmatically (e.g., from DB)
setTimeout(() => {
    const photoHiddenInput = document.getElementById('input_photo');
    if (photoHiddenInput) {
        photoHiddenInput.addEventListener('input', function () {
            const imgEl = document.getElementById('applicant_photo');
            const textEl = document.getElementById('applicant_photo_text');
            if (this.value) {
                if (imgEl) {
                    imgEl.src = this.value;
                    imgEl.style.display = 'block';
                }
                if (textEl) textEl.style.display = 'none';
            } else {
                if (imgEl) {
                    imgEl.src = '';
                    imgEl.style.display = 'none';
                }
                if (textEl) textEl.style.display = 'inline';
            }
        });
    }
}, 500);

function updateFormattedSpan(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
    const cls = document.getElementsByClassName(id);
    Array.from(cls).forEach(e => e.innerText = val);
}

/**
 * Scrapes the modal for current values to create a data object
 * used for the central database sync.
 */
function collectFormData() {
    const data = {};
    const fields = document.querySelectorAll('#dataEntryModal input, #dataEntryModal select');
    fields.forEach(f => {
        if (f.id && f.id.startsWith('input_')) {
            const key = f.id.replace('input_', '');
            data[key] = f.value;
        }
    });
    data['land_data_json'] = JSON.stringify(landData);
    data['collateral_type'] = document.querySelector('input[name="collateral_type"]:checked')?.value || 'land';

    // Collect arrays
    ['co_applicant', 'guarantor', 'partner'].forEach(type => {
        const container = document.getElementById(type + '_container');
        if (container) {
            const entries = container.querySelectorAll('.dynamic-entry');
            const arr = [];
            entries.forEach(entry => {
                const obj = {
                    name_bn: entry.querySelector('.input_name')?.value || '',
                    father_name: entry.querySelector('.input_father')?.value || '',
                    mother_name: entry.querySelector('.input_mother')?.value || '',
                    spouse_name: entry.querySelector('.input_spouse')?.value || '',
                    dob: entry.querySelector('.input_dob')?.value || '',
                    address: entry.querySelector('.input_address')?.value || '',
                    mobile: entry.querySelector('.input_mobile')?.value || '',
                    nid: entry.querySelector('.input_nid')?.value || ''
                };
                if (type === 'guarantor') {
                    obj.identifier_name = entry.querySelector('.input_identifier_name')?.value || '';
                    obj.identifier_address = entry.querySelector('.input_identifier_address')?.value || '';
                    obj.guarantor_type = entry.querySelector('.input_guarantor_type')?.value || '';
                }
                arr.push(obj);
            });
            data[type + 's_json'] = JSON.stringify(arr);
        }
    });

    return data;
}

// --- Standalone Modal Logic ---
function openDataEntryModal() {
    updateSuggestions();
    document.getElementById('dataEntryModal').style.display = 'flex';
}
function closeDataEntryModal() { document.getElementById('dataEntryModal').style.display = 'none'; }

/**
 * Populates datalists with unique values from the central customer database
 * to provide browser-like autocomplete suggestions.
 */
function updateSuggestions() {
    const customers = JSON.parse(window.AppStorage.getItem('bkb_customers') || '[]');
    const lists = {
        'suggestion_name_bn': 'applicant_name_bn',
        'suggestion_name_en': 'applicant_name_en',
        'suggestion_father_name_bn': 'applicant_father_name_bn',
        'suggestion_mobile': 'applicant_mobile'
    };

    Object.keys(lists).forEach(listId => {
        const datalist = document.getElementById(listId);
        if (!datalist) return;

        datalist.innerHTML = '';
        const fieldName = lists[listId];
        const uniqueValues = new Set();

        customers.forEach(c => {
            if (c[fieldName]) uniqueValues.add(c[fieldName]);
        });

        uniqueValues.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            datalist.appendChild(option);
        });
    });
}

function saveDataEntry() {
    const data = collectFormData();
    // Self-broadcast to trigger the FILL logic locally
    window.postMessage({ command: 'FILL', data: data }, '*');
    // Specific logic for Page 2 Land Table Rendering
    renderLandPage2();
    closeDataEntryModal();
}

function addDynamicEntry(type) {
    const container = document.getElementById(type + '_container');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = `dynamic-entry ${type}-entry`;
    div.style.cssText = 'border: 1px solid #ccc; padding: 10px; border-radius: 4px; position: relative; background: #fafafa;';
    div.innerHTML = `
                <button type="button" onclick="this.parentElement.remove()" style="position: absolute; right: 5px; top: 5px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 6px; font-size: 10px;">মুছুন</button>
                <div class="grid-4" style="margin-top: 15px;">
                    <div><label>নাম</label><input type="text" class="input_name" /></div>
                    <div><label>পিতার নাম</label><input type="text" class="input_father" /></div>
                    <div><label>মাতার নাম</label><input type="text" class="input_mother" /></div>
                    <div><label>স্বামী/স্ত্রীর নাম</label><input type="text" class="input_spouse" /></div>
                    <div><label>জন্ম তারিখ</label><input type="date" class="input_dob" /></div>
                    <div>
                        <label style="display:flex; justify-content:space-between">
                            জাতীয় পরিচয়পত্র
                            <span style="font-size: 10px; display: flex; gap: 5px;">
                                <span onclick="pullCustomerData(this)" style="color: blue; cursor: pointer; text-decoration: underline;">খুঁজুন (PULL)</span>
                                |
                                <span onclick="saveAsNewCustomer(this)" style="color: green; cursor: pointer; text-decoration: underline;">সেভ (SAVE)</span>
                            </span>
                        </label>
                        <input type="text" class="input_nid" placeholder="NID" />
                    </div>
                    <div><label>মোবাইল নম্বর</label><input type="text" class="input_mobile" /></div>
                    <div><label>ঠিকানা / গ্রাম</label><input type="text" class="input_address" /></div>
                </div>
            `;
    if (type === 'guarantor') {
        const identifierDiv = document.createElement('div');
        identifierDiv.className = 'grid-3';
        identifierDiv.style.marginTop = '10px';
        identifierDiv.innerHTML = `
                    <div><label>সনাক্তকারীর নাম</label><input type="text" class="input_identifier_name" /></div>
                    <div><label>সনাক্তকারীর ঠিকানা</label><input type="text" class="input_identifier_address" /></div>
                    <div>
                        <label>ধরণ</label>
                        <select class="input_guarantor_type">
                            <option value="guarantor">জামিনদারের তথ্য</option>
                            <option value="sharecropper">বর্গা চাষীদের ক্ষেত্রে</option>
                        </select>
                    </div>
                `;
        div.appendChild(identifierDiv);
    }
    container.appendChild(div);
}

function saveAsNewCustomer(element) {
    const entryDiv = element.closest('.dynamic-entry');
    const name = entryDiv.querySelector('.input_name')?.value.trim();
    const father = entryDiv.querySelector('.input_father')?.value.trim();
    const mother = entryDiv.querySelector('.input_mother')?.value.trim();
    const spouse = entryDiv.querySelector('.input_spouse')?.value.trim();
    const dob = entryDiv.querySelector('.input_dob')?.value.trim();
    const address = entryDiv.querySelector('.input_address')?.value.trim();
    const mobile = entryDiv.querySelector('.input_mobile')?.value.trim();
    const rawNid = entryDiv.querySelector('.input_nid')?.value.trim();

    if (!name || (!mobile && !rawNid)) {
        appToast('নাম এবং মোবাইল বা NID অবশ্যই পূরণ করতে হবে!');
        return;
    }

    let nid = rawNid;
    if (!nid) nid = 'TEMP-ID-' + Date.now();

    const payload = {
        applicant_nid: nid,
        applicant_name_bn: name,
        applicant_father_name_bn: father,
        applicant_mother_name_bn: mother,
        applicant_spouse_name_bn: spouse,
        applicant_dob: dob,
        applicant_curr_addr_village: address,
        applicant_mobile: mobile
    };

    if (window.parent && window.parent.ipcRenderer) {
        window.parent.ipcRenderer.invoke('db-save-customer', payload).then(res => {
            if (res.success) {
                appToast('গ্রাহক সফলভাবে ডেটাবেসে সংরক্ষিত হয়েছে!');
                // Also notify shell to refresh list if any list is open
                const frames = window.parent.document.querySelectorAll('iframe');
                frames.forEach(f => f.contentWindow?.postMessage({ command: 'REFRESH_CUSTOMER_LIST' }, '*'));
            } else {
                appToast('Error saving customer: ' + res.error);
            }
        }).catch(err => {
            appToast('Error saving customer: ' + err.message);
        });
    } else {
        appToast('Shell IPC renderer not found. Please run within Electron.', true);
    }
}

function pullCustomerData(element) {
    const input = element.parentElement.nextElementSibling;
    const searchValue = input.value.trim();
    if (!searchValue) {
        appToast('অনুগ্রহ করে মোবাইল বা NID নম্বর দিন', true);
        return;
    }
    // Ask Shell to pull customer
    window.parent.postMessage({ command: 'PULL_CUSTOMER', query: searchValue }, '*');

    // Register a one-time listener for the response to fill this specific block
    const pullListener = function (event) {
        if (event.data && event.data.command === 'PULL_CUSTOMER_RESPONSE') {
            window.removeEventListener('message', pullListener);
            const customer = event.data.customer;
            if (customer) {
                const entryDiv = element.closest('.dynamic-entry');
                const setVal = (cls, val) => { const el = entryDiv.querySelector(cls); if (el) el.value = val || ''; };

                setVal('.input_name', customer.applicant_name_bn || customer.applicant_name_en);
                setVal('.input_father', customer.applicant_father_name_bn);
                setVal('.input_mother', customer.applicant_mother_name_bn);
                setVal('.input_spouse', customer.applicant_spouse_name_bn);
                setVal('.input_dob', customer.applicant_dob);
                setVal('.input_address', customer.applicant_curr_addr_village || customer.applicant_present_upozila);
                setVal('.input_nid', customer.applicant_nid);
                setVal('.input_mobile', customer.applicant_mobile);
            } else {
                appToast('গ্রাহক পাওয়া যায়নি');
            }
        }
    };
    window.addEventListener('message', pullListener);
}

function generateAnnexurePage(type, title, dataArray) {
    if (!dataArray || dataArray.length <= 1) return;

    const page = document.createElement('div');
    page.className = 'page annexure-page';
    page.style.padding = '0';

    let html = `
                <div style="height: 14in; padding: 0.5in; box-sizing: border-box; position: relative; background: white;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; text-decoration: underline;">সংযোজনী (Annexure)</h3>
                        <h4 style="margin: 5px 0 0 0;">${title}</h4>
                    </div>
            `;

    for (let i = 1; i < dataArray.length; i++) {
        const item = dataArray[i];
        html += `
                    <div style="font-weight: bold; margin-bottom: 5px;">${toBanglaDigits(i + 1)}। ${title}</div>
                    <table class="loan-table" style="width: 100%; margin-bottom: 20px;">
                        <tr>
                            <td style="width: 50%; padding: 4px; vertical-align: top;">
                                <div style="display: flex;"><div style="width: 130px; display: flex; justify-content: space-between;"><span>I) নাম</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${item.name_bn || ''}</span></div></div>
                                <div style="display: flex;"><div style="width: 130px; display: flex; justify-content: space-between;"><span>II) পিতার নাম</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${item.father_name || ''}</span></div></div>
                                <div style="display: flex;"><div style="width: 130px; display: flex; justify-content: space-between;"><span>III) মাতার নাম</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${item.mother_name || ''}</span></div></div>
                                <div style="display: flex;"><div style="width: 130px; display: flex; justify-content: space-between;"><span>IV) স্বামী/স্ত্রীর নাম</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${item.spouse_name || ''}</span></div></div>
                            </td>
                            <td style="width: 50%; padding: 4px; vertical-align: top;">
                                <div style="display: flex;"><div style="width: 155px; white-space: nowrap;">V) জাতীয় পরিচয়পত্র নম্বর:</div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${toBanglaDigits(item.nid || '')}</span></div></div>
                                <div style="display: flex;"><div style="width: 155px; display: flex; justify-content: space-between;"><span>VI) জন্ম তারিখ</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${toBanglaDigits(item.dob || '')}</span></div></div>
                                <div style="display: flex;"><div style="width: 155px; display: flex; justify-content: space-between;"><span>VII) ঠিকানা</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${item.address || ''}</span></div></div>
                                <div style="display: flex;"><div style="width: 155px; display: flex; justify-content: space-between;"><span>VIII) মোবাইল নম্বর</span><span>:</span></div><div style="border-bottom: 1.5px dotted #000; flex-grow: 1; text-align: left; padding-left: 5px;"><span>${toBanglaDigits(item.mobile || '')}</span></div></div>
                            </td>
                        </tr>
                    </table>
                `;
    }

    html += `
                </div>
            `;
    page.innerHTML = html;
    // Append right before the modal so it's part of the printable document
    document.body.insertBefore(page, document.getElementById('dataEntryModal'));
}

// --- Land Management Logic ---
function renderLandTable() {
    var tbody = document.querySelector('#modal_land_table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    landData.forEach(function (item, index) {
        var tr = document.createElement('tr');
        tr.innerHTML = `
                    <td style="border: 1px solid #ddd; padding: 4px;">${item.type === 'own' ? 'নিজ' : item.type === 'share' ? 'বর্গা' : 'লিজ'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${item.mouza}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${item.khatian}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${item.dag}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">${toBanglaDigits(item.amount)}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; width: 1%; white-space: nowrap;">
                        <button onclick="deleteLand(${index})" style="padding: 2px 5px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Del</button>
                    </td>
                `;
        tbody.appendChild(tr);
    });
}

function addDynamicDagRow() {
    var container = document.getElementById('dynamic_dag_container');
    var div = document.createElement('div');
    div.className = 'dynamic-dag-row';
    div.style.cssText = 'display: flex; gap: 10px; margin-top: 1.5mm; align-items: flex-end;';
    div.innerHTML = `
                <div style="flex: none; width: 50px;">&nbsp;</div>
                <div style="flex: 0.7;">&nbsp;</div>
                <div style="flex: 1.5;">&nbsp;</div>
                <div style="flex: 1.2;">&nbsp;</div>
                <div style="flex: 1.2;">&nbsp;</div>
                <div style="display:flex; align-items: flex-end; flex: 2; gap:5px; position: relative; left: 7mm;">
                    <div style="display:flex; flex-direction:column; width: calc(130px - 4mm); text-align: center;">
                        <div class="row-dag-normal-container" style="display:flex; align-items:center; gap:2px;">
                            <input class="row-input-dag-no-1" type="text" style="padding: 4px; width: 48%; text-align: center;" />
                            <span>/</span>
                            <input class="row-input-dag-no-2" type="text" style="padding: 4px; width: 48%; text-align: center;" />
                        </div>
                        <div class="row-dag-bata-container" style="display:none; align-items:center; gap:2px;">
                            <div style="display:flex; flex-direction:column; width: 48%; border: 1px solid #ccc; border-radius: 3px;">
                                <input class="row-input-dag-batta-1-num" type="text" style="width: 100%; border: none; border-bottom: 1px solid #ccc; padding: 2px; text-align: center; font-size: 12px;" />
                                <input class="row-input-dag-batta-1-den" type="text" style="width: 100%; border: none; padding: 2px; text-align: center; font-size: 12px;" />
                            </div>
                            <span>/</span>
                            <div style="display:flex; flex-direction:column; width: 48%; border: 1px solid #ccc; border-radius: 3px;">
                                <input class="row-input-dag-batta-2-num" type="text" style="width: 100%; border: none; border-bottom: 1px solid #ccc; padding: 2px; text-align: center; font-size: 12px;" />
                                <input class="row-input-dag-batta-2-den" type="text" style="width: 100%; border: none; padding: 2px; text-align: center; font-size: 12px;" />
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:row; gap:4px; margin-bottom: 2px; flex-grow: 1;">
                        <button type="button" class="row-bata-dag-btn" style="font-size: 6.75pt; padding: 2px 8px; cursor: pointer; border: 1px solid #ccc; background: #eee; border-radius: 3px; white-space: nowrap;">বাটা দাগ</button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; flex: none; width: 95px; text-align: center;">
                    <input class="row-input-land-area" type="text" style="padding: 4px;" />
                </div>
                <div style="width: 82px; display: flex; justify-content: center; flex-shrink: 0; padding-bottom: 1px;">
                    <button type="button" onclick="this.parentElement.parentElement.remove()" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">মুছুন</button>
                </div>
            `;
    container.appendChild(div);

    div.querySelector('.row-bata-dag-btn').onclick = function () {
        var normal = div.querySelector('.row-dag-normal-container');
        var bata = div.querySelector('.row-dag-bata-container');
        if (normal.style.display === 'none') {
            normal.style.display = 'flex';
            bata.style.display = 'none';
        } else {
            normal.style.display = 'none';
            bata.style.display = 'flex';
        }
    };
}

function addLand() {
    var type = document.getElementById('input_land_ownership_type').value;
    var mouza = document.getElementById('input_land_mouza').value;
    var kt1 = document.getElementById('input_land_khatian_type_1_text').value;
    var kt2 = document.getElementById('input_land_khatian_type_2_text').value;
    var kn1 = document.getElementById('input_land_khatian_no_1').value;
    var kn2 = document.getElementById('input_land_khatian_no_2').value;
    var k_type = (kt1 ? kt1 : '') + (kt2 ? '/' + kt2 : '');
    var k_no = kn1 + (kn2 ? '/' + kn2 : '');

    var dt1 = document.getElementById('input_land_dag_type_1').value;
    var dt2 = document.getElementById('input_land_dag_type_2').value;

    function getDagNo(context) {
        var d_no = '';
        var amount = '';
        if (context === 'main') {
            if (document.getElementById('land_dag_bata_container').style.display !== 'none') {
                var b1n = document.getElementById('input_land_dag_batta_1_num').value;
                var b1d = document.getElementById('input_land_dag_batta_1_den').value;
                var b2n = document.getElementById('input_land_dag_batta_2_num').value;
                var b2d = document.getElementById('input_land_dag_batta_2_den').value;
                if (b1n || b1d) d_no = b1n + '/' + b1d + ((b2n || b2d) ? ' - ' + b2n + '/' + b2d : '');
            } else {
                var d1 = document.getElementById('input_land_dag_no_1').value;
                var d2 = document.getElementById('input_land_dag_no_2').value;
                if (d1 || d2) d_no = d1 + (d2 ? '/' + d2 : '');
            }
            amount = document.getElementById('input_land_area').value;
        } else {
            if (context.querySelector('.row-dag-bata-container').style.display !== 'none') {
                var b1n = context.querySelector('.row-input-dag-batta-1-num').value;
                var b1d = context.querySelector('.row-input-dag-batta-1-den').value;
                var b2n = context.querySelector('.row-input-dag-batta-2-num').value;
                var b2d = context.querySelector('.row-input-dag-batta-2-den').value;
                if (b1n || b1d) d_no = b1n + '/' + b1d + ((b2n || b2d) ? ' - ' + b2n + '/' + b2d : '');
            } else {
                var d1 = context.querySelector('.row-input-dag-no-1').value;
                var d2 = context.querySelector('.row-input-dag-no-2').value;
                if (d1 || d2) d_no = d1 + (d2 ? '/' + d2 : '');
            }
            amount = context.querySelector('.row-input-land-area').value;
        }
        return { no: d_no, amount: amount };
    }

    var d_type = (dt1 ? dt1 : '') + (dt2 ? '/' + dt2 : '');

    var main = getDagNo('main');
    var addedSomething = false;
    
    if (mouza && main.no && main.amount) {
        landData.push({
            type: type,
            mouza: mouza,
            k_type: k_type,
            k_no: k_no,
            khatian: (k_type + ' ' + k_no).trim(),
            d_type: d_type,
            d_no: main.no,
            dag: (d_type + ' ' + main.no).trim(),
            amount: main.amount
        });
        addedSomething = true;
    }
    document.querySelectorAll('#dynamic_dag_container .dynamic-dag-row').forEach(function (row) {
        var res = getDagNo(row);
        if (mouza && res.no && res.amount) {
            landData.push({
                type: type,
                mouza: mouza,
                k_type: k_type,
                k_no: k_no,
                khatian: (k_type + ' ' + k_no).trim(),
                d_type: d_type,
                d_no: res.no,
                dag: (d_type + ' ' + res.no).trim(),
                amount: res.amount
            });
            addedSomething = true;
        }
    });

    if (addedSomething) {
        renderLandTable();
        renderLandPage2();
        ['input_land_mouza', 'input_land_khatian_no_1', 'input_land_khatian_no_2', 'input_land_dag_no_1', 'input_land_dag_no_2', 'input_land_area',
            'input_land_dag_batta_1_num', 'input_land_dag_batta_1_den', 'input_land_dag_batta_2_num', 'input_land_dag_batta_2_den'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        document.getElementById('dynamic_dag_container').innerHTML = '';
        appToast('Land data added successfully!', false);
    } else {
        appToast('Failed to add land data. Please make sure Mouza, Dag No, and Area are filled.', true);
    }
}

function deleteLand(index) {
    landData.splice(index, 1);
    renderLandTable();
    renderLandPage2();
}

function syncKhatianDropdowns() {
    var sel1 = document.getElementById('input_land_khatian_type_1_select');
    var sel2 = document.getElementById('input_land_khatian_type_2_select');
    if (!sel1 || !sel2) return;

    var val1 = sel1.value;
    var val2 = sel2.value;

    Array.from(sel1.options).forEach(function (opt) {
        if (opt.value && opt.value !== 'write') {
            opt.disabled = (val2 !== '' && val2 !== 'write' && opt.value === val2);
        }
    });

    Array.from(sel2.options).forEach(function (opt) {
        if (opt.value && opt.value !== 'write') {
            opt.disabled = (val1 !== '' && val1 !== 'write' && opt.value === val1);
        }
    });
}

function renderLandPage2() {
    const types = { own: 'ক) নিজ মালিকানাধীন', share: 'খ) বর্গা চাষাধীন', lease: 'গ) লিজ জমি' };
    let totalLand = 0;

    // Collect unique sub-types across all entries for the header
    let allKhatianTypes = [...new Set(landData.flatMap(d => d.k_type.split('/')))].filter(t => t).join('/');
    let allDagTypes = [...new Set(landData.flatMap(d => d.d_type.split('/')))].filter(t => t).join('/');

    const hkt = document.getElementById('header_khatian_types');
    const hdt = document.getElementById('header_dag_types');
    if (hkt) hkt.innerText = allKhatianTypes ? '(' + allKhatianTypes + ')' : '';
    if (hdt) hdt.innerText = allDagTypes ? '(' + allDagTypes + ')' : '';

    const cropVal = document.getElementById('input_উৎপাদিতব‌্য ফসল')?.value || '';
    const loanAmtVal = toBanglaDigits(document.getElementById('input_loan_amount_num')?.value || '');

    const tbody = document.getElementById('land_table_body');
    if (tbody) {
        tbody.innerHTML = '';
        
        function generateTableHTML() {
            let html = '';
            for (let tKey in types) {
                let typeData = landData.filter(d => d.type === tKey);
                if (typeData.length === 0) {
                    html += `<tr style="height: 8mm;"><td style="text-align: left;">${types[tKey]}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
                    continue;
                }
                
                let mouzaGroups = [];
                let currentMouza = null;
                typeData.forEach(d => {
                    if (d.mouza !== currentMouza) {
                        mouzaGroups.push({ name: d.mouza, items: [d] });
                        currentMouza = d.mouza;
                    } else {
                        mouzaGroups[mouzaGroups.length - 1].items.push(d);
                    }
                });

                let typeRowSpan = typeData.length;
                let isFirstOfType = true;

                mouzaGroups.forEach(group => {
                    let isFirstOfMouza = true;
                    group.items.forEach(d => {
                        html += `<tr style="height: 8mm;">`;
                        
                        if (isFirstOfType) {
                            html += `<td rowspan="${typeRowSpan}" style="text-align: left;">${types[tKey]}</td>`;
                        }
                        
                        if (isFirstOfMouza) {
                            html += `<td rowspan="${group.items.length}">${d.mouza}</td>`;
                        }
                        
                        html += `<td>${d.k_no}</td>`;
                        html += `<td>${d.d_no}</td>`;
                        html += `<td>${toBanglaDigits(d.amount)}</td>`;
                        
                        if (isFirstOfType) {
                            html += `<td rowspan="${typeRowSpan}">${cropVal}</td>`;
                            html += `<td rowspan="${typeRowSpan}">${loanAmtVal}</td>`;
                            isFirstOfType = false;
                        }
                        
                        html += `</tr>`;
                        isFirstOfMouza = false;
                        totalLand += parseFloat(toEnglishDigits(d.amount)) || 0;
                    });
                });
            }
            return html;
        }

        if (landData.length > 4) {
            tbody.innerHTML = `<tr><td colspan="7" style="height: 12mm; text-align: center; font-weight: bold; font-size: 14pt;">বিস্তারিত সংযোজনী-১ এ দ্রষ্টব্য</td></tr>`;
            
            let annex = document.getElementById('land_annexure_page');
            if (!annex) {
                annex = document.createElement('div');
                annex.id = 'land_annexure_page';
                annex.className = 'page a4-page';
                annex.innerHTML = `
                    <div style="padding: 15mm;">
                        <h2 style="text-align: center; text-decoration: underline; margin-bottom: 20px;">সংযোজনী-১</h2>
                        <h3 style="text-align: center; margin-bottom: 20px;">জমির বিস্তারিত বিবরণ</h3>
                        <table class="loan-table" style="width: 100%; text-align: center; margin-top: 10mm;">
                            <thead>
                                <tr>
                                    <th style="width: 10%;">মালিকানার ধরণ</th>
                                    <th style="width: 10%;">মৌজার নাম</th>
                                    <th style="width: 20%;">খতিয়ান নং</th>
                                    <th style="width: 20%;">দাগ নং</th>
                                    <th style="width: 8%;">জমির পরিমাণ</th>
                                    <th style="width: 15%;">ফসল/খাতের নাম</th>
                                    <th style="width: 15%;">ঋণের পরিমাণ</th>
                                </tr>
                            </thead>
                            <tbody id="annexure_land_table_body"></tbody>
                        </table>
                    </div>
                `;
                document.body.appendChild(annex);
            }
            totalLand = 0;
            let tableHtml = generateTableHTML();
            tableHtml += `<tr><td colspan="4" style="text-align: right; font-weight: bold; padding-right: 2mm;">মোট জমির পরিমাণ</td><td style="font-weight: bold;">${toBanglaDigits(totalLand.toFixed(2))}</td><td colspan="2"></td></tr>`;
            document.getElementById('annexure_land_table_body').innerHTML = tableHtml;
        } else {
            const annex = document.getElementById('land_annexure_page');
            if (annex) annex.remove();
            tbody.innerHTML = generateTableHTML();
        }
    }
    const totalEl = document.getElementById('land_total_area');
    if (totalEl) totalEl.innerText = toBanglaDigits(totalLand.toFixed(2));

    // Populate Recommendation Table (Table 12)
    const recSector = document.getElementById('recommendation_1_sector');
    const recArea = document.getElementById('recommendation_1_land_area');
    const recLimit = document.getElementById('recommendation_1_per_acre_limit');
    const recLoan = document.getElementById('recommendation_1_recommended_loan');

    if (recSector) recSector.innerText = cropVal;
    if (recArea) recArea.innerText = toBanglaDigits(totalLand.toFixed(2));
    if (recLimit) recLimit.innerText = toBanglaDigits(document.getElementById('input_per_acre_limit')?.value || '');
    if (recLoan) recLoan.innerText = loanAmtVal;

    // Populate Point 5 RCC Table (Page 1)
    const rccSector1 = document.getElementById('rcc_table_1_sector');
    const rccAmount1 = document.getElementById('rcc_table_1_amount');
    if (rccSector1) rccSector1.innerText = cropVal;
    if (rccAmount1) rccAmount1.innerText = loanAmtVal;
}

function setupLiveEvents() {
    // 1. Age Calculation
    const dobInput = document.getElementById('input_applicant_dob');
    if (dobInput) {
        dobInput.addEventListener('change', function () {
            const dob = parseAnyDate(this.value);
            if (dob) {
                const age = Math.floor((new Date() - dob) / (31557600000));
                const ageInput = document.getElementById('input_applicant_age');
                if (ageInput) ageInput.value = toBanglaDigits(age);
            }
        });
    }

    // 2. Disbursement Totaling (Cash + Materials)
    const cashIn = document.getElementById('input_loan_disbursement_cash_amount');
    const matIn = document.getElementById('input_loan_disbursement_materials_amount');
    const totalIn = document.getElementById('input_loan_amount_num');

    const calcTotal = () => {
        const cash = parseFloat(toEnglishDigits(cashIn.value)) || 0;
        const mat = parseFloat(toEnglishDigits(matIn.value)) || 0;
        totalIn.value = toBanglaDigits(cash + mat);
        totalIn.dispatchEvent(new Event('input')); // Trigger words update
    };

    if (cashIn) cashIn.addEventListener('input', calcTotal);
    if (matIn) matIn.addEventListener('input', calcTotal);

    // 3. LF Totaling
    const lfPrincipal = document.getElementById('input_lf_principal_amount');
    const lfInterest = document.getElementById('input_lf_interest_amount');
    const lfTotal = document.getElementById('input_lf_total_amount');

    const calcLFTotal = () => {
        const p = parseFloat(toEnglishDigits(lfPrincipal.value)) || 0;
        const i = parseFloat(toEnglishDigits(lfInterest.value)) || 0;
        lfTotal.value = toBanglaDigits(p + i);
    };

    if (lfPrincipal) lfPrincipal.addEventListener('input', calcLFTotal);
    if (lfInterest) lfInterest.addEventListener('input', calcLFTotal);

    // 4. Amount to Words
    const amtInput = document.getElementById('input_loan_amount_num');
    if (amtInput) {
        amtInput.addEventListener('input', function () {
            let val = toEnglishDigits(this.value);
            const words = numberToBanglaWords(val);
            const wordsInput = document.getElementById('input_loan_total_amount_words');
            if (wordsInput) wordsInput.value = words ? words + ' টাকা মাত্র' : '';

            // Also update loc_amount_words live
            const enWords = val ? numberToEnglishWords(val).toUpperCase() : '';
            updateFormattedSpan('loc_amount_words', enWords);
        });
    }

    // Expiry Date Calculation
    function calculateExpiry() {
        const approvalDateVal = document.getElementById('input_loan_approval_date').value;
        const termVal = parseInt(toEnglishDigits(document.getElementById('input_loan_term_months').value)) || 0;
        const date = parseAnyDate(approvalDateVal);
        if (date && termVal) {
            date.setMonth(date.getMonth() + termVal);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const expiryInput = document.getElementById('input_loan_expiry_date');
            if (expiryInput) expiryInput.value = toBanglaDigits(`${day}/${month}/${year}`);
        }
    }
    document.getElementById('input_loan_approval_date')?.addEventListener('change', calculateExpiry);
    document.getElementById('input_loan_term_months')?.addEventListener('input', calculateExpiry);

    // 5. Land Logic UI
    document.getElementById('bata_dag_btn')?.addEventListener('click', function () {
        var normal = document.getElementById('land_dag_normal_container');
        var bata = document.getElementById('land_dag_bata_container');
        if (normal.style.display === 'none') {
            normal.style.display = 'flex';
            bata.style.display = 'none';
        } else {
            normal.style.display = 'none';
            bata.style.display = 'flex';
        }
    });

    // 6. Khatian/Dag Sync Dropdowns
    window.handleKhatianSelect = function (num) {
        var sel = document.getElementById('input_land_khatian_type_' + num + '_select');
        var inp = document.getElementById('input_land_khatian_type_' + num + '_text');
        if (sel.value === 'write') {
            sel.style.display = 'none';
            inp.style.display = 'block';
            inp.value = '';
            syncKhatianDropdowns();
            inp.focus();
        } else {
            inp.value = sel.value;
            syncKhatianToDag(num);
        }
    };
    window.resetKhatianSelect = function (num) {
        var sel = document.getElementById('input_land_khatian_type_' + num + '_select');
        var inp = document.getElementById('input_land_khatian_type_' + num + '_text');
        inp.style.display = 'none';
        sel.style.display = 'block';
        sel.value = '';
        syncKhatianDropdowns();
        syncKhatianToDag(num);
    };
    window.syncKhatianToDag = function (num) {
        var val = document.getElementById('input_land_khatian_type_' + num + '_text').value;
        document.getElementById('input_land_dag_type_' + num).value = val;
    };

    document.getElementById('add_more_dag_btn')?.addEventListener('click', addDynamicDagRow);
    document.getElementById('add_land_btn')?.addEventListener('click', addLand);
    applyBranchInfo();
}

function handleNumericInput(input) {
    input.value = toBanglaDigits(toEnglishDigits(input.value).replace(/[^0-9.]/g, ''));
}
// --- Utility Helpers ---
function toBanglaDigits(str) { return str.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]); }
function toEnglishDigits(str) { return str.toString().replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d)); }

function formatToBanglaDate(dateStr) {
    if (!dateStr) return '';
    const date = parseAnyDate(dateStr);
    if (!date) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return toBanglaDigits(`${d}/${m}/${y}`);
}

function formatToEnglishDate(dateStr) {
    if (!dateStr) return '';
    const date = parseAnyDate(dateStr);
    if (!date) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function parseAnyDate(str) {
    if (!str) return null;
    var engStr = toEnglishDigits(str);
    var d = new Date(engStr);
    if (!isNaN(d.getTime())) return d;
    var parts = engStr.match(/(\d+)[\/\-. ](\d+)[\/\-. ](\d+)/);
    if (parts) return new Date(parts[3], parts[2] - 1, parts[1]);
    return null;
}

function numberToBanglaWords(n) {
    n = parseInt(n) || 0;
    if (n === 0) return '';
    const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'ঊনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
    const convert = (num) => {
        if (num < 100) return units[num];
        if (num < 1000) return units[Math.floor(num / 100)] + " শত" + (num % 100 !== 0 ? " " + convert(num % 100) : "");
        if (num < 100000) return convert(Math.floor(num / 1000)) + " হাজার" + (num % 1000 !== 0 ? " " + convert(num % 1000) : "");
        if (num < 10000000) return convert(Math.floor(num / 100000)) + " লক্ষ" + (num % 100000 !== 0 ? " " + convert(num % 100000) : "");
        return convert(Math.floor(num / 10000000)) + " কোটি" + (num % 10000000 !== 0 ? " " + convert(num % 10000000) : "");
    };
    return convert(n);
}

// --- Global Input Formatter ---
document.addEventListener('input', function (e) {
    if (e.target.tagName === 'INPUT' && e.target.closest('.modal')) {
        const id = e.target.id;
        const val = e.target.value;
        const enFields = ['input_applicant_name_en', 'input_doc_sacp_bank_branch'];
        const wordFields = ['input_loan_total_amount_words'];

        if (enFields.includes(id)) {
            e.target.value = val.toUpperCase();
        } else if (wordFields.includes(id)) {
            // Allow Bangla text for words
        } else if (e.target.type !== 'date') {
            e.target.value = toBanglaDigits(val);
        }
    }
});

function handleApplicantTypeChange(val) {
    if (val === 'repeat') {
        document.getElementById('searchLoanModal').style.display = 'flex';
        document.getElementById('input_applicant_type').value = '';
        executeLoanSearch(true);
    }
}

function closeSearchLoanModal() {
    document.getElementById('searchLoanModal').style.display = 'none';
    document.getElementById('loanSearchInput').value = '';
    document.getElementById('loanSearchResults').innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #777;">Enter NID or Mobile to search.</td></tr>';
}

let currentSearchItems = [];
let currentSearchPage = 1;
const ITEMS_PER_PAGE = 10;

async function executeLoanSearch(showAll = false) {
    const query = (document.getElementById('loanSearchInput')?.value || '').trim();
    if (!showAll && !query) {
        showAll = true;
    }

    const resultsTbody = document.getElementById('loanSearchResults');
    resultsTbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">Searching...</td></tr>';

    try {
        let customers = [];
        if (window.parent && window.parent.ipcRenderer) {
            customers = await window.parent.ipcRenderer.invoke('db-search-customers', showAll ? '' : query);
        } else {
            const customersStr = window.AppStorage.getItem('bkb_customers') || '[]';
            try { customers = JSON.parse(customersStr); } catch (e) { }
            if (!showAll && query) {
                customers = customers.filter(c =>
                    (c.applicant_nid && c.applicant_nid.includes(query)) ||
                    (c.applicant_mobile && c.applicant_mobile.includes(query)) ||
                    (c.applicant_name_bn && c.applicant_name_bn.includes(query)) ||
                    (c.applicant_name_en && c.applicant_name_en.toLowerCase().includes(query.toLowerCase()))
                );
            }
        }

        currentSearchItems = [];
        customers.forEach(c => {
            let cLoans = [];
            try {
                if (c.loans) cLoans = (typeof c.loans === 'string') ? JSON.parse(c.loans) : c.loans;
            } catch (e) { }

            if (cLoans && cLoans.length > 0) {
                cLoans.forEach(l => {
                    currentSearchItems.push({ customer: c, loan: l });
                });
            }
        });

        currentSearchPage = 1;
        renderLoanSearchPage();
    } catch (err) {
        console.error("Search failed:", err);
        resultsTbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #dc3545;">Search failed.</td></tr>';
    }
}

function renderLoanSearchPage() {
    const resultsTbody = document.getElementById('loanSearchResults');
    if (currentSearchItems.length === 0) {
        resultsTbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #dc3545;">No matching customers found.</td></tr>';
        document.getElementById('searchPageIndicator').innerText = 'Page 1 of 1';
        document.getElementById('prevSearchPageBtn').disabled = true;
        document.getElementById('nextSearchPageBtn').disabled = true;
        return;
    }

    const totalPages = Math.ceil(currentSearchItems.length / ITEMS_PER_PAGE);
    if (currentSearchPage < 1) currentSearchPage = 1;
    if (currentSearchPage > totalPages) currentSearchPage = totalPages;

    const startIndex = (currentSearchPage - 1) * ITEMS_PER_PAGE;
    const pageItems = currentSearchItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    let html = '';
    pageItems.forEach(item => {
        const c = item.customer;
        const l = item.loan;

        const dataPayload = encodeURIComponent(JSON.stringify({ customer: c, loan: l }));
        const nidParam = encodeURIComponent(c.applicant_nid || '');
        const caseParam = encodeURIComponent(l.loan_case_no || '');

        html += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${c.applicant_name_bn || c.applicant_name_en || ''}</td>
                    <td style="padding: 8px;">${c.applicant_mobile || ''}</td>
                    <td style="padding: 8px;">${c.applicant_nid || ''}</td>
                    <td style="padding: 8px;">${l.loan_case_no || ''}</td>
                    <td style="padding: 8px;">
                        <input type="text" id="loan_ac_input_${l.loan_case_no}" value="${l.loan_account_no || ''}" style="width: 100px; padding: 4px; font-size: 13px;" placeholder="Account No" />
                    </td>
                    <td style="padding: 8px;">${l.sanction_amount || ''}</td>
                    <td style="padding: 8px; text-align: center; white-space: nowrap;">
                        <button type="button" onclick="loadRepeatLoan('${dataPayload}')" style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Select</button>
                        <button type="button" onclick="saveLoanRecord('${nidParam}', '${caseParam}')" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; margin-left: 2px;">Save</button>
                        <button type="button" onclick="deleteLoanRecord('${nidParam}', '${caseParam}')" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; margin-left: 2px;">Delete</button>
                    </td>
                </tr>`;
    });

    resultsTbody.innerHTML = html;
    document.getElementById('searchPageIndicator').innerText = `Page ${currentSearchPage} of ${totalPages}`;
    document.getElementById('prevSearchPageBtn').disabled = (currentSearchPage === 1);
    document.getElementById('nextSearchPageBtn').disabled = (currentSearchPage === totalPages);
}

function changeSearchPage(delta) {
    currentSearchPage += delta;
    renderLoanSearchPage();
}

async function saveLoanRecord(encodedNid, encodedCase) {
    if (!window.parent || !window.parent.ipcRenderer) {
        appToast('Database connection unavailable.', true);
        return;
    }
    const nid = decodeURIComponent(encodedNid);
    const loanCase = decodeURIComponent(encodedCase);
    const acInput = document.getElementById(`loan_ac_input_${loanCase}`);
    const newAc = acInput ? acInput.value.trim() : '';

    try {
        const customer = await window.parent.ipcRenderer.invoke('db-get-customer', nid);
        if (!customer) throw new Error('Customer not found in DB.');

        let loans = [];
        if (customer.loans) {
            loans = typeof customer.loans === 'string' ? JSON.parse(customer.loans) : customer.loans;
        }
        const loanIndex = loans.findIndex(l => l.loan_case_no === loanCase);
        if (loanIndex >= 0) {
            loans[loanIndex].loan_account_no = newAc;
            customer.loans = JSON.stringify(loans);

            // As per requirement: "add the loan case no in the customer profiles Status field"
            if (newAc) {
                customer.applicant_status = `Loan AC: ${newAc}`;
            } else {
                customer.applicant_status = `Loan Case: ${loanCase}`;
            }

            const res = await window.parent.ipcRenderer.invoke('db-save-customer', customer);
            if (res.success) {
                appToast('✅ Loan Account Number updated successfully!');
                // Refresh the list seamlessly
                executeLoanSearch(document.getElementById('loanSearchInput')?.value.trim() === '');
            } else {
                appToast('Error updating loan: ' + res.error);
            }
        } else {
            appToast('Loan record not found.', true);
        }
    } catch (e) {
        appToast('Error: ' + e.message);
    }
}

async function deleteLoanRecord(encodedNid, encodedCase) {
    if (!window.parent || !window.parent.ipcRenderer) {
        appToast('Database connection unavailable.', true);
        return;
    }
    if (!confirm('Are you sure you want to delete this loan record?')) return;

    const nid = decodeURIComponent(encodedNid);
    const loanCase = decodeURIComponent(encodedCase);

    try {
        const customer = await window.parent.ipcRenderer.invoke('db-get-customer', nid);
        if (!customer) throw new Error('Customer not found in DB.');

        let loans = [];
        if (customer.loans) {
            loans = typeof customer.loans === 'string' ? JSON.parse(customer.loans) : customer.loans;
        }
        const newLoans = loans.filter(l => l.loan_case_no !== loanCase);

        customer.loans = JSON.stringify(newLoans);
        const res = await window.parent.ipcRenderer.invoke('db-save-customer', customer);
        if (res.success) {
            appToast('✅ Loan record deleted successfully!');
            executeLoanSearch(document.getElementById('loanSearchInput')?.value.trim() === '');
        } else {
            appToast('Error deleting loan: ' + res.error);
        }
    } catch (e) {
        appToast('Error: ' + e.message);
    }
}

function loadRepeatLoan(encodedPayload) {
    try {
        const payload = JSON.parse(decodeURIComponent(encodedPayload));
        const c = payload.customer;
        const l = payload.loan;

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) { el.value = val || ''; el.dispatchEvent(new Event('input')); } };
        setVal('input_applicant_name_bn', c.applicant_name_bn);
        setVal('input_applicant_name_en', c.applicant_name_en);
        setVal('input_applicant_father_name_bn', c.applicant_father_name_bn);
        setVal('input_applicant_mother_name_bn', c.applicant_mother_name_bn);
        setVal('input_applicant_dob', c.applicant_dob);
        setVal('input_applicant_nid', c.applicant_nid);
        setVal('input_applicant_mobile', c.applicant_mobile);
        setVal('input_applicant_curr_addr_house', c.applicant_curr_addr_house);
        setVal('input_applicant_curr_addr_village', c.applicant_curr_addr_village);
        setVal('input_applicant_curr_addr_post', c.applicant_curr_addr_post);
        setVal('input_applicant_curr_addr_union', c.applicant_curr_addr_union);
        setVal('input_applicant_curr_addr_thana', c.applicant_present_upozila);
        setVal('input_applicant_curr_addr_district', c.applicant_present_district);

        setVal('input_loan_amount_num', l.sanction_amount);
        setVal('input_section_12_crop_name', l.sector);

        // setVal('input_loan_case_no', '');
        setVal('input_loan_approval_date', '');

        closeSearchLoanModal();
        appToast('✅ Loan data loaded! Enter a new Loan Case No to save as a new entry.');
    } catch (e) {
        console.error(e);
        appToast('Failed to load loan data.', true);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('span, div').forEach(el => {
        if (el.style.borderBottom && el.style.borderBottom.includes('dotted')) {
            if (!el.closest('table')) {
                el.classList.add('flexible-dotted');
            }
        }
    });
    setupLiveEvents();
    setTimeout(autoFetchInterestRate, 100);
});

// Deposit Loan Logic //

(function() {
    // Only run if on the Deposit Loan form
    const modalCheck = document.getElementById('input-modal');
    if (!modalCheck) return;

    window.toBanglaNumber = window.toBanglaDigits;
    window.toEnglishNumber = window.toEnglishDigits;

    // Alias the global account number formatter
    const formatAccNo = window.formatAccNo || function(raw) {
        if (!raw) return '';
        const clean = String(raw).replace(/-/g, '').replace(/\D/g, '');
        const fmt = clean.length > 4 ? clean.substring(0, 4) + '-' + clean.substring(4) : clean;
        const enToBnMap = {'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'};
        return fmt.replace(/[0-9]/g, m => enToBnMap[m]);
    };


// Polyfill AppStorage within iframe context
window.AppStorage = window.AppStorage || window.parent.AppStorage || {
    getItem: function (k) { return localStorage.getItem(k); },
    setItem: function (k, v) { localStorage.setItem(k, v); },
    removeItem: function (k) { localStorage.removeItem(k); }
};

window.applyCentralBranchInfo = function() {
    if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
        const central = window.parent.getCentralBranchData();
        const address = [central.thanaBn, central.districtBn].filter(Boolean).join(', ');

        const mappings = {
            'branch_name': central.nameBn,
            'branch_address': address,
            'branch_email': central.email,
            'branch_mobile': central.mobile ? toBanglaNumber(central.mobile) : (central.tel ? toBanglaNumber(central.tel) : '')
        };

        for (let cls in mappings) {
            const els = document.getElementsByClassName(cls);
            for (let el of els) el.innerText = mappings[cls] || '';
        }
    }
}

window.clearData = function() {
    if (confirm("Are you sure you want to clear all form data?")) {
        document.getElementById('dataForm').reset();
        window.AppStorage.removeItem('deposit_loan_form_draft');
        location.reload();
    }
}

window.generateWords = function() {
    const amt = document.getElementById('input_loan_amount_num').value;
    const words = numberToBanglaWords(toEnglishNumber(amt));
    document.getElementById('input_loan_amount_words').value = words ? words + " টাকা মাত্র" : "";
}



window.updatePrefix = function() {
    const el = document.getElementById('input_loan_type');
    const val = el ? el.value : '';
    const prefixEl = document.getElementById('acc_prefix');
    if (prefixEl) prefixEl.innerText = val ? val + '-' : '';
}

window.calculateDueDate = function() {
    const dateStr = toEnglishNumber(document.getElementById('input_application_date').value);
    const durationStr = document.getElementById('input_loan_term').value;
    const dueDateEl = document.getElementById('input_loan_expiry_date');

    if (!dateStr || !durationStr) {
        dueDateEl.value = '';
        return;
    }

    // Parse Date (DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY)
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length !== 3) return;

    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // JS months are 0-11
    let year = parseInt(parts[2], 10);

    if (year < 100) year += 2000; // Handle 2-digit year

    const date = new Date(year, month, day);

    // Parse Duration
    const match = durationStr.match(/(\d+)/);
    if (!match) return;
    let durationVal = parseInt(match[1], 10);

    if (/year|eQi/i.test(durationStr)) {
        date.setFullYear(date.getFullYear() + durationVal);
    } else {
        date.setMonth(date.getMonth() + durationVal);
    }

    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    dueDateEl.value = `${d}/${m}/${y}`;
}

/**
 * Helper to set content of elements by ID or Class.
 * If value contains HTML tags, it uses innerHTML.
 */
window.setElementValue = function(target, value) {
    const isHTML = /<[a-z][\s\S]*>/i.test(value);

    const el = document.getElementById(target);
    if (el) el[isHTML ? 'innerHTML' : 'innerText'] = value;

    const classEls = document.getElementsByClassName(target);
    for (let e of classEls) e[isHTML ? 'innerHTML' : 'innerText'] = value;
}

window.populateData = function() {
    const caseNo = document.getElementById('input_loan_case_no').value;
    const loanType = document.getElementById('input_loan_type').value;
    const year = document.getElementById('input_fiscal_year').value;
    const combinedLoanCaseHTML = `${toBanglaNumber(caseNo)}(<span class="english-font">${loanType}</span>)/${toBanglaNumber(year)}`;

    setElementValue('loan_case_no', combinedLoanCaseHTML);

    const accNo = document.getElementById('input_deposit_account_no').value;
    const combinedAccHTML = `<span class="english-font">${loanType}-</span>${formatAccNo(accNo)}`;
    setElementValue('deposit_account_no', combinedAccHTML);
    setElementValue('deposit_account_no_only', formatAccNo(accNo));

    const loanTypeEnglishHTML = `<span class="english-font">${loanType}</span>`;
    setElementValue('loan_type_en', loanTypeEnglishHTML);

    const map = {
        'input_applicant_mobile': 'applicant_mobile',
        'input_applicant_name_bn': 'applicant_name_bn',
        'input_applicant_father_name_bn': 'applicant_father_name_bn',
        'input_applicant_present_address': 'applicant_present_address',
        'input_loan_purpose': 'loan_purpose',
        'input_deposit_balance': 'deposit_balance',
        'input_loan_amount_num': 'loan_amount_num',
        'input_loan_amount_words': 'loan_amount_words',
        'input_loan_interest_rate': 'loan_interest_rate',
        'input_loan_term': 'loan_term',
        'input_loan_expiry_date': 'loan_expiry_date',
        'input_application_date': 'app_date',
        'input_sb_account_no': 'sb_account_no',
        'input_deposit_fdr_no': 'deposit_fdr_no' // New mapping for FDR
    };

    const extraMap = {
        'input_loan_amount_num': 'loan_max_amount_num',
        'input_loan_amount_words': 'loan_max_amount_words'
    };

    for (let id in map) {
        const elInp = document.getElementById(id);
        let val = elInp ? elInp.value : '';

        if (id === 'input_applicant_father_name_bn') {
            let genderVal = '';
            const genderEl = document.getElementById('input_applicant_gender');
            if (genderEl) genderVal = (genderEl.value || '').toLowerCase();
            const isMale = genderVal === 'male' || genderVal === 'পুরুষ';

            let isHusband = val.includes('স্বামী') || val.includes('স্বামীর');
            if (isMale) isHusband = false;

            let cleanVal = val.replace(/^(স্বামী|স্বামীর)[\s:\-]*/, '').trim();
            setElementValue(map[id], cleanVal);

            const fatherHusbandEls = document.getElementsByClassName('label_father_husband');
            for (let el of fatherHusbandEls) {
                if (el.innerText.includes('২।')) {
                    el.innerHTML = isHusband ? '২। <del>পিতা</del>/স্বামীর নাম' : '২। পিতা/<del>স্বামীর</del> নাম';
                } else {
                    el.innerHTML = isHusband ? '<del>পিতা</del>/স্বামী' : 'পিতা/<del>স্বামী</del>';
                }
            }
        } else if (id.includes('loan_amount_num') || id === 'input_deposit_balance') {
            val = toBanglaNumber(val) + (val ? '/-' : '');
        } else if (id === 'input_loan_interest_rate') {
            val = toBanglaNumber(val) + (val ? '%' : '');
        } else if (id === 'input_loan_term') {
            val = toBanglaNumber(val) + (val ? ' মাস' : '');
        } else if (id === 'input_application_date' || id === 'input_loan_expiry_date') {
            val = toBanglaNumber(val) + (val ? ' ইং' : '');
        } else if (id === 'input_applicant_mobile') {
            val = toBanglaNumber(val);
        } else if (id === 'input_sb_account_no') {
            val = formatAccNo(val);
        }

        if (id !== 'input_applicant_father_name_bn') {
            setElementValue(map[id], val);
        }
    }

    // Handle payment method text
    const sbAccVal = document.getElementById('input_sb_account_no')?.value;
    const paymentEls = document.getElementsByClassName('payment_method_text');
    for (let el of paymentEls) {
        if (!sbAccVal) {
            el.innerHTML = '<del>নং হিসাবের মাধ্যমে/</del>নগদ';
        } else {
            el.innerHTML = 'নং হিসাবের মাধ্যমে/<del>নগদ</del>';
        }
    }

    // Handle ref_principal_para separately
    const elBal = document.getElementById('input_deposit_balance');
    const dpsBalVal = elBal ? elBal.value : '';
    if (dpsBalVal) {
        setElementValue('deposit_balance_para', ': ' + toBanglaNumber(dpsBalVal) + '/-');
    } else {
        setElementValue('deposit_balance_para', '');
    }

    for (let id in extraMap) {
        const elEx = document.getElementById(id);
        let val = elEx ? elEx.value : '';
        if (id === 'input_loan_amount_num' && val) {
            val = toBanglaNumber(val) + '/-';
        }
        setElementValue(extraMap[id], val);
    }

    closeModal();
}

window.showModal = function() {
    updateSuggestions();
    const modal = document.getElementById('input-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

window.closeModal = function() {
    const modal = document.getElementById('input-modal');
    if (modal) modal.style.display = 'none';
}

window.clearData = function() {
    if (confirm("Are you sure you want to clear all form data?")) {
        document.getElementById('dataForm').reset();
        window.AppStorage.removeItem('deposit_loan_form_draft');
        location.reload();
    }
}

window.formatDateInput = function(input) {
    let v = input.value.replace(/[^0-9০-৯]/g, '').slice(0, 8);
    if (v.length >= 5) {
        input.value = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    } else if (v.length >= 3) {
        input.value = v.slice(0, 2) + '/' + v.slice(2);
    } else {
        input.value = v;
    }
}

window.setDateFromPicker = function(picker, textInputId) {
    const textInput = document.getElementById(textInputId);
    if (picker.value) {
        const parts = picker.value.split('-'); // YYYY-MM-DD
        textInput.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
        if (textInputId === 'input_application_date') calculateDueDate();
    }
}

// Auto-save logic to persist data while typing
window.autoSave = function() {
    const formData = {};
    const inputs = document.querySelectorAll('#dataForm input');
    inputs.forEach(input => {
        formData[input.id] = input.value;
    });
    window.AppStorage.setItem('deposit_loan_form_draft', JSON.stringify(formData));
}

window.loadDraft = function() {
    const saved = window.AppStorage.getItem('deposit_loan_form_draft');
    if (saved) {
        const data = JSON.parse(saved);
        for (const id in data) {
            const el = document.getElementById(id);
            if (el) el.value = data[id];
        }
        // Refresh calculated fields
        updatePrefix();
        generateWords();
        calculateDueDate();
    }
}

window.addEventListener('message', function (event) {
    if (!event.data) return;

    if (event.data.type === 'BRANCH_INFO_UPDATED') {
        applyCentralBranchInfo();
    }

    // Handle GET_FORM_DATA for Shell Persistence
    if (event.data.command === 'GET_FORM_DATA') {
        const formData = {};
        const inputs = document.querySelectorAll('#dataForm input');
        inputs.forEach(input => {
            formData[input.id.replace('input_', '')] = input.value;
        });
        event.source.postMessage({ command: 'FORM_DATA_RESPONSE', data: formData }, event.origin);
    }

    // Handle EXECUTE_ACTION from App Shell Control Panel
    if (event.data.command === 'EXECUTE_ACTION') {
        switch (event.data.actionId) {
            case 'btn-data-entry': showModal(); break;
            case 'btn-start-new': clearData(); break;
            case 'btn-clear-form': clearData(); break;
            case 'btn-print-form': 
                if (window.top !== window.self) {
                    window.top.document.getElementById('btn-print-form').click();
                } else {
                    window.print();
                }
                break;
            case 'btn-save-form': populateData(); break;
        }
    }

    // Handle customer data injection (FILL command)
    if (event.data.command === 'FILL') {
        const data = event.data.data;
        if (!data) return;

        // Map master database keys to modal input IDs per Placeholder.md
        const mapping = {
            'applicant_name_bn': 'input_applicant_name_bn',
            'applicant_father_name_bn': 'input_applicant_father_name_bn',
            'applicant_mobile': 'input_applicant_mobile',
            'applicant_nid': 'input_applicant_nid',
            'loan_amount_num': 'input_loan_amount_num',
            'loan_amount_words': 'input_loan_amount_words',
            'application_date': 'input_application_date',
            'loan_case_no': 'input_loan_case_no',
            'fiscal_year': 'input_fiscal_year',
            'deposit_account_no': 'input_deposit_account_no',
            'loan_interest_rate': 'input_loan_interest_rate',
            'loan_term': 'input_loan_term',
            'loan_expiry_date': 'input_loan_expiry_date'
        };

        Object.keys(mapping).forEach(key => {
            if (data[key] !== undefined) {
                const el = document.getElementById(mapping[key]);
                if (el) el.value = data[key];
            }
        });

        // Auto-assemble address if individual parts are provided
        if (data.applicant_present_district) {
            let addr = data.applicant_present_upozila ? data.applicant_present_upozila + ', ' : '';
            addr += data.applicant_present_district;
            document.getElementById('input_applicant_present_address').value = addr;
        }

        // Trigger field dependencies
        updatePrefix();
        generateWords();
        calculateDueDate();
        populateData(); // Flow to form spans
    }
});

// Centralized Initialization
window.addEventListener('load', () => {
    applyCentralBranchInfo();
    loadDraft();
    updateSuggestions();
    document.getElementById('dataForm').addEventListener('input', autoSave);
});

window.DepositLoanLogic = {
    openModal: showModal,
    startNewForm: clearData,
    clearData: clearData,
    populate: function (data) {
        if (!data) return;
        
        const gender = (data.applicant_gender || '').toLowerCase();
        const isFemale = gender === 'female' || gender === 'মহিলা';
        
        let displayFatherHusband = data.applicant_father_name_bn || '';
        if (isFemale && data.applicant_spouse_name_bn) {
            displayFatherHusband = data.applicant_spouse_name_bn;
            if (!displayFatherHusband.includes('স্বামী')) displayFatherHusband = 'স্বামী: ' + displayFatherHusband;
        }
        data.custom_father_spouse = displayFatherHusband;

        // Map master database keys to modal input IDs
        const mapping = {
            'applicant_name_bn': 'input_applicant_name_bn',
            'custom_father_spouse': 'input_applicant_father_name_bn',
            'applicant_mobile': 'input_applicant_mobile',
            'applicant_nid': 'input_applicant_nid',
            'applicant_gender': 'input_applicant_gender',
            'applicant_spouse_name_bn': 'input_applicant_spouse_name_bn'
        };

        Object.keys(mapping).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                const el = document.getElementById(mapping[key]);
                if (el) {
                    el.value = data[key];
                    el.dispatchEvent(new Event('input'));
                    el.dispatchEvent(new Event('change'));
                }
            }
        });

        // Auto-assemble address if individual parts are provided
        if (!document.getElementById('input_applicant_present_address').value) {
            const parts = [
                data.applicant_curr_addr_house,
                data.applicant_curr_addr_village,
                data.applicant_curr_addr_post,
                data.applicant_curr_addr_union,
                data.applicant_present_upozila || data.applicant_curr_addr_thana
            ].filter(Boolean);

            if (parts.length > 0) {
                document.getElementById('input_applicant_present_address').value = parts.join(', ');
            } else if (data.applicant_present_district) {
                document.getElementById('input_applicant_present_address').value = data.applicant_present_district;
            }
        }

        showModal();
    },
    saveForm: populateData
};

window.saveCustomerToDB = function () {
    const nameBn = (document.getElementById('input_applicant_name_bn')?.value || '').trim();
    const mobile = (document.getElementById('input_applicant_mobile')?.value || '').trim();
    let nid = (document.getElementById('input_applicant_nid')?.value || '').trim();

    if (!nameBn) {
        appToast('অনুগ্রহ করে গ্রাহকের নাম প্রদান করুন\n(Please provide at least a name.)', true);
        return;
    }

    if (!nid) {
        const nameKey = nameBn.replace(/\s+/g, '_').substring(0, 20);
        nid = 'TEMP-' + nameKey + '-' + Date.now();
    }

    // Determine Dynamic Loan Product
    let loanProduct = "Unknown";
    const depAccEl = document.getElementById('input_deposit_account_no');
    const secEl = document.getElementById('input_loan_sector');
    const busEl = document.getElementById('input_business_type');
    const catEl = document.getElementById('input_loan_category');

    if (depAccEl) {
        loanProduct = "ডিপোজিট ঋণ";
    } else if (secEl && busEl) {
        loanProduct = secEl.value + '-' + busEl.value;
    } else if (catEl) {
        loanProduct = catEl.value;
    }

    const loanRecord = {
        product: loanProduct,
        account_no: (document.getElementById('input_cbs_account_no')?.value || '').trim() || (document.getElementById('input_deposit_account_no')?.value || '').trim() || (document.getElementById('input_loan_case_no')?.value || '').trim(),
        sanctioned_amount: (document.getElementById('input_loan_amount_num')?.value || '').trim(),
        outstanding_amount: "",
        interest_rate: (document.getElementById('input_loan_interest_rate')?.value || '').trim(),
        sanction_date: (document.getElementById('input_application_date')?.value || '').trim(),
        expiry_date: (document.getElementById('input_loan_expiry_date')?.value || '').trim(),
        status: "UC"
    };

    const fhRaw = (document.getElementById('input_applicant_father_name_bn')?.value || '').trim();
    const isHusband = fhRaw.includes('স্বামী') || fhRaw.includes('স্বামীর');
    const fhClean = fhRaw.replace(/^(স্বামী|স্বামীর)[\s:\-]*/, '').trim();

    const customer = {
        applicant_name_bn: nameBn,
        applicant_father_name_bn: isHusband ? '' : fhClean,
        applicant_spouse_name_bn: isHusband ? fhClean : (document.getElementById('input_applicant_spouse_name_bn')?.value || '').trim(),
        applicant_gender: (document.getElementById('input_applicant_gender')?.value || '').trim(),
        applicant_mobile: mobile,
        applicant_nid: nid,
        applicant_present_address: (document.getElementById('input_applicant_present_address')?.value || '').trim(),
        new_loan: loanRecord
    };

    if (window.parent && window.parent.ipcRenderer) {
        window.parent.ipcRenderer.invoke('db-save-customer', customer).then(res => {
            if (res && (res.changes !== undefined || res.success)) {
                appToast('✅ Customer & Loan Data Saved to DB! Remember to update the CBS account number.');
            } else {
                appToast('Failed to save to DB.', true);
            }
        }).catch(err => {
            console.error(err);
            appToast('Failed to save to DB. Error: ' + err.message);
        });
    } else {
        window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', customer: customer }, '*');
        appToast('✅ Saved via fallback.');
    }
};

/**
 * Populates datalists with unique values from the central customer database
 */
window.updateSuggestions = function() {
    const customers = JSON.parse(window.AppStorage.getItem('bkb_customers') || '[]');
    const lists = {
        'suggestion_name_bn': 'applicant_name_bn',
        'suggestion_father_name_bn': 'applicant_father_name_bn',
        'suggestion_mobile': 'applicant_mobile'
    };

    Object.keys(lists).forEach(listId => {
        const datalist = document.getElementById(listId);
        if (!datalist) return;

        datalist.innerHTML = '';
        const fieldName = lists[listId];
        const uniqueValues = new Set();

        customers.forEach(c => {
            if (c[fieldName]) uniqueValues.add(c[fieldName]);
        });

        uniqueValues.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            datalist.appendChild(option);
        });
    });
}
})();

// Dynamic Resolution Class Toggler
function applyResolutionClasses() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const body = document.body;

  if (!body) return;

  body.classList.remove('res-compact', 'res-hd', 'res-large');

  if (width < 1366) {
    body.classList.add('res-compact');
  } else if (width >= 1920) {
    body.classList.add('res-large');
  } else {
    body.classList.add('res-hd');
  }
}

window.addEventListener('DOMContentLoaded', applyResolutionClasses);
window.addEventListener('resize', applyResolutionClasses);
