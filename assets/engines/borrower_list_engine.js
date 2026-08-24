function toBanglaNumbers(str) {
    if (!str && str !== 0) return '';
    const banglaDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return str.toString().replace(/[0-9]/g, d => banglaDigits[d]);
}
// Borrower List Engine
(function () {
    const MAX_ROWS_PER_PAGE = 26;
    let currentData = [];
    let currentSort = { column: null, asc: true };
    let locationMap = []; // Cached from DB for auto village-code lookup

    // Load location map from DB once on startup
    async function loadLocationMap() {
        try {
            if (window.parent && window.parent.ipcRenderer) {
                const locs = await window.parent.ipcRenderer.invoke('db-get-locations');
                if (Array.isArray(locs)) locationMap = locs;
            }
        } catch(e) { console.warn('Could not load location map:', e); }
    }

    // Attempt to auto-set village code for a single borrower item using location_map
    function autoLinkVillageCode(item) {
        if (item._villageCode) return; // Already has a code, don't overwrite
        if (!locationMap.length) return;
        const village = (item['বাড়ি ও গ্রাম'] || '').toString().trim().toLowerCase();
        if (!village) return;
        // Match: check if any location entry village name is contained in the address
        const match = locationMap.find(loc => {
            const locVillage = (loc.village || '').toString().trim().toLowerCase();
            return locVillage && village.includes(locVillage);
        });
        if (match && match.village_code) {
            item._villageCode = match.village_code;
            item._villageName = match.village;
        }
    }

    // Standard headers we expect from Excel
    const EXPECTED_HEADERS = ['হিসাব নম্বর', 'ঋণের ধরণ', 'নাম ও পিতার নাম', 'বাড়ি ও গ্রাম', 'পোস্ট', 'থানা/উপজেলা', 'ঋণের পরিমাণ', 'বিতরণের তারিখ', 'দেয় তারিখ', 'বর্তমান স্থিতি', 'মোবাইল', 'স্ট্যাটাস', 'মন্তব্য'];

    async function init() {

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('action-select')) {
            const id = e.target.getAttribute('data-id');
            const action = e.target.value;
            if (!action) return;
            
            if (action === 'close') {
                if (window.markLoanClosed) window.markLoanClosed(id);
            } else if (action === 'notice') {
                window.openNoticeModal(id);
            } else if (action === 'bulk_notice') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Bulk Notice feature will be implemented soon!'); else alert('Bulk Notice feature will be implemented soon!');
            } else if (action === 'update_due') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Update Due feature will be implemented soon!'); else alert('Update Due feature will be implemented soon!');
            } else if (action === 'edit') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Edit feature will be implemented soon!'); else alert('Edit feature will be implemented soon!');
            }
            e.target.value = '';
        }
    });

    window.openNoticeModal = function(id) {
        let modal = document.getElementById('notice-select-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'notice-select-modal';
            modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; padding:20px; box-shadow:0 0 10px rgba(0,0,0,0.5); z-index:9999; border-radius:5px;';
            modal.innerHTML = `
                <h3 style="margin-top:0;">Select Notice Type</h3>
                <select id="notice-type-dropdown" class="form-input" style="width:100%; margin-bottom:15px; padding: 5px;">
                    <option value="1">1st Notice (30 Days)</option>
                    <option value="2">2nd Notice (15 Days)</option>
                    <option value="final">Final Notice</option>
                    <option value="legal">Legal Notice</option>
                </select>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="btn-cancel-notice" class="btn" style="background:#e74c3c; color:white;">Cancel</button>
                    <button id="btn-generate-notice" class="btn" style="background:#2ecc71; color:white;">Generate</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-cancel-notice').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            document.getElementById('btn-generate-notice').addEventListener('click', () => {
                const type = document.getElementById('notice-type-dropdown').value;
                const loanId = modal.getAttribute('data-target-id');
                modal.style.display = 'none';
                alert('Notice generation triggered for Loan ID: ' + loanId + ' | Type: ' + type);
                // Here we will call the actual notice generation logic later
            });
        }
        modal.setAttribute('data-target-id', id);
        modal.style.display = 'block';
    };

        // Create hidden file inputs
        let fileInput = document.getElementById('excel-file');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'excel-file';
            fileInput.accept = '.xlsx, .xls';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }

        let statusInput = document.getElementById('status-excel-file');
        if (!statusInput) {
            statusInput = document.createElement('input');
            statusInput.type = 'file';
            statusInput.id = 'status-excel-file';
            statusInput.accept = '.xlsx, .xls';
            statusInput.style.display = 'none';
            document.body.appendChild(statusInput);
        }

        // Hidden input for importing a .bkb backup for unification
        let unifyInput = document.getElementById('unify-db-file');
        if (!unifyInput) {
            unifyInput = document.createElement('input');
            unifyInput.type = 'file';
            unifyInput.id = 'unify-db-file';
            unifyInput.accept = '.bkb,.json';
            unifyInput.style.display = 'none';
            document.body.appendChild(unifyInput);
        }

        let filledExcelInput = document.getElementById('filled-excel-file');
        if (!filledExcelInput) {
            filledExcelInput = document.createElement('input');
            filledExcelInput.type = 'file';
            filledExcelInput.id = 'filled-excel-file';
            filledExcelInput.accept = '.xlsx, .xls';
            filledExcelInput.style.display = 'none';
            document.body.appendChild(filledExcelInput);
        }

        fileInput.addEventListener('change', handleFileUpload);
        statusInput.addEventListener('change', handleStatusUpload);
        unifyInput.addEventListener('change', handleUnifyUpload);
        filledExcelInput.addEventListener('change', handleFilledExcelUpload);

        // Village Code input change handler (delegated)
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('village-code-input')) {
                const id = e.target.getAttribute('data-id');
                const val = e.target.value.trim();
                const item = currentData.find(d => String(d._id) === String(id));
                if (item) {
                    item._villageCode = val;
                    saveCurrentList();
                }
            }
        });

        // RESTORE saved list from AppStorage on startup
        await loadLocationMap();
        loadSavedList();
    }

    function loadSavedList() {
        try {
            if (window.parent && window.parent.AppStorage) {
                let saved = window.parent.AppStorage.getItem('report_borrower_list');
                if (saved) {
                    let list = Array.isArray(saved) ? saved : [];
                    if (typeof saved === 'string') {
                        try { list = JSON.parse(saved); } catch(e) {}
                    }
                    if (list && list.length > 0) {
                        // Re-parse dates for in-memory use and auto-link village codes
                        list.forEach(item => {
                            if (item['বিতরণের তারিখ'] && !item._distDate) {
                                item._distDate = parseDate(item['বিতরণের তারিখ']);
                            }
                            if (item['দেয় তারিখ'] && !item._expDate) {
                                item._expDate = parseDate(item['দেয় তারিখ']);
                            }
                            autoLinkVillageCode(item);
                        });
                        currentData = list;
                        applyFilters();
                        // Also silently try to merge any new entries from DB
                        fetchFromCustomerDB(true);
                    } else {
                        // No saved list — try fetching from DB automatically
                        fetchFromCustomerDB(true);
                    }
                } else {
                    fetchFromCustomerDB(true);
                }
            }
        } catch(e) {
            console.warn('Could not restore saved borrower list:', e);
        }
    }

    function triggerFileUpload() {
        document.getElementById('excel-file').click();
    }

    // UNIFY / MERGE from backup .bkb file
    function handleUnifyUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const importedDB = JSON.parse(evt.target.result);
                // Support both full DB format and a plain array of borrower records
                let importedList = [];
                if (Array.isArray(importedDB)) {
                    importedList = importedDB;
                } else if (importedDB.report_borrower_list) {
                    let raw = importedDB.report_borrower_list;
                    importedList = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
                } else if (importedDB.data && importedDB.data.report_borrower_list) {
                    let raw = importedDB.data.report_borrower_list;
                    importedList = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
                }

                if (!importedList || importedList.length === 0) {
                    if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No borrower records found in the selected backup file.\n\nMake sure you are selecting a valid .bkb database backup file.'); else alert('No borrower records found in the selected backup file.\n\nMake sure you are selecting a valid .bkb database backup file.');
                    return;
                }

                // HOST PC is master — only INSERT new records, never overwrite existing ones
                let added = 0;
                importedList.forEach(imported => {
                    const isDuplicate = currentData.some(existing => {
                        if (existing['হিসাব নম্বর'] && imported['হিসাব নম্বর'] && existing['হিসাব নম্বর'] === imported['হিসাব নম্বর']) return true;
                        if (existing._caseNo && imported._caseNo && existing._caseNo === imported._caseNo && existing._nid === imported._nid) return true;
                        return false;
                    });
                    if (!isDuplicate) {
                        currentData.push(imported);
                        added++;
                    }
                });

                // Save merged list
                saveCurrentList();
                applyFilters();

                // Show post-merge reminder
                const msg = `✅ Unification Complete!\n\nAdded ${added} new borrower(s) from the backup file.\nSkipped ${importedList.length - added} duplicate(s) — host PC data preserved.\n\n⚠️ IMPORTANT: Please update balances and loan status from the CBS module to ensure accuracy.`;
                alert(msg);
            } catch(err) {
                console.error('Unify error:', err);
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Error reading backup file: ' + err.message + '\n\nPlease ensure the file is a valid .bkb backup.'); else alert('Error reading backup file: ' + err.message + '\n\nPlease ensure the file is a valid .bkb backup.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // Central save function — always persists currentData to AppStorage
    function saveCurrentList() {
        try {
            if (window.parent && window.parent.AppStorage) {
                window.parent.AppStorage.setItem('report_borrower_list', JSON.stringify(currentData));
            }
        } catch(e) {
            console.error('Failed to save borrower list:', e);
        }
    }
    
    async function fetchFromCustomerDB(silent = false) {
        if (!window.parent || !window.parent.ipcRenderer) {
            if (!silent) if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Database connection unavailable.'); else alert('Database connection unavailable.');
            return;
        }
        try {
            const res = await window.parent.ipcRenderer.invoke('db-get-all-customers');
            if (res.success && res.data) {
                let newLoans = [];
                res.data.forEach(customer => {
                    if (customer.loans) {
                        try {
                            const loans = JSON.parse(customer.loans);
                            loans.forEach(loan => {
                                if (loan.loan_type === 'ডিপোজিট' || loan.loan_type === 'Deposit' || loan.product === 'Deposit' || loan.product === 'ডিপোজিট') return;
                                
                                newLoans.push({
                                    "হিসাব নম্বর": loan.cbs_account_no || loan.loan_case_no || loan.account_no || '',
                                    "_caseNo": loan.loan_case_no || loan.account_no || '',
                                    "_nid": customer.applicant_nid || '',
                                    "ঋণের ধরণ": loan.loan_type || loan.product || '',
                                    "_sector": loan.loan_sector || loan.loan_type || loan.product || '',
                                    "নাম ও পিতার নাম": (customer.applicant_name_bn || '') + (customer.applicant_father_name_bn ? ' ও ' + customer.applicant_father_name_bn : ''),
                                    "নাম": customer.applicant_name_bn || '',
                                    "পিতা/স্বামীর নাম": customer.applicant_father_name_bn || '',
                                    "বাড়ি ও গ্রাম": (customer.applicant_curr_addr_house || '') + (customer.applicant_curr_addr_village ? ' ' + customer.applicant_curr_addr_village : ''),
                                    "বাড়ি": customer.applicant_curr_addr_house || '',
                                    "গ্রাম": customer.applicant_curr_addr_village || '',
                                    "পোস্ট": customer.applicant_curr_addr_post || '',
                                    "থানা/উপজেলা": customer.applicant_present_upozila || '',
                                    "_district": customer.applicant_present_district || '',
                                    "জেলা": customer.applicant_present_district || '',
                                    "ঋণের পরিমাণ": loan.loan_amount || loan.sanction_amount || loan.sanctioned_amount || '',
                                    "interest_rate": loan.interest_rate || loan.interest || loan.rate || '',
                                    "বিতরণের তারিখ": loan.dist_date || loan.sanction_date || '',
                                    "দেয় তারিখ": loan.expiry_date || '',
                                    "বর্তমান স্থিতি": loan.outstanding_amount || '',
                                    "মোবাইল": customer.applicant_mobile || '',
                                    "স্ট্যাটাস": loan.status || 'UC',
                                    "মন্তব্য": ""
                                });
                            });
                        } catch (e) {
                            console.warn('Error parsing loans for customer', e);
                        }
                    }
                });
                
                if (newLoans.length === 0) {
                    if (!silent) if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No loans found in Customer DB.'); else alert('No loans found in Customer DB.');
                    return;
                }
                
                let borrowerList = currentData || [];
                
                let added = 0;
                let updated = 0;
                newLoans.forEach(nl => {
                    // Match by CBS Account or Internal CaseNo+NID combo
                    const existingIndex = borrowerList.findIndex(bl => {
                        if (bl["হিসাব নম্বর"] && nl["হিসাব নম্বর"] && bl["হিসাব নম্বর"] === nl["হিসাব নম্বর"]) return true;
                        if (bl._caseNo && nl._caseNo && bl._caseNo === nl._caseNo && bl._nid === nl._nid) return true;
                        return false;
                    });
                    
                    if (existingIndex > -1) {
                        // Safe merge to prevent overwriting manual CBS Accounts
                        const merged = { ...borrowerList[existingIndex] };
                        for (let key in nl) {
                            if (nl[key] && !merged[key]) merged[key] = nl[key];
                        }
                        // Prioritize real CBS account if available in DB
                        if (nl["হিসাব নম্বর"] && nl["হিসাব নম্বর"] !== merged._caseNo) {
                            merged["হিসাব নম্বর"] = nl["হিসাব নম্বর"]; 
                        }
                        autoLinkVillageCode(merged);
                        borrowerList[existingIndex] = merged;
                        updated++;
                    } else {
                        nl._id = borrowerList.length;
                        autoLinkVillageCode(nl);
                        borrowerList.push(nl);
                        added++;
                    }
                });
                
                currentData = borrowerList;
                saveCurrentList();
                if (!silent) {
                    if(window.parent && window.parent.showAppToast) window.parent.showAppToast(`Successfully fetched from DB! Added ${added} new loans, updated ${updated} existing loans.`); else alert(`Successfully fetched from DB! Added ${added} new loans, updated ${updated} existing loans.`);
                    applyFilters();
                } else {
                    if (added > 0 || updated > 0) {
                        applyFilters(); // Re-render
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching customers', e);
            if (!silent) if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Error fetching from Customer DB'); else alert('Error fetching from Customer DB');
        }
    }
    window.triggerFileUpload = triggerFileUpload;
    window.uploadList = triggerFileUpload;
    
    function triggerFilledExcelUpload() {
        const fi = document.getElementById('filled-excel-file');
        if (fi) fi.click();
    }
    window.triggerFilledExcelUpload = triggerFilledExcelUpload;

    function triggerStatusUpload() {
        const si = document.getElementById('status-excel-file');
        if (si) si.click();
    }
    window.triggerStatusUpload = triggerStatusUpload;
    
    function triggerUnifyUpload() {
        const ui = document.getElementById('unify-db-file');
        if (ui) ui.click();
    }
    window.triggerUnifyUpload = triggerUnifyUpload;

    function handleFilledExcelUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            const data = new Uint8Array(evt.target.result);
            if (typeof XLSX === 'undefined') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel library not loaded.'); else alert('Excel library not loaded.');
                return;
            }
            const workbook = XLSX.read(data, {type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const excelData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy', defval: "" });

            if (excelData.length === 0) {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No data found in the Excel file.'); else alert('No data found in the Excel file.');
                return;
            }

            if (currentData.length > 0) {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('The list already contains data. Please use the Clear List button to start again.'); else alert('The list already contains data. Please use the Clear List button to start again.');
                e.target.value = '';
                return;
            }

            let newRecords = [];
            excelData.forEach(row => {
                const accNo = (row['হিসাব নম্বর'] || '').toString().trim();
                if (!accNo) return;
                
                const name = (row['নাম'] || '').toString().trim();
                const fname = (row['পিতা/স্বামীর নাম'] || '').toString().trim();
                const recombinedName = name + (fname ? '\n' + fname : '');

                let newItem = { ...row };
                newItem['নাম ও পিতার নাম'] = recombinedName;
                newItem['_id'] = 'loan_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
                
                let bari = (row['বাড়ি'] || '').toString().trim();
                let gram = (row['গ্রাম'] || '').toString().trim();
                let combined = [];
                if (bari) combined.push(bari);
                if (gram) combined.push(gram);
                if (combined.length > 0 && !newItem['বাড়ি ও গ্রাম']) {
                    newItem['বাড়ি ও গ্রাম'] = combined.join(', ');
                }

                if (newItem['মঞ্জুরীকৃত পরিমাণ'] && !newItem['ঋণের পরিমাণ']) {
                    newItem['ঋণের পরিমাণ'] = newItem['মঞ্জুরীকৃত পরিমাণ'];
                }
                if (newItem['সুদের হার(%)'] && !newItem['interest_rate']) {
                    newItem['interest_rate'] = newItem['সুদের হার(%)'];
                }
                if (newItem['মেয়াদ উত্তীর্ণ'] && !newItem['দেয় তারিখ']) {
                    newItem['দেয় তারিখ'] = newItem['মেয়াদ উত্তীর্ণ'];
                }
                if (newItem['মোবাইল নম্বর'] && !newItem['মোবাইল']) {
                    let mob = newItem['মোবাইল নম্বর'].toString().trim();
                    if (mob && !mob.startsWith('0')) {
                        mob = '0' + mob;
                    }
                    newItem['মোবাইল'] = mob;
                }
                if (newItem['শ্রেণীমান'] && !newItem['স্ট্যাটাস']) {
                    newItem['স্ট্যাটাস'] = newItem['শ্রেণীমান'];
                }
                if (newItem['বর্তমান স্থিতি'] && !newItem['বকেয়া স্থিতি']) {
                    newItem['বকেয়া স্থিতি'] = newItem['বর্তমান স্থিতি'];
                }
                
                newRecords.push(newItem);
            });

            if (newRecords.length > 0) {
                currentData = newRecords;
                saveCurrentList();
                renderPages(currentData);
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast(`Successfully loaded ${newRecords.length} records from the filled Excel.`); else alert(`Successfully loaded ${newRecords.length} records from the filled Excel.`);
            }
            e.target.value = ''; // Reset input
        };
        reader.readAsArrayBuffer(file);
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            if (typeof XLSX === 'undefined') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel library not loaded.'); else alert('Excel library not loaded.');
                return;
            }
            const workbook = XLSX.read(data, {type: 'array', cellDates: true, dateNF: 'dd/mm/yyyy'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to json, raw dates will be Date objects because of cellDates: true
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false, dateNF: 'dd/mm/yyyy'});
            
            if (jsonData.length === 0) {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No data found in the Excel file.'); else alert('No data found in the Excel file.');
                return;
            }

            processData(jsonData);
        };
        reader.readAsArrayBuffer(file);
        
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    }

    function parseDate(dateStr) {
        if (!dateStr && dateStr !== 0) return null;
        if (dateStr instanceof Date) return dateStr;
        // Excel serial date (number) conversion
        if (typeof dateStr === 'number') {
            return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        }
        dateStr = String(dateStr).trim();
        if (!dateStr) return null;
        // Assume dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
        if (dateStr.includes('/') || dateStr.includes('-') || dateStr.includes('.')) {
            const parts = dateStr.split(/[\/\-\.]/);
            if (parts.length === 3) {
                let y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
                let m = parseInt(parts[1], 10) - 1;
                let d = parseInt(parts[0], 10);
                return new Date(y, m, d);
            }
        }
        return new Date(dateStr);
    }

    function processData(jsonData) {
        // Ensure data consistency
        const processed = jsonData.map((row, index) => {
            let item = { ...row };
            
            // Fix Excel formula blank evaluation (empty cell reference returns 0 instead of blank)
            const textCols = ['পোস্ট', 'থানা/উপজেলা', 'গ্রাম', 'বাড়ি', 'বাড়ি ও গ্রাম', 'নাম', 'পিতা/স্বামীর নাম', 'নাম ও পিতার নাম'];
            textCols.forEach(col => {
                if (item[col] === 0 || item[col] === '0') item[col] = '';
            });

            // Backwards compatibility mapper for UI Excel headers
            if (item['বাড়ি ও গ্রাম (পোস্ট, উপজেলা, জেলা)'] && !item['বাড়ি ও গ্রাম']) {
                item['বাড়ি ও গ্রাম'] = item['বাড়ি ও গ্রাম (পোস্ট, উপজেলা, জেলা)'];
            }
            if (!item['বাড়ি ও গ্রাম']) {
                let bari = (item['বাড়ি'] || '').toString().trim();
                let gram = (item['গ্রাম'] || '').toString().trim();
                let combined = [];
                if (bari && bari !== '0') combined.push(bari);
                if (gram && gram !== '0') combined.push(gram);
                if (combined.length > 0) {
                    item['বাড়ি ও গ্রাম'] = combined.join(', ');
                }
            }
            if (item['মঞ্জুরীকৃত পরিমাণ'] && !item['ঋণের পরিমাণ']) {
                item['ঋণের পরিমাণ'] = item['মঞ্জুরীকৃত পরিমাণ'];
            }
            if (item['সুদের হার(%)'] && !item['interest_rate']) {
                item['interest_rate'] = item['সুদের হার(%)'];
            }
            if (item['মেয়াদ উত্তীর্ণ'] && !item['দেয় তারিখ']) {
                item['দেয় তারিখ'] = item['মেয়াদ উত্তীর্ণ'];
            }
            if (item['মোবাইল নম্বর'] && !item['মোবাইল']) {
                item['মোবাইল'] = item['মোবাইল নম্বর'];
            }
            if (item['শ্রেণীমান'] && !item['স্ট্যাটাস']) {
                item['স্ট্যাটাস'] = item['শ্রেণীমান'];
            }
            if (item['CBS Balance (Date)'] && !item['cbs_balance']) {
                item['cbs_balance'] = item['CBS Balance (Date)'];
            }
            if (item['Current Due (Date)'] && !item['current_due']) {
                item['current_due'] = item['Current Due (Date)'];
            }
            if (item['Notice Status'] && !item['notice_status']) {
                item['notice_status'] = item['Notice Status'];
            }
            
            item['_id'] = index;
            // Standardize dates for sorting
            if (item['বিতরণের তারিখ']) {
                item['_distDate'] = parseDate(item['বিতরণের তারিখ']);
            }
            if (item['দেয় তারিখ']) {
                item['_expDate'] = parseDate(item['দেয় তারিখ']);
            }
            // Parse loan amounts for numerical sorting
            if (item['ঋণের পরিমাণ']) {
                item['_loanAmount'] = parseFloat(item['ঋণের পরিমাণ'].toString().replace(/[^\d.]/g, '')) || 0;
            }
            autoLinkVillageCode(item);
            return item;
        });

        // Default sort: বিতরণের তারিখ (Disbursement Date) Ascending
        processed.sort((a, b) => {
            if (a._distDate && b._distDate) {
                return a._distDate - b._distDate;
            }
            return 0;
        });

        currentData = processed;
        saveCurrentList();
        
        // Setup initial sort state
        currentSort = { column: 'বিতরণের তারিখ', asc: true };
        
        generateBorrowerList();
    }

    function generateBorrowerList() {
        if (currentData.length === 0) {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No data available. Please upload an Excel list first.'); else alert('No data available. Please upload an Excel list first.');
            return;
        }
        
        // Force default sort by Disbursement Date Ascending (Older to Newer)
        currentData.sort((a, b) => {
            const dA = a._distDate ? new Date(a._distDate) : 0;
            const dB = b._distDate ? new Date(b._distDate) : 0;
            return dA - dB;
        });
        currentSort = { column: 'বিতরণের তারিখ', asc: true };

        applyFilters();
    }
    window.generateBorrowerList = generateBorrowerList;
    window.generateList = generateBorrowerList;

    function renderPages(data) {
        window.currentRenderedData = data;
        const uiTbody = document.getElementById('ui-borrower-tbody');
        if (!uiTbody) return;
        uiTbody.innerHTML = '';

        data.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            // Format dates back to dd/mm/yyyy for display
            let distDateDisplay = item['বিতরণের তারিখ'] || '';
            let expDateDisplay = item['দেয় তারিখ'] || '';
            
            if (item._distDate instanceof Date && !isNaN(item._distDate)) {
                distDateDisplay = `${item._distDate.getDate().toString().padStart(2,'0')}/${(item._distDate.getMonth()+1).toString().padStart(2,'0')}/${item._distDate.getFullYear()}`;
            }
            if (item._expDate instanceof Date && !isNaN(item._expDate)) {
                expDateDisplay = `${item._expDate.getDate().toString().padStart(2,'0')}/${(item._expDate.getMonth()+1).toString().padStart(2,'0')}/${item._expDate.getFullYear()}`;
            }


            
            // Format Name
            let nameStr = item['নাম ও পিতার নাম'] || '';
            if (!nameStr.includes('\n')) {
                nameStr = nameStr.replace(/পিতা:/g, '\nপিতা:').replace(/স্বামী:/g, '\nস্বামী:');
            }

            // Merge address
            const village = item['বাড়ি ও গ্রাম'] || '';
            const post = item['পোস্ট'] || '';
            const thana = item['থানা/উপজেলা'] || '';
            let mergedAddress = [];
            if (village) mergedAddress.push(`গ্রাম: ${village}`);
            if (post) mergedAddress.push(`পোস্ট: ${post}`);
            if (thana) mergedAddress.push(`উপজেলা: ${thana}`);
            
            let irateDisplay = (item.interest_rate || '').toString().trim();
            if (irateDisplay && !irateDisplay.includes('%')) irateDisplay += '%';
            
            tr.innerHTML = `
                <td class="no-print" style="text-align:center;"><input type="checkbox" class="loan-checkbox" value="${item._id}" onchange="updateActionState()"></td>
                <td style="text-align:center;">${toBanglaNumbers(index + 1)}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="হিসাব নম্বর" style="text-align:center;">${toBanglaNumbers(item['হিসাব নম্বর'] || '')}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="ঋণের ধরণ" style="text-align:center;">${item['ঋণের ধরণ'] || ''}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="নাম ও পিতার নাম" style="white-space: pre-wrap; min-width: 150px; line-height: 1.3;">${nameStr}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="বাড়ি ও গ্রাম">${mergedAddress.join(', ')}</td>
                <td style="text-align:center; min-width:70px;">
                    <input type="text" class="village-code-input" data-id="${item._id}" value="${item._villageCode || ''}" placeholder="-" style="width:60px; text-align:center; border:1px solid #ccc; border-radius:3px; padding:2px 4px; font-size:11px;" title="${item._villageName || 'Click to set village code'}">
                </td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="ঋণের পরিমাণ" style="text-align:center;">${toBanglaNumbers(item['ঋণের পরিমাণ'] || '')}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="interest_rate" style="text-align:center;">${toBanglaNumbers(irateDisplay)}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="বিতরণের তারিখ" style="text-align:center; white-space:nowrap;">${toBanglaNumbers(distDateDisplay)}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="দেয় তারিখ" style="text-align:center; white-space:nowrap;">${toBanglaNumbers(expDateDisplay)}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="বর্তমান স্থিতি" style="text-align:center; ${item._isCreditBalance ? 'color:red; font-weight:bold;' : ''}">${toBanglaNumbers(item['বর্তমান স্থিতি'] || '')}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="মোবাইল" style="text-align:center;">${toBanglaNumbers(item['মোবাইল'] || '')}</td>
                <td style="text-align:center;">${item['স্ট্যাটাস'] || ''}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" class="comment-cell">${item['মন্তব্য'] || ''}</td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="cbs_balance"></td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="current_due"></td>
                <td contenteditable="true" spellcheck="false" data-id="${item._id}" data-col="notice_status"></td>
            `;
            uiTbody.appendChild(tr);
        });

        // Update UI Totals
        let totalAmt = 0;
        data.forEach(item => {
            let bal = parseFloat((item['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
            totalAmt += bal;
        });
        const uiTotalLoans = document.getElementById('ui-total-loans');
        const uiTotalAmt = document.getElementById('ui-total-outstanding');
        if (uiTotalLoans) uiTotalLoans.innerText = `${toBanglaNumbers(data.length.toString())} টি ঋণ`;
        if (uiTotalAmt) uiTotalAmt.innerText = toBanglaNumbers(totalAmt.toLocaleString('en-IN')) + '/-';

        // Request header population again so new pages get branch info
        try {
            window.parent.postMessage({ command: 'GET_BRANCH_INFO' }, '*');
        } catch(e){}

        setupFilters();
    }

    window.sortByVillageCode = function() {
        if (!currentData || !currentData.length) return;
        currentData.sort((a, b) => {
            const aCode = a._villageCode ? parseInt(a._villageCode) || a._villageCode : null;
            const bCode = b._villageCode ? parseInt(b._villageCode) || b._villageCode : null;
            if (aCode === null && bCode === null) return 0;
            if (aCode === null) return 1;  // No code goes last
            if (bCode === null) return -1;
            if (aCode < bCode) return -1;
            if (aCode > bCode) return 1;
            // Secondary sort: by disbursement date within same code
            const dA = a._distDate ? new Date(a._distDate) : 0;
            const dB = b._distDate ? new Date(b._distDate) : 0;
            return dA - dB;
        });
        saveCurrentList();
        applyFilters();
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Sorted by Village Code ✓');
    };

    window.generateLegalReport = function() {
        if (!window.currentRenderedData) return;
        const data = window.currentRenderedData;
        const printContainer = document.getElementById('print-container');
        if (!printContainer) return;
        
        // Clean up any extra dynamic pages that might have been created by other scripts, but preserve title-page and main-page
        const pages = printContainer.querySelectorAll('.page');
        pages.forEach(p => {
            if (p.id !== 'title-page' && p.id !== 'main-page') {
                p.remove();
            }
        });
        
        const firstPage = document.getElementById('main-page');
        if (!firstPage) return;
        const firstTbody = firstPage.querySelector('#borrower-tbody');
        if (firstTbody) {
            firstTbody.innerHTML = '';
        } else {
            return;
        }

        let currentTbody = firstTbody;

        function buildPrintRow(item, seqNum) {
            const tr = document.createElement('tr');
            let dD = item['\u09ac\u09bf\u09a4\u09b0\u09a3\u09c7\u09b0 \u09a4\u09be\u09b0\u09bf\u0996']||'', eD = item['\u09a6\u09c7\u09af\u09bc \u09a4\u09be\u09b0\u09bf\u0996']||'';
            if (item._distDate instanceof Date && !isNaN(item._distDate)) dD = `${item._distDate.getDate().toString().padStart(2,'0')}/${(item._distDate.getMonth()+1).toString().padStart(2,'0')}/${item._distDate.getFullYear()}`;
            if (item._expDate instanceof Date && !isNaN(item._expDate)) eD = `${item._expDate.getDate().toString().padStart(2,'0')}/${(item._expDate.getMonth()+1).toString().padStart(2,'0')}/${item._expDate.getFullYear()}`;
            let nm = item['\u09a8\u09be\u09ae \u0993 \u09aa\u09bf\u09a4\u09be\u09b0 \u09a8\u09be\u09ae']||'';
            if (!nm.includes('\n')) nm = nm.replace(/\u09aa\u09bf\u09a4\u09be:/g,'\n\u09aa\u09bf\u09a4\u09be:').replace(/\u09b8\u09cd\u09ac\u09be\u09ae\u09c0:/g,'\n\u09b8\u09cd\u09ac\u09be\u09ae\u09c0:');
            let ir = (item.interest_rate||'').toString().trim(); if(ir&&!ir.includes('%')) ir+='%';
            tr.innerHTML = `<td class="no-print" style="text-align:center;"><input type="checkbox" class="loan-checkbox" value="${item._id}"></td>
                <td style="text-align:center;">${toBanglaNumbers(seqNum.toString())}</td>
                <td style="text-align:center;">${toBanglaNumbers(item['\u09b9\u09bf\u09b8\u09be\u09ac \u09a8\u09ae\u09cd\u09ac\u09b0']||'')}</td>
                <td style="text-align:center;">${item['\u098b\u09a3\u09c7\u09b0 \u09a7\u09b0\u09a3']||''}</td>
                <td style="white-space:pre-wrap;min-width:150px;line-height:1.3;">${nm}</td>
                <td>${item['\u09ac\u09be\u09a1\u09bc\u09bf \u0993 \u0997\u09cd\u09b0\u09be\u09ae']||''}</td><td>${item['\u09aa\u09cb\u09b8\u09cd\u099f']||''}</td><td>${item['\u09a5\u09be\u09a8\u09be/\u0989\u09aa\u099c\u09c7\u09b2\u09be']||''}</td>
                <td style="text-align:center;">${toBanglaNumbers(item['\u098b\u09a3\u09c7\u09b0 \u09aa\u09b0\u09bf\u09ae\u09be\u09a3']||'')}</td>
                <td style="text-align:center;">${toBanglaNumbers(ir)}</td>
                <td style="text-align:center;white-space:nowrap;">${toBanglaNumbers(dD)}</td>
                <td style="text-align:center;white-space:nowrap;">${toBanglaNumbers(eD)}</td>
                <td style="text-align:center;${item._isCreditBalance?'color:red;font-weight:bold;':''}">${toBanglaNumbers(item['\u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8 \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf']||'')}</td>
                <td style="text-align:center;">${toBanglaNumbers(item['\u09ae\u09cb\u09ac\u09be\u0987\u09b2']||'')}</td>
                <td style="text-align:center;">${item['\u09b8\u09cd\u099f\u09cd\u09af\u09be\u099f\u09be\u09b8']||''}</td>
                <td>${item['\u09ae\u09a8\u09cd\u09a4\u09ac\u09cd\u09af']||''}</td>`;
            return tr;
        }

        const anyCode = data.some(d => d._villageCode);
        let seqNum = 1;
        if (anyCode) {
            const sorted = [...data].sort((a,b) => {
                const aC = a._villageCode ? (parseInt(a._villageCode) || a._villageCode) : null;
                const bC = b._villageCode ? (parseInt(b._villageCode) || b._villageCode) : null;
                if (aC===null && bC===null) return 0;
                if (aC===null) return 1;
                if (bC===null) return -1;
                return aC < bC ? -1 : aC > bC ? 1 : 0;
            });
            const groups = [];
            sorted.forEach(item => {
                const code = item._villageCode || '__NONE__';
                let g = groups.find(x => x.code === code);
                if (!g) { g = {code, name: item._villageName||'', items:[]}; groups.push(g); }
                g.items.push(item);
            });
            let grandTotal = 0;
            groups.forEach((grp, gi) => {
                const lbl = grp.code === '__NONE__'
                    ? '\u0985\u09b6\u09cd\u09b0\u09c7\u09a3\u09c0\u09ac\u09a6\u09cd\u09a7 (\u09ac\u09bf\u09a8\u09be \u0995\u09cb\u09a1)'
                    : `\u0997\u09cd\u09b0\u09be\u09ae \u0995\u09cb\u09a1: ${grp.code}${grp.name ? ' \u2014 ' + grp.name : ''}`;
                const hTr = document.createElement('tr');
                hTr.style.cssText = 'background:#2c3e50;color:white;font-weight:bold;font-size:11pt;';
                hTr.innerHTML = `<td colspan="16" style="padding:8px;border:none;">${lbl}</td>`;
                currentTbody.appendChild(hTr);
                let grpTotal = 0;
                grp.items.forEach(item => {
                    currentTbody.appendChild(buildPrintRow(item, seqNum++));
                    grpTotal += parseFloat((item['\u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8 \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf']||'').toString().replace(/[^\d.]/g,'')) || 0;
                });
                grandTotal += grpTotal;
                const sTr = document.createElement('tr');
                sTr.style.cssText = 'font-weight:bold;background:#d5e8d4;';
                sTr.innerHTML = `<td colspan="7" style="text-align:right;padding:6px;border-top:2px solid #000;">\u0989\u09aa\u09ae\u09cb\u099f (${lbl}): ${toBanglaNumbers(grp.items.length.toString())} \u099f\u09bf</td><td colspan="5" style="text-align:right;padding:6px;border-top:2px solid #000;">\u09ae\u09cb\u099f \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf:</td><td colspan="4" style="text-align:left;padding:6px;border-top:2px solid #000;">${toBanglaNumbers(grpTotal.toLocaleString('en-IN'))}/-</td>`;
                currentTbody.appendChild(sTr);
                if (gi < groups.length - 1) {
                    const bTr = document.createElement('tr');
                    bTr.style.cssText = 'page-break-after:always;border:none;';
                    bTr.innerHTML = '<td colspan="16" style="border:none;padding:0;height:0;"></td>';
                    currentTbody.appendChild(bTr);
                }
            });
            const gTr = document.createElement('tr');
            gTr.style.cssText = 'font-weight:bold;background:#ecf0f1;';
            gTr.innerHTML = `<td colspan="7" style="text-align:right;">\u09b8\u09b0\u09cd\u09ac\u09ae\u09cb\u099f (Grand Total): ${toBanglaNumbers(data.length.toString())} \u099f\u09bf \u098b\u09a3</td><td colspan="5" style="text-align:right;">\u09ae\u09cb\u099f \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf:</td><td colspan="4" style="text-align:left;">${toBanglaNumbers(grandTotal.toLocaleString('en-IN'))}/-</td>`;
            currentTbody.appendChild(gTr);
        } else {
            data.forEach(item => currentTbody.appendChild(buildPrintRow(item, seqNum++)));
            let ft = 0;
            data.forEach(item => { ft += parseFloat((item['\u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8 \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf']||'').toString().replace(/[^\d.]/g,'')) || 0; });
            const tTr = document.createElement('tr');
            tTr.style.cssText = 'font-weight:bold;background:#ecf0f1;';
            tTr.innerHTML = `<td colspan="7" style="text-align:right;">\u09b8\u09b0\u09cd\u09ac\u09ae\u09cb\u099f (Total): ${toBanglaNumbers(data.length.toString())} \u099f\u09bf \u098b\u09a3</td><td colspan="5" style="text-align:right;">\u09ae\u09cb\u099f \u09b8\u09cd\u09a5\u09bf\u09a4\u09bf:</td><td colspan="4" style="text-align:left;">${toBanglaNumbers(ft.toLocaleString('en-IN'))}/-</td>`;
            currentTbody.appendChild(tTr);
        }
        // Overview table is on the Title Page at top.

        const originalDisplay = printContainer.style.display;
        printContainer.style.display = 'block';

        // Extract styles and HTML for Electron native PDF generator
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                            .map(el => el.outerHTML)
                            .join('\n');
        const htmlContent = styles + printContainer.outerHTML;
        const baseUrl = window.location.href;

        if (window.parent && window.parent.ipcRenderer) {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Generating Legal PDF Natively... Please wait.');
            window.parent.ipcRenderer.invoke('save-as-pdf', {
                html: htmlContent,
                baseUrl: baseUrl,
                defaultName: `Borrower_List_Legal_${new Date().toISOString().slice(0,10)}.pdf`,
                options: { pageSize: 'Legal', landscape: true }
            }).then(result => {
                printContainer.style.display = originalDisplay;
                if (result.success) {
                    if(window.parent && window.parent.showAppToast) window.parent.showAppToast('PDF Saved Successfully: ' + result.path);
                } else if (result.reason !== 'user_canceled') {
                    if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Error saving PDF: ' + result.error, true);
                }
                // Cleanup
                const cleanupPages = printContainer.querySelectorAll('.page');
                cleanupPages.forEach(p => {
                    if (p.id !== 'title-page' && p.id !== 'main-page') {
                        p.remove();
                    }
                });
                if (firstTbody) firstTbody.innerHTML = '';
            }).catch(err => {
                printContainer.style.display = originalDisplay;
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Error generating PDF.', true);
                console.error(err);
            });
        } else {
            // Trigger native print dialog for pure web fallback
            window.print();
            
            // Clean up memory after print dialog
            setTimeout(() => {
                printContainer.style.display = originalDisplay;
                const cleanupPages = printContainer.querySelectorAll('.page');
                for (let i = 1; i < cleanupPages.length; i++) {
                    cleanupPages[i].remove();
                }
                if (firstTbody) firstTbody.innerHTML = '';
            }, 1000);
        }
    };

    // Advanced Filtering and Sorting functionality
    function setupFilters() {
        const thElements = document.querySelectorAll('#ui-container .report-table th');
        
        // Setup sort icons
        thElements.forEach(th => {
            if (!th.hasAttribute('data-sortable')) {
                th.setAttribute('data-sortable', 'true');
                th.style.cursor = 'pointer';
                th.style.position = 'relative';
                
                const icon = document.createElement('span');
                icon.className = 'sort-icon no-print';
                icon.innerHTML = ' ↕';
                icon.style.opacity = '0.5';
                th.appendChild(icon);

                th.addEventListener('click', () => {
                    const colName = th.childNodes[0].textContent.trim();
                    handleSort(colName);
                });
            }
        });

        // Update all icons to reflect current sort
        document.querySelectorAll('#ui-container .report-table th').forEach(th => {
             const colName = th.childNodes[0].textContent.trim();
             const icon = th.querySelector('.sort-icon');
             if (icon) {
                 if (colName === currentSort.column) {
                     icon.innerHTML = currentSort.asc ? ' ↑' : ' ↓';
                     icon.style.opacity = '1';
                 } else {
                     icon.innerHTML = ' ↕';
                     icon.style.opacity = '0.5';
                 }
             }
        });


        // ensure padding is completely removed from iframe body
        document.body.style.paddingRight = '0';
        
        populateFilterDropdowns();
    }

    function handleSort(colName) {
        if (!currentData || currentData.length === 0) return;
        
        let asc = true;
        if (currentSort.column === colName) {
            asc = !currentSort.asc;
        }
        currentSort = { column: colName, asc: asc };

        currentData.sort((a, b) => {
            let valA = a[colName] || '';
            let valB = b[colName] || '';

            // Handle special column types
            if (colName === 'বিতরণের তারিখ' || colName === 'মেয়াদোত্তীর্ণের তারিখ') {
                valA = a._distDate || parseDate(a[colName]) || 0;
                valB = b._distDate || parseDate(b[colName]) || 0;
            } else if (colName === 'ঋণের পরিমাণ' || colName === 'বর্তমান স্থিতি') {
                valA = parseFloat(valA.toString().replace(/[^\d.]/g, '')) || 0;
                valB = parseFloat(valB.toString().replace(/[^\d.]/g, '')) || 0;
            } else if (colName === 'ক্রম') {
                 // Sort strings naturally (e.g. 1, 2, 10 instead of 1, 10, 2)
                 valA = parseInt(valA.toString().replace(/[^\d]/g, '')) || 0;
                 valB = parseInt(valB.toString().replace(/[^\d]/g, '')) || 0;
            }

            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });

        // We re-apply filters (which calls renderPages with the filtered, but now sorted data)
        applyFilters();
    }

    function populateFilterDropdowns() {
        if (!currentData || currentData.length === 0) return;

        const types = new Set();
        const sectors = new Set();
        const years = new Set();
        const statuses = new Set();
        const coreCategories = new Set();
        const subCategories = new Set();

        currentData.forEach(item => {
            if (item['ঋণের ধরণ']) types.add(item['ঋণের ধরণ'].toString().trim());
            if (item._sector) sectors.add(item._sector.toString().trim());
            if (item['স্ট্যাটাস']) statuses.add(item['স্ট্যাটাস'].toString().trim().toUpperCase());
            if (item.loan_core_category) coreCategories.add(item.loan_core_category.toString().trim());
            if (item.loan_sub_category) subCategories.add(item.loan_sub_category.toString().trim());
            
            // Calculate Economic Year from Disbursement Date
            const dDate = item._distDate || parseDate(item['বিতরণের তারিখ']);
            if (dDate instanceof Date && !isNaN(dDate)) {
                let year = dDate.getFullYear();
                let month = dDate.getMonth() + 1; // 1-12
                // Economic year is July 1 to June 30
                if (month < 7) {
                    years.add(`${year-1}-${year}`);
                } else {
                    years.add(`${year}-${year+1}`);
                }
            }
        });

        const typeSelect = document.getElementById('pfilter-loan-type');
        const sectorSelect = document.getElementById('pfilter-loan-sector');
        const yearSelect = document.getElementById('pfilter-economic-year');
        const statusSelect = document.getElementById('pfilter-loan-status');
        const coreCatSelect = document.getElementById('pfilter-core-category');
        const subCatSelect = document.getElementById('pfilter-sub-category');
        
        if (!typeSelect || !sectorSelect || !yearSelect) return;

        // Keep current selections if possible
        const cType = typeSelect.value;
        const cSec = sectorSelect.value;
        const cYear = yearSelect.value;
        const cStatus = statusSelect ? statusSelect.value : 'all';
        const cCoreCat = coreCatSelect ? coreCatSelect.value : 'all';
        const cSubCat = subCatSelect ? subCatSelect.value : 'all';

        typeSelect.innerHTML = '<option value="all">All</option>';
        sectorSelect.innerHTML = '<option value="all">All</option>';
        yearSelect.innerHTML = '<option value="all">All</option>';
        if (statusSelect) {
            statusSelect.innerHTML = '<option value="all">Status: All</option><option value="not_closed">All except Closed</option>';
        }
        if (coreCatSelect) coreCatSelect.innerHTML = '<option value="all">Core: All</option>';
        if (subCatSelect) subCatSelect.innerHTML = '<option value="all">Sub: All</option>';

        [...types].sort().forEach(t => { typeSelect.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`); });
        [...sectors].sort().forEach(s => { sectorSelect.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`); });
        [...years].sort((a,b) => b.localeCompare(a)).forEach(y => { yearSelect.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`); });
        
        if (coreCatSelect) {
            [...coreCategories].sort().forEach(c => { coreCatSelect.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`); });
        }
        if (subCatSelect) {
            [...subCategories].sort().forEach(s => { subCatSelect.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`); });
        }
        if (statusSelect) {
            [...statuses].sort().forEach(st => {
                if (st && st !== 'CLOSED') {
                    statusSelect.insertAdjacentHTML('beforeend', `<option value="${st}">${st}</option>`);
                }
            });
            if (statuses.has('CLOSED')) {
                statusSelect.insertAdjacentHTML('beforeend', `<option value="CLOSED">CLOSED</option>`);
            }
        }

        typeSelect.value = types.has(cType) ? cType : 'all';
        sectorSelect.value = sectors.has(cSec) ? cSec : 'all';
        yearSelect.value = years.has(cYear) ? cYear : 'all';
        if (statusSelect) {
            statusSelect.value = (statuses.has(cStatus) || cStatus === 'not_closed') ? cStatus : 'all';
        }
    }

    function applyFilters() {
        if (!currentData) return;
        
        const typeSelect = document.getElementById('pfilter-loan-type');
        const sectorSelect = document.getElementById('pfilter-loan-sector');
        const yearSelect = document.getElementById('pfilter-economic-year');
        const statusSelect = document.getElementById('pfilter-loan-status');
        const topNInput = document.getElementById('ui-top-loans');
        
        const typeFilter = typeSelect ? typeSelect.value : 'all';
        const sectorFilter = sectorSelect ? sectorSelect.value : 'all';
        const yearFilter = yearSelect ? yearSelect.value : 'all';
        const statusFilter = statusSelect ? statusSelect.value : 'all';
        const topN = topNInput && topNInput.value ? parseInt(topNInput.value) : null;

        let filtered = currentData.filter(item => {
            if (typeFilter !== 'all' && (item['ঋণের ধরণ'] || '').toString().trim() !== typeFilter) return false;
            if (sectorFilter !== 'all' && (item._sector || '').toString().trim() !== sectorFilter) return false;
            
            if (statusFilter === 'not_closed') {
                const itemStatus = (item['স্ট্যাটাস'] || '').toString().toUpperCase();
                if (itemStatus.includes('CLOSED')) return false;
            } else if (statusFilter !== 'all') {
                const itemStatus = (item['স্ট্যাটাস'] || '').toString().toUpperCase();
                // We check if the exact keyword exists in the string
                if (!itemStatus.includes(statusFilter)) {
                    return false;
                }
            }
            
            if (yearFilter !== 'all') {
                const dDate = item._distDate || parseDate(item['বিতরণের তারিখ']);
                if (dDate instanceof Date && !isNaN(dDate)) {
                    let year = dDate.getFullYear();
                    let month = dDate.getMonth() + 1;
                    let ecYear = month < 7 ? `${year-1}-${year}` : `${year}-${year+1}`;
                    if (ecYear !== yearFilter) return false;
                } else {
                    return false; // Cannot filter if no valid date
                }
            }
            return true;
        });
        if (topN && topN > 0) {
            // Sort by 'বর্তমান স্থিতি' descending
            filtered.sort((a, b) => {
                let valA = parseFloat((a['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
                let valB = parseFloat((b['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
                return valB - valA;
            });
            filtered = filtered.slice(0, topN);
        }

        renderPages(filtered);
        
        // Silently update the breakdown stats for the printable title page
        if (typeof window.showBreakdown === 'function') {
            window.showBreakdown(true);
        }
    }

    // Expose applyFilters globally so inline onchange="applyFilters()" works
    window.applyFilters = applyFilters;

    function exportToExcel() {
        if (!currentData || currentData.length === 0) return;
        
        // Grab the currently displayed data by applying the current filters again
        const typeSelect = document.getElementById('pfilter-loan-type');
        const sectorSelect = document.getElementById('pfilter-loan-sector');
        const yearSelect = document.getElementById('pfilter-economic-year');
        const statusSelect = document.getElementById('pfilter-loan-status');
        const topNInput = document.getElementById('ui-top-loans');
        
        const typeFilter = typeSelect ? typeSelect.value : 'all';
        const sectorFilter = sectorSelect ? sectorSelect.value : 'all';
        const yearFilter = yearSelect ? yearSelect.value : 'all';
        const statusFilter = statusSelect ? statusSelect.value : 'all';
        const topN = topNInput && topNInput.value ? parseInt(topNInput.value) : null;

        let filtered = currentData.filter(item => {
            if (typeFilter !== 'all' && (item['ঋণের ধরণ'] || '').toString().trim() !== typeFilter) return false;
            if (sectorFilter !== 'all' && (item._sector || '').toString().trim() !== sectorFilter) return false;
            if (statusFilter !== 'all' && !(item['স্ট্যাটাস'] || '').toString().toUpperCase().includes(statusFilter)) return false;
            if (yearFilter !== 'all') {
                const dDate = item._distDate || parseDate(item['বিতরণের তারিখ']);
                if (dDate instanceof Date && !isNaN(dDate)) {
                    let year = dDate.getFullYear();
                    let month = dDate.getMonth() + 1;
                    let ecYear = month < 7 ? `${year-1}-${year}` : `${year}-${year+1}`;
                    if (ecYear !== yearFilter) return false;
                } else return false;
            }
            return true;
        });

        if (topN && topN > 0) {
            filtered.sort((a, b) => {
                let valA = parseFloat((a['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
                let valB = parseFloat((b['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
                return valB - valA;
            });
            filtered = filtered.slice(0, topN);
        }

        const exportData = filtered.map((item, index) => {
            let distDateDisplay = item['বিতরণের তারিখ'] || '';
            let expDateDisplay  = item['দেয় তারিখ'] || '';
            if (item._distDate instanceof Date && !isNaN(item._distDate))
                distDateDisplay = `${item._distDate.getDate().toString().padStart(2,'0')}/${(item._distDate.getMonth()+1).toString().padStart(2,'0')}/${item._distDate.getFullYear()}`;
            if (item._expDate instanceof Date && !isNaN(item._expDate))
                expDateDisplay = `${item._expDate.getDate().toString().padStart(2,'0')}/${(item._expDate.getMonth()+1).toString().padStart(2,'0')}/${item._expDate.getFullYear()}`;

            return {
                "ক্রম": (index + 1),
                "হিসাব নম্বর": item['হিসাব নম্বর'] || '',
                "ঋণের ধরণ": item['ঋণের ধরণ'] || '',
                "নাম ও পিতার নাম": item['নাম ও পিতার নাম'] || '',
                "বাড়ি ও গ্রাম": item['বাড়ি ও গ্রাম'] || '',
                "পোস্ট": item['পোস্ট'] || '',
                "থানা/উপজেলা": item['থানা/উপজেলা'] || '',
                "ঋণের পরিমাণ": item['ঋণের পরিমাণ'] || '',
                "বিতরণের তারিখ": distDateDisplay,
                "দেয় তারিখ": expDateDisplay,
                "বর্তমান স্থিতি": item['বর্তমান স্থিতি'] || '',
                "মোবাইল": item['মোবাইল'] || '',
                "স্ট্যাটাস": item['স্ট্যাটাস'] || '',
                "শ্রেণীমান": item['শ্রেণীমান'] || '',
                "মন্তব্য": item['মন্তব্য'] || ''
            };
        });

        if (typeof XLSX === 'undefined') {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel library not loaded.'); else alert('Excel library not loaded.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook  = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Borrower List");

        let filename = "Borrower_List";
        if (topN) filename += "_Top_" + topN;
        if (statusFilter !== 'all') filename += "_" + statusFilter;
        filename += ".xlsx";

        XLSX.writeFile(workbook, filename);
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel Exported successfully! Check your default Downloads folder.'); else alert('Excel Exported successfully! Check your default Downloads folder.');
    }

    function handleStatusUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            const data = new Uint8Array(evt.target.result);
            if (typeof XLSX === 'undefined') {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel library not loaded.'); else alert('Excel library not loaded.');
                return;
            }
            const workbook      = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet     = workbook.Sheets[firstSheetName];

            // Header is on row 11 (index 10)
            const statusData = XLSX.utils.sheet_to_json(worksheet, { range: 10, defval: "" });

            if (statusData.length === 0) {
                if(window.parent && window.parent.showAppToast) window.parent.showAppToast('No status data found in the Excel file.'); else alert('No status data found in the Excel file.');
                return;
            }

            // Build lookup map keyed by ACCOUNTNO
            const statusMap = {};
            statusData.forEach(row => {
                if (row['ACCOUNTNO']) {
                    statusMap[row['ACCOUNTNO'].toString().trim()] = row;
                }
            });

            let updatedCount = 0;
            currentData.forEach(item => {
                const accNo = (item['হিসাব নম্বর'] || '').toString().trim();
                if (!accNo || !statusMap[accNo]) return;
                const statusRow = statusMap[accNo];

                // Balance: positive = credit anomaly
                if (statusRow['AMTBAL_TK'] !== undefined && statusRow['AMTBAL_TK'] !== "") {
                    let balVal = parseFloat(statusRow['AMTBAL_TK'].toString().replace(/[^\d.-]/g, ''));
                    if (!isNaN(balVal)) {
                        item._isCreditBalance = balVal > 0;
                        item['বর্তমান স্থিতি'] = Math.abs(balVal);
                    } else {
                        item['বর্তমান স্থিতি'] = statusRow['AMTBAL_TK'];
                    }
                }

                // CBS Classification Status
                if (statusRow['CLASSIFIED'] !== undefined && statusRow['CLASSIFIED'] !== "") {
                    item['স্ট্যাটাস'] = statusRow['CLASSIFIED'];
                }

                const intRate = statusRow['INTEREST_RATE'] || statusRow['INTRATE'] || statusRow['INT_RATE'] || statusRow['RATE'] || statusRow['INTEREST'];
                if (intRate !== undefined && intRate !== "") {
                    item['interest_rate'] = intRate;
                }

                // Due / Expiry Date
                let expDate = statusRow['EXPIRY_DATE'] || statusRow['EXPDATE'] || statusRow['DUE_DATE'] || statusRow['EXP_DATE'] || statusRow['LIMIT_EXPIRY'] || statusRow['EXPIRY_DT'];
                if (expDate !== undefined && expDate !== "") {
                    if (typeof expDate === 'number') {
                        const d = parseDate(expDate);
                        if (d) expDate = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
                    }
                    item['দেয় তারিখ'] = expDate;
                    item._expDate = parseDate(expDate);
                }

                // Renew Date — BL loans must not be tagged Renewed
                let renewDate = statusRow['RENEW_DATE'];
                if (renewDate !== undefined && renewDate !== "") {
                    if (typeof renewDate === 'number') {
                        const d = parseDate(renewDate);
                        if (d) renewDate = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
                    }
                    if (!item._original_dist_date && item['বিতরণের তারিখ']) {
                        item._original_dist_date = item['বিতরণের তারিখ'];
                    }
                    item['বিতরণের তারিখ'] = renewDate;
                    item._distDate = parseDate(renewDate);
                }

                // (Renewed marking disabled per user request)
                
                updatedCount++;
            });

            // Sync any CLOSED statuses to the central DB
            if (window.syncClosedLoansToDB) window.syncClosedLoansToDB();

            if(window.parent && window.parent.showAppToast) window.parent.showAppToast(`Successfully updated status for ${updatedCount} accounts.`); else alert(`Successfully updated status for ${updatedCount} accounts.`);
            saveCurrentList();
            applyFilters();
        };
        reader.readAsArrayBuffer(file);

        // Reset input so same file can be re-uploaded if needed
        e.target.value = '';
    }

    // --- CLASSIFICATION LOGIC ---
    window.applyClassificationsToList = function() {
        if (!currentData || currentData.length === 0) {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast("No borrower data to classify."); else alert('No borrower data to classify.');
            return;
        }

        let today = new Date();
        const asOfInput = document.getElementById('ui-as-of-date');
        if (asOfInput && asOfInput.value) {
            today = new Date(asOfInput.value);
            today.setHours(23, 59, 59, 999);
        } else {
            today.setHours(0, 0, 0, 0);
        }

        // Economic year: Jul 1 to Jun 30
        const todayMonth = today.getMonth() + 1;
        let ecoYearStart, ecoYearEnd;
        if (todayMonth >= 7) {
            ecoYearStart = new Date(today.getFullYear(), 6, 1);
            ecoYearEnd   = new Date(today.getFullYear() + 1, 5, 30, 23, 59, 59);
        } else {
            ecoYearStart = new Date(today.getFullYear() - 1, 6, 1);
            ecoYearEnd   = new Date(today.getFullYear(), 5, 30, 23, 59, 59);
        }

        // Signed months overdue: positive = past due, negative = not yet due
        function signedMonthDiff(dueDate, asOf) {
            if (!dueDate || !(dueDate instanceof Date) || isNaN(dueDate)) return -999;
            let months = (asOf.getFullYear() - dueDate.getFullYear()) * 12;
            months += asOf.getMonth() - dueDate.getMonth();
            if (asOf.getDate() < dueDate.getDate()) months--;
            return months;
        }

        let updatedCount = 0;

        currentData.forEach(r => {
            // 1. Carry over CBS confirmed SS/DF/BL as-is
            const cbsStatus = (r['à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸'] || '').trim().toUpperCase();
            if (['SS', 'DF', 'BL'].includes(cbsStatus)) {
                r['à¦¶à§à¦°à§‡à¦£à§€à¦®à¦¾à¦¨'] = cbsStatus;
            }

            // 2. Parse disbursement / renewal date
            let dDate = r._distDate;
            if (!(dDate instanceof Date) || isNaN(dDate)) {
                dDate = parseDate(String(r['বিতরণের তারিখ'] || '').trim());
            }

            // 3. Parse due / expiry date
            let expiryDate = r._expDate;
            if (!(expiryDate instanceof Date) || isNaN(expiryDate)) {
                expiryDate = parseDate(String(r['দেয় তারিখ'] || r['মেয়াদ উত্তীর্ণ'] || '').trim());
            }

            // 4. Disbursed or renewed in the CURRENT economic year (clears comment)
            if (dDate instanceof Date && !isNaN(dDate) && dDate >= ecoYearStart && dDate <= ecoYearEnd) {
                r['মন্তব্য'] = (r['মন্তব্য'] || '').toString()
                    .replace(/WCL-\d/g, '')
                    .replace(/<span[^>]*>Renewed<\/span>/ig, '')
                    .replace(/Renewed/ig, '')
                    .trim();
                updatedCount++;
                return;
            }

            // 5. No due date -> row already highlighted red in UI; skip
            if (!(expiryDate instanceof Date) || isNaN(expiryDate)) {
                return;
            }

            // 6. Calculate months overdue based on the As Of Date (today)
            const monthsOverdue = signedMonthDiff(expiryDate, today);

            // Strip out old classification comments and Renewed tags
            let comment = (r['মন্তব্য'] || '').toString()
                .replace(/WCL-\d/g, '')
                .replace(/<span[^>]*>Renewed<\/span>/ig, '')
                .replace(/Renewed/ig, '')
                .trim();

            let todayEcoYear = today.getFullYear();
            if (today.getMonth() + 1 < 7) todayEcoYear -= 1;

            let ssDate = new Date(expiryDate);
            ssDate.setMonth(ssDate.getMonth() + 3);
            
            let ssEcoYear = ssDate.getFullYear();
            if (ssDate.getMonth() + 1 < 7) ssEcoYear -= 1;

            let ssMonth = ssDate.getMonth() + 1;
            let wclClass = '';
            
            // Only assign the WCL tag if the loan's SS date falls within the CURRENT Economic Year
            if (ssEcoYear === todayEcoYear) {
                if      (ssMonth >= 7  && ssMonth <= 9)  wclClass = 'WCL-1';
                else if (ssMonth >= 10 && ssMonth <= 12) wclClass = 'WCL-2';
                else if (ssMonth >= 1  && ssMonth <= 3)  wclClass = 'WCL-3';
                else if (ssMonth >= 4  && ssMonth <= 6)  wclClass = 'WCL-4';
            }

            // WCL means "Would Be Classified". If the loan is ALREADY mathematically SS/DF/BL, or if the CBS file already marked it as such, it MUST NOT get a WCL tag!
            const isAlreadyClassified = ['SS', 'DF', 'BL'].includes(cbsStatus) || monthsOverdue >= 3;
            
            if (isAlreadyClassified) {
                r['মন্তব্য'] = comment;
            } else {
                r['মন্তব্য'] = comment ? (comment + (wclClass ? ' ' + wclClass : '')) : wclClass;
            }
            updatedCount++;
        });

        if (typeof saveCurrentList === 'function') saveCurrentList();
        applyFilters();
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast(`Classification applied to ${updatedCount} records successfully.`); else alert(`Classification applied to ${updatedCount} records successfully.`);
    };

    // --- PROGRESS REPORT LOGIC ---
    window.generateProgressReport = async function() {
        const f1 = document.getElementById('filePrevProgress').files[0];
        const f2 = document.getElementById('fileCurrProgress').files[0];
        if(!f1 || !f2) { if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Please select both Previous and Current module files.'); else alert('Please select both Previous and Current module files.'); return; }
        
        if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
            // Try to load jsPDF dynamically if not present
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('jsPDF and jsPDF-AutoTable libraries not loaded. Please ensure they are available in the system.'); else alert('jsPDF and jsPDF-AutoTable libraries not loaded. Please ensure they are available in the system.'); 
            return;
        }

        const readExcelFile = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    if(typeof XLSX === 'undefined') reject(new Error('SheetJS not loaded'));
                    const wb = XLSX.read(data, {type: 'binary'});
                    resolve(wb);
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });

        const parseModule = (wb) => {
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet, { range: 11, defval: "" });
            
            // Get module date
            const dateCell = sheet['A7'];
            let moduleDate = new Date();
            if (dateCell) {
                let v = String((dateCell.w !== undefined) ? dateCell.w : dateCell.v).trim();
                const m = v.match(/^(\d{1,2})\D(\d{1,2})\D(\d{2,4})$/);
                if(m){
                    let year = Number(m[3]);
                    if (year < 100) year += (year >= 50 ? 1900 : 2000);
                    moduleDate = new Date(year, Number(m[2])-1, Number(m[1]));
                }
            }

            const branchText = sheet['A5'] ? String(sheet['A5'].v || '') : '';
            const branchName = branchText.replace(/^(Select Branch|Branch Name)[\s-:]*/i, '').trim() || 'Unknown';

            const parsed = [];
            data.forEach(row => {
                if (row['ACCOUNTNO']) {
                    const balance = Number(String(row['AMTBAL_TK']).replace(/[^0-9.-]+/g, '')) || 0;
                    parsed.push({
                        ACCOUNTNO: String(row['ACCOUNTNO']).trim(),
                        CLASSIFIED: String(row['CLASSIFIED'] || '').trim().toUpperCase(),
                        AMTBAL_TK: Math.abs(balance)
                    });
                }
            });
            return { date: moduleDate, branchName, rows: parsed };
        };

        try {
            const wb1 = await readExcelFile(f1);
            const wb2 = await readExcelFile(f2);
            
            const d1 = parseModule(wb1);
            const d2 = parseModule(wb2);
            
            // For true progress, we would run classification logic on the modules.
            // Since we just have status strings or we assume they are already classified.
            // But we will use the raw strings from the module if available, or just map what we have.
            // Wait, in loan_classification_tool we classified them first:
            // But here let's just use what's in the file, or rely on the fact that progress report looks at changes in amounts/counts by CLASSIFIED status.
            
            const loanStatuses = ['SS', 'DF', 'BL', 'WCL-1', 'WCL-2', 'WCL-3', 'WCL-4', 'UC'];
            const summary1 = {};
            const summary2 = {};
            loanStatuses.forEach(s => {
                summary1[s] = { count: 0, amount: 0 };
                summary2[s] = { count: 0, amount: 0 };
            });
    
            d1.rows.forEach(r => {
                if (summary1[r.CLASSIFIED]) {
                    summary1[r.CLASSIFIED].count++;
                    summary1[r.CLASSIFIED].amount += r.AMTBAL_TK;
                }
            });
            d2.rows.forEach(r => {
                if (summary2[r.CLASSIFIED]) {
                    summary2[r.CLASSIFIED].count++;
                    summary2[r.CLASSIFIED].amount += r.AMTBAL_TK;
                }
            });
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'legal' });
            
            const margin = 0.3;
            const startY = margin + 1.0;
    
            doc.setFontSize(16);
            doc.text(`Progress Report of Loan Recovery`, doc.internal.pageSize.getWidth() / 2, margin + 0.2, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Date from: ${d1.date.toLocaleDateString('en-GB')} to ${d2.date.toLocaleDateString('en-GB')}`, doc.internal.pageSize.getWidth() / 2, margin + 0.5, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Branch: ${d2.branchName}`, margin, margin + 0.7);
    
            const body = [];
            loanStatuses.forEach(type => {
                if(type === 'UC') return; // Exclude UC from main progress table if desired, but good to have
                const countDiff = summary1[type].count - summary2[type].count;
                const amountDiff = summary1[type].amount - summary2[type].amount;
                body.push([
                    `${type}-Number`,
                    summary1[type].count.toLocaleString('en-IN'),
                    summary2[type].count.toLocaleString('en-IN'),
                    countDiff.toLocaleString('en-IN')
                ]);
                body.push([
                    `${type}-Amount`,
                    Math.round(summary1[type].amount).toLocaleString('en-IN'),
                    Math.round(summary2[type].amount).toLocaleString('en-IN'),
                    Math.round(amountDiff).toLocaleString('en-IN')
                ]);
            });
            
            doc.autoTable({
                head: [['Type', 'Previous', 'Current', 'Progress (Recovery)']],
                body: body,
                startY: startY,
                theme: 'grid',
                margin: { left: margin, right: margin },
                headStyles: { halign: 'center', fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                }
            });
            
            doc.save(`Progress_Report_${d2.branchName.replace(/ /g, '_')}.pdf`);
            document.getElementById('progress-report-modal').style.display = 'none';
        } catch (e) {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Error generating report: ' + e.message, true); else alert('Error generating report: ' + e.message);
        }
    };

    // Initialize on load
    window.addEventListener('DOMContentLoaded', init);

    window.markLoanClosed = function(id, customDateStr) {
    if(!id) return;
    
    let closingStr = customDateStr;
    if (!closingStr) {
        const d = new Date();
        closingStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    }
    
    const idx = currentData.findIndex(x => String(x._id) === String(id));
    if(idx > -1) {
        let existingComment = currentData[idx]['মন্তব্য'] || "";
        const newCloseText = "Closed on: " + closingStr;
        
        // Remove old 'Closed on: ...' text to prevent duplicates
        existingComment = existingComment.replace(/(?:\|\s*)?Closed on:\s*[^|]*/g, "").trim();
        existingComment = existingComment.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '');
        
        currentData[idx]['স্ট্যাটাস'] = 'Closed';
        currentData[idx]['মন্তব্য'] = existingComment ? (existingComment + " | " + newCloseText) : newCloseText;
    }
};

// Checkbox selection logic
    window.toggleAllCheckboxes = function(source) {
    const checkboxes = document.querySelectorAll('.loan-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    window.updateActionState();
};

    window.updateActionState = function() {
    // Legacy function, kept so it doesn't break toggleAllCheckboxes
};

// Add dropdown toggle event in parent context
if (window.parent && window.parent.document) {
    // We attach an observer or use event delegation since the button might be created after script loads
    window.parent.document.addEventListener('click', function(e) {
        // Kept for consistency, originally handled dropdown closing
    });
}

    window.handleSidebarAction = function(action, type) {
    const dropdown = window.parent.document.getElementById('paction-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    if (action === 'clear_all') {
        if (confirm("Are you sure you want to clear the entire list? This action cannot be undone.")) {
            currentData = [];
            saveCurrentList();
            applyFilters();
        }
        return;
    }

    const checkboxes = document.querySelectorAll('.loan-checkbox:checked');
    if (checkboxes.length === 0) {
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast("Please select at least one loan."); else alert("Please select at least one loan.");
        return;
    }
    
    if (action === 'categorize') {
        const modal = document.getElementById('categorizeModal');
        const countDiv = document.getElementById('categorizeSelectedCount');
        if (countDiv) countDiv.innerText = checkboxes.length + ' Loans Selected';
        
        document.getElementById('coreCategory').value = '';
        window.updateSubCategories();
        
        if (modal) modal.style.display = 'flex';
        return;
    }
    
    if (action === 'delete') {
        if (confirm(`Are you sure you want to delete the ${checkboxes.length} selected loan(s)?`)) {
            const idsToDelete = Array.from(checkboxes).map(cb => String(cb.value));
            currentData = currentData.filter(item => !idsToDelete.includes(String(item._id)));
            saveCurrentList();
            applyFilters();
        }
        return;
    }
    
    if (action === 'notice') {
        const selectedIds = Array.from(checkboxes).map(cb => String(cb.value));
        
        let url = '';
        if (type === 'Demand Notice') url = 'forms/notice/demand_notice.html';
        else if (type === 'Legal Notice') url = 'forms/notice/legal_notice.html';
        else if (type === 'Advocate Notice') url = 'forms/notice/advocate_notice.html';
        else if (type === 'Final Notice') url = 'forms/notice/final_notice.html';
        else if (type === 'Special Notice') url = 'forms/notice/special_notice.html';
        else if (type === 'Camp Notice') url = 'forms/notice/camp_notice.html';
        
        if (url) {
            // Helper for Number to Bangla Words
            function convertToBanglaWords(num) {
                if (!num || isNaN(num) || num <= 0) return '';
                const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'উননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
                function convert(n) {
                    if (n < 100) return units[n];
                    if (n < 1000) return units[Math.floor(n / 100)] + ' শত' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
                    if (n < 100000) return convert(Math.floor(n / 1000)) + ' হাজার' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
                    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' লক্ষ' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
                    if (n >= 10000000) return convert(Math.floor(n / 10000000)) + ' কোটি' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
                    return '';
                }
                return convert(Math.floor(Number(num)));
            }

            // Get Date from "As Of:" or default to Today
            let noticeDate = '';
            const asOfInput = document.getElementById('ui-as-of-date');
            if (asOfInput && asOfInput.value) {
                const parts = asOfInput.value.split('-');
                if (parts.length === 3) noticeDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            if (!noticeDate) {
                const d = new Date();
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                noticeDate = `${day}/${month}/${year}`;
            }

            const selectedLoans = currentData.filter(item => selectedIds.includes(String(item._id))).map(item => {
                let loan = { ...item };
                loan.notice_date = noticeDate;
                
                // 1. Extract Name & Father's Name
                let name = loan['নাম'] || '';
                let father = loan['পিতা/স্বামীর নাম'] || loan['পিতার নাম'] || loan['পিতা'] || '';
                if (!name || !father) {
                    const full = (loan['নাম ও পিতার নাম'] || '').trim();
                    if (full) {
                        if (full.includes('\n')) {
                            const lines = full.split('\n').map(s => s.trim()).filter(Boolean);
                            if (!name && lines[0]) name = lines[0].replace(/^নাম\s*[:ঃ\-]/, '').trim();
                            if (!father && lines[1]) father = lines[1].replace(/^(পিতা|স্বামী|পিতা\/স্বামী)\s*[:ঃ\-]?/, '').trim();
                        } else {
                            const match = full.match(/^(.*?)(?:[\s,]+|\s+ও\s+)(?:পিতা|স্বামী|পিতা\/স্বামী)\s*[:ঃ\-\s]+(.*)$/i);
                            if (match) {
                                if (!name) name = match[1].replace(/^নাম\s*[:ঃ\-]/, '').trim();
                                if (!father) father = match[2].trim();
                            } else {
                                const oMatch = full.match(/^(.*?)\s+ও\s+(.*)$/);
                                if (oMatch) {
                                    if (!name) name = oMatch[1].trim();
                                    if (!father) father = oMatch[2].replace(/^(পিতা|স্বামী)\s*[:ঃ\-]?/, '').trim();
                                } else if (!name) {
                                    name = full;
                                }
                            }
                        }
                    }
                }
                loan['নাম'] = name;
                loan['পিতা/স্বামীর নাম'] = father;

                // 2. Extract Village, Post, Upazila, District
                let village = loan['গ্রাম'] || '';
                let post = loan['পোস্ট'] || '';
                let upazila = loan['থানা/উপজেলা'] || loan['উপজেলা'] || loan['থানা'] || '';
                let district = loan['জেলা'] || loan['_district'] || '';
                let mobile = loan['মোবাইল'] || loan['মোবাইল নম্বর'] || '';

                const rawAddr = (loan['বাড়ি ও গ্রাম (পোস্ট, উপজেলা, জেলা)'] || loan['বাড়ি ও গ্রাম'] || '').trim();
                let house = '';
                let union = '';
                if (rawAddr) {
                    const hMatch = rawAddr.match(/(?:বাড়ি|বাড়ি)\s*[:ঃ\-]?\s*([^,]+)/);
                    const vMatch = rawAddr.match(/গ্রাম\s*[:ঃ\-]?\s*([^,]+)/);
                    const unMatch = rawAddr.match(/(?:ইউনিয়ন|ইউ\/পৌর|পৌরসভা|ইউনিয়ন)\s*[:ঃ\-]?\s*([^,]+)/);
                    const pMatch = rawAddr.match(/পোস্ট\s*[:ঃ\-]?\s*([^,]+)/);
                    const uMatch = rawAddr.match(/(?:উপজেলা|থানা)\s*[:ঃ\-]?\s*([^,]+)/);
                    const dMatch = rawAddr.match(/জেলা\s*[:ঃ\-]?\s*([^,]+)/);

                    if (hMatch) house = hMatch[1].trim();
                    if (!village && vMatch) village = vMatch[1].trim();
                    if (unMatch) union = unMatch[1].trim();
                    if (!post && pMatch) post = pMatch[1].trim();
                    if (!upazila && uMatch) upazila = uMatch[1].trim();
                    if (!district && dMatch) district = dMatch[1].trim();

                    if (!village) {
                        const parts = rawAddr.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
                        if (parts.length === 1) {
                            village = parts[0].replace(/^গ্রাম\s*[:ঃ\-]?/, '').trim();
                        } else if (parts.length >= 2) {
                            if (!village) village = parts[0].replace(/^গ্রাম\s*[:ঃ\-]?/, '').trim();
                            if (!post && parts[1]) post = parts[1].replace(/^পোস্ট\s*[:ঃ\-]?/, '').trim();
                            if (!upazila && parts[2]) upazila = parts[2].replace(/^(?:উপজেলা|থানা)\s*[:ঃ\-]?/, '').trim();
                            if (!district && parts[3]) district = parts[3].replace(/^জেলা\s*[:ঃ\-]?/, '').trim();
                        }
                    }
                }

                loan['বাড়ি'] = house;
                loan['গ্রাম'] = village;
                loan['ইউনিয়ন'] = union;
                loan['পোস্ট'] = post;
                loan['থানা/উপজেলা'] = upazila;
                
                // Branch District lookup
                let branchDistrict = '';
                try {
                    if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
                        const bData = window.parent.getCentralBranchData();
                        if (bData && bData.districtBn) branchDistrict = bData.districtBn;
                    } else if (typeof window.getCentralBranchData === 'function') {
                        const bData = window.getCentralBranchData();
                        if (bData && bData.districtBn) branchDistrict = bData.districtBn;
                    }
                } catch(e) {}

                // Use branch district as primary district, fallback to extracted district
                let finalDistrict = branchDistrict || district || '';
                
                // Format District with Mobile
                let districtFormatted = finalDistrict;
                if (mobile) {
                    let mobileBn = toBanglaNumbers(mobile);
                    districtFormatted = districtFormatted ? (districtFormatted + ', মোবাইল নং: ' + mobileBn) : ('মোবাইল নং: ' + mobileBn);
                }
                loan['জেলা'] = districtFormatted;

                // 3. Format Dates (Bangla)
                let distDate = loan['বিতরণের তারিখ'] || '';
                if (loan._distDate instanceof Date && !isNaN(loan._distDate)) {
                    distDate = `${loan._distDate.getDate().toString().padStart(2,'0')}/${(loan._distDate.getMonth()+1).toString().padStart(2,'0')}/${loan._distDate.getFullYear()}`;
                }
                loan['বিতরণের তারিখ'] = toBanglaNumbers(distDate);

                let expDate = loan['দেয় তারিখ'] || loan['মেয়াদ উত্তীর্ণ'] || '';
                if (loan._expDate instanceof Date && !isNaN(loan._expDate)) {
                    expDate = `${loan._expDate.getDate().toString().padStart(2,'0')}/${(loan._expDate.getMonth()+1).toString().padStart(2,'0')}/${loan._expDate.getFullYear()}`;
                }
                loan['দেয় তারিখ'] = toBanglaNumbers(expDate);
                loan['notice_date'] = toBanglaNumbers(noticeDate);

                // Account Number to Bangla
                loan['হিসাব নম্বর'] = toBanglaNumbers(loan['হিসাব নম্বর'] || loan['_caseNo'] || '');

                // 4. Format Amounts and Words
                let principal = parseFloat(String(loan['ঋণের পরিমাণ'] || loan['মঞ্জুরীকৃত পরিমাণ'] || 0).replace(/[^\d.]/g, '')) || 0;
                let balance = parseFloat(String(loan['বর্তমান স্থিতি'] || loan['বকেয়া স্থিতি'] || loan['cbs_balance'] || 0).replace(/[^\d.]/g, '')) || 0;

                loan['ঋণের পরিমাণ'] = toBanglaNumbers(principal ? principal.toLocaleString('en-IN') : (loan['ঋণের পরিমাণ'] || ''));
                loan['loan_amount_words'] = convertToBanglaWords(principal);

                loan['বর্তমান স্থিতি'] = toBanglaNumbers(balance ? balance.toLocaleString('en-IN') : (loan['বর্তমান স্থিতি'] || ''));
                loan['total_due_words'] = convertToBanglaWords(balance);
                loan['upcoming_total_num'] = loan['বর্তমান স্থিতি'];
                loan['upcoming_total_words'] = loan['total_due_words'];

                // 5. Manager Name
                let managerName = '';
                try {
                    managerName = localStorage.getItem('bkb_manager_name') || '';
                    if (!managerName && window.parent && window.parent.localStorage) {
                        managerName = window.parent.localStorage.getItem('bkb_manager_name') || '';
                    }
                } catch(e) {}
                loan['manager_name'] = managerName;
                
                return loan;
            });
            window.parent.sessionStorage.setItem('pending_notice_data', JSON.stringify(selectedLoans));
            window.parent.sessionStorage.setItem('pending_notice_ids', JSON.stringify(selectedIds));
            window.parent.sessionStorage.setItem('pending_notice_type', type);
            
            if (typeof window.parent.openLocalForm === 'function') {
                window.parent.openLocalForm(url, type);
            } else {
                window.parent.open(url, '_blank');
            }
        }
        return;
    } else if (action === 'close') {
        const modal = document.getElementById('closeModal');
        const countDiv = document.getElementById('closeSelectedCount');
        if (countDiv) countDiv.innerText = checkboxes.length + ' Loans Selected';
        
        const dateInput = document.getElementById('closeDateInput');
        if (dateInput) {
            const d = new Date();
            dateInput.value = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        }
        
        if (modal) modal.style.display = 'flex';
    } else {
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast('This action (' + action + ') is under development.'); else alert('This action (' + action + ') is under development.');
    }
};

    window.generateNotice = function() {
    const checkboxes = document.querySelectorAll('.loan-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const noticeType = document.getElementById('noticeType').value;
    if(selectedIds.length === 0) return;
    
    // Store selection for the notice page
    window.parent.sessionStorage.setItem('pending_notice_ids', JSON.stringify(selectedIds));
    window.parent.sessionStorage.setItem('pending_notice_type', noticeType);
    
    // Hide modal
    document.getElementById('noticeModal').style.display = 'none';
    
    // Open notice page in new tab via parent router/window
    window.parent.open('forms/monitoring/notice.html', '_blank');
};

    window.confirmCloseLoan = function() {
    const checkboxes = document.querySelectorAll('.loan-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    let dateStr = "";
    const dateInput = document.getElementById('closeDateInput');
    if (dateInput) {
        dateStr = dateInput.value.trim();
    }
    
    checkboxes.forEach(cb => window.markLoanClosed(cb.value, dateStr));
    saveCurrentList();
    applyFilters();
    
    const modal = document.getElementById('closeModal');
    if (modal) modal.style.display = 'none';
};



// Save inline edits
    window.addEventListener('blur', function(e) {
    if (e.target && typeof e.target.hasAttribute === 'function' && e.target.hasAttribute('contenteditable')) {
        const id = e.target.getAttribute('data-id');
        const col = e.target.getAttribute('data-col');
        if (id && currentData) {
            const idx = currentData.findIndex(x => String(x._id) === String(id));
            if (idx > -1) {
                if (e.target.classList.contains('comment-cell')) {
                    currentData[idx]['???????'] = e.target.innerText.trim();
                } else if (col) {
                    currentData[idx][col] = e.target.innerText.trim();
                }
                saveCurrentList();
            }
        }
    }
}, true);

// Top Loans Filter Functions
    window.applyTopFilter = function() {
    if (!currentData || currentData.length === 0) return;
    const input = document.getElementById('ui-top-loans');
    if (!input || !input.value) {
        renderPages(currentData);
        return;
    }
    
    const topN = parseInt(input.value);
    if (isNaN(topN) || topN <= 0) {
        renderPages(currentData);
        return;
    }
    
    // Create a copy and sort by outstanding amount descending
    let sortedData = [...currentData].sort((a, b) => {
        const valA = parseFloat((a['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
        const valB = parseFloat((b['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
        return valB - valA;
    });
    
    const filtered = sortedData.slice(0, topN);
    renderPages(filtered);
};

    window.resetFilter = function() {
    const topN = document.getElementById('ui-top-loans');
    const type = document.getElementById('pfilter-loan-type');
    const sector = document.getElementById('pfilter-loan-sector');
    const year = document.getElementById('pfilter-economic-year');
    const status = document.getElementById('pfilter-loan-status');
    if (topN) topN.value = '';
    if (type) type.value = 'all';
    if (sector) sector.value = 'all';
    if (year) year.value = 'all';
    if (status) status.value = 'all';
    if (currentData) {
        renderPages(currentData);
    }
};

    window.showBreakdown = function(silent = false) {
    if (!window.currentRenderedData) return;
    const data = window.currentRenderedData;
    
    // Aggregation objects
    let types = {};
    let classes = {
        'Standard (UC)': { num: 0, amt: 0 },
        'WCL-1': { num: 0, amt: 0 },
        'WCL-2': { num: 0, amt: 0 },
        'WCL-3': { num: 0, amt: 0 },
        'WCL-4': { num: 0, amt: 0 },
        'SS': { num: 0, amt: 0 },
        'DF': { num: 0, amt: 0 },
        'BL': { num: 0, amt: 0 },
        'Others': { num: 0, amt: 0 }
    };
    
    let totalNum = 0;
    let totalAmt = 0;

    data.forEach(item => {
        let type = item['ঋণের ধরণ'] || 'Unknown';
        let status = (item['স্ট্যাটাস'] || '').toString().trim().toUpperCase();
        let comment = (item['মন্তব্য'] || '').toString().trim().toUpperCase();
        let bal = parseFloat((item['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
        
        totalNum++;
        totalAmt += bal;

        // By Type
        if (!types[type]) types[type] = { num: 0, amt: 0 };
        types[type].num++;
        types[type].amt += bal;

        // By Classification (WCL and Standard)
        if (comment.includes('WCL-1')) {
            classes['WCL-1'].num++; classes['WCL-1'].amt += bal;
        } else if (comment.includes('WCL-2')) {
            classes['WCL-2'].num++; classes['WCL-2'].amt += bal;
        } else if (comment.includes('WCL-3')) {
            classes['WCL-3'].num++; classes['WCL-3'].amt += bal;
        } else if (comment.includes('WCL-4')) {
            classes['WCL-4'].num++; classes['WCL-4'].amt += bal;
        } else if (status === 'UC') {
            classes['Standard (UC)'].num++; classes['Standard (UC)'].amt += bal;
        } else if (status === 'SS' || status === '2') {
            classes['SS'].num++; classes['SS'].amt += bal;
        } else if (status === 'DF' || status === '3') {
            classes['DF'].num++; classes['DF'].amt += bal;
        } else if (status === 'BL' || status === '4') {
            classes['BL'].num++; classes['BL'].amt += bal;
        } else {
            classes['Others'].num++; classes['Others'].amt += bal;
        }
    });

    // Populate Type Table
    const typeTbody = document.getElementById('breakdown-type-tbody');
    typeTbody.innerHTML = '';
    for (const [t, val] of Object.entries(types)) {
        typeTbody.innerHTML += `<tr><td>${t}</td><td style="text-align:center;">${val.num}</td><td style="text-align:right;">${val.amt.toLocaleString('en-IN')}/-</td></tr>`;
    }
    document.getElementById('breakdown-type-total-num').innerText = totalNum;
    document.getElementById('breakdown-type-total-amt').innerText = totalAmt.toLocaleString('en-IN') + '/-';

    // Build Nested Class Table
    let nestedTypes = {};
    data.forEach(item => {
        let type = (item['ঋণের ধরণ'] || 'Unknown').toString().trim();
        if (!type) type = 'Unknown';
        let statusRaw = (item['স্ট্যাটাস'] || 'UC').toString().trim().toUpperCase();
        if (!statusRaw) statusRaw = 'UC';
        
        let comment = (item['মন্তব্য'] || '').toString().trim().toUpperCase();
        let status = statusRaw;
        
        if (comment.includes('WCL-1')) status = 'WCL-1';
        else if (comment.includes('WCL-2')) status = 'WCL-2';
        else if (comment.includes('WCL-3')) status = 'WCL-3';
        else if (comment.includes('WCL-4')) status = 'WCL-4';
        else if (statusRaw === 'UC') status = 'Standard (UC)';
        let bal = parseFloat((item['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
        
        if (!nestedTypes[type]) nestedTypes[type] = { totalNum: 0, totalAmt: 0, statuses: {} };
        if (!nestedTypes[type].statuses[status]) nestedTypes[type].statuses[status] = { num: 0, amt: 0 };
        
        nestedTypes[type].totalNum++;
        nestedTypes[type].totalAmt += bal;
        nestedTypes[type].statuses[status].num++;
        nestedTypes[type].statuses[status].amt += bal;
    });

    const classTbody = document.getElementById('breakdown-class-tbody');
    const printClassTbody = document.getElementById('print-breakdown-class-tbody');
    
    if (classTbody) classTbody.innerHTML = '';
    if (printClassTbody) printClassTbody.innerHTML = '';
    
    Object.keys(nestedTypes).sort().forEach(type => {
        let typeData = nestedTypes[type];
        let statusKeys = Object.keys(typeData.statuses).sort();
        let rowSpan = statusKeys.length;
        
        statusKeys.forEach((status, idx) => {
            let statData = typeData.statuses[status];
            let tr = `<tr>`;
            if (idx === 0) {
                tr += `<td rowspan="${rowSpan}" style="vertical-align: middle; font-weight: bold; border: 1px solid #ddd; padding: 8px;">${type}</td>`;
            }
            tr += `<td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${status}</td>
                   <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${statData.num}</td>
                   <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${statData.amt.toLocaleString('en-IN')}/-</td>
                   </tr>`;
            if (classTbody) classTbody.innerHTML += tr;
            if (printClassTbody) printClassTbody.innerHTML += tr.replace(/#ddd/g, '#000'); // Print uses black borders
        });
        
        if (rowSpan > 1) {
            let totalTr = `<tr style="background: #fafafa; font-weight: bold; font-size: 13px;">
                                        <td colspan="2" style="text-align: right; border: 1px solid #ddd; padding: 8px;">Total (${type}):</td>
                                        <td style="text-align: center; border: 1px solid #ddd; padding: 8px;">${typeData.totalNum}</td>
                                        <td style="text-align: right; border: 1px solid #ddd; padding: 8px;">${typeData.totalAmt.toLocaleString('en-IN')}/-</td>
                                     </tr>`;
            if (classTbody) classTbody.innerHTML += totalTr;
            if (printClassTbody) printClassTbody.innerHTML += totalTr.replace(/#ddd/g, '#000').replace(/#fafafa/g, '#e0e0e0');
        }
    });

    // Populate Pie Chart Data with Strict Color Mappings
    let pieData = [];
    let pieLabels = [];
    let pieColors = [];
    
    const strictColorMap = {
        'Standard (UC)': '#27ae60', // DeepGreen
        'WCL-1': '#2ecc71',         // Jungle Green
        'WCL-2': '#87CEEB',         // Sky Blue
        'WCL-3': '#9b59b6',         // Purple
        'WCL-4': '#808000',         // Olive
        'SS': '#2980b9',            // Blue
        'DF': '#f1c40f',            // Yellow
        'BL': '#e74c3c',            // Red
        'Others': '#95a5a6'         // Grey
    };

    for (const [c, val] of Object.entries(classes)) {
        if (val.num > 0) {
            pieData.push(val.amt);
            pieLabels.push(c);
            pieColors.push(strictColorMap[c] || '#95a5a6');
        }
    }
    if (document.getElementById('breakdown-class-total-num')) document.getElementById('breakdown-class-total-num').innerText = totalNum;
    if (document.getElementById('breakdown-class-total-amt')) document.getElementById('breakdown-class-total-amt').innerText = totalAmt.toLocaleString('en-IN') + '/-';
    if (document.getElementById('print-breakdown-class-total-num')) document.getElementById('print-breakdown-class-total-num').innerText = totalNum;
    if (document.getElementById('print-breakdown-class-total-amt')) document.getElementById('print-breakdown-class-total-amt').innerText = totalAmt.toLocaleString('en-IN') + '/-';

    // Draw Pie Chart
    const canvas = document.getElementById('breakdown-chart');
    if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (totalAmt > 0) {
            let startAngle = 0;
            const cx = 150;
            const cy = 150;
            const radius = 120;
            
            for (let i = 0; i < pieData.length; i++) {
                let sliceAngle = 2 * Math.PI * (pieData[i] / totalAmt);
                ctx.fillStyle = pieColors[i];
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
                ctx.closePath();
                ctx.fill();
                startAngle += sliceAngle;
                
                // Draw Legend
                ctx.fillRect(320, 50 + (i * 30), 20, 20);
                ctx.fillStyle = "#333";
                ctx.font = "14px Arial";
                let pct = ((pieData[i] / totalAmt) * 100).toFixed(1) + '%';
                ctx.fillText(pieLabels[i] + ' - ' + pct, 350, 65 + (i * 30));
            }
        } else {
            ctx.fillStyle = "#333";
            ctx.font = "16px Arial";
            ctx.fillText("No Outstanding Amount for Chart", 100, 150);
        }
    }

    if (!silent) {
        document.getElementById('breakdown-modal').style.display = 'flex';
    }
};


const subCategoriesMap = {
    'Agri Loan': ['Crop Loan', 'Livestock Loan', 'Fisheries Loan'],
    'CMSME Loan': ['Trading', 'Manufacturing', 'Service'],
    'Project Loan': ['Manufacturing', 'Service'],
    'Personal Loan': ['Own Staff', 'Others'],
    'Deposit Loan': ['Deposit Loan'],
    'Consumer Credit': ['Consumer Credit']
};

    window.updateSubCategories = function() {
    const coreSelect = document.getElementById('coreCategory');
    const subSelect = document.getElementById('subCategory');
    const selected = coreSelect.value;
    
    subSelect.innerHTML = '<option value="">Select Sub Category</option>';
    
    if (selected && subCategoriesMap[selected]) {
        subCategoriesMap[selected].forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            subSelect.appendChild(opt);
        });
    }
};

    window.saveCategorization = function() {
    const core = document.getElementById('coreCategory').value;
    const sub = document.getElementById('subCategory').value;
    
    if (!core || !sub) {
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast("Please select both Core and Sub Categories."); else alert("Please select both Core and Sub Categories.");
        return;
    }
    
    const checkboxes = document.querySelectorAll('.loan-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => String(cb.value));
    
    let updatedCount = 0;
    currentData.forEach(item => {
        if (selectedIds.includes(String(item._id))) {
            item.loan_core_category = core;
            item.loan_sub_category = sub;
            updatedCount++;
        }
    });
    
    if (updatedCount > 0) {
        saveCurrentList();
        applyFilters();
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast(`Successfully categorized ${updatedCount} loans.`); else alert(`Successfully categorized ${updatedCount} loans.`);
    }
    
    document.getElementById('categorizeModal').style.display = 'none';
};
    function downloadExcelFormat() {
        if (typeof XLSX === 'undefined') { if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Excel library not loaded.'); else alert('Excel library not loaded.'); return; }
        const ws = XLSX.utils.aoa_to_sheet([['ক্রম','হিসাব নম্বর','ঋণের ধরণ','নাম','পিতা/স্বামীর নাম','বাড়ি','গ্রাম','পোস্ট','থানা/উপজেলা','মঞ্জুরীকৃত পরিমাণ','সুদের হার(%)','বিতরণের তারিখ','মেয়াদ উত্তীর্ণ','বর্তমান স্থিতি','মোবাইল নম্বর','শ্রেণীমান','মন্তব্য']]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Borrower List Format');
        XLSX.writeFile(wb, 'Borrower_List_Format.xlsx');
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Format downloaded successfully!'); else alert('Format downloaded successfully!');
    }

    window.downloadExcelFormat = downloadExcelFormat;
    window.exportToExcel = exportToExcel;
    window.triggerUnifyUpload = triggerUnifyUpload;
    window.triggerFilledExcelUpload = triggerFilledExcelUpload;
    window.triggerStatusUpload = triggerStatusUpload;
    window.applyClassificationsToList = applyClassificationsToList;

    window.clearList = function() {
        if (confirm("Are you sure you want to clear the entire list? This cannot be undone.")) {
            currentData = [];
            saveCurrentList();
            renderPages(currentData);
        }
    };

    window.generateProgressReport = function() {
        const startDate = window.parent.document.getElementById('progress-start-date').value;
        const endDate = window.parent.document.getElementById('progress-end-date').value;
        
        if (!startDate || !endDate) {
            if(window.parent && window.parent.showAppToast) window.parent.showAppToast('Please select both start and end dates.'); else alert('Please select both start and end dates.');
            return;
        }

        // TODO: Implement actual snapshot loading and comparison here.
        // Currently just a skeleton response as logic was not fully defined yet.
        const resultsDiv = window.parent.document.getElementById('progress-report-results');
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <h4 style="margin-top:0; color:#2c3e50;">Report Generated</h4>
            <p>From: <b>${startDate}</b> to <b>${endDate}</b></p>
            <p>Total loans analyzed: ${currentData.length}</p>
            <p><i>(Detailed snapshot comparison logic will be implemented here)</i></p>
        `;
    };

    window.calculatePerformanceAnalysis = function() {
    if (!currentData || currentData.length === 0) {
        if(window.parent && window.parent.showAppToast) window.parent.showAppToast("No data available for analysis."); else alert("No data available for analysis.");
        return;
    }

    let newLoansCount = 0;
    let newLoansAmount = 0;
    
    let recoveredCount = 0;
    let recoveredAmount = 0;

    let renewedCount = 0;
    let renewedAmount = 0;

    // Current Economic Year determination
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1;
    let ecoStart, ecoEnd;
    if (currentMonth >= 7) {
        // July to Dec -> eco year is currentYear to currentYear+1
        ecoStart = new Date(currentYear, 6, 1); // July 1
        ecoEnd = new Date(currentYear + 1, 5, 30, 23, 59, 59); // June 30
    } else {
        // Jan to June -> eco year is currentYear-1 to currentYear
        ecoStart = new Date(currentYear - 1, 6, 1); // July 1
        ecoEnd = new Date(currentYear, 5, 30, 23, 59, 59); // June 30
    }

    currentData.forEach(item => {
        const distDate = item._distDate || parseDate(item['বিতরণের তারিখ']);
        const bal = parseFloat((item['বর্তমান স্থিতি'] || '').toString().replace(/[^\d.]/g, '')) || 0;
        const originalDisbursement = parseFloat((item['ঋণের পরিমাণ'] || item['মঞ্জুরীকৃত পরিমাণ'] || '').toString().replace(/[^\d.]/g, '')) || bal;
        const status = (item['স্ট্যাটাস'] || '').toString().trim().toUpperCase();
        const comment = (item['মন্তব্য'] || '').toString();

        // Check Renewed
        if (comment.includes('Renewed')) {
            renewedCount++;
            renewedAmount += bal;
        }

        // Check New Sanction (Disbursement within eco year)
        if (distDate && distDate >= ecoStart && distDate <= ecoEnd) {
            if (!comment.includes('Renewed')) {
                newLoansCount++;
                newLoansAmount += originalDisbursement;
            }
        }

        // Check Recovered (Closed)
        if (status.includes('CLOSE') || status.includes('CLOSED')) {
            recoveredCount++;
            recoveredAmount += originalDisbursement;
        }
    });

    const resultHtml = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h3 style="margin-top:0; border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">Performance Analysis</h3>
            <p><strong>Economic Year:</strong> ${ecoStart.getFullYear()}-${ecoEnd.getFullYear()}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr style="background: #ecf0f1;">
                    <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: left;">Metric</th>
                    <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">Number of Accounts</th>
                    <th style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">Amount (Tk)</th>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #bdc3c7;">New Sanctioned (Fresh)</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">${newLoansCount}</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${newLoansAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #bdc3c7;">Renewed Loans</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">${renewedCount}</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${renewedAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #bdc3c7;">Recovered / Closed</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: center;">${recoveredCount}</td>
                    <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${recoveredAmount.toLocaleString('en-IN')}</td>
                </tr>
            </table>
            <div style="margin-top: 20px; text-align: right;">
                <button onclick="document.body.removeChild(this.parentNode.parentNode.parentNode);" style="padding: 8px 15px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        </div>
    `;

    const modalOverlay = document.createElement('div');
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100vw';
    modalOverlay.style.height = '100vh';
    modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.zIndex = '9999';

    const modalContent = document.createElement('div');
    modalContent.style.background = '#fff';
    modalContent.style.borderRadius = '8px';
    modalContent.style.width = '500px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    modalContent.innerHTML = resultHtml;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
};

    window.syncClosedLoansToDB = async function() {
    if (!currentData || currentData.length === 0) return;
    if (!window.parent || !window.parent.ipcRenderer) return;

    const updates = [];
    currentData.forEach(item => {
        const status = (item['স্ট্যাটাস'] || '').toString().trim().toUpperCase();
        if (status.includes('CLOSE') || status.includes('CLOSED')) {
            const acc = item['হিসাব নম্বর'] || item._caseNo || item['loan_case_no'];
            if (acc) {
                updates.push({ account_no: acc, status: 'CLOSED' });
            }
        }
    });

    if (updates.length > 0) {
        try {
            const res = await window.parent.ipcRenderer.invoke('db-sync-loan-status', updates);
            if (res && res.success) {
                console.log(`Successfully synced ${res.count} closed loan statuses to central DB.`);
            } else {
                console.warn('Failed to sync loan statuses:', res ? res.error : 'Unknown error');
            }
        } catch (e) {
            console.warn('IPC error during loan sync:', e);
        }
    }
    };

    window.printModal = function(modalId) {
        document.body.classList.add('print-modal-only');
        
        // Dynamically override page size to A4 Portrait specifically for the modal
        const style = document.createElement('style');
        style.id = 'modal-print-style';
        style.innerHTML = '@page { size: A4 portrait !important; margin: 0.5in; }';
        document.head.appendChild(style);
        
        const modal = document.getElementById(modalId);
        if (modal) {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-modal-only');
                const injectedStyle = document.getElementById('modal-print-style');
                if (injectedStyle) injectedStyle.remove();
            }, 1000);
        }
    };

})();
