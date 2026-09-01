/**
 * Web Engine
 * Centralizes all web and portal-based activities: NID scanning, CBS monitoring, and data restoration.
 */
window.WebEngine = {
    cbsAutosave: {},

    init: function(ipcRenderer) {



        // Load initial state
        try {
            this.cbsAutosave = JSON.parse(localStorage.getItem('cbs_autosave_data') || '{}');
        } catch(e){}

        if (ipcRenderer) {
            ipcRenderer.on('cbs-field-autosave', (event, data) => {
                const { path, selector, value } = data;
                if (!this.cbsAutosave[path]) this.cbsAutosave[path] = {};
                this.cbsAutosave[path][selector] = value;
                localStorage.setItem('cbs_autosave_data', JSON.stringify(this.cbsAutosave));
            });
        }

        // Setup Smart Mode button
        const btnSmartMode = document.getElementById('btn-smart-mode');
        if (btnSmartMode) {
            btnSmartMode.onclick = () => {
                const originalText = btnSmartMode.innerText;
                btnSmartMode.innerText = 'Smart Mode Active!';
                btnSmartMode.style.backgroundColor = '#27ae60';
                btnSmartMode.style.color = '#fff';
                setTimeout(() => {
                    btnSmartMode.innerText = originalText;
                    btnSmartMode.style.backgroundColor = '';
                    btnSmartMode.style.color = '';
                }, 2500);
            };
        }

        // Setup Restore CBS Data button
        const btnRestoreCbs = document.getElementById('btn-restore-cbs-data');
        if (btnRestoreCbs) {
            btnRestoreCbs.onclick = async () => {
                const webview = typeof window.getActiveIframe === 'function' ? window.getActiveIframe() : null;
                if (!webview || webview.tagName !== 'WEBVIEW') {
                    window.showAppToast('Please select an active CBS portal tab first.', true);
                    return;
                }
                
                try {
                    const pathname = await webview.executeJavaScript('window.location.pathname');
                    const savedFields = this.cbsAutosave[pathname];
                    
                    if (!savedFields || Object.keys(savedFields).length === 0) {
                        window.showAppToast('No autosaved form data found for this page.', true);
                        return;
                    }
                    
                    const script = `(function() {
                        const data = ${JSON.stringify(savedFields)};
                        let count = 0;
                        function restoreContext(doc) {
                            for (const [selector, val] of Object.entries(data)) {
                                const el = doc.querySelector(selector);
                                if (el && el.value !== val && !el.disabled && !el.readOnly && el.type !== 'hidden') {
                                    el.value = val;
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    if (el.tagName.toLowerCase() === 'select') {
                                        el.dispatchEvent(new Event('change', { bubbles: true }));
                                        if (typeof window.jQuery !== 'undefined') {
                                            try { window.jQuery(el).trigger('change'); } catch(e){}
                                        }
                                    }
                                    count++;
                                }
                            }
                            const iframes = doc.querySelectorAll('iframe');
                            iframes.forEach(iframe => {
                                try {
                                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                                    if (iframeDoc) restoreContext(iframeDoc);
                                } catch(e){}
                            });
                        }
                        restoreContext(document);
                        window.showAppToast('Restored ' + count + ' fields on this page!');
                    })();`;
                    
                    await webview.executeJavaScript(script);
                } catch(e) {
                    console.error(e);
                    window.showAppToast('Failed to restore data: ' + e.message);
                }
            };
        }
        
        // --- MOVED INITIALIZATION BLOCK ---
        const btnInjectRtgs = document.getElementById('btn-inject-rtgs-data', true);
    const btnInjectEftn = document.getElementById('btn-inject-eftn-data');
    const injectModal = document.getElementById('transactionInjectModal');
    const btnDoInject = document.getElementById('btn-do-inject-tx');
    const datePicker = document.getElementById('inject-tx-date');
    const txSelect = document.getElementById('inject-tx-select');
    const title = document.getElementById('injectModalTitle');

    if (btnInjectRtgs) {
        btnInjectRtgs.onclick = () => {
            currentInjectType = 'RTGS';
            if (title) title.innerText = 'Inject RTGS Data';
            if (datePicker) datePicker.value = '';
            if (txSelect) txSelect.innerHTML = '<option value="">-- Please select a date first --</option>';
            if (injectModal) injectModal.classList.add('visible');
        };
    }

    if (btnInjectEftn) {
        btnInjectEftn.onclick = () => {
            currentInjectType = 'EFTN';
            if (title) title.innerText = 'Inject EFTN Data';
            if (datePicker) datePicker.value = '';
            if (txSelect) txSelect.innerHTML = '<option value="">-- Please select a date first --</option>';
            if (injectModal) injectModal.classList.add('visible');
        };
    }

    if (datePicker) {
        datePicker.onchange = async () => {
            const dateStr = datePicker.value;
            if (!dateStr) return;
            
            txSelect.innerHTML = '<option value="">Loading...</option>';
            try {
                const txs = await window.DB.getTransactionsByDate(dateStr, currentInjectType);
                if (txs && txs.length > 0) {
                    txSelect.innerHTML = '<option value="">-- Select Transaction --</option>';
                    txs.forEach(tx => {
                        const opt = document.createElement('option');
                        opt.value = JSON.stringify(tx);
                        // Make a nice label: Sender -> Receiver (Amount)
                        const sender = tx.sender_name_en || tx.sender_name_bn || tx.sender_name || 'Unknown Sender';
                        const receiver = tx.receiver_name_en || tx.receiver_name_bn || tx.receiver_name || 'Unknown Receiver';
                        const amt = tx.amount_num || tx.amount || '0';
                        opt.innerText = `${tx.is_injected ? ' ' : ''}${sender}  ${receiver} (BDT ${amt})`;
                        txSelect.appendChild(opt);
                    });
                } else {
                    txSelect.innerHTML = '<option value="">No transactions found for this date</option>';
                }
            } catch (e) {
                console.error(e);
                txSelect.innerHTML = '<option value="">Error loading transactions</option>';
            }
        };
    }

    if (btnDoInject) {
        btnDoInject.onclick = () => {
            if (!txSelect.value) {
                window.showAppToast('Please select a transaction to inject.', true);
                return;
            }
            const txData = JSON.parse(txSelect.value);
            
            // Get the active CBS webview
            const webview = getActiveIframe();
            if (!webview || webview.tagName !== 'WEBVIEW') {
                window.showAppToast('CBS portal is not active.');
                return;
            }

            // 1. Read mappings from the MAIN window's localStorage
            const mappingJson = window.localStorage.getItem(currentInjectType.toLowerCase() + '_field_mapping');
            const mapping = mappingJson ? JSON.parse(mappingJson) : null;
            
            if (!mapping) {
                window.showAppToast('No mapping found for ' + currentInjectType + '. Please scan a web form first.', true);
                return;
            }
            
            // 2. Build the script string to inject into the webview
            const script = `(async function() {
                const mapping = ${JSON.stringify(mapping)};
                const txData = ${JSON.stringify(txData)};
                const currentInjectType = '${currentInjectType}';
                
                function setValByMap(appKey, val) {
                    if (!val) return;
                    let webSelector = null;
                    for (const [webId, mappedAppKey] of Object.entries(mapping)) {
                        if (mappedAppKey === appKey) {
                            webSelector = '#' + webId;
                            let el = document.querySelector(webSelector);
                            if (!el) {
                                webSelector = '[name="' + webId + '"]';
                                el = document.querySelector(webSelector);
                            }
                            if (el) {
                                if (el.tagName.toLowerCase() === 'select') {
                                    let option = Array.from(el.options).find(opt => opt.value === val);
                                    if (!option) {
                                        option = Array.from(el.options).find(opt => opt.text.toLowerCase().includes(val.toLowerCase()));
                                    }
                                    if (!option) {
                                        const cleanVal = String(val).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
                                        if (cleanVal) {
                                            option = Array.from(el.options).find(opt => {
                                                const cleanText = opt.text.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
                                                return cleanText.includes(cleanVal);
                                            });
                                        }
                                    }
                                    // Fallback for branch dropdown: Match using Routing Number digits
                                    if (!option && appKey === 'beneficiary_branch') {
                                        const routingVal = txData.receiver_routing_no || txData.rtgs_receiver_routing_no || '';
                                        const cleanRouting = routingVal.replace(/[^0-9]/g, '');
                                        if (cleanRouting) {
                                            option = Array.from(el.options).find(opt => {
                                                const cleanText = opt.text.replace(/[^0-9]/g, '');
                                                return cleanText.includes(cleanRouting);
                                            });
                                        }
                                    }
                                    if (option) {
                                        el.value = option.value;
                                    }
                                } else if (el.type === 'radio') {
                                    if (el.value.toLowerCase() === String(val).toLowerCase() || 
                                        (String(val).toLowerCase() === 'yes' && ['y', 'yes', 'true', '1'].includes(el.value.toLowerCase())) ||
                                        (String(val).toLowerCase() === 'no' && ['n', 'no', 'false', '0'].includes(el.value.toLowerCase()))) {
                                        el.checked = true;
                                    }
                                } else if (el.type === 'checkbox') {
                                    const truthy = ['yes', 'true', '1', 'checked'].includes(String(val).toLowerCase());
                                    el.checked = truthy;
                                } else {
                                    // Handle smart date formatting for date inputs
                                    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
                                        if (el.type === 'date') {
                                            el.value = val;
                                        } else {
                                            // Custom text datepicker: default to m/d/yyyy (Month/Day/Year)
                                            const parts = val.split('-');
                                            const y = parts[0], m = parts[1], d = parts[2];
                                            const cleanD = parseInt(d, 10), cleanM = parseInt(m, 10);
                                            el.value = cleanM + '/' + cleanD + '/' + y;
                                        }
                                    } else {
                                        el.value = val;
                                    }
                                }
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                if (el.tagName.toLowerCase() === 'select' || el.type === 'checkbox' || el.type === 'radio') {
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    if (typeof window.jQuery !== 'undefined') {
                                        try {
                                            window.jQuery(el).trigger('change');
                                        } catch(e){}
                                    }
                                }
                                console.log('Injected', val, 'into', webId);
                            }
                        }
                    }
                }
                
                // Distribute account number with hyphen formatting if it is 15 digits
                let rawSenderAc = txData.sender_account_no || txData.sender_account || txData.deposit_account_no || '';
                let senderAcClean = rawSenderAc.replace(/[^0-9a-zA-Z]/g, '');
                if (senderAcClean.length >= 5) {
                    rawSenderAc = senderAcClean.slice(0, 4) + '-' + senderAcClean.slice(4);
                }

                // Core injection routine that checks and populates fields
                function injectAll() {
                    setValByMap('sender_account_no', rawSenderAc);
                    setValByMap('sender_name', txData.sender_name_en || txData.sender_name || txData.applicant_name_en);
                    setValByMap('sender_address', txData.sender_address || txData.rtgs_sender_address);
                    setValByMap('sender_mobile', txData.sender_mobile || txData.applicant_mobile);
                    setValByMap('cheque_number', txData.cheque_no || txData.cheque_number);
                    setValByMap('cheque_date', txData.cheque_date);
                    setValByMap('beneficiary_name', txData.receiver_name_en || txData.receiver_name || txData.rtgs_receiver_name || txData.receiver_account_title);
                    setValByMap('beneficiary_account', txData.receiver_account_no || txData.receiver_account || txData.rtgs_receiver_account || txData.receiver_account_no);
                    setValByMap('beneficiary_bank', txData.receiver_bank || txData.bank_name || txData.receiving_bank || txData.rtgs_receiver_bank);
                    setValByMap('beneficiary_branch', txData.receiver_branch || txData.rtgs_receiver_branch);
                    setValByMap('beneficiary_routing', txData.receiver_routing_no || txData.rtgs_receiver_routing_no || txData.receiver_routing);
                    setValByMap('beneficiary_address', txData.receiver_address || txData.rtgs_receiver_address);
                    setValByMap('amount', txData.amount_num || txData.amount || txData.rtgs_transaction_amount);
                    setValByMap('amount_words', txData.amount_words || txData.rtgs_amount_words);
                    
                    const chargesVal = parseFloat(txData.rtgs_transaction_charges || txData.charges || '0') || 0;
                    setValByMap('charges', chargesVal > 0 ? 'Yes' : 'No');
                    
                    setValByMap('remarks', txData.purpose || txData.remarks || txData.rtgs_purpose || txData.payment_purpose);
                }
                
                // 1. Initial Injection: Sender Account & Bank
                setValByMap('sender_account_no', rawSenderAc);
                setValByMap('beneficiary_bank', txData.receiver_bank || txData.bank_name || txData.receiving_bank || txData.rtgs_receiver_bank);
                
                // 2. Wait 1 second for CBS validation & Branch AJAX lists
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 3. Populate everything else
                injectAll();
                
                // 4. Run repeating checks every 1.5 seconds (up to 4 times) to inject dynamically appearing fields (like Cheque No)
                let attempts = 0;
                const intervalId = setInterval(() => {
                    attempts++;
                    if (attempts >= 4) {
                        clearInterval(intervalId);
                    }
                    console.log('Running secondary validation check for missed fields (Attempt ' + attempts + ')...');
                    injectAll();
                }, 1500);
                
                window.showAppToast('Data successfully injected into the ' + currentInjectType + ' portal according to your saved mappings!');
            })();`;
            
            webview.executeJavaScript(script).then(() => {
    if (injectModal) injectModal.classList.remove('visible');
    
    // Mark as injected
    window.DB.markTransactionInjected(currentInjectType, txData.id).then(() => {
        // Refresh the list visually
        if (datePicker && datePicker.onchange) {
            datePicker.onchange();
        }
    }).catch(err => console.error("Error marking injected:", err));
}).catch(e => {
                console.error('Injection error:', e);
                window.showAppToast('Failed to inject data: ' + e.message);
            });
        };
    }

    const btnScanRtgs = document.getElementById('btn-scan-rtgs-form', true);
    if (btnScanRtgs) {
        btnScanRtgs.onclick = async () => {
            const webview = getActiveIframe();
            if (!webview) {
                window.showAppToast('No active iframe or webview found in the current tab.', true);
                return;
            }
            if (webview.tagName !== 'WEBVIEW') {
                // It might be an iframe. Let's try to run it via contentWindow if possible (though CORS might block it if external)
                if (webview.tagName === 'IFRAME') {
                    window.showAppToast('Found an IFRAME instead of a WEBVIEW. Attempting to scan IFRAME...');
                } else {
                    window.showAppToast('Found element: ' + webview.tagName + ', expected WEBVIEW.');
                    return;
                }
            }

            try {
                btnScanRtgs.innerText = 'Scanning...';
                const script = `
                    (function() {
                        const fields = [];
                        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
                        
                        function findLabelFor(el) {
                            // 1. Standard label attribute
                            if (el.id) {
                                const label = document.querySelector('label[for="'+el.id+'"]');
                                if (label) return label.innerText;
                            }
                            // 2. Wrapped in label
                            const parentLabel = el.closest('label');
                            if (parentLabel) {
                                // Remove the input's own text if any, just get the label text
                                const clone = parentLabel.cloneNode(true);
                                const innerInputs = clone.querySelectorAll('input, select, textarea');
                                innerInputs.forEach(i => i.remove());
                                return clone.innerText;
                            }
                            // 3. Placeholder or title
                            if (el.placeholder) return el.placeholder;
                            if (el.title) return el.title;
                            
                            // 4. Look at the previous table cell (very common in old portals)
                            const td = el.closest('td');
                            if (td && td.previousElementSibling) {
                                const prevTdText = td.previousElementSibling.innerText.trim();
                                if (prevTdText.length > 0 && prevTdText.length < 50) return prevTdText;
                            }
                            
                            // 5. Look at previous sibling text
                            if (el.previousSibling && el.previousSibling.nodeType === 3) {
                                const text = el.previousSibling.textContent.trim();
                                if (text) return text;
                            }
                            
                            // 6. Look at previous element sibling
                            if (el.previousElementSibling) {
                                const text = el.previousElementSibling.innerText;
                                if (text && text.trim().length < 50) return text.trim();
                            }

                            return '';
                        }

                        inputs.forEach(el => {
                            let labelText = findLabelFor(el);
                            
                            // Clean up the label
                            if (labelText) {
                                labelText = labelText.replace(/[\\n\\r]+/g, ' ').trim();
                                labelText = labelText.substring(0, 100);
                            }
                            
                            fields.push({
                                id: el.id || '',
                                name: el.name || '',
                                type: el.tagName.toLowerCase() === 'input' ? el.type : el.tagName.toLowerCase(),
                                label: labelText
                            });
                        });
                        return fields;
                    })();
                `;

                const fields = await webview.executeJavaScript(script);
                btnScanRtgs.innerText = 'Scan Web Form';

                const tableBody = document.querySelector('#scan-fields-table tbody');
                tableBody.innerHTML = '';
                
                // Define our App Fields for mapping
                const appFields = [
                    { val: '', label: '-- Ignore --' },
                    { val: 'sender_account_no', label: 'Sender Account Number' },
                    { val: 'sender_name', label: 'Sender Name' },
                    { val: 'sender_address', label: 'Sender Address' },
                    { val: 'sender_mobile', label: 'Sender Mobile' },
                    { val: 'sender_nid', label: 'Sender NID (EFTN)' },
                    { val: 'cheque_number', label: 'Cheque Number' },
                    { val: 'cheque_date', label: 'Cheque Date' },
                    { val: 'beneficiary_name', label: 'Beneficiary Name' },
                    { val: 'beneficiary_account', label: 'Beneficiary A/C' },
                    { val: 'beneficiary_bank', label: 'Beneficiary Bank' },
                    { val: 'beneficiary_branch', label: 'Beneficiary Branch' },
                    { val: 'beneficiary_routing', label: 'Routing Number' },
                    { val: 'beneficiary_address', label: 'Beneficiary Address' },
                    { val: 'amount', label: 'Amount' },
                    { val: 'amount_words', label: 'Amount (Words)' },
                    { val: 'charges', label: 'Charges (Yes / No)' },
                    { val: 'remarks', label: 'Remarks / Purpose' }
                ];

                function getFriendlyFieldName(f) {
                    if (f.label && f.label.trim()) {
                        return f.label.replace(/[:*]/g, '').trim();
                    }
                    let raw = f.id || f.name || '';
                    if (!raw) return 'Unknown Field';
                    
                    if (raw.includes('cmsBank') || raw.includes('cmbBank')) {
                        return 'Receiver Bank';
                    }

                    let noPrefix = raw.replace(/^ContentPlaceHolder\d+_/i, '');
                    let match = noPrefix.match(/^[a-z]+([A-Z].*)$/);
                    if(match) {
                        return match[1];
                    }

                    raw = raw.replace(/^(ctl00\$|ContentPlaceHolder\d+_|ctrl\d+_|txt|ddl|btn|chk|opt|rdo)/i, '');
                    raw = raw.replace(/^[a-z]+_/i, '');
                    let cleaned = raw.replace(/([A-Z])/g, ' $1').trim();
                    cleaned = cleaned.replace(/[_-]/g, ' ');
                    cleaned = cleaned.split(/\s+/).map(word => {
                        if (!word) return '';
                        return word.charAt(0).toUpperCase() + word.slice(1);
                    }).join(' ');
                    return cleaned.trim() || raw;
                }
                // Get existing mappings to pre-select
                const existingRtgs = window.AppStorage ? JSON.parse(window.AppStorage.getItem('rtgs_field_mapping') || '{}') : JSON.parse(localStorage.getItem('rtgs_field_mapping') || '{}');
                const existingEftn = window.AppStorage ? JSON.parse(window.AppStorage.getItem('eftn_field_mapping') || '{}') : JSON.parse(localStorage.getItem('eftn_field_mapping') || '{}');
                const existingCbs = window.AppStorage ? JSON.parse(window.AppStorage.getItem('cbs_field_mapping') || '{}') : JSON.parse(localStorage.getItem('cbs_field_mapping') || '{}');
                const existingMap = Object.keys(existingRtgs).length > 0 ? existingRtgs : (Object.keys(existingEftn).length > 0 ? existingEftn : existingCbs);

                fields.forEach((f, i) => {
                    // Only show fields that have at least ID or Name
                    if (!f.id && !f.name) return;

                    const tr = document.createElement('tr');
                    
                    const tdIdName = document.createElement('td');
                    tdIdName.style.wordBreak = 'break-all';
                    tdIdName.innerHTML = `<span style="font-size: 0.9em; color: #555;">${f.id || 'N/A'}</span>`;
                    tr.appendChild(tdIdName);

                    const tdType = document.createElement('td');
                    let extractedType = f.type;
                    let rawId = f.id || f.name || '';
                    let idParts = rawId.split('_');
                    let lastPart = idParts[idParts.length - 1];
                    let match = lastPart.match(/^[a-z]+([A-Z].*)$/);
                    if (match) {
                        extractedType = match[1];
                    } else {
                        let match2 = lastPart.match(/^([A-Z].*)$/);
                        if (match2) extractedType = match2[1];
                    }
                    tdType.innerHTML = `<span style="font-size: 0.95em; color: #16a085; font-weight: 600;">${extractedType}</span>`;
                    tr.appendChild(tdType);

                    const tdLabel = document.createElement('td');
                    const friendlyName = getFriendlyFieldName(f);
                    const origLabel = f.label && f.label.trim() ? `<br><span style="font-size: 0.8em; color: #888;">(Orig: ${f.label})</span>` : '';
                    tdLabel.innerHTML = `<span style="font-weight: 600; color: #2c3e50; font-size: 1.05em;">${friendlyName}</span><br><span style="font-size: 0.85em; color: #555;">Name: ${f.name || 'N/A'}</span>${origLabel}`;
                    tr.appendChild(tdLabel);

                    const tdMap = document.createElement('td');
                    const select = document.createElement('select');
                    const fieldKey = f.id || f.name;
                    select.dataset.webId = f.id;
                    select.dataset.webName = f.name;
                    select.className = 'field-mapping-select';
                    
                    appFields.forEach(af => {
                        const opt = document.createElement('option');
                        opt.value = af.val;
                        opt.innerText = af.label;
                        if (existingMap[fieldKey] === af.val) {
                            opt.selected = true;
                        }
                        select.appendChild(opt);
                    });
                    
                    tdMap.appendChild(select);
                    tr.appendChild(tdMap);
                    
                    tableBody.appendChild(tr);
                });

                document.getElementById('scanWebFormModal').classList.add('visible');

            } catch(e) {
                console.error(e);
                window.showAppToast('Error scanning page: ' + e.message);
                btnScanRtgs.innerText = 'Scan Web Form';
            }
        };
    }
    
    const btnSaveMapping = document.getElementById('btn-save-field-mapping', true);
    if (btnSaveMapping) {
        btnSaveMapping.onclick = () => {
            const formType = document.getElementById('mapping-form-type') ? document.getElementById('mapping-form-type').value : 'rtgs';
            const selects = document.querySelectorAll('.field-mapping-select');
            const newMapping = {};
            selects.forEach(s => {
                const key = s.dataset.webId || s.dataset.webName;
                if (s.value) {
                    newMapping[key] = s.value;
                } else {
                    newMapping[key] = null; // mark for deletion
                }
            });
            
            const saveMerged = (type, newMap) => {
                const storageKey = type + '_field_mapping';
                const existing = window.AppStorage ? JSON.parse(window.AppStorage.getItem(storageKey) || '{}') : JSON.parse(localStorage.getItem(storageKey) || '{}');
                Object.keys(newMap).forEach(k => {
                    if (newMap[k] === null) delete existing[k];
                    else existing[k] = newMap[k];
                });
                if (window.AppStorage) window.AppStorage.setItem(storageKey, JSON.stringify(existing));
                else localStorage.setItem(storageKey, JSON.stringify(existing));
            };
            
            if (formType === 'both') {
                saveMerged('rtgs', newMapping);
                saveMerged('eftn', newMapping);
                saveMerged('cbs', newMapping);
            } else {
                saveMerged(formType, newMapping);
            }
            
            window.showAppToast('Mapping saved successfully for ' + formType.toUpperCase() + '!');
            document.getElementById('scanWebFormModal').classList.remove('visible');
        };
    }
    // Auto-restore focus whenever main window regains focus or user clicks shell
    window.addEventListener('focus', () => {
        if (typeof window.restoreAppFocus === 'function') {
            window.restoreAppFocus(50);
        }
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('input, select, textarea, button, [contenteditable="true"]')) {
            if (typeof window.restoreAppFocus === 'function') {
                window.restoreAppFocus(50);
            }
        }
    });
    },

    pullNidDataAndShowModal: function() {
        const webview = typeof window.getActiveIframe === 'function' ? window.getActiveIframe() : null;
        if (!webview || webview.tagName !== 'WEBVIEW') {
            window.showAppToast('Please open the NID portal first.', true);
            return;
        }

        const script = `
            (async function() {
                const container = document.querySelector('#verificationPrintContent');
                if (!container) return null;

                const data = {};
                const text = container.innerText;
                
                let photo = '';
                const imgEl = container.querySelector('img');
                if (imgEl) {
                    if (imgEl.src.startsWith('data:image')) {
                        photo = imgEl.src;
                    } else {
                        try {
                            const response = await fetch(imgEl.src);
                            const blob = await response.blob();
                        photo = await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } catch(e) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = imgEl.naturalWidth || imgEl.width || 132;
                            canvas.height = imgEl.naturalHeight || imgEl.height || 170;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(imgEl, 0, 0);
                            photo = canvas.toDataURL('image/jpeg');
                        } catch (e2) {
                            photo = imgEl.src;
                        }
                    }
                }
                }

                const parseField = (label) => {
                    const regex = new RegExp(label + '[\\\\s:]+([^\\\\r\\\\n]*)', 'i');
                    const match = text.match(regex);
                    if (!match) return '';
                    let val = match[1].trim();
                    // Split by long dash '—' or regular dash '-' if it contains 'not matched' or 'verified'
                    if (val.includes('—')) {
                        val = val.split('—')[0].trim();
                    } else if (val.includes('-')) {
                        const parts = val.split('-');
                        if (parts.length > 1 && (parts[1].toLowerCase().includes('verified') || parts[1].toLowerCase().includes('matched'))) {
                            val = parts[0].trim();
                        }
                    }
                    const lowerVal = val.toLowerCase();
                    if (lowerVal === 'n/a' || lowerVal === 'not verified' || lowerVal === 'verified' || /^-+$/.test(lowerVal)) return '';
                    return val;
                };

                data.photo = photo;
                data.nameBn = parseField('Name');
                data.nameEn = parseField('NameEn');
                data.dob = parseField('DateOfBirth');
                data.nidRaw = parseField('National ID'); 
                data.pin = parseField('PIN');
                data.father = parseField('Father');
                data.mother = parseField('Mother');
                data.presentUpozila = parseField('PresentAddress.upozila');
                data.presentDistrict = parseField('PresentAddress.district');
                data.presentDivision = parseField('PresentAddress.division');
                data.permanentUpozila = parseField('PermanentAddress.upozila');
                data.permanentDistrict = parseField('PermanentAddress.district');
                data.permanentDivision = parseField('PermanentAddress.division');

                return data;
            })()
        `;

        webview.executeJavaScript(script).then(data => {
            if (!data) {
                window.showAppToast('No NID verification data found in the current view. Please complete verification first.', true);
                return;
            }
            if (!data.nameBn && !data.nidRaw) {
                window.showAppToast('Verification content detected but fields are empty. Please ensure the portal result is fully loaded.', true);
                return;
            }

            const cleanNidFromPortal = (data.nidRaw || '').replace(/\D/g, '');
            const cleanPinFromPortal = (data.pin || '').replace(/\D/g, '');

            document.getElementById('pulled_nid_photo').src = data.photo || '';
            document.getElementById('pulled_nid_name_bn').value = data.nameBn || '';
            document.getElementById('pulled_nid_name_en').value = (data.nameEn || '').toUpperCase();
            document.getElementById('pulled_nid_nid').value = cleanNidFromPortal; 
            document.getElementById('pulled_nid_dob').value = data.dob || '';
            document.getElementById('pulled_nid_pin').value = cleanPinFromPortal;
            document.getElementById('pulled_nid_father_name_bn').value = data.father || '';
            document.getElementById('pulled_nid_mother_name_bn').value = data.mother || '';
            document.getElementById('pulled_nid_present_upozila').value = data.presentUpozila || '';
            document.getElementById('pulled_nid_present_district').value = data.presentDistrict || '';
            document.getElementById('pulled_nid_present_division').value = data.presentDivision || '';
            document.getElementById('pulled_nid_permanent_upozila').value = data.permanentUpozila || '';
            document.getElementById('pulled_nid_permanent_district').value = data.permanentDistrict || '';
            document.getElementById('pulled_nid_permanent_division').value = data.permanentDivision || '';

            document.getElementById('pulledNidDataModal').classList.add('visible');
            if (webview) webview.blur();
            document.body.focus();
            setTimeout(() => {
                const firstInput = document.getElementById('pulled_nid_name_bn');
                if (firstInput) firstInput.focus();
            }, 150);
        });





    },

    injectCbsAutofill: async function(customer) {
        const script = `(function() {
            const data = ${JSON.stringify(customer)};
            function autofillContext(doc) {
                const inputs = doc.querySelectorAll('input:not([type="hidden"]), select, textarea');
                inputs.forEach(el => {
                    const id = (el.id || '').toLowerCase();
                    const name = (el.name || '').toLowerCase();
                    const placeholder = (el.placeholder || '').toLowerCase();
                    
                    let val = '';
                    if (id.includes('acc') || id.includes('acno') || name.includes('acc') || name.includes('acno')) {
                        val = data.deposit_account_no || data.sender_account_no || data.account_no || '';
                    } else if (id.includes('name') || name.includes('name') || placeholder.includes('name')) {
                        val = data.applicant_name_en || data.sender_name || '';
                    } else if (id.includes('mobile') || id.includes('phone') || name.includes('mobile') || name.includes('phone')) {
                        val = data.applicant_mobile || data.sender_mobile || '';
                    } else if (id.includes('nid') || name.includes('nid')) {
                        val = data.applicant_nid || '';
                    } else if (id.includes('address') || id.includes('addr') || name.includes('address') || name.includes('addr')) {
                        val = data.sender_address || '';
                    }
                    
                    if (val && el.value !== val && !el.disabled && !el.readOnly) {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        if (el.tagName.toLowerCase() === 'select') {
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            if (typeof window.jQuery !== 'undefined') {
                                try { window.jQuery(el).trigger('change'); } catch(e){}
                            }
                        }
                    }
                });
                
                const iframes = doc.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) autofillContext(iframeDoc);
                    } catch(e){}
                });
            }
            autofillContext(document);
        })();`;
        
        const webview = typeof window.getActiveIframe === 'function' ? window.getActiveIframe() : null;
        if (webview && webview.tagName === 'WEBVIEW') {
            await webview.executeJavaScript(script);
        }
    }
};
