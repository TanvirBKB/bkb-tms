/**
 * Deposit Engine
 * Centralizes deposit-specific business logic.
 */
window.DepositEngine = {
    // Shared modal methods
    openModal: function (modalId) {
        const modal = document.getElementById(modalId || 'dataEntryModal');
        if (modal) modal.style.display = 'flex';
    },

    closeModal: function (modalId) {
        const modal = document.getElementById(modalId || 'dataEntryModal');
        if (modal) modal.style.display = 'none';
    },

    // A generic helper to convert English digits to Bangla
    toBn: function (str) {
        if (!str) return '';
        const enToBn = {
            '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
            '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
        };
        return String(str).replace(/[0-9]/g, match => enToBn[match]);
    },

    calcAgeInModal: function (dobId = 'm_dob', ageId = 'm_age') {
        const dob = document.getElementById(dobId).value;
        if (!dob) { document.getElementById(ageId).value = ''; return; }
        const today = new Date();
        const birth = new Date(dob);
        if (!isNaN(birth)) {
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            document.getElementById(ageId).value = age >= 0 ? age : '';
        }
    },

    // Farmer-specific logic
    initFarmerForm: function () {
        // Expose functions globally for app-logic.js integration
        window.openModal = DepositEngine.openModal;
        window.closeModal = DepositEngine.closeModal;
        window.startNewForm = () => location.reload();
        window.clearForm = () => location.reload();
        window.saveFarmerToDB = DepositEngine.saveFarmerToDB;
        window.saveModalData = DepositEngine.saveFarmerModalData;
        window.clearModalData = DepositEngine.clearFarmerModalData;
        window.applyModalData = DepositEngine.applyFarmerModalData;
        window.populateFromCustomer = DepositEngine.populateFarmerForm;
        window.populate = DepositEngine.populateFarmerForm;
        window.applyBranchInfo = DepositEngine.applyBranchInfo;
        window.calcAgeInModal = (dobId = 'm_dob', ageId = 'm_age') => DepositEngine.calcAgeInModal(dobId, ageId);
        
        window.updateInitialDepositWords = function() {
            const amount = document.getElementById('m_initial_deposit').value;
            const wordsEl = document.getElementById('m_initial_deposit_words');
            if (!amount) {
                if(wordsEl) wordsEl.value = '';
                return;
            }
            if (wordsEl && typeof DepositEngine.convertToBanglaWords === 'function') {
                const words = DepositEngine.convertToBanglaWords(amount);
                wordsEl.value = words ? words + ' টাকা মাত্র' : '';
            }
        };

        window.handleFormPhotoUpload = function (event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const dataUrl = e.target.result;
                    const imgEl = document.getElementById('applicant_photo');
                    const textEl = document.getElementById('applicant_photo_text');
                    if (imgEl) {
                        imgEl.src = dataUrl;
                        imgEl.style.display = 'block';
                    }
                    if (textEl) {
                        textEl.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            }
        };

        DepositEngine.applyBranchInfo();
        
        window.onclick = function (event) {
            const modal = document.getElementById('dataEntryModal');
            if (event.target === modal) {
                DepositEngine.closeModal();
            }
        };

        // Handle incoming messages
        //         window.addEventListener('message', function (event) {
        //             if (event.data && event.data.command === 'FILL_SLOT') {
        //                 DepositEngine.populateFarmerForm(event.data.data);
        //             }
        //             if (event.data && event.data.command === 'EXECUTE_ACTION') {
        //                 if (event.data.actionId === 'btn-print-form') window.print();
        //                 if (event.data.actionId === 'btn-clear-form' || event.data.actionId === 'btn-start-new') location.reload();
        //                 if (event.data.actionId === 'btn-data-entry') DepositEngine.openModal();
        //             }
        //         });

        // Setup apply/close buttons to use engine methods
        const applyBtn = document.querySelector('#dataEntryModal button[onclick="applyModalData()"]');
        if (applyBtn) {
            applyBtn.onclick = DepositEngine.applyFarmerModalData;
        }

        // Let global window.closeModal handle the closing. No need to redefine inline handlers here.

        const dobInput = document.getElementById('m_dob');
        if (dobInput) {
            // Using global mapping instead for robustness
        }
        
        DepositEngine.restoreFarmerModalData();
    },

    saveFarmerToDB: function() {
        const customerData = {
            applicant_name_bn: document.getElementById('m_name').value,
            applicant_father_name_bn: document.getElementById('m_father').value,
            applicant_mother_name_bn: document.getElementById('m_mother').value,
            applicant_nid: document.getElementById('m_nid').value,
            applicant_dob: document.getElementById('m_dob').value,
            applicant_curr_addr_village: document.getElementById('m_village').value,
            applicant_curr_addr_block: document.getElementById('m_block').value,
            applicant_curr_addr_mouza: document.getElementById('m_mouza').value,
            applicant_curr_addr_ward: document.getElementById('m_ward').value,
            applicant_curr_addr_union: document.getElementById('m_union').value,
            applicant_present_district: document.getElementById('m_district').value,
            farmer_account_no: document.getElementById('m_account_no').value,
            applicant_farmer_card_no: document.getElementById('m_customer_id').value,
        };

        const nomName = document.getElementById('m_nom_name').value;
        if (nomName) {
            customerData.relationships = [{
                relation_type: 'নমিনী',
                relation_name_bn: nomName,
                relation_father_name_bn: document.getElementById('m_nom_father').value,
                relation_spouse_name_bn: document.getElementById('m_nom_spouse').value,
                relation_mother_name_bn: document.getElementById('m_nom_mother').value,
                relation_dob: document.getElementById('m_nom_dob').value,
                relation_type_bn: document.getElementById('m_nom_relation').value
            }];
        }

        window.parent.postMessage({ command: 'SAVE_CUSTOMER', data: customerData }, '*');
        if (typeof window.appToast === 'function') window.appToast('গ্রাহক তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!');
        else appToast('✅ গ্রাহক তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!');
    },

    saveFarmerModalData: function() {
        const inputs = document.querySelectorAll('#dataEntryModal input');
        const data = {};
        inputs.forEach(el => {
            if (el.type === 'checkbox') data[el.id] = el.checked;
            else data[el.id] = el.value;
        });
        localStorage.setItem('farmer_saved_data', JSON.stringify(data));
        if(typeof window.appToast === 'function') window.appToast('ডেটা সফলভাবে সেভ করা হয়েছে!');
        else appToast('✅ ডেটা সফলভাবে সেভ করা হয়েছে!');
    },

    clearFarmerModalData: function() {
        const inputs = document.querySelectorAll('#dataEntryModal input');
        inputs.forEach(el => {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        });
        localStorage.removeItem('farmer_saved_data');
    },

    restoreFarmerModalData: function() {
        const saved = localStorage.getItem('farmer_saved_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                Object.keys(data).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.type === 'checkbox') el.checked = data[id];
                        else el.value = data[id];
                    }
                });
            } catch(e) {}
        }
    },

    applyBranchInfo: function () {
        if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
            const bData = window.parent.getCentralBranchData();
            
            if (bData.code) {
                const rawCode = DepositEngine.toBn(bData.code.toString().substring(0, 4));
                const codePart = rawCode + '-';
                const accEl = document.getElementById('farmer_account_no');
                if (accEl && (!accEl.innerText || accEl.innerText.length < 5)) accEl.innerText = codePart;
                const cidEl = document.getElementById('farmer_customer_id');
                if (cidEl && (!cidEl.innerText || cidEl.innerText.length < 4)) cidEl.innerText = rawCode;
                
                const mAccEl = document.getElementById('m_account_no');
                if (mAccEl && !mAccEl.value) mAccEl.value = codePart;
                const mCidEl = document.getElementById('m_customer_id');
                if (mCidEl && !mCidEl.value) mCidEl.value = rawCode;
            }

            const map = {
                'branch_name': bData.nameBn,
                'branch_location_1': bData.locationBn,
                'branch_mobile': bData.mobile,
                'branch_email': bData.email
            };

            Object.keys(map).forEach(key => {
                const els = document.querySelectorAll(`[data-db-field="${key}"]`);
                els.forEach(el => {
                    let val = map[key] || '';
                    if (el.classList.contains('bangla-numbers') && val) {
                        val = DepositEngine.toBn(val);
                    }
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val;
                    else el.innerText = val;
                });
            });

            document.querySelectorAll('.branch-name-input').forEach(el => {
                if (el.tagName === 'INPUT') el.value = bData.nameBn;
                else el.innerText = bData.nameBn || '';
            });
            document.querySelectorAll('.branch-location-input').forEach(el => {
                if (el.tagName === 'INPUT') el.value = bData.locationBn;
                else el.innerText = bData.locationBn || '';
            });
        }
    },

    applyFarmerModalData: function () {
        const g = id => document.getElementById(id);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.classList.contains('bangla-numbers') && val) val = DepositEngine.toBn(val);
                el.innerText = val;
            }
        };

        setVal('applicant_name_bn', g('m_name').value);
        setVal('kyc_account_name', g('m_name').value);
        setVal('applicant_signature_name_1', g('m_name').value);
        setVal('applicant_father_name_bn', g('m_father').value);
        setVal('applicant_mother_name_bn', g('m_mother').value);
        setVal('applicant_nid', g('m_nid').value);
        setVal('applicant_age', g('m_age').value);

        setVal('applicant_curr_addr_village', g('m_village').value);
        setVal('applicant_curr_addr_block', g('m_block').value);
        setVal('nominee_witness_name', g('m_witness_name')?.value);
        setVal('nominee_witness_address', g('m_witness_address')?.value);
        
        setVal('applicant_mobile', g('m_mobile')?.value);
        const krishiBox = document.getElementById('krishi_card_box');
        if (krishiBox) {
            krishiBox.style.display = g('m_krishi_card')?.checked ? 'block' : 'none';
        }
        
        const depositAmt = g('m_initial_deposit')?.value;
        const depositWords = g('m_initial_deposit_words')?.value;
        if (depositAmt) {
            setVal('initial_deposit_display', `${DepositEngine.toBn(depositAmt)}/- (${depositWords})`);
        } else {
            setVal('initial_deposit_display', '');
        }

        setVal('applicant_curr_addr_mouza', g('m_mouza').value);
        setVal('applicant_curr_addr_ward', g('m_ward').value);
        setVal('applicant_curr_addr_union', g('m_union').value);
        setVal('applicant_present_district', g('m_district').value);

        setVal('nominee-name', g('m_nom_name').value);
        setVal('nominee-father', g('m_nom_father').value);
        setVal('nominee-spouse', g('m_nom_spouse').value);
        setVal('nominee-mother', g('m_nom_mother').value);
        setVal('nominee-dob', g('m_nom_dob').value);
        setVal('nominee-relation', g('m_nom_relation').value);

        if (g('m_account_no').value) {
            setVal('farmer_account_no', g('m_account_no').value);
            const rawAcc = g('m_account_no').value.replace(/-/g, '').trim();
            for (let i = 0; i < 14; i++) {
                const box = document.getElementById('account_no_header_digit_' + i);
                if (box) box.value = DepositEngine.toBn(rawAcc[i] || '');
            }
        }
        if (g('m_customer_id').value) setVal('farmer_customer_id', g('m_customer_id').value);
        if (g('m_date').value) {
            const [y, m, d] = g('m_date').value.split('-');
            setVal('farmer_date', `${d}/${m}/${y}`);
        }

        DepositEngine.closeModal();
    },

    populateFarmerForm: function (customer) {
        if (!customer) return;

        // Auto-fill matched IDs in the form directly
        Object.keys(customer).forEach(key => {
            const el = document.getElementById(key);
            if (el && (el.tagName === 'SPAN' || el.tagName === 'DIV')) {
                let val = customer[key] || '';
                if (el.classList.contains('bangla-numbers') && val) {
                    val = DepositEngine.toBn(val);
                }
                el.innerText = val;
            }
        });

        if (customer.applicant_name_bn) {
            const nameBn = customer.applicant_name_bn;
            if (document.getElementById('kyc_account_name')) document.getElementById('kyc_account_name').innerText = nameBn;
            if (document.getElementById('applicant_signature_name_1')) document.getElementById('applicant_signature_name_1').innerText = nameBn;
        }

        if (customer.farmer_account_no) {
            const rawAcc = String(customer.farmer_account_no).replace(/-/g, '').trim();
            for (let i = 0; i < 14; i++) {
                const box = document.getElementById('account_no_header_digit_' + i);
                if (box) box.value = DepositEngine.toBn(rawAcc[i] || '');
            }
        }

        // ----------------------------------------------------
        // Population from customer.applicant_farmer_card_no to boxes
        // ----------------------------------------------------
        if (customer.applicant_farmer_card_no) {
            const boxes = document.querySelectorAll('.box-group .id-box');
            let chars = String(customer.applicant_farmer_card_no).trim();
            boxes.forEach(b => b.innerText = '');
            for (let i = 0; i < boxes.length && i < chars.length; i++) {
                boxes[i].innerText = DepositEngine.toBn(chars[i]);
            }
        }

        // Special NID logic
        const nidEl = document.getElementById('applicant_nid');
        if (nidEl) {
            const nidParts = [];
            if (customer.applicant_nid_10) nidParts.push(customer.applicant_nid_10);
            if (customer.applicant_nid_17) nidParts.push(customer.applicant_nid_17);

            if (nidParts.length > 0) {
                nidEl.innerText = DepositEngine.toBn(nidParts.join(', '));
            } else if (customer.applicant_nid) {
                nidEl.innerText = DepositEngine.toBn(customer.applicant_nid);
            }
        }

        // Handle auto-age calculation
        const ageEl = document.getElementById('applicant_age');
        if (ageEl && customer.applicant_dob) {
            const today = new Date();
            const birth = new Date(customer.applicant_dob);
            if (!isNaN(birth)) {
                let age = today.getFullYear() - birth.getFullYear();
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                if (age >= 0) ageEl.innerText = DepositEngine.toBn(age);
            }
        }

        // Nominee Logic
        if (customer.relationships && customer.relationships.length > 0) {
            const nominee = customer.relationships.find(r => r.relation_type === 'Nominee' || r.relation_type === 'নমিনী');
            if (nominee) {
                const g = id => document.getElementById(id);
                if (g('nominee-name')) g('nominee-name').innerText = nominee.relation_name_bn || nominee.relation_name_en || '';
                if (g('nominee-father')) g('nominee-father').innerText = nominee.relation_father_name_bn || '';
                if (g('nominee-mother')) g('nominee-mother').innerText = nominee.relation_mother_name_bn || '';
                if (g('nominee-spouse')) g('nominee-spouse').innerText = nominee.relation_spouse_name_bn || '';
                if (g('nominee-dob')) g('nominee-dob').innerText = nominee.relation_dob ? DepositEngine.toBn(nominee.relation_dob) : '';
                if (g('nominee-relation')) g('nominee-relation').innerText = nominee.relation_type_bn || nominee.relation_type || '';
            }
        }

        // Populate Modal Inputs
        const g = id => document.getElementById(id);
        if (g('m_name')) g('m_name').value = customer.applicant_name_bn || customer.applicant_name_en || '';
        if (g('m_father')) g('m_father').value = customer.applicant_father_name_bn || '';
        if (g('m_mother')) g('m_mother').value = customer.applicant_mother_name_bn || '';
        if (g('m_nid')) {
            const nidParts = [];
            if (customer.applicant_nid_10) nidParts.push(customer.applicant_nid_10);
            if (customer.applicant_nid_17) nidParts.push(customer.applicant_nid_17);
            g('m_nid').value = nidParts.length > 0 ? nidParts.join(', ') : (customer.applicant_nid || '');
        }
        if (g('m_dob')) {
            g('m_dob').value = customer.applicant_dob || '';
            DepositEngine.calcAgeInModal('m_dob', 'm_age');
        }

        if (g('m_village')) g('m_village').value = customer.applicant_curr_addr_village || customer.applicant_perm_addr_village || '';
        if (g('m_district')) g('m_district').value = customer.applicant_present_district || customer.applicant_permanent_district || '';
        if (g('m_union')) g('m_union').value = customer.applicant_curr_addr_union || customer.applicant_perm_addr_union || '';

        if (customer.relationships && customer.relationships.length > 0) {
            const nominee = customer.relationships.find(r => r.relation_type === 'Nominee' || r.relation_type === 'নমিনী');
            if (nominee) {
                if (g('m_nom_name')) g('m_nom_name').value = nominee.relation_name_bn || nominee.relation_name_en || '';
                if (g('m_nom_father')) g('m_nom_father').value = nominee.relation_father_name_bn || '';
                if (g('m_nom_mother')) g('m_nom_mother').value = nominee.relation_mother_name_bn || '';
                if (g('m_nom_spouse')) g('m_nom_spouse').value = nominee.relation_spouse_name_bn || '';
                if (g('m_nom_dob')) g('m_nom_dob').value = nominee.relation_dob || '';
                if (g('m_nom_relation')) g('m_nom_relation').value = nominee.relation_type_bn || nominee.relation_type || '';
            }
        }
    },
    
    convertToBanglaWords: function(n) {
        const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগার', 'বার', 'তের', 'চৌদ্দ', 'পনের', 'ষোল', 'সতের', 'আঠার', 'ঊনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
        if (n < 100) return units[n];
        if (n < 1000) return units[Math.floor(n / 100)] + 'শত' + (n % 100 !== 0 ? ' ' + DepositEngine.convertToBanglaWords(n % 100) : '');
        if (n < 100000) return DepositEngine.convertToBanglaWords(Math.floor(n / 1000)) + ' হাজার' + (n % 1000 !== 0 ? ' ' + DepositEngine.convertToBanglaWords(n % 1000) : '');
        if (n < 10000000) return DepositEngine.convertToBanglaWords(Math.floor(n / 100000)) + ' লক্ষ' + (n % 100000 !== 0 ? ' ' + DepositEngine.convertToBanglaWords(n % 100000) : '');
        if (n >= 10000000) return DepositEngine.convertToBanglaWords(Math.floor(n / 10000000)) + ' কোটি' + (n % 10000000 !== 0 ? ' ' + DepositEngine.convertToBanglaWords(n % 10000000) : '');
        return '';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.DepositEngine) DepositEngine.initFarmerForm();
});


const enToBn = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

/**
 * Formats an account number with a hyphen after the 4th digit.
 * Input can be raw digits or already-hyphenated. Output is in Bangla numerals.
 * e.g. "12345678901234" → "১২৩৪-৫৬৭৮৯০১২৩৪"
 */
window.formatAccNo = function(raw) {
    if (!raw) return '';
    // Strip hyphens & convert any Bangla digits back to English for processing
    const digits = String(raw).replace(/-/g, '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    if (!digits || digits.replace(/\D/g, '').length === 0) return raw; // non-numeric, return as-is
    const clean = digits.replace(/\D/g, '');
    const formatted = clean.length > 4 ? clean.substring(0, 4) + '-' + clean.substring(4) : clean;
    return formatted.replace(/[0-9]/g, m => enToBn[m]);
};

// Automatic conversion of keyboard digits (0-9) to standard Bengali digits (০-৯) inside .bangla-numbers
document.addEventListener('input', (e) => {
    if (e.target.hasAttribute('contenteditable') && e.target.classList.contains('bangla-numbers')) {
        let range = document.getSelection().getRangeAt(0);
        let currentPos = range.startOffset;

        let val = e.target.innerText;
        let converted = val.replace(/[0-9]/g, (match) => enToBn[match]);

        if (val !== converted) {
            e.target.innerText = converted;

            // Seamless caret position restoration
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

// Listen for FILL command to populate branch info and auto-convert Bangla numbers
window.addEventListener('message', function (event) {
    if (event.data && event.data.command === 'FILL') {
        const data = event.data.data;
        Object.keys(data).forEach(key => {
            const queryStr = '#' + key + ', .' + key + ', [data-db-field="' + key + '"]';
            const els = document.querySelectorAll(queryStr);
            els.forEach(el => {
                let val = data[key] || '';

                // Automatically convert digits to Bangla if the class is present
                if (el.classList.contains('bangla-numbers') && val) {
                    val = val.replace(/[0-9]/g, match => enToBn[match]);
                }

                if (el.tagName === 'SPAN' || el.tagName === 'DIV') {
                    el.innerText = val;
                } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    el.value = val;
                }
            });
        });
    }
});

// =========================================
// SHARED DEPOSIT LOGIC
// =========================================
// Common utilities used across SB, DPS, and Farmer forms.

/**
 * Custom Confirmation Dialog
 */
window.appConfirm = function (msg, onYes, onNo) {
    let overlay = document.getElementById('_app_confirm_overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = '_app_confirm_overlay';
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '99998', fontFamily: "'SolaimanLipi', Arial, sans-serif"
    });
    overlay.innerHTML = `
        <div style="background:white;border-radius:10px;padding:28px 32px;max-width:400px;width:90%;
                    box-shadow:0 8px 30px rgba(0,0,0,0.25);text-align:center;">
            <p style="margin:0 0 22px;font-size:1rem;color:#333;line-height:1.5;">${msg}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="_app_confirm_yes" style="background:#dc3545;color:white;border:none;
                    padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;font-weight:bold;">
                    হ্যাঁ / Yes
                </button>
                <button id="_app_confirm_no" style="background:#6c757d;color:white;border:none;
                    padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;">
                    না / No
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_app_confirm_yes').addEventListener('click', () => {
        overlay.remove(); if (onYes) onYes();
    });
    overlay.querySelector('#_app_confirm_no').addEventListener('click', () => {
        overlay.remove(); if (onNo) onNo();
    });
};

/**
 * Custom Toast Notification
 */
window.appToast = function (msg, isError = false) {
    const color = isError ? '#dc3545' : '#28a745';
    let t = document.getElementById('_app_toast');
    if (!t) {
        t = document.createElement('div');
        t.id = '_app_toast';
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
    t.style.backgroundColor = color;
    t.style.opacity = '1';
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.style.opacity = '0'; }, 3200);
};

// =========================================
// SAVINGS ACCOUNT (SB) LOGIC

/* ================================================================
   SHARED GLOBAL EVENT ROUTER
   Handles all 'message' events for ALL forms.
   Delegates to the currently active form's window.xxx functions.
================================================================ */
window.addEventListener('message', function (event) { // SHARED GLOBAL EVENT ROUTER
    if (!event.data || !event.data.command) return;
    var cmd = event.data.command;

    if (cmd === 'FILL') {
        if (typeof window.populateFromCustomer === 'function') {
            window.populateFromCustomer(event.data.data);
        }
    }
    else if (cmd === 'FILL_SLOT') {
        var slot = event.data.slot || '';
        var data = event.data.data || {};
        if (slot.startsWith('nominee_')) {
            var nIdx = parseInt(slot.split('_')[1]);
            if (typeof window.populateNomineeEntry === 'function') window.populateNomineeEntry(nIdx, data);
        } else if (slot.startsWith('person_')) {
            var pIdx = parseInt(slot.split('_')[1]);
            if (typeof window.populatePersonSlot === 'function') window.populatePersonSlot(pIdx, data);
        }
    }
    else if (cmd === 'EXECUTE_ACTION') {
        switch (event.data.actionId) {
            case 'btn-data-entry':
                if (typeof window.openModal === 'function') window.openModal();
                break;
            case 'btn-print-form':
                window.print();
                break;
            case 'btn-start-new':
            case 'btn-clear-form':
                if (typeof window.appConfirm === 'function') {
                    window.appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); });
                } else {
                    if (confirm('সকল ডেটা মুছে রিস্টার্ট করবেন?')) location.reload();
                }
                break;
        }
    }
});

// =========================================
(function () {
    if (!document.getElementById("sb-ac-form")) return; // Guard to prevent execution on other forms
    // Savings  Form Logic //

    // Modal Functions - defined here so they're available to HTML buttons
    function openModal() {
        const modal = document.getElementById("dataEntryModal");
        console.log("openModal called, modal:", modal);
        if (modal) {
            modal.style.display = "block";
            modal.style.visibility = "visible";
            modal.style.position = "fixed";
            modal.style.zIndex = "10000";
            console.log("Modal displayed:", modal.style.display);
            console.log("Modal visibility:", modal.style.visibility);
            console.log("Modal innerHTML length:", modal.innerHTML.length);

            // Initialize modal content on open
            initializeModalContent();
        } else {
            console.error("Modal element not found!");
            appToast("Modal element not found! Check browser console for errors.");
        }
    }

    function closeModal() {
        const modal = document.getElementById("dataEntryModal");
        console.log("closeModal called");
        if (modal) {
            modal.style.display = "none";
        }
    }

    // Handle clicking outside modal to close it
    window.onclick = function (event) {
        const modal = document.getElementById("dataEntryModal");
        if (event.target == modal) {
            closeModal();
        }
    };

    // Toggle visibility of non-resident fields
    function toggleNonResidentFields(selectElement) {
        const personEntry = selectElement.closest('.person-entry');
        if (!personEntry) return;

        const visaTypeGroup = personEntry.querySelector('.modal_visa_type_group');
        const workPermitGroup = personEntry.querySelector('.modal_work_permit_group');

        if (selectElement.value === 'nonres') {
            visaTypeGroup.style.display = 'block';
            workPermitGroup.style.display = 'block';
        } else {
            visaTypeGroup.style.display = 'none';
            workPermitGroup.style.display = 'none';
        }
    }

    // Placeholder for initialization - will be properly defined in main script
    function initializeModalContent() {
        // This will be properly defined after all DOM is loaded
        // For now, just ensure first person entry exists
        setTimeout(() => {
            const pContainer = document.getElementById('person_container');
            if (pContainer && pContainer.children.length === 0) {
                if (typeof addPerson === 'function') {
                    addPerson();
                }
            }
        }, 100);
    }



    /**
     * Converts English digits to Bangla Unicode digits.
     */
    function toBanglaDigits(str) {
        if (str === undefined || str === null || str === "") return "";
        const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
        return str.toString().replace(/\d/g, d => banglaDigits[d]);
    }






    // Expose to global window so HTML onclick handlers can reach them
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.toggleNonResidentFields = toggleNonResidentFields;

    // Wire up remaining HTML inline functions that were hidden by the IIFE
    if (typeof addGuardian === 'function') window.addGuardian = addGuardian;
    if (typeof addNominee === 'function') window.addNominee = addNominee;
    if (typeof addPerson === 'function') window.addPerson = addPerson;
    if (typeof addRiskItem === 'function') window.addRiskItem = addRiskItem;
    if (typeof addTransactionRow === 'function') window.addTransactionRow = addTransactionRow;
    if (typeof applyData === 'function') window.applyData = applyData;
    if (typeof clearModalData === 'function') window.clearModalData = clearModalData;
    if (typeof handleOperationMode === 'function') window.handleOperationMode = handleOperationMode;
    if (typeof handleOthers === 'function') window.handleOthers = handleOthers;
    if (typeof saveModalData === 'function') window.saveModalData = saveModalData;
    if (typeof toggleNomineeMinor === 'function') window.toggleNomineeMinor = toggleNomineeMinor;
    if (typeof toggleNomineeSection === 'function') window.toggleNomineeSection = toggleNomineeSection;
    if (typeof togglePepFieldsGlobal === 'function') window.togglePepFieldsGlobal = togglePepFieldsGlobal;
    if (typeof toggleSanctionFieldsGlobal === 'function') window.toggleSanctionFieldsGlobal = toggleSanctionFieldsGlobal;
    if (typeof toggleTick === 'function') window.toggleTick = toggleTick;
    if (typeof updateRiskScore === 'function') window.updateRiskScore = updateRiskScore;
    if (typeof convertAmount === 'function') window.convertAmount = convertAmount;
    if (typeof removeRiskItem === 'function') window.removeRiskItem = removeRiskItem;

    window.AppStorage = window.AppStorage || window.parent?.AppStorage || {
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => localStorage.setItem(k, v),
        removeItem: (k) => localStorage.removeItem(k)
    };
    // Handles digit input focusing logic
    document.querySelectorAll('.digit-input, .box-input-p3').forEach((input, idx, inputs) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                let next = idx + 1;
                // Skip locked digits when moving forward
                while (next < inputs.length && inputs[next].readOnly) next++;
                if (next < inputs.length) inputs[next].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value) {
                let prev = idx - 1;
                // Skip locked digits when moving backward
                while (prev >= 0 && inputs[prev].readOnly) prev--;
                if (prev >= 0) inputs[prev].focus();
            }
        });
    });

    let currentBranchCode = "";

    /**
     * Centrally managed Branch Code population logic.
     * Converts English digits to Bangla and locks the first 4 boxes.
     */
    window.setBranchCode = function (code) {
        // 0. Update text labels for Branch Name across all pages from central data
        if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
            const bData = window.parent.getCentralBranchData();

            document.querySelectorAll('.branch-name-input').forEach(el => {
                const val = bData.nameBn || '';
                if (el.tagName === 'INPUT') el.value = val;
                else el.innerText = bData.nameBn || '';
            });

            document.querySelectorAll('.branch-location-input').forEach(el => {
                // Populate with Thana if available, fallback to Location
                const addressText = bData.thanaBn || bData.locationBn || '';
                if (el.tagName === 'INPUT') el.value = addressText;
                else el.innerText = addressText;
            });

            // Sync Page 1 branch field by ID
            const p1Branch = document.getElementById('branch_name');
            if (p1Branch) p1Branch.value = bData.nameBn || '';
        }

        if (!code || code === "undefined") return;

        currentBranchCode = code.toString().substring(0, 4);
        const bnCode = toBanglaDigits(currentBranchCode);

        // 1. Update Page 1 Boxes (Account Number and Unique ID) 
        ['p1_acc_container', 'p1_cid_container'].forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.querySelectorAll('input').forEach((inp, i) => {
                    if (i < 4) {
                        inp.value = bnCode[i] || '';
                        inp.readOnly = true;
                        inp.classList.add('locked-digit');
                    }
                });
            }
        });

        // 2. Update All Banners (Page 3, 6, 8, etc.)  
        document.querySelectorAll('.bkb-banner-p3 .banner-row-p3').forEach(row => {
            const inputs = row.querySelectorAll('.box-input-p3');
            inputs.forEach((inp, i) => {
                if (i < 4) {
                    inp.value = bnCode[i] || '';
                    inp.readOnly = true;
                    inp.classList.add('locked-digit');
                }
            });
        });

        // 3. Update Page 5 Custom Header specifically 
        const p5Header = document.getElementById('account_no_header_container');
        if (p5Header) {
            p5Header.querySelectorAll('input').forEach((inp, i) => {
                if (i < 4) {
                    inp.value = bnCode[i] || '';
                    inp.readOnly = true;
                    inp.classList.add('locked-digit');
                }
            });
        }

        // 4. Update Data Entry Modal Inputs 
        ['modal_account_no', 'modal_unique_customer_id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const raw = el.value.replace(/\D/g, '');
                if (!raw.startsWith(currentBranchCode)) {
                    const suffix = raw.substring(currentBranchCode.length) || '';
                    const combined = currentBranchCode + suffix;
                    el.value = combined.length > 4
                        ? combined.substring(0, 4) + '-' + combined.substring(4)
                        : combined;
                }
            }
        });
    };

    // Auto-sync branch info from parent shell on startup
    function syncBranchState() {
        if (window.parent) {
            // Try to get code from a global function in the shell
            if (typeof window.parent.getCentralBranchCode === 'function') {
                const code = window.parent.getCentralBranchCode();
                window.setBranchCode(code);
                return;
            }
            // Shell might not be ready yet, retry in 500ms
            setTimeout(syncBranchState, 500);
        }
    }
    window.addEventListener('load', syncBranchState);

    function toggleTick(el) {
        el.innerText = el.innerText === '✓' ? '' : '✓';
    }

    // Logic to lock the first 4 digits (branch code) and auto-insert a hyphen after them
    function setupModalInputLock(id) {
        const el = document.getElementById(id);
        if (!el) return;

        function applyFormat() {
            // Strip everything that's not a digit
            let digits = el.value.replace(/\D/g, '');
            // Enforce max 14 digits
            if (digits.length > 14) digits = digits.substring(0, 14);
            // Ensure branch code prefix
            if (currentBranchCode && !digits.startsWith(currentBranchCode)) {
                digits = currentBranchCode + digits.substring(currentBranchCode.length);
            }
            // Format: XXXX-XXXXXXXXXX
            const formatted = digits.length > 4
                ? digits.substring(0, 4) + '-' + digits.substring(4)
                : digits;
            el.value = formatted;
        }

        el.addEventListener('keydown', (e) => {
            const pos = el.selectionStart;
            // Prevent deleting into the branch code (first 4 digits + hyphen = positions 0-4)
            if (pos <= 5 && (e.key === 'Backspace' || e.key === 'Delete')) e.preventDefault();
        });

        el.addEventListener('input', applyFormat);
    }

    // Initialize modal input locks
    setupModalInputLock('modal_account_no');
    setupModalInputLock('modal_unique_customer_id');

    const warningToast = document.getElementById('warning-toast');
    let toastTimeout;

    function showWarning(msg) {
        if (!warningToast) return;
        warningToast.innerText = msg;
        warningToast.style.display = 'block';
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            warningToast.style.display = 'none';
        }, 2000);
    }

    // Number only restriction for specific fields and banner boxes
    document.querySelectorAll('.number-only, .box-input-p3, .digit-input').forEach(el => {
        el.addEventListener('keydown', (e) => {
            // Allow: backspace, delete, tab, escape, enter, arrows, Ctrl+A/C/V/X
            if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
                (e.keyCode === 67 && (e.ctrlKey === true || e.metaKey === true)) ||
                (e.keyCode === 86 && (e.ctrlKey === true || e.metaKey === true)) ||
                (e.keyCode === 88 && (e.ctrlKey === true || e.metaKey === true)) ||
                (e.keyCode >= 35 && e.keyCode <= 40)) {
                return;
            }

            let isStrict = el.classList.contains('box-input-p3') || el.classList.contains('digit-input');
            let valid = false;

            // Numbers
            if (!e.shiftKey && ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105))) {
                valid = true;
            }

            // Allow Space, Dash, Plus, Parentheses for phone numbers and money formats (non-strict)
            if (!isStrict) {
                if (e.keyCode === 32 || e.keyCode === 189 || e.keyCode === 109 || e.keyCode === 107 ||
                    (e.keyCode === 187 && e.shiftKey) ||
                    (e.keyCode === 57 && e.shiftKey) ||
                    (e.keyCode === 48 && e.shiftKey)) {
                    valid = true;
                }
            }

            if (!valid) {
                e.preventDefault();
                showWarning('only numbers are accepted');
            }
        });

        // Prevent pasting non-numeric text
        el.addEventListener('paste', (e) => {
            let paste = (e.clipboardData || window.clipboardData).getData('text');
            let isStrict = el.classList.contains('box-input-p3') || el.classList.contains('digit-input');
            let regex = isStrict ? /^\d+$/ : /^[\d\s\+\-\(\)\.]+$/;

            if (!regex.test(paste)) {
                e.preventDefault();
                showWarning('only numbers are accepted');
            }
        });
    });

    // Auto-resize font to fit box width
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.addEventListener('input', function () {
            let fontSize = parseInt(window.getComputedStyle(this).fontSize);
            // Reduce font size if content overflows (min 6px)
            while (this.scrollWidth > this.clientWidth && fontSize > 6) {
                fontSize--;
                this.style.fontSize = fontSize + 'px';
            }
        });
    });

    // Logic to populate Account Number in photo box from Banner inputs on Page 3
    // Structure: Branch(4) - Type(4) - Number(6). Last digit is security.
    // We need the first 5 digits of the Number part (indices 8, 9, 10, 11, 12 of the banner inputs).
    const bannerAccInputs = document.querySelectorAll('.bkb-banner-p3 .banner-row-p3:first-child .box-input-p3');

    function updatePhotoAccNumber() {
        let val1 = bannerAccInputs[8].value || '';
        let val2 = bannerAccInputs[9].value || '';
        let val3 = bannerAccInputs[10].value || '';
        let val4 = bannerAccInputs[11].value || '';
        let val5 = bannerAccInputs[12].value || '';

        let combined = val1 + val2 + val3 + val4 + val5;
        const displayEl = document.getElementById('photo_acc_num_display') || document.getElementById('display_acc_no_short');
        if (displayEl) displayEl.innerText = combined.length > 0 ? combined : '............';
    }

    if (bannerAccInputs.length > 0) {
        [8, 9, 10, 11, 12].forEach(index => {
            if (bannerAccInputs[index]) {
                bannerAccInputs[index].addEventListener('input', updatePhotoAccNumber);
            }
        });
    }

    // --- START: Date Box Validation and Input Handling ---

    function setupDateInput(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const dateBoxes = container.querySelectorAll('.date-container .digit-box');
        if (dateBoxes.length !== 8) return;

        function validateDate() {
            const dateDigits = Array.from(dateBoxes).map(box => box.innerText.trim());
            if (dateDigits.some(digit => digit === '') || dateDigits.join('').length < 8) {
                return; // Don't validate if not fully filled
            }

            const day = dateDigits.slice(0, 2).join('');
            const month = dateDigits.slice(2, 4).join('');
            const year = dateDigits.slice(4, 8).join('');
            const d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10);

            let isValid = true;
            // Check for NaN and basic ranges (e.g., year 2525 is invalid)
            if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
                isValid = false;
            } else {
                // More precise check using Date object to handle days in month and leap years
                const testDate = new Date(y, m - 1, d);
                if (testDate.getFullYear() !== y || testDate.getMonth() + 1 !== m || testDate.getDate() !== d) {
                    isValid = false;
                }
            }

            if (!isValid) {
                showWarning('Invalid date. Please use DD MM YYYY format.');
                dateBoxes.forEach(box => box.style.backgroundColor = '#ffdddd');
                dateBoxes[0].focus();
            } else {
                dateBoxes.forEach(box => box.style.backgroundColor = '');
            }
        }

        dateBoxes.forEach((box, index) => {
            box.addEventListener('input', () => {
                box.style.backgroundColor = ''; // Remove error highlight on typing
                const text = box.innerText.trim();
                if (text.length > 1) box.innerText = text.charAt(0);
                if (text.length === 1 && index < dateBoxes.length - 1) {
                    dateBoxes[index + 1].focus();
                }
            });

            box.addEventListener('keydown', (e) => {
                // Allow navigation, control keys, and paste
                if (['Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) || (e.ctrlKey || e.metaKey)) {
                    if (e.key === 'Backspace' && box.innerText.length === 0 && index > 0) {
                        dateBoxes[index - 1].focus();
                    }
                    return;
                }
                // Allow only numbers
                if (!/^\d$/.test(e.key)) {
                    e.preventDefault();
                    showWarning('Only numbers are allowed for dates.');
                }
            });

            box.addEventListener('paste', (e) => {
                e.preventDefault();
                let paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (paste) {
                    let currentBoxIndex = index;
                    for (let i = 0; i < paste.length && currentBoxIndex < dateBoxes.length; i++) {
                        dateBoxes[currentBoxIndex].innerText = paste[i];
                        dateBoxes[currentBoxIndex++].style.backgroundColor = '';
                    }
                    dateBoxes[Math.min(currentBoxIndex, dateBoxes.length - 1)].focus();
                    if (currentBoxIndex >= dateBoxes.length) validateDate();
                }
            });
        });

        dateBoxes[dateBoxes.length - 1].addEventListener('blur', validateDate);
    }

    // Apply the date input logic to all relevant pages
    setupDateInput('#page-3');
    setupDateInput('#page-8');

    // --- END: Date Box Validation and Input Handling ---

    // Modal functions are defined in HEAD script block


    function handleOthers(selectId, inputId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const input = document.getElementById(inputId);
        if (!input) return;
        if (select.value === 'others' || select.value === 'survivor') {
            input.style.display = 'block';
        } else {
            input.style.display = 'none';
        }
    }

    function togglePepFieldsGlobal(select) {
        const fields = document.getElementById('modal_kyc_pep_fields');
        if (select.value === 'yes') fields.style.display = 'block';
        else fields.style.display = 'none';
    }

    function toggleSanctionFieldsGlobal(select) {
        const fields = document.getElementById('modal_kyc_sanction_fields');
        if (select.value === 'yes') fields.style.display = 'block';
        else fields.style.display = 'none';
    }

    function handleOperationMode() {
        if (!document.getElementById('modal_account_operation')) return;
        handleOthers('modal_account_operation', 'modal_operation_others');
        // Keep "Add Another" visible; we allow adding multiple applicants regardless of operation mode here.
    }

    function setElementText(id, val) {
        document.querySelectorAll('[id="' + id + '"]').forEach(el => {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = val;
            else el.innerText = val;
        });
    }

    function setCheck(id, checked) {
        document.querySelectorAll('[id="' + id + '"]').forEach(el => {
            el.innerText = checked ? '✓' : '';
        });
    }

    function toBanglaDigits(str) {
        if (str === null || str === undefined) return "";
        return str.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
    }

    function toBanglaNumber(n) {
        return toBanglaDigits(n);
    }

    function toEnglishNumber(n) {
        if (!n) return "";
        const englishDigits = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
        return n.toString().split('').map(digit => englishDigits[digit] || digit).join('');
    }

    function distributeDigits(nodeList, valStr) {
        nodeList.forEach((input, i) => {
            if (i < valStr.length) input.value = valStr[i];
            else input.value = '';
        });
    }

    function convertAmount() {
        const amountEl = document.getElementById('modal_initial_deposit_amount');
        const wordsEl = document.getElementById('modal_initial_deposit_amount_words');
        if (!amountEl) return;

        let amountInput = amountEl.value || '';
        // Convert Bangla digits to Latin before parsing (if user typed Bangla digits)
        const banglaDigits = '০১২৩৪৫৬৭৮৯';
        const latinDigits = '0123456789';
        amountInput = amountInput.replace(new RegExp('[' + banglaDigits + ']', 'g'), ch => latinDigits[banglaDigits.indexOf(ch)]);
        // Remove non-digits for calculation
        const numStr = amountInput.replace(/[^\d]/g, '');

        // Update the input value to reflect only numbers (visual enforcement)
        if (amountEl.value !== numStr) amountEl.value = numStr;

        if (!numStr) {
            if (wordsEl) wordsEl.value = '';
            return;
        }
        const num = parseInt(numStr, 10);
        if (!isNaN(num)) {
            if (wordsEl) wordsEl.value = convertToBanglaWords(num) + ' টাকা মাত্র';
        }
    }

    function convertToBanglaWords(n) {
        const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগার', 'বার', 'তের', 'চৌদ্দ', 'পনের', 'ষোল', 'সতের', 'আঠার', 'ঊনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

        if (n < 100) return units[n];

        if (n < 1000) {
            return units[Math.floor(n / 100)] + 'শ' + (n % 100 !== 0 ? ' ' + convertToBanglaWords(n % 100) : '');
        }
        if (n < 100000) {
            return convertToBanglaWords(Math.floor(n / 1000)) + ' হাজার' + (n % 1000 !== 0 ? ' ' + convertToBanglaWords(n % 1000) : '');
        }
        if (n < 10000000) {
            return convertToBanglaWords(Math.floor(n / 100000)) + ' লক্ষ' + (n % 100000 !== 0 ? ' ' + convertToBanglaWords(n % 100000) : '');
        }
        if (n >= 10000000) {
            return convertToBanglaWords(Math.floor(n / 10000000)) + ' কোটি' + (n % 10000000 !== 0 ? ' ' + convertToBanglaWords(n % 10000000) : '');
        }
        return '';
    }

    function copyAddress(checkbox) {
        const section = checkbox.closest('.person-entry');
        const fields = ['road', 'dist', 'phone', 'post', 'thana', 'email'];
        if (checkbox.checked) {
            fields.forEach(field => {
                section.querySelector('.modal_perm_' + field).value = section.querySelector('.modal_curr_' + field).value;
            });
        } else {
            fields.forEach(field => section.querySelector('.modal_perm_' + field).value = '');
        }
    }

    // --- Dynamic Section Logic ---
    function createPersonHTML(index) {
        return `
        <div class="entry-section person-entry">
            ${index > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <span style="font-weight:bold; color:var(--bank-green);">Applicant-${index + 1}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="fbtn-data" onclick="pullCustomerForSlot(this)" 
                        >
                        &#128269; Pull Customer Data
                    </button>
                    <button type="button" class="fbtn-remove" onclick="removeSection(this)"
                        >
                        Remove (-)
                    </button>
                </div>
            </div>` : ''}
            <input type="hidden" class="modal_photo_data">
            <div class="form-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <div class="form-group" style="grid-column: span 2;"><label>নাম (বাংলায়)</label><input type="text" class="modal_name_bn"></div>
                <div class="form-group" style="grid-column: span 2;"><label>নাম (ইংরেজি)</label><input type="text" class="modal_name_en" oninput="this.value = this.value.toUpperCase()"></div>
                
                <div class="form-group" style="grid-column: span 2;"><label>পিতার নাম</label><input type="text" class="modal_father"></div>
                <div class="form-group" style="grid-column: span 2;"><label>মাতার নাম</label><input type="text" class="modal_mother"></div>
                
                <div class="form-group" style="grid-column: span 2;"><label>স্বামী/স্ত্রীর নাম</label><input type="text" class="modal_spouse"></div>
                <div class="form-group"><label>জাতীয়তা</label>
                    <select class="modal_nationality" onchange="if(this.value==='other'){ this.nextElementSibling.style.display='block'; } else { this.nextElementSibling.style.display='none'; }">
                        <option value="">নির্বাচন করুন</option>
                        <option value="বাংলাদেশী">বাংলাদেশী</option>
                        <option value="other">অন্যান্য</option>
                    </select>
                    <input type="text" class="modal_nationality_other" placeholder="জাতীয়তা উল্লেখ করুন" style="display:none; margin-top:5px;">
                </div>

                <div class="form-group"><label>আইডির ধরণ নির্বাচন করুন</label>
                    <select class="modal_id_type" onchange="updateIdInput(this)">
                        <option value="">নির্বাচন করুন</option>
                        <option value="nid">এনআইডি (10 বা 17 ডিজিট)</option>
                        <option value="birth">জন্মনিবন্ধন</option>
                        <option value="passport">পাসপোর্ট</option>
                    </select>
                </div>
                <div class="form-group"><label>আইডি নম্বর</label><input type="text" class="modal_id_number" placeholder="নম্বর এখানে লিখুন" onchange="validateIdNumber(this)" oninput="handleIdInput(this)"></div>
                <div class="form-group"><label>জন্ম তারিখ</label><input type="date" class="modal_dob"></div>
                <div class="form-group"><label>লিঙ্গ</label>
                    <select class="modal_gender">
                        <option value="">নির্বাচন করুন</option><option value="male">পুরুষ</option><option value="female">মহিলা</option><option value="third">তৃতীয়</option>
                    </select>
                </div>
                <div class="form-group"><label>টিআইএন</label><input type="text" class="modal_tin" oninput="this.value = this.value.replace(/[^0-9]/g, '')"></div>

                <div class="form-group"><label>রেসিডেন্ট স্ট্যাটাস</label>
                    <select class="modal_resident" onchange="toggleNonResidentFields(this)">
                        <option value="">নির্বাচন করুন</option><option value="resident">রেসিডেন্ট</option><option value="nonres">নন রেসিডেন্ট</option>
                    </select>
                </div>
                <div class="form-group modal_visa_type_group" style="display:none;"><label>ভিসার প্রকৃতি--মেয়াদ</label><input type="text" class="modal_visa_type"></div>
                <div class="form-group modal_work_permit_group" style="display:none;"><label>কর্মানুমতি আছে/নাই</label>
                    <select class="modal_work_permit">
                        <option value="">নির্বাচন করুন</option><option value="yes">হ্যাঁ</option><option value="no">না</option>
                    </select>
                </div>
                <div class="form-group"><label>পেশা</label><input type="text" class="modal_profession"></div>
                <div class="form-group"><label>মাসিক আয়</label><input type="text" class="modal_income" oninput="this.value = this.value.replace(/[^0-9]/g, '')"></div>
                <div class="form-group"><label>আয়ের উৎস</label><input type="text" class="modal_source"></div>
                
                <div class="full-width" style="grid-column: span 4; font-weight:bold; margin-top:5px; border-bottom: 1px solid #eee;">বর্তমান ঠিকানা</div>
                <div class="form-group" style="grid-column: span 2;"><label>রোড/গ্রাম</label><input type="text" class="modal_curr_road"></div>
                <div class="form-group"><label>পোস্ট</label><input type="text" class="modal_curr_post"></div>
                <div class="form-group"><label>থানা</label><input type="text" class="modal_curr_thana"></div>
                
                <div class="form-group"><label>জেলা</label><input type="text" class="modal_curr_dist"></div>
                <div class="form-group"><label>ফোন</label><input type="text" class="modal_curr_phone"></div>
                <div class="form-group" style="grid-column: span 2;"><label>ইমেইল</label><input type="text" class="modal_curr_email"></div>

                <div class="full-width" style="grid-column: span 4; font-weight:bold; margin-top:5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee;">
                    <span>স্থায়ী ঠিকানা</span>
                    <label style="font-weight: normal; font-size: 12px; cursor: pointer;"><input type="checkbox" class="same_as_current" onchange="copyAddress(this)"> বর্তমানের মতো</label>
                </div>
                <div class="form-group" style="grid-column: span 2;"><label>রোড/গ্রাম</label><input type="text" class="modal_perm_road"></div>
                <div class="form-group"><label>পোস্ট</label><input type="text" class="modal_perm_post"></div>
                <div class="form-group"><label>থানা</label><input type="text" class="modal_perm_thana"></div>
                
                <div class="form-group"><label>জেলা</label><input type="text" class="modal_perm_dist"></div>
                <div class="form-group"><label>ফোন</label><input type="text" class="modal_perm_phone"></div>
                <div class="form-group" style="grid-column: span 2;"><label>ইমেইল</label><input type="text" class="modal_perm_email"></div>
            </div>
        </div>`;
    }

    function createNomineeHTML(index) {
        return `
            <div class="entry-section nominee-entry" style="width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <span style="font-weight:bold; color:var(--bank-green);">Nominee-${index + 1}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button type="button" class="fbtn-data" onclick="pullCustomerForNominee(this)">
                            &#128269; Pull Customer Data
                        </button>
                        ${index > 0 ? `
                        <button type="button" class="fbtn-remove" onclick="removeSection(this)">
                            Remove (-)
                        </button>` : ''}
                    </div>
                </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                <div class="form-group"><label>Nominee Name</label><input type="text" class="modal_nom_name" oninput="this.value = this.value.toUpperCase()"></div>
                <div class="form-group"><label>Nominee DOB</label><input type="date" class="modal_nom_dob"></div>
                <div class="form-group"><label>Address</label><input type="text" class="modal_nom_addr"></div>
                <div class="form-group"><label>Relationship</label><input type="text" class="modal_nom_rel"></div>
                <div class="form-group"><label>Percentage (%)</label><input type="number" class="modal_nom_pct" placeholder="e.g. 50"></div>
                <div class="form-group"><label>Nominee ID</label><input type="text" class="modal_nom_id"></div>
            </div>
        </div>`;
    }
    function addPerson() {
        const container = document.getElementById('person_container');
        const div = document.createElement('div');
        div.innerHTML = createPersonHTML(container.children.length);
        container.appendChild(div.firstElementChild);
        // Initialize events and display for the newly added person section
        initPersonSection(container.lastElementChild);
    }

    // Context-aware customer pull for a specific applicant slot
    function pullCustomerForSlot(btn) {
        const personEntry = btn.closest('.person-entry');
        const container = document.getElementById('person_container');
        const index = Array.from(container.children).indexOf(personEntry);
        window.parent.postMessage({
            command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
            targetContext: 'person_' + index
        }, '*');
    }

    function pullCustomerForNominee(btn) {
        const nomineeEntry = btn.closest('.nominee-entry');
        const container = document.getElementById('nominee_container');
        const index = Array.from(container.children).indexOf(nomineeEntry);
        window.parent.postMessage({
            command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
            targetContext: 'nominee_' + index
        }, '*');
    }

    function addNominee() {
        const container = document.getElementById('nominee_container');
        const div = document.createElement('div');
        div.innerHTML = createNomineeHTML(container.children.length);
        container.appendChild(div.firstElementChild);
    }

    function removeSection(btn) {
        btn.closest('.entry-section').remove();
    }

    function handleIdInput(input) {
        const container = input.closest('.person-entry') || input.closest('.guardian-entry');
        if (!container) return;

        const typeSelect = container.querySelector('.modal_id_type') || container.querySelector('.guardian_id_type');
        if (!typeSelect) return;

        const type = typeSelect.value;
        if (type === 'nid' || type === 'birth' || type === 'tin') {
            input.value = input.value.replace(/[^0-9]/g, '');
        }
    }

    function updateIdInput(selectElement) {
        const idInput = selectElement.closest('.person-entry').querySelector('.modal_id_number');
        const idType = selectElement.value;

        if (!idInput) return;

        // Clear previous value
        idInput.value = '';

        // Set placeholder based on ID type
        switch (idType) {
            case 'nid':
                idInput.placeholder = '10 বা 17 ডিজিট এনআইডি নম্বর';
                idInput.type = 'text';
                idInput.dataset.idType = 'nid';
                break;
            case 'birth':
                idInput.placeholder = 'জন্মনিবন্ধন নম্বর';
                idInput.type = 'text';
                idInput.dataset.idType = 'birth';
                break;
            case 'passport':
                idInput.placeholder = 'পাসপোর্ট নম্বর';
                idInput.type = 'text';
                idInput.dataset.idType = 'passport';
                break;
            default:
                idInput.placeholder = 'নম্বর এখানে লিখুন';
                idInput.dataset.idType = '';
        }
    }

    function validateIdNumber(inputElement) {
        const personEntry = inputElement.closest('.person-entry');
        const idTypeSelect = personEntry.querySelector('.modal_id_type');
        const idType = idTypeSelect.value;
        const idValue = inputElement.value.trim();

        if (!idValue) return; // Empty is allowed

        let isValid = true;
        let errorMsg = '';

        if (idType === 'nid') {
            // NID must be 10 or 17 digits
            const digitOnly = idValue.replace(/\D/g, '');
            if (digitOnly.length !== 10 && digitOnly.length !== 17) {
                isValid = false;
                errorMsg = 'এনআইডি নম্বর 10 বা 17 ডিজিট হতে হবে';
            }
        } else if (idType === 'birth') {
            // Birth registration - allow various formats
            if (idValue.length < 5) {
                isValid = false;
                errorMsg = 'জন্মনিবন্ধন নম্বর যথাযথ হতে হবে';
            }
        } else if (idType === 'passport') {
            // Passport - typically 6-9 characters
            if (idValue.length < 6 || idValue.length > 9) {
                isValid = false;
                errorMsg = 'পাসপোর্ট নম্বর 6-9 অক্ষর হতে হবে';
            }
        }

        if (!isValid) {
            appToast(errorMsg, true);
            inputElement.focus();
            // Don't clear the value, just highlight the error
        }
    }

    function validateNominees() {
        // Percentage is not mandatory to complete data entry
        return true;
    }

    function toggleNomineeSection() {
        const nomineeSection = document.getElementById('nominee_section');
        const btn = document.getElementById('btn-add-nominee');
        const nomineeContainer = document.getElementById('nominee_container');

        if (nomineeSection.style.display === 'none') {
            nomineeSection.style.display = 'block';
            btn.style.backgroundColor = '#4CAF50';
            btn.style.color = 'white';
            // Add first nominee if none exist
            if (nomineeContainer.children.length === 0) addNominee();
        } else {
            nomineeSection.style.display = 'none';
            btn.style.backgroundColor = '';
            btn.style.color = '';
            // Clear nominees when hiding
            nomineeContainer.innerHTML = '';
        }
    }

    function toggleNomineeMinor() {
        const guardianSection = document.getElementById('guardian-section');
        const btn = document.getElementById('btn-nominee-minor');
        const guardianContainer = document.getElementById('guardian_container');

        if (guardianSection.style.display === 'none') {
            guardianSection.style.display = 'block';
            btn.style.backgroundColor = '#4CAF50';
            btn.style.color = 'white';
            // Add first guardian if none exist
            if (guardianContainer.children.length === 0) addGuardian();
        } else {
            guardianSection.style.display = 'none';
            btn.style.backgroundColor = '';
            btn.style.color = '';
            // Clear guardians when hiding
            guardianContainer.innerHTML = '';
        }
    }

    function updateGuardianIdInput(selectElement) {
        const guardianEntry = selectElement.closest('.guardian-entry');
        const idInput = guardianEntry.querySelector('.guardian_id_number');
        const idType = selectElement.value;

        if (!idInput) return;

        // Clear previous value
        idInput.value = '';

        // Set placeholder based on ID type
        switch (idType) {
            case 'nid':
                idInput.placeholder = 'এনআইডি নম্বর লিখুন (১০ ডিজিট সুপারিশকৃত)';
                idInput.type = 'text';
                break;
            case 'passport':
                idInput.placeholder = 'পাসপোর্ট নম্বর লিখুন';
                idInput.type = 'text';
                break;
            case 'birth':
                idInput.placeholder = 'জন্ম নিবন্ধন নম্বর লিখুন';
                idInput.type = 'text';
                break;
            case 'other':
                idInput.placeholder = 'অন্যান্য আইডি নম্বর লিখুন';
                idInput.type = 'text';
                break;
            default:
                idInput.placeholder = 'নম্বর লিখুন';
        }
    }

    function createGuardianHTML(index) {
        return `
        <div class="entry-section guardian-entry" style="width: 100%;">
            ${index > 0 ? `<div style="font-weight:bold; color:var(--bank-green); margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">Guardian-${index + 1}</div>` : ''}
            ${index > 0 ? '<button class="fbtn-remove" onclick="removeSection(this)">Remove</button>' : ''}
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                <div class="form-group"><label>ক) নাম</label><input type="text" class="guardian_name" placeholder="পূর্ণ নাম লিখুন"></div>
                <div class="form-group"><label>খ) স্থায়ী ঠিকানা</label><input type="text" class="guardian_address" placeholder="স্থায়ী ঠিকানা লিখুন"></div>
                <div class="form-group"><label>গ) আইডি নির্বাচন করুন</label><select class="guardian_id_type" onchange="updateGuardianIdInput(this)"><option value="">নির্বাচন করুন</option><option value="nid">এনআইডি</option><option value="passport">পাসপোর্ট নম্বর</option><option value="birth">জন্ম নিবন্ধন নম্বর</option><option value="other">অন্যান্য</option></select></div>
                <div class="form-group"><label>আইডি নম্বর</label><input type="text" class="guardian_id_number" placeholder="নম্বর লিখুন" oninput="handleIdInput(this)"></div>
                <div class="form-group"><label>জন্ম তারিখ</label><input type="date" class="guardian_dob"></div>
                <div class="form-group"><label>ঘ) সম্পর্ক</label><input type="text" class="guardian_relationship" placeholder="অভিভাবক, চাচা, খালা ইত্যাদি"></div>
            </div>
        </div>`;
    }

    function addGuardian() {
        const container = document.getElementById('guardian_container');
        const div = document.createElement('div');
        div.innerHTML = createGuardianHTML(container.children.length);
        container.appendChild(div.firstElementChild);
    }

    // Initialize with one person and one nominee
    window.addEventListener('load', () => {
        const pContainer = document.getElementById('person_container');
        if (pContainer && pContainer.children.length === 0) addPerson();
        const nContainer = document.getElementById('nominee_container');
        if (nContainer && nContainer.children.length === 0) addNominee();
        // Don't initialize guardian - only add when "Nominee is Minor" is clicked
    });

    // Helper to clone pages for dynamic entries
    function clonePage(templateId, newId) {
        const template = document.getElementById(templateId);
        if (!template) return null;
        const clone = template.cloneNode(true);
        clone.id = newId;
        clone.classList.add('generated-page');
        const wrapper = document.getElementById('sb-ac-form');
        if (wrapper) wrapper.appendChild(clone); else document.body.appendChild(clone);
        return clone;
    }

    // Helper to initialize person section events (DOB display, font)
    function initPersonSection(pDiv) {
        if (!pDiv) return;
        // Apply Solaiman Lipi font for inputs in this section
        pDiv.querySelectorAll('input, select').forEach(inp => {
            inp.style.fontFamily = "'SolaimanLipi', 'Noto Serif Bengali', serif";
        });
    }

    function applyData() {
        console.log("applyData() called");

        const krishiBox = document.getElementById('krishi_card_box');
        const mKrishi = document.getElementById('m_krishi_card');
        if (krishiBox && mKrishi) {
            krishiBox.style.display = mKrishi.checked ? 'block' : 'none';
        }

        let op = document.getElementById('modal_account_operation')?.value || '';
        if (op && op !== 'single') {
            const applicants = document.querySelectorAll('.applicant-entry, .person-entry');
            if (applicants.length < 2) {
                appToast('হিসাব পরিচালনা পদ্ধতি এককভাবে হলে কমপক্ষে ২ জন আবেদনকারীর তথ্য দিন।', true);
                return;
            }
        }

        // Account Number Logic 
        const accNoEl = document.getElementById('modal_account_no');
        if (!accNoEl) {
            console.warn("modal_account_no element not found. Skipping account number population.");
            // Do not return entirely, as other parts of the form might still be valid.
            // Instead, handle this specific part gracefully.
        }
        const accNum = accNoEl ? accNoEl.value.replace(/\D/g, '') : ''; // Strip hyphen, get raw digits
        console.log("Starting form population. Account number:", accNum);

        if (accNum) {
            const banglaAccNum = toBanglaDigits(accNum);
            console.log("Bangla account number:", banglaAccNum);

            // 1. Page 1 Boxes (14)  
            const p1AccInputs = document.querySelectorAll('#p1_acc_container .digit-input');
            console.log("Page 1 account inputs found:", p1AccInputs.length);
            distributeDigits(p1AccInputs, banglaAccNum);

            // 2. Banners (Page 3, 5, 6, 8) - First row  
            document.querySelectorAll('.bkb-banner-p3').forEach(banner => {
                const row = banner.querySelector('.banner-row-p3:first-child');
                if (row) {
                    const inputs = row.querySelectorAll('.box-input-p3');
                    distributeDigits(inputs, banglaAccNum);
                }
            });

            // 3. Page 5 Header (14 boxes)
            const p5HeaderInputs = document.querySelectorAll('#account_no_header_container .box-input-p3');
            console.log("Page 5 header inputs found:", p5HeaderInputs.length);
            distributeDigits(p5HeaderInputs, banglaAccNum);

            // 4. Short Account Number (5 digits: indices 8-12) for dotted lines
            const shortAccNum = banglaAccNum.substring(8, 13);
            setElementText('photo_acc_num_display', shortAccNum); // Page 3 
            setElementText('display_acc_no_nominee', shortAccNum);      // Page 4 (Nominee)
            setElementText('display_acc_no_bo', shortAccNum);      // Page 8 (Beneficial Owner)
            // setElementText('p4_header_acc_num', shortAccNum);     // Page 4 (Removed if not in Placeholders.md) 
        }

        // Unique ID Logic 
        const uniqueIdEl = document.getElementById('modal_unique_customer_id');
        if (!uniqueIdEl) {
            console.warn("modal_unique_customer_id element not found. Skipping unique customer ID population.");
        }
        const uniqueId = uniqueIdEl ? uniqueIdEl.value : '';
        if (uniqueId) {
            const banglaUniqueId = toBanglaDigits(uniqueId);

            // Page 1 (14 boxes)  
            const p1UniqueInputs = document.querySelectorAll('#p1_cid_container .digit-input');
            distributeDigits(p1UniqueInputs, banglaUniqueId);

            // Banners (Page 3, 5, 6, 8) - Second row
            document.querySelectorAll('.bkb-banner-p3').forEach(banner => {
                const row = banner.querySelector('.banner-row-p3:nth-child(2)');
                if (row) {
                    const inputs = row.querySelectorAll('.box-input-p3');
                    distributeDigits(inputs, banglaUniqueId);
                }
            });
        }

        // Date  
        const dateValEl = document.getElementById('modal_app_date');
        if (!dateValEl) {
            console.warn("modal_app_date element not found. Skipping date population.");
        }
        const dateVal = dateValEl ? dateValEl.value : ''; // YYYY-MM-DD
        if (dateVal) {
            const [y, m, d] = dateVal.split('-');
            setElementText('app_date', toBanglaDigits(`${d}/${m}/${y}`));
            // Populate digit boxes on page 3
            const p3DateBoxes = document.querySelectorAll('#page-3 .date-container .digit-box');
            if (p3DateBoxes.length === 8) {
                const digits = (d + m + y).split('');
                p3DateBoxes.forEach((box, i) => box.innerText = toBanglaDigits(digits[i] || ''));
            }
            // Populate digit boxes on page 8
            const p8DateBoxes = document.querySelectorAll('#page-8 .date-container .digit-box');
            if (p8DateBoxes.length === 8) {
                const digits = (d + m + y).split('');
                p8DateBoxes.forEach((box, i) => box.innerText = toBanglaDigits(digits[i] || ''));
            }

            // Also populate date on any cloned Page 8 (for multiple applicants)
            document.querySelectorAll('.generated-page .date-container .digit-box').forEach((box, i) => { // Added null check for box
                if (box) {
                    const digits = (d + m + y).split('');
                    // Since we iterate all boxes in all generated pages, we need modulo 8
                    box.innerText = toBanglaDigits(digits[i % 8] || '');
                }
            });
        }

        // Titles  
        const titleBn = document.getElementById('modal_account_title_bn')?.value || '';
        const titleEn = document.getElementById('modal_account_title_en')?.value || '';

        setElementText('account_title_bn', titleBn);
        setElementText('account_title_bn_bo', titleBn);
        const combinedTitle = (titleBn ? titleBn : '') + (titleBn && titleEn ? ' / ' : '') + (titleEn ? titleEn : '');
        // The original `account_title` is an input box, not contenteditable.
        setElementText('account_title', combinedTitle);
        setElementText('account_title_en', titleEn);
        setElementText('account_title_en_bo', titleEn);

        // Nature  
        const nature = document.getElementById('modal_account_nature')?.value || '';
        ['savings', 'current', 'snd', 'fc', 'rfcd', 'nfcd', 'others'].forEach(t => setCheck('account_nature_' + t, false));
        setElementText('account_nature_others_input', '');
        if (nature) {
            setCheck('account_nature_' + nature, true);
            if (nature === 'others') {
                const natureOthersInputEl = document.getElementById('modal_account_nature_others_input');
                if (natureOthersInputEl) setElementText('account_nature_others_input', natureOthersInputEl.value);
            }
        }

        // Currency  
        const curr = document.getElementById('modal_account_currency')?.value || '';
        ['taka', 'dollar', 'euro', 'pound', 'others'].forEach(t => setCheck('account_currency_' + t, false));
        setElementText('account_currency_others_input', '');
        if (curr) {
            setCheck('account_currency_' + curr, true);
            if (curr === 'others') {
                const currOthersInputEl = document.getElementById('modal_account_currency_others_input');
                if (currOthersInputEl) setElementText('account_currency_others_input', currOthersInputEl.value);
            }
        }

        // Operation  
        op = document.getElementById('modal_account_operation')?.value || '';
        ['single', 'joint', 'anyone', 'anyone_or_survivor'].forEach(t => setCheck('account_operation_' + t, false));
        setElementText('account_operation_others_input', '');
        if (op) {
            // The ID for "anyone_or_survivor" is actually "account_operation_anyone_or_survivor"
            // The modal value is "survivor", so we need to map it.
            const actualOpId = op === 'survivor' ? 'anyone_or_survivor' : op;
            setCheck('account_operation_' + actualOpId, true);
            if (op === 'survivor') { // survivor maps to "Any one or survivor / Others"
                const opOthersInputEl = document.getElementById('modal_operation_others');
                if (opOthersInputEl) setElementText('account_operation_others_input', opOthersInputEl.value);
            }
        }

        // Initial Deposit 
        const initAmt = document.getElementById('modal_initial_deposit_amount')?.value || '';
        if (initAmt) {
            setElementText('initial_deposit_amount', toBanglaDigits(initAmt) + '/-');
        }
        setElementText('initial_deposit_amount_words', document.getElementById('modal_initial_deposit_amount_words')?.value || '');

        // Remove previously generated pages
        document.querySelectorAll('.generated-page').forEach(el => el.remove());

        // --- Person Info Population ---
        const persons = document.querySelectorAll('.person-entry');
        persons.forEach((p, index) => {
            let targetContext = document; // Default context 
            let prefix = '';

            const getVal = (cls) => p.querySelector('.' + cls).value;

            if (index === 0) {
                prefix = 'applicant';
            } else {
                // Generate new page for Person 2+ (Clone Page 8) 
                // We clone Page 8 for every applicant after the first one  
                // because Page 8 is the "Beneficial Owner" form for each individual. 
                const newPageId = `generated_person_${index}`;
                const newPage = clonePage('page-8', newPageId);
                targetContext = newPage;
                prefix = 'beneficial_owner'; // Use semantic prefix for BO page (Page 8)
            }

            // Helper to set text within context
            const setText = (idSuffix, val) => {
                // Look for standardized ID in the specific context
                // For Primary Applicant, IDs are like 'applicant_name_bn'
                // For Beneficial Owner (Joint), IDs are like 'beneficial_owner_name_bn'
                const el = targetContext.querySelector ? targetContext.querySelector(`#${prefix}_${idSuffix}`) : document.getElementById(`${prefix}_${idSuffix}`);
                if (el) {
                    if (el.tagName === 'INPUT') el.value = val;
                    else if (el.contentEditable === 'true') el.innerText = val; // Only set innerText if contenteditable
                }
            };

            // Helper for checkboxes in context
            const setChk = (idSuffix, state) => {
                const el = targetContext.querySelector ? targetContext.querySelector(`#${prefix}_${idSuffix}`) : document.getElementById(`${prefix}_${idSuffix}`);
                if (el) el.innerText = state ? '✓' : '';
            };

            setText('name_bn', getVal('modal_name_bn'));
            setText('name_en', getVal('modal_name_en'));

            const dobVal = getVal('modal_dob');
            if (dobVal) {
                const [y, m, d] = dobVal.split('-');
                setText('dob', toBanglaDigits(`${d}/${m}/${y}`)); // Changed to 'dob' as per Placeholders.md
            }

            let natVal = getVal('modal_nationality');
            if (natVal === 'other') {
                const otherNat = p.querySelector('.modal_nationality_other')?.value || '';
                setText('nationality', otherNat);
            } else {
                setText('nationality', natVal);
            }
            setText('father_name_bn', getVal('modal_father')); // Changed to 'father_name_bn'
            setText('mother_name_bn', getVal('modal_mother')); // Changed to 'mother_name_bn'
            setText('spouse_name_bn', getVal('modal_spouse')); // Changed to 'spouse_name_bn'
            setText('profession', getVal('modal_profession'));
            setText('monthly_income', toBanglaDigits(getVal('modal_income')));
            setText('fund_source', getVal('modal_source'));
            setText('tin', toBanglaDigits(getVal('modal_tin')));


            // ID (Page 4 for P1, Page 8 for P2)
            const idType = getVal('modal_id_type');
            const idNumber = getVal('modal_id_number');
            if (index === 0) {
                // Page 4 - only NID field exists
                if (idType === 'nid') {
                    setElementText('applicant_nid', toBanglaDigits(idNumber));
                } else { // For non-NID types on page 4, use the other_id field
                    // For non-NID types on page 4, use the other_id field
                    const p4OtherId = document.getElementById('applicant_other_id');
                    if (p4OtherId) p4OtherId.innerText = idNumber;
                }
            } else {
                // For P2+, ID fields are on the cloned page 8 (or original Page 8 for P1 explicit block)
                if (idType === 'nid') {
                    setText('nid', toBanglaDigits(idNumber)); // Use 'nid' as idSuffix
                    setText('beneficial_owner_other_id', '');
                } else {
                    setText('beneficial_owner_nid', '');
                    setText('beneficial_owner_other_id', idNumber);
                }
            }

            // Gender 
            const gender = p.querySelector('.modal_gender').value;
            ['male', 'female', 'third'].forEach(t => setChk(`${prefix}_gender_${t}`, false)); // Use setChk for consistency
            if (gender) setChk(`${prefix}_gender_${gender}`, true); // Use setChk for consistency

            // Resident
            const res = p.querySelector('.modal_resident')?.value || '';
            if (index === 0) { // Page 8 doesn't have resident checkboxes in this snippet, only Page 3 
                ['resident', 'nonresident'].forEach(t => setCheck(`applicant_resident_status_${t}`, false));
                if (res) setCheck(`applicant_resident_status_${res === 'nonres' ? 'nonresident' : 'resident'}`, true); // Corrected ID
            }

            // Address
            setText('curr_addr_village', toBanglaDigits(getVal('modal_curr_road')));
            setText('curr_addr_district', toBanglaDigits(getVal('modal_curr_dist')));
            setText('curr_addr_post', toBanglaDigits(getVal('modal_curr_post')));
            setText('curr_addr_thana', toBanglaDigits(getVal('modal_curr_thana')));
            setText('mobile', toBanglaDigits(getVal('modal_curr_phone')));
            setText('email', getVal('modal_curr_email'));

            setText('perm_addr_village', toBanglaDigits(getVal('modal_perm_road')));
            setText('perm_addr_district', toBanglaDigits(getVal('modal_perm_dist')));
            setText('perm_addr_post', toBanglaDigits(getVal('modal_perm_post')));
            setText('perm_thana', toBanglaDigits(getVal('modal_perm_thana')));
            setText('perm_phone', toBanglaDigits(getVal('modal_curr_phone'))); // Fallback to current phone
            setText('perm_email', getVal('modal_curr_email')); // Fallback to current email

            // Populate Account Title on Cloned Pages (for Person 2+) 
            if (index > 0) {
                const accTitleBn = document.getElementById('modal_account_title_bn').value;
                const accTitleEn = document.getElementById('modal_account_title_en').value;
                const titleBnEl = targetContext.querySelector('#account_title_bn_bo');
                if (titleBnEl) titleBnEl.innerText = accTitleBn;
                const titleEnEl = targetContext.querySelector('#account_title_en_bo');
                if (titleEnEl) titleEnEl.innerText = accTitleEn;
            }

            // Handle Photo Rendering
            const photoVal = getVal('modal_photo_data');
            const imgId = `${prefix}_photo`;
            const textId = `${prefix}_photo_text`;

            // Scoped selection to handle cloned pages correctly
            const imgEl = targetContext.querySelector ? targetContext.querySelector(`#${imgId}`) : document.getElementById(imgId);
            const textEl = targetContext.querySelector ? targetContext.querySelector(`#${textId}`) : document.getElementById(textId);

            if (imgEl && photoVal) {
                imgEl.src = photoVal;
                imgEl.style.display = 'block';
                if (textEl) textEl.style.display = 'none';
            } else if (imgEl) {
                imgEl.src = '';
                imgEl.style.display = 'none';
                if (textEl) textEl.style.display = 'block';
            }
        });

        // Modern Banking
        ['online', 'atm', 'sms', 'others'].forEach(t => {
            const el = document.getElementById('modal_banking_service_' + t);
            if (el) setCheck('banking_service_' + t, el.checked);
        });

        // Populate Gender and Resident Status for first person on page 3 (if available)
        if (document.querySelector('.person-entry')) {
            const firstPerson = document.querySelector('.person-entry');
            const gender = firstPerson.querySelector('.modal_gender').value;
            ['male', 'female', 'third'].forEach(t => setCheck('applicant_gender_' + t, false));
            if (gender) setCheck('applicant_gender_' + gender, true);

            const res = firstPerson.querySelector('.modal_resident').value;
            ['resident', 'nonresident'].forEach(t => setCheck('applicant_resident_status_' + t, false));
            if (res) {
                const targetResId = res === 'nonres' ? 'applicant_resident_status_nonresident' : 'applicant_resident_status_resident';
                setCheck(targetResId, true);
            }
        }

        // Introducer 
        setElementText('introducer_name', document.getElementById('modal_introducer_name')?.value || '');
        setElementText('introducer_other_info', toBanglaDigits(document.getElementById('modal_introducer_other_id')?.value || ''));

        const introAcc = document.getElementById('modal_introducer_acc_details')?.value || '';
        const introNid = document.getElementById('modal_intro_nid')?.value || '';
        const introDob = document.getElementById('modal_intro_dob')?.value || '';
        let introStr = [];
        if (introAcc) introStr.push(introAcc);
        if (introNid) introStr.push(introNid);
        if (introDob) {
            const [y, m, d] = introDob.split('-');
            introStr.push(`${d}/${m}/${y}`);
        }
        setElementText('introducer_acc_details', toBanglaDigits(introStr.join(', ')));

        // --- Transaction Profile Population ---
        const depTbody = document.getElementById('p5_dep_tbody');
        const withTbody = document.getElementById('p5_with_tbody');

        // Clear existing
        [depTbody, withTbody].forEach(tb => {
            if (!tb) return;
            for (let i = 0; i < 6; i++) {
                if (tb.children[i]) {
                    tb.children[i].children[1].innerText = '';
                    tb.children[i].children[2].innerText = '';
                    tb.children[i].children[3].innerText = '';
                    if (i === 5) {
                        const descDiv = tb.children[i].children[0].querySelector('.dotted-line');
                        if (descDiv) descDiv.innerText = '';
                    }
                }
            }
            if (tb.children[6]) { // Total row
                tb.children[6].children[1].innerText = '';
                tb.children[6].children[2].innerText = '';
                tb.children[6].children[3].innerText = '';
            }
        });

        let depTotal = 0;
        let withTotal = 0;

        // Accumulate data by category index
        const depData = Array(6).fill().map(() => ({ no: 0, max: 0, total: 0, desc: [] }));
        const withData = Array(6).fill().map(() => ({ no: 0, max: 0, total: 0, desc: [] }));

        transactions.forEach(t => {
            const tbody = t.type === 'deposit' ? depTbody : withTbody;
            if (!tbody) return;

            let rowIndex = -1;
            switch (t.cat) {
                case 'cash': rowIndex = 0; break;
                case 'transfer': rowIndex = 1; break;
                case 'remittance': rowIndex = 2; break;
                case 'export_import': rowIndex = 3; break;
                case 'bo': rowIndex = 4; break;
                case 'others': rowIndex = 5; break;
            }

            if (rowIndex !== -1) {
                const dataArr = t.type === 'deposit' ? depData : withData;
                const noVal = parseFloat(t.no) || 0;
                const maxVal = parseFloat(t.max) || 0;
                const totalVal = parseFloat(t.total) || 0;

                dataArr[rowIndex].no += noVal;
                dataArr[rowIndex].max = Math.max(dataArr[rowIndex].max, maxVal);
                dataArr[rowIndex].total += totalVal;
                if (t.cat === 'others' && t.otherDesc) {
                    dataArr[rowIndex].desc.push(t.otherDesc);
                }
            }
        });

        // Render accumulated data to form
        [depData, withData].forEach((dataArr, typeIdx) => {
            const tbody = typeIdx === 0 ? depTbody : withTbody;
            if (!tbody) return;

            dataArr.forEach((d, i) => {
                if (d.no === 0 && d.total === 0) return; // Skip empty

                const row = tbody.children[i];
                if (!row) return;

                row.children[1].innerText = toBanglaDigits(d.no);
                row.children[2].innerText = toBanglaDigits(d.max);
                row.children[3].innerText = toBanglaDigits(d.total);

                if (i === 5 && d.desc.length > 0) {
                    const descDiv = row.children[0].querySelector('.dotted-line');
                    if (descDiv) descDiv.innerText = d.desc.join(', ');
                }

                if (typeIdx === 0) depTotal += d.total;
                else withTotal += d.total;
            });
        });

        if (depTbody && depTbody.children[6]) depTbody.children[6].children[3].innerText = toBanglaDigits(depTotal);
        if (withTbody && withTbody.children[6]) withTbody.children[6].children[3].innerText = toBanglaDigits(withTotal);

        // --- Page 5 Signature Table Population --- 
        // Reuse persons array that was already declared earlier 

        // Populate applicant names to first 3 rows (or 1 per row if multiple applicants) 
        for (let i = 0; i < Math.min(persons.length, 5); i++) {
            const name = persons[i].querySelector('.modal_name_bn').value || '';
            const serialCell = document.getElementById(`applicant_signature_serial_${i + 1}`);
            const nameCell = document.getElementById(`applicant_signature_name_${i + 1}`);

            if (serialCell) serialCell.innerText = toBanglaDigits((i + 1).toString());
            if (nameCell) nameCell.innerText = name;
        }

        // Populate mobile number from first person 
        if (persons.length > 0) {
            const mobileNum = persons[0].querySelector('.modal_curr_phone').value || '';
            const mobileCell = document.getElementById('applicant_mobile_display');
            if (mobileCell) {
                mobileCell.innerText = 'মোাবাইল নম্বর- ' + toBanglaDigits(mobileNum);
            }
        }

        // Populate monthly income from modal
        const firstPersonEntry = document.querySelector('.person-entry');
        if (firstPersonEntry) {
            const monthlyIncomeValue = firstPersonEntry.querySelector('.modal_income').value || '';
            setElementText('kyc_monthly_income', toBanglaDigits(monthlyIncomeValue));
        }

        // Special Instructions & Account Name on Page 5
        setElementText('special_instruction_1', document.getElementById('modal_special_instruction_1_input').value);
        setElementText('special_instruction_2', document.getElementById('modal_special_instruction_2_input').value);
        setElementText('kyc_account_name', document.getElementById('modal_account_title_en').value);

        // --- KYC Profile Population (Global/P1) --- 
        // Assuming P1 is the first entry 
        const p1 = document.querySelector('.person-entry');
        if (p1) {
            setElementText('kyc_applicant_profession', p1.querySelector('.modal_profession')?.value || '');
            setElementText('kyc_monthly_income', toBanglaDigits(p1.querySelector('.modal_income')?.value || ''));
            setElementText('kyc_fund_source', p1.querySelector('.modal_source')?.value || '');
            const idNumber = p1.querySelector('.modal_id_number')?.value || ''; // This is for the main applicant's ID
            setElementText('kyc_id_nid_value', toBanglaDigits(idNumber)); // Assuming this is NID
            setElementText('kyc_id_tin_value', toBanglaDigits(p1.querySelector('.modal_tin')?.value || ''));
        }

        // Populate account name from English account title
        const accountTitleEnModal = document.getElementById('modal_account_title_en');
        setElementText('kyc_account_name', accountTitleEnModal ? accountTitleEnModal.value : '');

        // Populate account nature from dropdown
        const natureSelect = document.getElementById('modal_account_nature');
        setElementText('kyc_account_nature', natureSelect ? natureSelect.options[natureSelect.selectedIndex].text : '');

        // Populate KYC fields from modal
        setElementText('kyc_opening_purpose', document.getElementById('modal_kyc_purpose')?.value || '');
        setElementText('kyc_source_verification', document.getElementById('modal_kyc_source_docs')?.value || '');
        setElementText('kyc_address_verification', document.getElementById('modal_kyc_addr_verify')?.value || '');

        // Populate Beneficial Owner checkbox based on selection
        const benYes = document.getElementById('modal_kyc_ben_yes_radio')?.checked || false;
        const benNo = document.getElementById('modal_kyc_ben_no_radio')?.checked || false;

        // Clear both checkboxes first
        setCheck('kyc_beneficial_owner_yes', false);
        setCheck('kyc_beneficial_owner_no', false);

        // Set the appropriate checkbox based on selection 
        if (benYes) {
            setCheck('kyc_beneficial_owner_yes', true);
        } else if (benNo) {
            setCheck('kyc_beneficial_owner_no', true);
        }

        // Populate Non-Resident/Visa Information (Section 11 - पाता 6/12) 
        if (p1) {
            const residentStatus = p1.querySelector('.modal_resident')?.value || '';
            if (residentStatus === 'nonres') {
                // Get visa type and work permit info 
                const visaType = p1.querySelector('.modal_visa_type')?.value || '';
                const workPermit = p1.querySelector('.modal_work_permit')?.value || '';

                // Populate visa type and expiry date 
                setElementText('kyc_visa_type', visaType);

                // Populate work permit checkboxes 
                setCheck('kyc_work_permit_yes', false);
                setCheck('kyc_work_permit_no', false);
                if (workPermit === 'yes') {
                    setCheck('kyc_work_permit_yes', true);
                } else if (workPermit === 'no') {
                    setCheck('kyc_work_permit_no', true);
                }
            }
        }

        // Identity Documents - Hybrid approach: Use kycDocs array AND Applicant Info 
        setElementText('kyc_id_nid_value', ''); // Clear existing
        setElementText('kyc_id_passport_value', ''); // Clear existing
        setElementText('kyc_id_birth_reg_value', ''); // Clear existing
        setElementText('kyc_id_other_value', ''); // Clear existing

        // 2. Also check Applicant Info (Main Applicant) and populate if not already filled by kycDocs 
        const firstPerson = document.querySelector('.person-entry');
        if (firstPerson) {
            const idType = firstPerson.querySelector('.modal_id_type').value;
            const idNumber = firstPerson.querySelector('.modal_id_number').value;

            if (idNumber && idType) {
                const fieldId = `kyc_id_${idType}_value`;
                if (idType === 'nid' || idType === 'birth') {
                    setElementText(fieldId, toBanglaDigits(idNumber));
                } else {
                    setElementText(fieldId, idNumber);
                }

                // Automatically tick copy and verify 
                setCheck(`kyc_id_${idType}_copy_checked`, true);
                setCheck(`kyc_id_${idType}_verify_checked`, true);
            }
        }

        const pepSelect = document.getElementById('modal_kyc_pep'); // Corrected ID
        const pep = pepSelect ? pepSelect.value : '';
        ['yes', 'no'].forEach(t => setCheck(`kyc_pep_status_${t}`, false));
        if (pep) {
            setCheck(`kyc_pep_status_${pep}`, true); // This will set the correct checkbox based on 'yes' or 'no'
            if (pep === 'yes') {
                const pepApp = document.getElementById('modal_kyc_pep_approval')?.value || '';
                if (pepApp) setCheck(`kyc_pep_approval_${pepApp}`, true);
                const pepInt = document.getElementById('modal_kyc_pep_interview')?.value || '';
                if (pepInt) setCheck(`kyc_pep_interview_${pepInt}`, true);
            }
        }

        const sanctionSelect = document.getElementById('modal_kyc_sanction'); // Corrected ID
        const sanction = sanctionSelect ? sanctionSelect.value : '';
        ['yes', 'no'].forEach(t => setCheck(`kyc_sanction_list_${t}`, false));
        if (sanction) {
            setCheck(`kyc_sanction_list_${sanction}`, true); // This will set the correct checkbox based on 'yes' or 'no'
            if (sanction === 'yes') {
                setElementText('kyc_sanction_action_details', document.getElementById('modal_kyc_sanction_details')?.value || '');
            }
        }

        // --- Page 8 Population (Beneficial Owner/Account Holder - সংযুক্তি-১) ---
        // Get first person data from modal (applicant info)
        const firstApplicant = document.querySelector('.person-entry');
        if (firstApplicant) {
            const mapping = {
                'applicant_name_bn': 'modal_name_bn',
                'applicant_name_en': 'modal_name_en',
                'applicant_dob': 'modal_dob',
                'applicant_father_name_bn': 'modal_father',
                'applicant_mother_name_bn': 'modal_mother',
                'applicant_spouse_name_bn': 'modal_spouse',
                'applicant_nationality': 'modal_nationality',
                'applicant_nid': 'modal_id_number',
                'applicant_nid_10': 'modal_id_number',
                'applicant_mobile': 'modal_curr_phone',
                'applicant_email': 'modal_curr_email',
                'applicant_curr_addr_village': 'modal_curr_road',
                'applicant_curr_addr_district': 'modal_curr_dist',
                'applicant_present_district': 'modal_curr_dist',
                'applicant_curr_addr_post': 'modal_curr_post',
                'applicant_curr_addr_thana': 'modal_curr_thana',
                'applicant_present_upozila': 'modal_curr_thana',
                'applicant_perm_addr_village': 'modal_perm_road',
                'applicant_perm_addr_district': 'modal_perm_dist',
                'applicant_permanent_district': 'modal_perm_dist',
                'applicant_perm_district': 'modal_perm_dist',
                'applicant_perm_addr_post': 'modal_perm_post',
                'applicant_perm_addr_thana': 'modal_perm_thana',
                'applicant_permanent_upozila': 'modal_perm_thana',
                'applicant_perm_upozila': 'modal_perm_thana',
                'applicant_perm_phone': 'modal_perm_phone',
                'applicant_perm_email': 'modal_perm_email',
                'applicant_profession': 'modal_profession',
                'applicant_monthly_income': 'modal_income',
                'monthly_income': 'modal_income',
                'applicant_fund_source': 'modal_source',
                'applicant_tin': 'modal_tin',
                'applicant_gender': 'modal_gender',
                'applicant_resident_status': 'modal_resident',
                'photo': 'modal_photo_data'
            };

            // Basic personal information 
            if (benYes) {
                setElementText('beneficial_owner_name_bn', firstApplicant.querySelector('.modal_name_bn').value);
                setElementText('beneficial_owner_name_en', firstApplicant.querySelector('.modal_name_en').value);

                // Family information 
                setElementText('beneficial_owner_father_name_bn', firstApplicant.querySelector('.modal_father').value);
                setElementText('beneficial_owner_mother_name_bn', firstApplicant.querySelector('.modal_mother').value);
                setElementText('beneficial_owner_spouse_name_bn', firstApplicant.querySelector('.modal_spouse').value);

                // Nationality 
                const nationalitySelect = firstApplicant.querySelector('.modal_nationality');
                const nationalityValue = nationalitySelect.value;
                if (nationalityValue === 'other') {
                    setElementText('beneficial_owner_nationality', firstApplicant.querySelector('.modal_nationality_other').value);
                } else {
                    setElementText('beneficial_owner_nationality', nationalityValue);
                }

                // Date of Birth 
                const dobValue = firstApplicant.querySelector('.modal_dob').value;
                if (dobValue) {
                    const [y, m, d] = dobValue.split('-');
                    setElementText('beneficial_owner_dob', toBanglaDigits(`${d}/${m}/${y}`));
                }

                // Gender 
                const genderSelect = firstApplicant.querySelector('.modal_gender');
                const genderValue = genderSelect.value;
                ['male', 'female', 'third'].forEach(gender => setCheck(`beneficial_owner_gender_${gender}`, false));
                if (genderValue) setCheck(`beneficial_owner_gender_${genderValue}`, true);

                // Professional information 
                setElementText('beneficial_owner_profession', firstApplicant.querySelector('.modal_profession')?.value || '');
                setElementText('beneficial_owner_monthly_income', toBanglaDigits(firstApplicant.querySelector('.modal_income')?.value || ''));
                setElementText('beneficial_owner_fund_source', firstApplicant.querySelector('.modal_source')?.value || '');
                setElementText('beneficial_owner_tin', toBanglaDigits(firstApplicant.querySelector('.modal_tin')?.value || ''));

                // Address information 
                setElementText('beneficial_owner_curr_addr_village', firstApplicant.querySelector('.modal_curr_road').value);
                setElementText('beneficial_owner_curr_addr_post', firstApplicant.querySelector('.modal_curr_post').value);
                setElementText('beneficial_owner_curr_addr_thana', firstApplicant.querySelector('.modal_curr_thana').value);
                setElementText('beneficial_owner_curr_addr_district', firstApplicant.querySelector('.modal_curr_dist').value);
                setElementText('beneficial_owner_mobile', toBanglaDigits(firstApplicant.querySelector('.modal_curr_phone').value));
                setElementText('beneficial_owner_email', firstApplicant.querySelector('.modal_curr_email').value);
                // Permanent address 
                setElementText('beneficial_owner_perm_addr_village', firstApplicant.querySelector('.modal_perm_road').value);
                setElementText('beneficial_owner_perm_addr_post', firstApplicant.querySelector('.modal_perm_post').value);
                setElementText('beneficial_owner_perm_addr_thana', firstApplicant.querySelector('.modal_perm_thana').value);
                setElementText('beneficial_owner_perm_addr_district', firstApplicant.querySelector('.modal_perm_dist').value);
                setElementText('beneficial_owner_perm_phone', toBanglaDigits(firstApplicant.querySelector('.modal_perm_phone').value));
                setElementText('beneficial_owner_perm_email', firstApplicant.querySelector('.modal_perm_email').value);

                // Identity documents 
                const idTypeSelect = firstApplicant.querySelector('.modal_id_type');
                const idNumber = firstApplicant.querySelector('.modal_id_number')?.value || '';
                const idType = idTypeSelect ? idTypeSelect.value : '';

                if (idNumber) {
                    if (idType === 'nid') {
                        setElementText('beneficial_owner_nid', toBanglaDigits(idNumber));
                        setElementText('beneficial_owner_other_id', '');
                    } else {
                        setElementText('beneficial_owner_nid', '');
                        setElementText('beneficial_owner_other_id', idNumber);
                    }
                }
            } else {
                // Clear all fields
                setElementText('beneficial_owner_name_bn', '');
                setElementText('beneficial_owner_name_en', '');
                setElementText('beneficial_owner_father_name_bn', '');
                setElementText('beneficial_owner_mother_name_bn', '');
                setElementText('beneficial_owner_spouse_name_bn', '');
                setElementText('beneficial_owner_nationality', '');
                setElementText('beneficial_owner_dob', '');
                ['male', 'female', 'third'].forEach(gender => setCheck(`beneficial_owner_gender_${gender}`, false));
                setElementText('beneficial_owner_profession', '');
                setElementText('beneficial_owner_monthly_income', '');
                setElementText('beneficial_owner_fund_source', '');
                setElementText('beneficial_owner_tin', '');
                setElementText('beneficial_owner_curr_addr_village', '');
                setElementText('beneficial_owner_curr_addr_post', '');
                setElementText('beneficial_owner_curr_addr_thana', '');
                setElementText('beneficial_owner_curr_addr_district', '');
                setElementText('beneficial_owner_mobile', '');
                setElementText('beneficial_owner_email', '');
                setElementText('beneficial_owner_perm_addr_village', '');
                setElementText('beneficial_owner_perm_addr_post', '');
                setElementText('beneficial_owner_perm_addr_thana', '');
                setElementText('beneficial_owner_perm_addr_district', '');
                setElementText('beneficial_owner_perm_phone', '');
                setElementText('beneficial_owner_perm_email', '');
                setElementText('beneficial_owner_nid', '');
                setElementText('beneficial_owner_other_id', '');
            }
        }

        // --- Risk Assessment Population (Page 9) --- 
        const riskMap = {
            prod: { id: 'modal_risk_prod', scoreId: 'modal_risk_prod_score', tbody: 'risk_p9_t1_tbody', type: 'row_idx' },
            onboard: { id: 'modal_risk_onboard', scoreId: 'modal_risk_onboard_score', tbody: 'risk_p9_t1_tbody', type: 'row_idx' },
            geo: { id: 'modal_risk_geo', scoreId: 'modal_risk_geo_score', tbody: 'risk_p9_t2_tbody', type: 'geo' },
            rel: { id: 'modal_risk_rel', scoreId: 'modal_risk_rel_score', tbody: 'risk_p9_t4_tbody', type: 'rel' },
            txn: { id: 'modal_risk_txn', scoreId: 'modal_risk_txn_score', tbody: 'risk_p9_t5_tbody', type: 'row_idx' },
            trans: { id: 'modal_risk_trans', scoreId: 'modal_risk_trans_score', tbody: 'risk_p9_t6_tbody', type: 'trans' },
            cust_biz: { id: 'modal_risk_cust_biz', scoreId: 'modal_risk_cust_biz_score', tbody: 'risk_p9_t3_tbody', row: 0 },
            cust_prof: { id: 'modal_risk_cust_prof', scoreId: 'modal_risk_cust_prof_score', tbody: 'risk_p9_t3_tbody', row: 1 }
        };

        // Clear previous scores and styles in risk tables
        ['risk_p9_t1_tbody', 'risk_p9_t2_tbody', 'risk_p9_t3_tbody', 'risk_p9_t4_tbody', 'risk_p9_t5_tbody', 'risk_p9_t6_tbody'].forEach(tid => {
            const tbody = document.getElementById(tid);
            if (tbody) {
                Array.from(tbody.rows).forEach((row, rIndex) => {
                    // Reset styles
                    row.style.fontWeight = '';
                    row.style.backgroundColor = '';

                    // Remove ticks from all cells
                    Array.from(row.cells).forEach(cell => {
                        if (cell.innerText.includes(' (✓)')) {
                            cell.innerText = cell.innerText.replace(' (✓)', '');
                        }
                    });

                    // Specific reset for Table 3 (Business/Profession)
                    if (tid === 'risk_p9_t3_tbody') {
                        if (rIndex === 0 && row.cells.length > 2) {
                            row.cells[1].innerText = 'ব্যবসা সংযুক্ত তালিকা-১ হতে সন্নিবেশ করুন';
                            row.cells[2].innerText = '';
                        } else if (rIndex === 1 && row.cells.length > 2) {
                            row.cells[1].innerText = 'কার্যকলাপ সংক্রান্ত সংযুক্ত তালিকা -১ হতে সন্নিবেশ করুন';
                            row.cells[2].innerText = '';
                        }
                    }
                });
            }
        });

        // Populate Table 3 (Business/Profession)
        const bizSelect = document.getElementById('modal_risk_cust_biz');
        const bizScore = document.getElementById('modal_risk_cust_biz_score').value;
        if (bizSelect.value) {
            const tbody = document.getElementById('risk_p9_t3_tbody');
            if (tbody && tbody.rows[0]) {
                tbody.rows[0].cells[1].innerText = bizSelect.options[bizSelect.selectedIndex].text + ' (✓)';
                tbody.rows[0].cells[2].innerText = toBanglaDigits(bizScore);
                tbody.rows[0].style.fontWeight = 'bold';
                tbody.rows[0].style.backgroundColor = '#e6f7e6';
            }
        }
        const profSelect = document.getElementById('modal_risk_cust_prof');
        const profScore = document.getElementById('modal_risk_cust_prof_score').value;
        if (profSelect.value) {
            const tbody = document.getElementById('risk_p9_t3_tbody');
            if (tbody && tbody.rows[1]) {
                tbody.rows[1].cells[1].innerText = profSelect.options[profSelect.selectedIndex].text.split('(')[0] + ' (✓)';
                tbody.rows[1].cells[1].innerText = profSelect.options[profSelect.selectedIndex].text + ' (✓)';
                tbody.rows[1].cells[2].innerText = toBanglaDigits(profScore);
                tbody.rows[1].style.fontWeight = 'bold';
                tbody.rows[1].style.backgroundColor = '#e6f7e6';
            }
        }

        // For other tables, we might just want to ensure the logic is consistent, but since they are pre-filled with scores, 
        // and this is a printable form, maybe we don't need to change anything visually other than maybe bolding the selected row?
        // I will implement bolding the selected row for clarity.
        // Also adding tick mark (✓) to the selected option text as requested.

        const markSelectedRow = (tbodyId, rowIndex, cellIndexForTick) => {
            const tbody = document.getElementById(tbodyId);
            if (tbody && tbody.rows[rowIndex]) {
                const row = tbody.rows[rowIndex];
                row.style.fontWeight = 'bold';
                row.style.backgroundColor = '#e6f7e6';

                if (cellIndexForTick !== undefined && row.cells[cellIndexForTick]) {
                    if (!row.cells[cellIndexForTick].innerText.includes('(✓)')) {
                        row.cells[cellIndexForTick].innerText += ' (✓)';
                    }
                }
            }
        };

        // Populate from addedRisks array
        addedRisks.forEach(risk => {
            const val = risk.value;
            const score = risk.score;
            const text = risk.selected;

            if (risk.id === 'modal_risk_prod') {
                markSelectedRow('risk_p9_t1_tbody', parseInt(val) - 1, 1);
            } else if (risk.id === 'modal_risk_onboard') {
                markSelectedRow('risk_p9_t1_tbody', parseInt(val), 1);
            } else if (risk.id === 'modal_risk_geo') {
                if (val.includes('_')) {
                    markSelectedRow('risk_p9_t2_tbody', val === '4_yes' ? 4 : 5, 0);
                } else {
                    markSelectedRow('risk_p9_t2_tbody', parseInt(val) - 1, 1);
                }
            } else if (risk.id === 'modal_risk_cust_biz') {
                const tbody = document.getElementById('risk_p9_t3_tbody');
                if (tbody && tbody.rows[0]) {
                    tbody.rows[0].cells[1].innerText = text + ' (✓)';
                    tbody.rows[0].cells[2].innerText = toBanglaDigits(score);
                    tbody.rows[0].style.fontWeight = 'bold';
                    tbody.rows[0].style.backgroundColor = '#e6f7e6';
                }
            } else if (risk.id === 'modal_risk_cust_prof') {
                const tbody = document.getElementById('risk_p9_t3_tbody');
                if (tbody && tbody.rows[1]) {
                    tbody.rows[1].cells[1].innerText = text + ' (✓)';
                    tbody.rows[1].cells[2].innerText = toBanglaDigits(score);
                    tbody.rows[1].style.fontWeight = 'bold';
                    tbody.rows[1].style.backgroundColor = '#e6f7e6';
                }
            } else if (risk.id === 'modal_risk_rel') {
                markSelectedRow('risk_p9_t4_tbody', val === 'pep_yes' ? 1 : 2, 0);
            } else if (risk.id === 'modal_risk_txn') {
                markSelectedRow('risk_p9_t5_tbody', parseInt(val), 1);
            } else if (risk.id === 'modal_risk_trans') {
                markSelectedRow('risk_p9_t6_tbody', val === 'yes' ? 1 : 2, 0);
            }
        });

        populatePage7RiskAssessment();

        // --- Nominee Population ---
        // validateNominees() is now non-blocking

        const nominees = document.querySelectorAll('.nominee-entry');
        nominees.forEach((n, index) => {
            let targetContext = document;
            let prefix = 'p4';

            if (index > 0) {
                // Generate new page for Nominee 2+
                const newPageId = `generated_nominee_${index}`;
                const newPage = clonePage('page-4', newPageId);
                newPage.style.paddingTop = '1in';

                // Remove content before "Third Part" (Nominee Section) from generated page
                const contentArea = newPage.querySelector('.content-area');
                if (contentArea) {
                    const children = Array.from(contentArea.children);
                    let remove = true;
                    for (const child of children) {
                        if (child.classList.contains('section-title-solid') && child.innerText.includes('তৃতীয় অংশ')) {
                            remove = false;
                            child.style.marginTop = '0'; // Reset margin for the new top element
                        }
                        if (remove) {
                            child.remove();
                        }
                    }
                }

                // Add Attachment Label (Songlogni)
                const attNum = toBanglaDigits(index.toString().padStart(2, '0'));
                const attLabel = document.createElement('div');
                attLabel.innerText = `সংলগ্নী-${attNum}`;
                attLabel.style.position = 'absolute';
                attLabel.style.right = '0.4in';
                attLabel.style.top = '0.4in';
                attLabel.style.fontWeight = 'bold';
                attLabel.style.fontSize = '11pt';
                newPage.appendChild(attLabel);

                targetContext = newPage;
            }

            const getVal = (cls) => n.querySelector('.' + cls).value;

            const setText = (idSuffix, val) => {
                if (index === 0) {
                    setElementText(`nominee_1_${idSuffix}`, val);
                } else {
                    const el = targetContext.querySelector(`#${prefix}_${idSuffix}`);
                    if (el) {
                        if (el.tagName === 'INPUT') el.value = val;
                        else el.innerText = val;
                    }
                }
            };

            setText('name', getVal('modal_nom_name'));
            const nomDob = getVal('modal_nom_dob');
            if (nomDob) {
                const [y, m, d] = nomDob.split('-');
                setText('dob', toBanglaDigits(`${d}/${m}/${y}`));
            }
            setText('addr', getVal('modal_nom_addr'));
            setText('rel', getVal('modal_nom_rel'));
            setText('pct', toBanglaDigits(getVal('modal_nom_pct')));
            setText('id', toBanglaDigits(getVal('modal_nom_id')));
        });

        // Guardian/Legal Representative Information (if nominee is minor) - populate first guardian on page 4
        const guardianSection = document.getElementById('guardian-section');
        if (guardianSection && guardianSection.style.display !== 'none') {
            const guardianContainer = document.getElementById('guardian_container');
            const firstGuardian = guardianContainer.querySelector('.guardian-entry');

            if (firstGuardian) {
                const guardianName = firstGuardian.querySelector('.guardian_name').value;
                const guardianAddr = firstGuardian.querySelector('.guardian_address').value;
                const guardianIdType = firstGuardian.querySelector('.guardian_id_type').value;
                const guardianIdNum = firstGuardian.querySelector('.guardian_id_number').value;
                const guardianRel = firstGuardian.querySelector('.guardian_relationship').value;

                // Populate page 4 guardian fields
                setElementText('nominee_1_guardian_name', guardianName);
                setElementText('nominee_1_guardian_addr', guardianAddr);

                // For the ID field - include both type and number 
                let idDisplay = '';
                if (guardianIdType && guardianIdNum) {
                    const idTypeLabel = {
                        'nid': 'এনআইডি',
                        'passport': 'পাসপোর্ট',
                        'birth': 'জন্ম নিবন্ধন',
                        'other': 'অন্যান্য'
                    }[guardianIdType] || guardianIdType;
                    idDisplay = `${idTypeLabel}: ${guardianIdNum}`;
                }
                setElementText('nominee_1_guardian_id', idDisplay);
                setElementText('nominee_1_guardian_rel', guardianRel);
            }
        }

        // Transaction Profile

        console.log("Form population completed successfully!");
        // Re-run central injection to populate any newly cloned pages for joint applicants
        if (window.parent && typeof window.parent.injectCentralData === 'function') {
            window.parent.injectCentralData();
        }
        closeModal();
    }

    // --- Persistence & Button Logic ---

    function loadFormData() {
        const saved = window.AppStorage.getItem('sb_ac_main_form');
        if (!saved) return;
        const data = JSON.parse(saved);

        if (data.inputs) {
            document.querySelectorAll('input.box-input-p3, input.digit-input').forEach((el, i) => {
                if (data.inputs[i] !== undefined) el.value = data.inputs[i];
            });
        }
        if (data.contentEditable) {
            document.querySelectorAll('[contenteditable="true"]').forEach((el, i) => {
                if (data.contentEditable[i] !== undefined) el.innerText = data.contentEditable[i];
            });
        }
        if (data.checkboxes) {
            document.querySelectorAll('.tick-box').forEach((el, i) => {
                if (data.checkboxes[i] !== undefined) el.innerText = data.checkboxes[i];
            });
        }
    }

    function startNewForm() {
        appConfirm('সমস্ত ডেটা মুছে নতুন শুরু করবেন?<br><small>(Are you sure you want to clear all data and start new?)</small>', function () {

            // 1. Clear LocalStorage
            window.AppStorage.removeItem('sb_ac_main_form');
            window.AppStorage.removeItem('sb_ac_modal_data');
            window.AppStorage.removeItem('cd_ac_main_form');
            window.AppStorage.removeItem('bkb_dps_mss_modal_cache');
            localStorage.removeItem('fdr_live_preview_data');
            sessionStorage.removeItem('fdr_auto_preview');

            // 2. Clear Main Form Fields (Preserve central organizational inputs)
            const persistentFields = ['branch_name', 'p3_manager_branch', 'p3_manager_address', 'display_branch_name'];
            const persistentClasses = ['branch-name-input', 'branch-location-input', 'branch-code-input'];
            document.querySelectorAll('input.box-input-p3, input.digit-input, input.input-box, [contenteditable="true"]').forEach(el => {
                if (persistentFields.includes(el.id)) return;
                if (el.readOnly) return; // Skip locked branch code digits
                if (Array.from(el.classList).some(cls => persistentClasses.includes(cls))) return;

                // Skip tables on Page 9 and 10 to preserve static scoring options
                if (el.closest('#page-9 table') || el.closest('#page-10 table')) return;
                // Skip specific manager branch headers
                if (el.id === 'p3_manager_branch' || el.id === 'p3_manager_address') return;

                if (el.tagName === 'INPUT') el.value = '';
                else el.innerText = '';
            });
            document.querySelectorAll('.tick-box').forEach(el => el.innerText = '');
            document.querySelectorAll('.sig-box img').forEach(el => el.src = '');

            // NOTE: Do NOT clear Branch Info here — branch info persists and
            // is only updated via the Branch Info modal. (Per user request.)

            // 3. Clear Modal Data
            document.querySelectorAll('#dataEntryModal input, #dataEntryModal select, #dataEntryModal textarea').forEach(el => {
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                else el.value = '';
            });
            document.querySelectorAll('#dataEntryModal select').forEach(el => el.selectedIndex = 0);

            // Reset Dynamic Sections in Modal
            const pContainer = document.getElementById('person_container');
            if (pContainer) { pContainer.innerHTML = ''; }

            const nContainer = document.getElementById('nominee_container');
            if (nContainer) { nContainer.innerHTML = ''; }

            const gContainer = document.getElementById('guardian_container');
            if (gContainer) gContainer.innerHTML = '';

            addPerson();
            addNominee();

            document.getElementById('nominee_section').style.display = 'none';
            document.getElementById('guardian-section').style.display = 'none';

            // Reset Global Arrays & Tables
            transactions = []; renderTransactionTable();
            kycDocs = []; renderKycDocTable();
            addedRisks = []; renderRiskSummaryTable();

            // Hide "Others" inputs & Remove Generated Pages
            document.querySelectorAll('.others-input').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.generated-page').forEach(el => el.remove());

            // Reset specific displays
            document.querySelectorAll('.date-container .digit-box').forEach(el => el.innerText = '');
            if (document.getElementById('photo_acc_num_display')) document.getElementById('photo_acc_num_display').innerText = '............';
            if (document.getElementById('display_acc_no_nominee')) document.getElementById('display_acc_no_nominee').innerText = '............';
            if (document.getElementById('display_acc_no_bo')) document.getElementById('display_acc_no_bo').innerText = '............';

            // Reset Risk Tables Highlighting (Page 9)
            ['risk_p9_t1_tbody', 'risk_p9_t2_tbody', 'risk_p9_t3_tbody', 'risk_p9_t4_tbody', 'risk_p9_t5_tbody', 'risk_p9_t6_tbody'].forEach(id => {
                const tbody = document.getElementById(id);
                if (tbody) {
                    Array.from(tbody.rows).forEach((row, rIndex) => {
                        row.style.fontWeight = '';
                        row.style.backgroundColor = '';

                        // Remove ticks from all cells
                        Array.from(row.cells).forEach(cell => {
                            cell.innerText = cell.innerText.replace(' (✓)', '');
                        });

                        // Specific reset for Table 3 (Business/Profession)
                        if (id === 'risk_p9_t3_tbody') {
                            if (rIndex === 0 && row.cells.length > 2) {
                                row.cells[1].innerText = 'ব্যবসা সংযুক্ত তালিকা-১ হতে সন্নিবেশ করুন';
                                row.cells[2].innerText = '';
                            } else if (rIndex === 1 && row.cells.length > 2) {
                                row.cells[1].innerText = 'কার্যকলাপ সংক্রান্ত সংযুক্ত তালিকা -১ হতে সন্নিবেশ করুন';
                                row.cells[2].innerText = '';
                            }
                        }
                    });
                }
            });

            // Reset Risk Score on Page 7
            if (document.getElementById('risk_score_total')) document.getElementById('risk_score_total').innerText = '';
            if (document.getElementById('risk_rating_high')) document.getElementById('risk_rating_high').innerText = 'উচ্চ';
            if (document.getElementById('risk_rating_low')) document.getElementById('risk_rating_low').innerText = 'নিম্ন';

            appToast('Form has been reset.');
        }); // end appConfirm
    }

    // Validate number-only input
    function validateNumberOnly(input, fieldName) {
        const value = input.value;
        const numbersOnly = value.replace(/[^0-9]/g, '');

        if (value !== numbersOnly) {
            input.value = numbersOnly;
            if (numbersOnly === '') {
                showWarning(`${fieldName} can only contain numbers`);
            }
        }
    }

    // Show warning toast
    function showWarning(message) {
        const toast = document.getElementById('warning-toast');
        if (toast) {
            toast.innerText = message;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }

    function saveModalData() {
        // Save static inputs
        const staticInputs = document.querySelectorAll('#dataEntryModal > .modal-content > .form-grid > .form-group input, #dataEntryModal > .modal-content > .form-grid > .form-group select');
        const data = {};
        staticInputs.forEach(el => {
            if (el.id && el.type !== 'radio') data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });
        data['modal_kyc_ben_yes_radio'] = document.getElementById('modal_kyc_ben_yes_radio').checked;
        data['modal_kyc_ben_no_radio'] = document.getElementById('modal_kyc_ben_no_radio').checked;

        // Save dynamic sections (Person)
        data.persons = [];
        document.querySelectorAll('.person-entry').forEach(p => {
            const pData = {};
            p.querySelectorAll('input, select').forEach(el => {
                if (el.type === 'checkbox') pData[el.className] = el.checked;
                else pData[el.className] = el.value;
            });

            data.persons.push(pData);
        });

        // Save dynamic sections (Nominee)
        data.nominees = [];
        document.querySelectorAll('.nominee-entry').forEach(n => {
            const nData = {};
            n.querySelectorAll('input, select').forEach(el => nData[el.className] = el.value);
            data.nominees.push(nData);
        });

        data.transactions = transactions;
        data.addedRisks = addedRisks;

        window.AppStorage.setItem('sb_ac_modal_data', JSON.stringify(data));
        appToast('Modal data saved!');
    }

    function loadModalData() {
        const saved = window.AppStorage.getItem('sb_ac_modal_data');
        if (!saved) return;
        const data = JSON.parse(saved);

        // Load static
        for (const key in data) {
            if (key === 'persons' || key === 'nominees' || key.endsWith('_radio')) continue;
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') el.checked = data[key];
                else el.value = data[key];
            }
        }
        // Ensure amount words and BN display are updated after static load
        if (data['modal_kyc_ben_yes_radio'] !== undefined) document.getElementById('modal_kyc_ben_yes_radio').checked = data['modal_kyc_ben_yes_radio'];
        if (data['modal_kyc_ben_no_radio'] !== undefined) document.getElementById('modal_kyc_ben_no_radio').checked = data['modal_kyc_ben_no_radio'];

        if (document.getElementById('modal_init_amount')) convertAmount();

        // Load Persons
        const pContainer = document.getElementById('person_container');
        if (pContainer) {
            pContainer.innerHTML = ''; // Clear default
            if (data.persons && data.persons.length > 0) {
                data.persons.forEach((pData, i) => {
                    addPerson();
                    const pDiv = pContainer.children[i];
                    for (const cls in pData) {
                        const el = pDiv.querySelector('.' + cls);
                        if (el) {
                            if (el.type === 'checkbox') el.checked = pData[cls];
                            else el.value = pData[cls];
                            if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change'));
                            if (el.type === 'date') el.dispatchEvent(new Event('change'));
                        }
                    }
                    // Initialize person events (DOB BN etc.) after values restored
                    initPersonSection(pDiv);
                });
            } else {
                addPerson();
            }
        }

        // Load Nominees
        const nContainer = document.getElementById('nominee_container');
        if (nContainer) {
            nContainer.innerHTML = '';
            if (data.nominees && data.nominees.length > 0) {
                data.nominees.forEach((nData, i) => {
                    addNominee();
                    const nDiv = nContainer.children[i];
                    for (const cls in nData) {
                        const el = nDiv.querySelector('.' + cls);
                        if (el) el.value = nData[cls];
                    }
                });
            } else {
                addNominee();
            }
        }

        if (data.transactions) {
            transactions = data.transactions;
            renderTransactionTable();
        }

        if (data.addedRisks) {
            addedRisks = data.addedRisks;
            renderRiskSummaryTable();
            populatePage7RiskAssessment(); // Also update page 7 on load
        }

        // Trigger change events for dropdowns to show/hide "others" fields
        ['modal_nature', 'modal_currency', 'modal_operation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.dispatchEvent(new Event('change'));
        });
        if (document.getElementById('modal_operation')) handleOperationMode();
    }

    function clearModalData() {
        // (modal data cleared directly without confirmation)

        const modal = document.getElementById('dataEntryModal');

        // 1. Clear all input/select/textarea values in the modal
        modal.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = false;
            } else {
                el.value = '';
            }
        });

        // 2. Reset Dynamic Sections (Person, Nominee, Guardian)
        const pContainer = document.getElementById('person_container');
        if (pContainer) {
            pContainer.innerHTML = '';
            addPerson();
        }

        const nContainer = document.getElementById('nominee_container');
        if (nContainer) {
            nContainer.innerHTML = '';
            addNominee();
        }

        const gContainer = document.getElementById('guardian_container');
        if (gContainer) {
            gContainer.innerHTML = '';
        }

        // Hide conditional sections
        document.getElementById('nominee_section').style.display = 'none';
        document.getElementById('guardian-section').style.display = 'none';

        // 3. Reset Arrays and Tables
        transactions = [];
        renderTransactionTable();

        kycDocs = [];
        // renderKycDocTable();

        addedRisks = [];
        renderRiskSummaryTable();

        // Reset Risk Score Display
        if (document.getElementById('modal_risk_total_score_display')) {
            document.getElementById('modal_risk_total_score_display').innerText = '0';
        }

        // 4. Reset UI Visibility (Others inputs, etc.)
        modal.querySelectorAll('.others-input').forEach(el => el.style.display = 'none');
        modal.querySelectorAll('.modal_nationality_other').forEach(el => el.style.display = 'none');

        // Trigger change events on selects to reset any dependent UI (like placeholders or visibility)
        modal.querySelectorAll('select').forEach(el => el.dispatchEvent(new Event('change')));

        if (document.getElementById('modal_operation')) handleOperationMode();
    }

    // Load data on startup
    window.addEventListener('load', () => {
        loadFormData();
        loadModalData();
    });

    function saveFormData() {
        const data = {
            inputs: Array.from(document.querySelectorAll('input.box-input-p3, input.digit-input')).map(el => el.value),
            contentEditable: Array.from(document.querySelectorAll('[contenteditable="true"]')).map(el => el.innerText),
            checkboxes: Array.from(document.querySelectorAll('.tick-box')).map(el => el.innerText)
        };
        window.AppStorage.setItem('sb_ac_main_form', JSON.stringify(data));
        appToast('Work saved successfully!');
    }
    // --- END: Data Entry Modal Logic ---

    // --- Risk Assessment Logic ---
    const riskScores = {
        'modal_risk_prod': { '1': 1, '2': 4, '3': 3, '4': 1, '5': 4, '6': 5, '7': 3, '8': 5 },
        'modal_risk_onboard': { '9': 2, '10': 3, '11': 5, '12': 3 },
        'modal_risk_geo': { '1': 1, '2': 2, '3': 3, '4_yes': 5, '4_no': 1 },
        'modal_risk_biz_prof_gen': { 'low': 1, 'high': 5 },
        'modal_risk_rel': { 'pep_yes': 5, 'pep_no': 0 },
        'modal_risk_txn': { '1': 1, '2': 2, '3': 3, '4': 5 },
        'modal_risk_trans': { 'yes': 1, 'no': 5 },
        'modal_risk_cust_biz': {
            'biz_1': 5, 'biz_2': 5, 'biz_3': 5, 'biz_4': 5, 'biz_5': 5, 'biz_6': 5, 'biz_7': 5, 'biz_8': 5, 'biz_9': 5, 'biz_10': 5,
            'biz_11': 5, 'biz_12': 5, 'biz_13': 5, 'biz_14': 5, 'biz_15': 5, 'biz_16': 5, 'biz_17': 5, 'biz_18': 5, 'biz_19': 5, 'biz_20': 5,
            'biz_21': 5, 'biz_22': 5, 'biz_23': 5, 'biz_24': 4, 'biz_25': 4, 'biz_26': 4, 'biz_27': 4, 'biz_28': 4, 'biz_29': 4, 'biz_30': 4,
            'biz_31': 4, 'biz_32': 4, 'biz_33': 4, 'biz_34': 4, 'biz_35': 4, 'biz_36': 4, 'biz_37': 3, 'biz_38': 3, 'biz_39': 3, 'biz_40': 3,
            'biz_41': 3, 'biz_42': 3, 'biz_43': 3, 'biz_44': 3, 'biz_45': 3, 'biz_46': 3, 'biz_47': 2, 'biz_48': 2, 'biz_49': 2, 'biz_50': 2,
            'biz_51': 2, 'biz_52': 1
        },
        'modal_risk_cust_prof': {
            'prof_1': 5, 'prof_2': 5, 'prof_3': 4, 'prof_4': 4, 'prof_5': 4, 'prof_6': 4, 'prof_7': 4, 'prof_8': 4, 'prof_9': 4,
            'prof_10': 3, 'prof_11': 3, 'prof_12': 3, 'prof_13': 2, 'prof_14': 2, 'prof_15': 2, 'prof_16': 2, 'prof_17': 1,
            'prof_18': 1, 'prof_19': 1
        }
    };

    let addedRisks = [];

    function updateRiskScore(selectElement) {
        const selectId = selectElement.id;
        const scoreInputId = selectId + '_score';
        const selectedValue = selectElement.value;
        const scoreInput = document.getElementById(scoreInputId);

        if (scoreInput) {
            const score = riskScores[selectId] ? riskScores[selectId][selectedValue] : '';
            scoreInput.value = score !== undefined ? score : '';
        }
    }

    function addRiskItem(selectId, factorName) {
        const selectElement = document.getElementById(selectId);
        const scoreInput = document.getElementById(selectId + '_score');

        if (!selectElement || !scoreInput || !selectElement.value || scoreInput.value === '') {
            appToast('Please select an option and ensure a score is displayed.');
            return;
        }

        const selectedText = selectElement.options[selectElement.selectedIndex].text;
        const selectedValue = selectElement.value;
        const score = parseInt(scoreInput.value, 10);

        // Remove existing entry for this factor if it exists to avoid duplicates
        addedRisks = addedRisks.filter(item => item.id !== selectId);

        const newItem = {
            id: selectId,
            value: selectedValue,
            factor: factorName,
            selected: selectedText,
            score: score
        };

        addedRisks.push(newItem);
        renderRiskSummaryTable();

        // Reset fields
        selectElement.value = '';
        scoreInput.value = '';
    }

    function removeRiskItem(factorName) {
        addedRisks = addedRisks.filter(item => item.factor !== factorName);
        renderRiskSummaryTable();
    }

    function renderRiskSummaryTable() {
        const tbody = document.getElementById('modal_risk_summary_table').querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        let total = 0;

        addedRisks.forEach(item => {
            total += item.score;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="border:1px solid #ddd; padding:4px;">${item.factor}</td>
                <td style="border:1px solid #ddd; padding:4px;">${item.selected}</td>
                <td style="border:1px solid #ddd; padding:4px; text-align:center;">${item.score}</td>
                <td style="border:1px solid #ddd; padding:4px; text-align:center;">
                    <button type="button" onclick="removeRiskItem('${item.factor}')" style="color:red;border:none;background:none;cursor:pointer;">X</button>
                </td>
            `;
        });

        document.getElementById('modal_risk_total_score_display').innerText = total;
        populatePage7RiskAssessment();
    }

    function calculateTotalRiskScore() {
        return addedRisks.reduce((sum, item) => sum + item.score, 0);
    }

    function populatePage7RiskAssessment() {
        const score = calculateTotalRiskScore();
        const hasData = addedRisks.length > 0;

        // Populate the total score dotted line
        setElementText('risk_score_total', hasData ? toBanglaDigits(score.toString()) : '');

        const highCell = document.getElementById('risk_rating_high');
        const lowCell = document.getElementById('risk_rating_low');

        // Reset cells to base text
        if (highCell) highCell.innerText = 'উচ্চ';
        if (lowCell) lowCell.innerText = 'নিম্ন';

        if (hasData) {
            // Set tick mark beside text with spacing to prevent text wrap
            if (score >= 15 && highCell) highCell.innerText = 'উচ্চ  (✓)';
            else if (score < 15 && lowCell) lowCell.innerText = 'নিম্ন  (✓)';
        }
    }

    let transactions = [];
    function addTransactionRow(type) {
        const prefix = type === 'deposit' ? 'modal_tp_dep' : 'modal_tp_with';

        const cat = document.getElementById(prefix + '_cat').value;
        const no = document.getElementById(prefix + '_no').value;
        const max = document.getElementById(prefix + '_max').value;
        const total = document.getElementById(prefix + '_total').value;
        const otherDesc = document.getElementById(prefix + '_other_desc').value;

        if (!no && !max && !total) return;

        // Check if entry exists and replace
        const existingIdx = transactions.findIndex(t => t.type === type && t.cat === cat);
        if (existingIdx > -1) {
            transactions[existingIdx] = { type, cat, no, max, total, otherDesc };
        } else {
            transactions.push({ type, cat, no, max, total, otherDesc });
        }
        renderTransactionTable();

        document.getElementById(prefix + '_no').value = '';
        document.getElementById(prefix + '_max').value = '';
        document.getElementById(prefix + '_total').value = '';
        document.getElementById(prefix + '_other_desc').value = '';
    }

    function renderTransactionTable() {
        const depTbody = document.getElementById('modal_tp_dep_tbody');
        const withTbody = document.getElementById('modal_tp_with_tbody');

        depTbody.innerHTML = transactions.map((t, i) => t.type === 'deposit' ? `<tr><td>${t.type}</td><td>${t.cat}${t.cat === 'others' ? ' (' + t.otherDesc + ')' : ''}</td><td>${t.no}</td><td>${t.max}</td><td>${t.total}</td><td><button type="button" onclick="transactions.splice(${i},1);renderTransactionTable()" style="color:red;border:none;background:none;cursor:pointer;">X</button></td></tr>` : '').join('');

        withTbody.innerHTML = transactions.map((t, i) => t.type === 'withdraw' ? `<tr><td>${t.type}</td><td>${t.cat}${t.cat === 'others' ? ' (' + t.otherDesc + ')' : ''}</td><td>${t.no}</td><td>${t.max}</td><td>${t.total}</td><td><button type="button" onclick="transactions.splice(${i},1);renderTransactionTable()" style="color:red;border:none;background:none;cursor:pointer;">X</button></td></tr>` : '').join('');
    }

    // Expose actions to the Hub (App Shell)
    function populateNomineeEntry(nomineeEntry, data) {
        if (!nomineeEntry || !data) return;
        const mapping = {
            'applicant_name_bn': 'modal_nom_name',
            'applicant_name_en': 'modal_nom_name',
            'applicant_dob': 'modal_nom_dob',
            'applicant_nid': 'modal_nom_id',
            'applicant_nid_10': 'modal_nom_id',
            'applicant_curr_addr_village': 'modal_nom_addr'
        };
        Object.keys(mapping).forEach(key => {
            let mappedValue = data[key] || data[key.replace('_10', '')];
            if (key === 'applicant_curr_addr_village') {
                const house = (data.applicant_curr_addr_house || data.curr_addr_house_en || '').trim();
                const village = (data.applicant_curr_addr_village || data.curr_addr_village_en || '').trim();
                if (house && village) mappedValue = house + ', ' + village;
                else if (house) mappedValue = house;
                else mappedValue = village;
            }
            if (mappedValue !== undefined && mappedValue !== null && mappedValue !== '') {
                const el = nomineeEntry.querySelector('.' + mapping[key]);
                if (el) {
                    if (key === 'applicant_name_en' && !data['applicant_name_bn']) mappedValue = mappedValue.toUpperCase();
                    el.value = mappedValue;
                    el.dispatchEvent(new Event('input'));
                    el.dispatchEvent(new Event('change'));
                }
            }
        });

        if (data.applicant_nid || data.applicant_nid_10 || data.applicant_passport_no || data.applicant_birth_reg_no) {
            const idNumInput = nomineeEntry.querySelector('.modal_nom_id');
            if (idNumInput) {
                let idValToSet = data.applicant_nid_10 || data.applicant_nid_17 || data.applicant_nid || data.applicant_passport_no || data.applicant_birth_reg_no;
                idNumInput.value = idValToSet;
                idNumInput.dispatchEvent(new Event('input'));
            }
        }
    }

    window.populatePersonSlot = function(idx, data) {
        const container = document.getElementById('person_container');
        if (!container) return;
        while (container.children.length <= idx) {
            if (typeof addPerson === 'function') addPerson();
        }
        const entry = container.children[idx];
        if (entry && typeof populatePersonEntry === 'function') {
            populatePersonEntry(entry, data);
        }
    };

    function populatePersonEntry(personEntry, data) {
        if (!personEntry || !data) return;

        const mapping = {
            'applicant_name_bn': 'modal_name_bn',
            'applicant_name_en': 'modal_name_en',
            'applicant_dob': 'modal_dob',
            'applicant_father_name_bn': 'modal_father',
            'applicant_mother_name_bn': 'modal_mother',
            'applicant_spouse_name_bn': 'modal_spouse',
            'applicant_nationality': 'modal_nationality',
            'applicant_nid': 'modal_id_number',
            'applicant_nid_10': 'modal_id_number',
            'applicant_mobile': 'modal_curr_phone',
            'applicant_email': 'modal_curr_email',
            'applicant_curr_addr_village': 'modal_curr_road',
            'applicant_present_district': 'modal_curr_dist',
            'applicant_curr_addr_post': 'modal_curr_post',
            'applicant_present_upozila': 'modal_curr_thana',
            'applicant_perm_addr_village': 'modal_perm_road',
            'applicant_permanent_district': 'modal_perm_dist',
            'applicant_perm_addr_post': 'modal_perm_post',
            'applicant_permanent_upozila': 'modal_perm_thana',
            'applicant_profession': 'modal_profession',
            'monthly_income': 'modal_income',
            'applicant_fund_source': 'modal_source',
            'applicant_tin': 'modal_tin',
            'applicant_gender': 'modal_gender',
            'applicant_resident_status': 'modal_resident',
            'photo': 'modal_photo_data'
        };

        Object.keys(mapping).forEach(key => {
            let mappedValue = data[key] || data[key.replace('_10', '')];
            if (key === 'applicant_curr_addr_village') {
                const house = (data.applicant_curr_addr_house || data.curr_addr_house_en || '').trim();
                const village = (data.applicant_curr_addr_village || data.curr_addr_village_en || '').trim();
                if (house && village) {
                    mappedValue = house + ', ' + village;
                } else if (house) {
                    mappedValue = house;
                } else {
                    mappedValue = village;
                }
            }
            if (key === 'applicant_profession') {
                let parts = [];
                if (data.occupation_type) parts.push(data.occupation_type);
                if (data.occupation_bn) parts.push(data.occupation_bn);
                mappedValue = parts.join(', ');
            } else if (key === 'applicant_gender') {
                if (mappedValue === 'Male') mappedValue = 'male';
                else if (mappedValue === 'Female') mappedValue = 'female';
                else if (mappedValue === 'Third Gender') mappedValue = 'third';
            } else if (key === 'applicant_nationality') {
                if (mappedValue === 'Bangladeshi' || mappedValue === 'বাংলাদেশী') mappedValue = 'বাংলাদেশী';
                else if (mappedValue) mappedValue = 'other';
            } else if (key === 'applicant_resident_status') {
                if (mappedValue === 'Resident') mappedValue = 'resident';
                else if (mappedValue === 'Non-Resident') mappedValue = 'nonres';
            }
            if (mappedValue !== undefined && mappedValue !== null && mappedValue !== '') {
                const el = personEntry.querySelector('.' + mapping[key]);
                if (el) {
                    if (key === 'applicant_name_en') mappedValue = mappedValue.toUpperCase();
                    el.value = mappedValue;
                    if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change'));
                }
            }
        });

        if (data.applicant_nid || data.applicant_nid_10 || data.applicant_passport_no || data.applicant_birth_reg_no) {
            const idTypeSelect = personEntry.querySelector('.modal_id_type');
            const idNumInput = personEntry.querySelector('.modal_id_number');
            if (idTypeSelect && idNumInput) {
                let idTypeToSelect = '';
                let idValToSet = '';
                if (data.applicant_nid_10 || data.applicant_nid_17) {
                    idTypeToSelect = 'nid';
                    idValToSet = data.applicant_nid_10 || data.applicant_nid_17;
                } else if (data.applicant_passport_no) {
                    idTypeToSelect = 'passport';
                    idValToSet = data.applicant_passport_no;
                } else if (data.applicant_birth_reg_no) {
                    idTypeToSelect = 'birth';
                    idValToSet = data.applicant_birth_reg_no;
                } else if (data.applicant_nid && !data.applicant_nid.startsWith('TEMP-')) {
                    idTypeToSelect = 'nid';
                    idValToSet = data.applicant_nid;
                }

                if (idTypeToSelect) {
                    idTypeSelect.value = idTypeToSelect;
                    if (typeof updateIdInput === 'function') updateIdInput(idTypeSelect);
                    idTypeSelect.dispatchEvent(new Event('change'));
                    idNumInput.value = idValToSet;
                }
            }
        }
    }

    window.SBACFormLogic = {
        openModal: openModal,
        startNewForm: startNewForm,
        clearForm: startNewForm,
        clearData: startNewForm,
        populate: function (data) {
            if (!data) return;

            // Load Transaction Profile
            try {
                let tp = data.transaction_profile;
                if (!tp && data.additional_data) {
                    const addData = typeof data.additional_data === 'string' ? JSON.parse(data.additional_data) : data.additional_data;
                    tp = addData.transaction_profile;
                }
                if (tp) {
                    transactions = typeof tp === 'string' ? JSON.parse(tp) : tp;
                    renderTransactionTable();
                }
            } catch (e) { console.warn("Failed to load TP", e); }





            // Reset person entries first to avoid duplicates
            const personContainer = document.getElementById('person_container');
            if (personContainer) {
                personContainer.innerHTML = '';
            }

            // Add the primary applicant
            addPerson();
            const firstPersonEntry = personContainer ? personContainer.children[0] : null;
            if (firstPersonEntry) {
                populatePersonEntry(firstPersonEntry, data);
            }

            // Add co-applicants from relationships
            if (data.relationships && data.relationships.length > 0) {
                const coApplicants = data.relationships.filter(r =>
                    r.relation_type === 'Co-applicant' ||
                    r.relation_type === 'Spouse' ||
                    r.relation_type === 'Brother' ||
                    r.relation_type === 'Sister' ||
                    r.relation_type === 'Partner' ||
                    r.relation_type === 'Director'
                );

                coApplicants.forEach((rel, idx) => {
                    addPerson();
                    const nextEntry = personContainer.children[idx + 1];
                    if (nextEntry) {
                        populatePersonEntry(nextEntry, rel);
                    }
                });

                // Set operation mode to Jointly since there are co-applicants
                const modeOfOperSelect = document.getElementById('modal_mode_of_oper');
                if (modeOfOperSelect) {
                    modeOfOperSelect.value = 'jointly';
                    modeOfOperSelect.dispatchEvent(new Event('change'));
                }
            }

            // Auto-fill account title with applicant name if empty
            const titleBn = document.getElementById('modal_account_title_bn');
            if (titleBn && !titleBn.value && data.applicant_name_bn) {
                titleBn.value = data.applicant_name_bn;
            }
            const titleEn = document.getElementById('modal_account_title_en');
            if (titleEn && !titleEn.value && data.applicant_name_en) {
                titleEn.value = data.applicant_name_en;
            }

            // Finally, update the form view and show the modal for review
            applyData();
            openModal();
        },
        saveForm: saveModalData,
        saveWork: saveFormData,
        loadWork: loadFormData
    };

    //     window.addEventListener('message', function (event) {
    //         if (!event.data) return;
    // 
    //         // Targeted slot fill: populate only a specific applicant entry
    //         if (event.data.command === 'FILL_SLOT') {
    //             let idx = event.data.slotIndex;
    //             const data = event.data.data;
    //             if (idx === undefined && event.data.targetContext && event.data.targetContext.startsWith('person_')) {
    //                 idx = parseInt(event.data.targetContext.split('_')[1]);
    //             }
    //             if (idx !== undefined && data) {
    //                 // Ensure the entry exists — add it if needed
    //                 while (container.children.length <= idx) {
    //                     addPerson();
    //                 }
    //                 const entry = container.children[idx];
    //                 if (entry) {
    //                     if (typeof populatePersonEntry === 'function') {
    //                         populatePersonEntry(entry, data);
    //                     }
    //                 }
    //             } else if (ctx && ctx.startsWith('nominee_') && data) {
    //                 const idx = parseInt(ctx.split('_')[1]);
    //                 const container = document.getElementById('nominee_container');
    //                 while (container.children.length <= idx) {
    //                     addNominee();
    //                 }
    //                 const entry = container.children[idx];
    //                 if (entry) {
    //                     if (typeof populateNomineeEntry === 'function') {
    //                         populateNomineeEntry(entry, data);
    //                     }
    //                 }
    //             }
    //             return;
    //         }
    // 
    //         if (event.data.command === 'EXECUTE_ACTION') {
    //             switch (event.data.actionId) {
    //                 case 'btn-data-entry': openModal(); break;
    //                 case 'btn-start-new': startNewForm(); break;
    //                 case 'btn-clear-form': startNewForm(); break;
    //                 case 'btn-save-form': saveFormData(); break;
    //                 case 'btn-print-form': window.print(); break;
    //             }
    //         }
    //     });

    window.saveCustomerToDB = function () {
        const firstPerson = document.querySelector('.person-entry');
        if (!firstPerson) {
            appToast('No customer data to save.');
            return;
        }

        const nameBn = (firstPerson.querySelector('.modal_name_bn').value || '').trim();
        const nameEn = (firstPerson.querySelector('.modal_name_en').value || '').trim().toUpperCase();
        let nid = (firstPerson.querySelector('.modal_id_number').value || '').trim().replace(/\D/g, '');
        const idType = (firstPerson.querySelector('.modal_id_type').value || '').trim();

        if (!nameBn && !nameEn) {
            appToast('অনুগ্রহ করে কমপক্ষে নাম প্রদান করুন।\n(Please provide at least a name.)');
            return;
        }

        // Generate temporary ID if NID is missing
        if (!nid || (idType !== 'nid' && idType !== 'birth')) {
            const nameKey = (nameBn || nameEn).replace(/\s+/g, '_').substring(0, 20);
            nid = 'TEMP-' + nameKey + '-' + Date.now();
        }

        const customer = {
            photo: firstPerson.querySelector('.modal_photo_data')?.value || '',
            applicant_name_bn: nameBn,
            applicant_name_en: nameEn,
            applicant_father_name_bn: (firstPerson.querySelector('.modal_father').value || '').trim(),
            applicant_mother_name_bn: (firstPerson.querySelector('.modal_mother').value || '').trim(),
            applicant_spouse_name_bn: (firstPerson.querySelector('.modal_spouse').value || '').trim(),
            applicant_nid: nid,
            applicant_nid_10: (nid.length === 10) ? nid : '',
            applicant_nid_17: (nid.length === 17) ? nid : '',
            applicant_dob: (firstPerson.querySelector('.modal_dob').value || '').trim(),
            applicant_curr_addr_village: (firstPerson.querySelector('.modal_curr_road').value || '').trim(),
            applicant_curr_addr_post: (firstPerson.querySelector('.modal_curr_post').value || '').trim(),
            applicant_present_upozila: (firstPerson.querySelector('.modal_curr_thana').value || '').trim(),
            applicant_present_district: (firstPerson.querySelector('.modal_curr_dist').value || '').trim(),
            applicant_perm_addr_village: (firstPerson.querySelector('.modal_perm_road').value || '').trim(),
            applicant_perm_addr_post: (firstPerson.querySelector('.modal_perm_post').value || '').trim(),
            applicant_permanent_upozila: (firstPerson.querySelector('.modal_perm_thana').value || '').trim(),
            applicant_permanent_district: (firstPerson.querySelector('.modal_perm_dist').value || '').trim(),
            applicant_mobile: (firstPerson.querySelector('.modal_curr_phone').value || '').trim(),
            applicant_email: (firstPerson.querySelector('.modal_curr_email').value || '').trim(),
            applicant_nationality: (firstPerson.querySelector('.modal_nationality').value || '').trim(),
            applicant_profession: (firstPerson.querySelector('.modal_profession').value || '').trim(),
            monthly_income: (firstPerson.querySelector('.modal_income').value || '').trim(),
            applicant_fund_source: (firstPerson.querySelector('.modal_source').value || '').trim(),
            applicant_tin: (firstPerson.querySelector('.modal_tin').value || '').trim(),
            applicant_gender: (firstPerson.querySelector('.modal_gender').value || '').trim(),
            applicant_resident_status: (firstPerson.querySelector('.modal_resident').value || '').trim(),
            transaction_profile: JSON.stringify(transactions)
        };


        // Gather relationships for sync
        const rels = [];
        const persons = document.querySelectorAll('.person-entry');
        for (let i = 1; i < persons.length; i++) {
            const p = persons[i];
            let pNid = (p.querySelector('.modal_id_number').value || '').trim().replace(/\D/g, '');
            if (pNid) rels.push({ nid: pNid, type: 'Co-applicant', type_bn: 'সহ-আবেদনকারী', reverse: 'Co-applicant of this customer' });
        }
        const nominees = document.querySelectorAll('.nominee-entry');
        for (let i = 0; i < nominees.length; i++) {
            const n = nominees[i];
            let nNid = (n.querySelector('.modal_nom_id').value || '').trim().replace(/\D/g, '');
            if (nNid) rels.push({ nid: nNid, type: 'Nominee', type_bn: 'নমিনী', reverse: 'Account Holder (Nominated by)' });
        }
        customer.relationships_to_sync = rels;

        const accountNo = (document.getElementById('modal_account_no')?.value || '').replace(/\D/g, '').trim();
        const customerCode = (document.getElementById('modal_unique_customer_id')?.value || '').trim();
        const rawDate = (document.getElementById('modal_app_date')?.value || '').trim();
        if (accountNo) {
            customer.new_account = {
                account_no: accountNo,
                customer_code: customerCode,
                account_title: (document.getElementById('modal_account_title_en')?.value || document.getElementById('modal_account_title_bn')?.value || nameEn || nameBn || '').trim(),
                account_type: 'SB',
                opened_at: rawDate ? rawDate.split('-').reverse().join('/') : ''
            };
        }

        window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', customer: customer }, '*');
    };

    window.handleFormPhotoUpload = function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const dataUrl = e.target.result;
                const imgEl = document.getElementById('applicant_photo');
                const textEl = document.getElementById('applicant_photo_text');
                if (imgEl) {
                    imgEl.src = dataUrl;
                    imgEl.style.display = 'block';
                }
                if (textEl) {
                    textEl.style.display = 'none';
                }
                // Update the modal's hidden input as well
                const firstPersonEntry = document.querySelector('.person-entry');
                if (firstPersonEntry) {
                    const modalPhotoData = firstPersonEntry.querySelector('.modal_photo_data');
                    if (modalPhotoData) {
                        modalPhotoData.value = dataUrl;
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // ── Non-blocking Toast + Confirm helpers ──


    // Ensure critical shared listener functions are exposed in SB form
    window.populateFromCustomer = typeof populateFromCustomer !== 'undefined' ? populateFromCustomer : undefined;
    window.populatePersonSlot = typeof populatePersonSlot !== 'undefined' ? populatePersonSlot : undefined;
    window.populateNomineeEntry = typeof populateNomineeEntry !== 'undefined' ? populateNomineeEntry : undefined;
    window.syncBranchState = typeof syncBranchState !== 'undefined' ? syncBranchState : undefined;


    // --- AUTO-EXPOSED SB FUNCTIONS ---
    if (typeof openModal !== 'undefined') window.openModal = openModal;
    if (typeof closeModal !== 'undefined') window.closeModal = closeModal;
    if (typeof toggleNonResidentFields !== 'undefined') window.toggleNonResidentFields = toggleNonResidentFields;
    if (typeof initializeModalContent !== 'undefined') window.initializeModalContent = initializeModalContent;
    if (typeof toBanglaDigits !== 'undefined') window.toBanglaDigits = toBanglaDigits;
    if (typeof syncBranchState !== 'undefined') window.syncBranchState = syncBranchState;
    if (typeof toggleTick !== 'undefined') window.toggleTick = toggleTick;
    if (typeof setupModalInputLock !== 'undefined') window.setupModalInputLock = setupModalInputLock;
    if (typeof showWarning !== 'undefined') window.showWarning = showWarning;
    if (typeof updatePhotoAccNumber !== 'undefined') window.updatePhotoAccNumber = updatePhotoAccNumber;
    if (typeof setupDateInput !== 'undefined') window.setupDateInput = setupDateInput;
    if (typeof validateDate !== 'undefined') window.validateDate = validateDate;
    if (typeof handleOthers !== 'undefined') window.handleOthers = handleOthers;
    if (typeof togglePepFieldsGlobal !== 'undefined') window.togglePepFieldsGlobal = togglePepFieldsGlobal;
    if (typeof toggleSanctionFieldsGlobal !== 'undefined') window.toggleSanctionFieldsGlobal = toggleSanctionFieldsGlobal;
    if (typeof handleOperationMode !== 'undefined') window.handleOperationMode = handleOperationMode;
    if (typeof setElementText !== 'undefined') window.setElementText = setElementText;
    if (typeof setCheck !== 'undefined') window.setCheck = setCheck;
    if (typeof toBanglaNumber !== 'undefined') window.toBanglaNumber = toBanglaNumber;
    if (typeof toEnglishNumber !== 'undefined') window.toEnglishNumber = toEnglishNumber;
    if (typeof distributeDigits !== 'undefined') window.distributeDigits = distributeDigits;
    if (typeof convertAmount !== 'undefined') window.convertAmount = convertAmount;
    if (typeof convertToBanglaWords !== 'undefined') window.convertToBanglaWords = convertToBanglaWords;
    if (typeof copyAddress !== 'undefined') window.copyAddress = copyAddress;
    if (typeof createPersonHTML !== 'undefined') window.createPersonHTML = createPersonHTML;
    if (typeof createNomineeHTML !== 'undefined') window.createNomineeHTML = createNomineeHTML;
    if (typeof addPerson !== 'undefined') window.addPerson = addPerson;
    if (typeof pullCustomerForSlot !== 'undefined') window.pullCustomerForSlot = pullCustomerForSlot;
    if (typeof pullCustomerForNominee !== 'undefined') window.pullCustomerForNominee = pullCustomerForNominee;
    if (typeof addNominee !== 'undefined') window.addNominee = addNominee;
    if (typeof removeSection !== 'undefined') window.removeSection = removeSection;
    if (typeof handleIdInput !== 'undefined') window.handleIdInput = handleIdInput;
    if (typeof updateIdInput !== 'undefined') window.updateIdInput = updateIdInput;
    if (typeof validateIdNumber !== 'undefined') window.validateIdNumber = validateIdNumber;
    if (typeof validateNominees !== 'undefined') window.validateNominees = validateNominees;
    if (typeof toggleNomineeSection !== 'undefined') window.toggleNomineeSection = toggleNomineeSection;
    if (typeof toggleNomineeMinor !== 'undefined') window.toggleNomineeMinor = toggleNomineeMinor;
    if (typeof updateGuardianIdInput !== 'undefined') window.updateGuardianIdInput = updateGuardianIdInput;
    if (typeof createGuardianHTML !== 'undefined') window.createGuardianHTML = createGuardianHTML;
    if (typeof addGuardian !== 'undefined') window.addGuardian = addGuardian;
    if (typeof clonePage !== 'undefined') window.clonePage = clonePage;
    if (typeof initPersonSection !== 'undefined') window.initPersonSection = initPersonSection;
    if (typeof applyData !== 'undefined') window.applyData = applyData;
    if (typeof loadFormData !== 'undefined') window.loadFormData = loadFormData;
    if (typeof startNewForm !== 'undefined') window.startNewForm = startNewForm;
    if (typeof validateNumberOnly !== 'undefined') window.validateNumberOnly = validateNumberOnly;
    if (typeof saveModalData !== 'undefined') window.saveModalData = saveModalData;
    if (typeof loadModalData !== 'undefined') window.loadModalData = loadModalData;
    if (typeof clearModalData !== 'undefined') window.clearModalData = clearModalData;
    if (typeof saveFormData !== 'undefined') window.saveFormData = saveFormData;
    if (typeof updateRiskScore !== 'undefined') window.updateRiskScore = updateRiskScore;
    if (typeof addRiskItem !== 'undefined') window.addRiskItem = addRiskItem;
    if (typeof removeRiskItem !== 'undefined') window.removeRiskItem = removeRiskItem;
    if (typeof renderRiskSummaryTable !== 'undefined') window.renderRiskSummaryTable = renderRiskSummaryTable;
    if (typeof calculateTotalRiskScore !== 'undefined') window.calculateTotalRiskScore = calculateTotalRiskScore;
    if (typeof populatePage7RiskAssessment !== 'undefined') window.populatePage7RiskAssessment = populatePage7RiskAssessment;
    if (typeof addTransactionRow !== 'undefined') window.addTransactionRow = addTransactionRow;
    if (typeof renderTransactionTable !== 'undefined') window.renderTransactionTable = renderTransactionTable;
    if (typeof populateNomineeEntry !== 'undefined') window.populateNomineeEntry = populateNomineeEntry;
    if (typeof populatePersonEntry !== 'undefined') window.populatePersonEntry = populatePersonEntry;
    // ---------------------------------
})();

// =========================================
// DPS/FDR ACCOUNT (DP/FD) LOGIC
// =========================================
(function () {
    if (!document.getElementById("dps-mss-form") && !document.getElementById("modal_deposit_type")) return; // Guard for DPS form

    // Dynamic Modal Logic
    function openModal() { document.getElementById('dataEntryModal').style.display = 'block'; }
    function closeModal() { document.getElementById('dataEntryModal').style.display = 'none'; }

    // Close modal when clicking outside of it (on the overlay)
    window.onclick = function (event) {
        const modal = document.getElementById('dataEntryModal');
        if (event.target == modal) {
            closeModal();
        }
    };

    function handleRenewalChange() {
        const method = document.getElementById('modal_renewal_method').value;
        document.getElementById('modal_renewal_acc_container').style.display = (method === 'renew_principal') ? 'block' : 'none';
    }

    /**
     * Toggles the visibility of specific form sections based on selected deposit type.
     */
    function printFDRCheque() {
        applyData(); // Ensure data is populated into DB blob
        
        // Build the data object by reading directly from the A4 form DOM elements as mapped by the user
        const toBnNum = (str) => {
            const bnObj = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
            return String(str).replace(/[0-9]/g, match => bnObj[match] || match);
        };

        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            // For inputs, value is present. For contenteditable divs and spans, use innerText.
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el.value || '';
            return el.innerText || '';
        };

        // Account Title/Name: "নাম (বাংলায়)", "পিতার নাম", "রোড/গ্রাম", "থানা"
        let nameBn = getVal('applicant_name_bn');
        let fatherName = getVal('applicant_father_name_bn');
        let village = getVal('applicant_curr_addr_village');
        let thana = getVal('applicant_curr_addr_thana');
        let accountTitle = [nameBn, fatherName, village, thana].filter(Boolean).join(', ');

        // Principal Amount (fig) with /- sign
        let rawAmount = getVal('dps_fd_amount');
        let fdrAmount = rawAmount ? rawAmount + '/-' : ''; 

        // Principal (in words)
        let amountWords = getVal('dps_fd_amount_bn_words');

        // Duration-মেয়াদকাল (বছর, মাস, দিন)
        let tY = getVal('dps_fd_tenor_year');
        let tM = getVal('dps_fd_tenor_month');
        let tD = getVal('dps_fd_tenor_day');
        let durationStr = [tY ? tY + ' বছর' : '', tM ? tM + ' মাস' : '', tD ? tD + ' দিন' : ''].filter(Boolean).join(' ');

        // Rate-মুনাফার হার (%)
        let rate = getVal('dps_fd_rate');
        let rateStr = toBnNum(rate).replace('%', '').trim(); // Remove existing % sign so we don't duplicate it

        // FDR A/C no (could be in account_no_p1 or modal_account_no depending on user interaction)
        let rawAccNo = getVal('account_no_p1') || getVal('modal_account_no');
        // Safely strip only non-digits (preserving English and Bengali numerals)
        let cleanAccNo = rawAccNo.replace(/[^\d০-৯]/g, '');
        let formattedAccNo = cleanAccNo;
        if (cleanAccNo.length > 4) {
            formattedAccNo = cleanAccNo.substring(0, 4) + '-' + cleanAccNo.substring(4);
        }

        // Date extraction (Handle DD-MM-YYYY or YYYY-MM-DD from modal)
        const formatDmyFlat = (raw) => {
            if (!raw) return '';
            let s = raw.trim();
            // If it's a browser date picker format YYYY-MM-DD
            if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return s.split('-').reverse().join(''); // DDMMYYYY
            }
            if (s.match(/^\d{2}\/\d{2}\/\d{4}$/)) { // DD/MM/YYYY
                return s.split('/').join(''); // DDMMYYYY
            }
            if (s.match(/^[০-৯]{2}\/[০-৯]{2}\/[০-৯]{4}$/)) { // Bengali DD/MM/YYYY
                return s.split('/').join(''); // DDMMYYYY
            }
            // Strip everything except English and Bengali numerals
            return s.replace(/[^\d০-৯]/g, ''); 
        };

        let rawDate = getVal('date') || getVal('modal_app_date');
        let rawMatDate = getVal('dps_fd_maturity_date');
        
        let chequeFlatDate = toBnNum(formatDmyFlat(rawDate));
        let matFlatDate = toBnNum(formatDmyFlat(rawMatDate));

        const dataToPass = {
            m_fdr_date: chequeFlatDate,
            m_fdr_acc: toBnNum(formattedAccNo),
            m_fdr_title: accountTitle,
            m_fdr_amount: toBnNum(fdrAmount),
            m_fdr_words: amountWords,
            m_fdr_roi: rateStr ? rateStr + '%' : '',
            m_fdr_tenure: toBnNum(durationStr),
            m_fdr_matdate: matFlatDate,
            m_fdr_remarks: getVal('dps_fd_scheme_name'),
            m_date: chequeFlatDate,
            m_payee: accountTitle,
            m_words: amountWords,
            m_figures: toBnNum(fdrAmount),
            m_account: toBnNum(formattedAccNo),
            m_acpayee: 'A/C PAYEE ONLY'
        };

        localStorage.setItem('fdr_live_preview_data', JSON.stringify(dataToPass));
        sessionStorage.setItem('fdr_auto_preview', 'true');
        
        // Use postMessage to bypass Chromium file:// cross-origin blocks
        if (window.parent) {
            window.parent.postMessage({ command: 'OPEN_CHEQUE_PRINT_TAB' }, '*');
        }
    }

    function closeFDRChequePreview() {
        const chequeContainer = document.getElementById('fdr_cheque_page_container');
        if (chequeContainer) chequeContainer.style.display = 'none';

        // Restore original views
        document.querySelectorAll('.page').forEach(el => el.style.display = ''); 
        
        const fdrSlipPage = document.getElementById('fdr_deposit_slip_page_container');
        if (fdrSlipPage && document.getElementById('modal_deposit_type').value === 'fd') {
            fdrSlipPage.style.display = 'block';
        }
        
        const floatingMenu = document.querySelector('.floating-menu');
        const floatingBtn = document.querySelector('.floating-btn-container');
        if (floatingMenu) floatingMenu.style.display = '';
        if (floatingBtn) floatingBtn.style.display = '';
        
        const styleTag = document.getElementById('fdr_cheque_dynamic_style');
        if (styleTag) styleTag.innerHTML = '';
    }

    function updateDepositTypeFields() {
        const type = document.getElementById('modal_deposit_type').value;
        const fdSection = document.getElementById('modal_fd_section');
        const schemeSection = document.getElementById('modal_scheme_section');
        const fdrSlipPage = document.getElementById('fdr_deposit_slip_page_container');
        const fdrPopulateBtn = document.getElementById('btn_populate_fdr');

        if (fdSection) fdSection.style.display = (type === 'fd') ? 'grid' : 'none';
        if (schemeSection) schemeSection.style.display = (type === 'scheme') ? 'grid' : 'none';
        if (fdrSlipPage) fdrSlipPage.style.display = (type === 'fd') ? 'block' : 'none';
        if (fdrPopulateBtn) fdrPopulateBtn.style.display = (type === 'fd') ? 'inline-block' : 'none';
    }

    function calculateMaturityDate() {
        let appDateVal = document.getElementById('modal_app_date').value;
        if (!appDateVal) {
            const today = new Date();
            appDateVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }

        const y = parseInt(document.getElementById('modal_tenor_y')?.value) || 0;
        const m = parseInt(document.getElementById('modal_tenor_m')?.value) || 0;
        const d = parseInt(document.getElementById('modal_tenor_d')?.value) || 0;

        const parts = appDateVal.split('-');
        if (parts.length !== 3) return;

        let date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        date.setFullYear(date.getFullYear() + y);
        date.setMonth(date.getMonth() + m);
        date.setDate(date.getDate() + d);

        const maturityDateInput = document.getElementById('modal_maturity_date');
        if (maturityDateInput) {
            const year = String(date.getFullYear()).padStart(4, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            maturityDateInput.value = `${year}-${month}-${day}`;
        }
    }

    /**
     * Calculates the number of installments for Savings/Special Schemes
     * based on tenor (months) and installment frequency.
     */
    function calculateInstallmentCount() {
        const tenorMonths = parseInt(document.getElementById('modal_scheme_tenor')?.value) || 0;
        const freq = document.getElementById('modal_inst_freq')?.value;
        const countInput = document.getElementById('modal_inst_count');

        if (!countInput) return;

        let divisor = 1;
        if (freq === 'quarterly') divisor = 3;
        else if (freq === 'half_yearly') divisor = 6;
        else if (freq === 'yearly') divisor = 12;

        if (tenorMonths > 0 && freq) {
            const count = Math.floor(tenorMonths / divisor);
            countInput.value = count;
        } else {
            countInput.value = '';
        }
    }

    /**
     * Generic helper to update amount in words in the modal.
     */
    function updateModalWords(input, targetId) {
        const numStr = input.value.replace(/\D/g, '');
        const target = document.getElementById(targetId);
        if (!numStr) {
            if (target) target.value = '';
            return;
        }
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && target) {
            target.value = convertToBanglaWords(num) + ' টাকা মাত্র';
        }
    }

    const riskScores = {
        'modal_risk_prod': { '1': 1, '2': 4, '3': 3, '4': 1, '5': 4, '6': 5, '7': 3, '8': 5 },
        'modal_risk_onboard': { '9': 2, '10': 3, '11': 5, '12': 3 },
        'modal_risk_geo': { '1': 1, '2': 2, '3': 3, '4_yes': 5, '4_no': 1 },
        'modal_risk_biz_prof_gen': { 'low': 1, 'high': 5 },
        'modal_risk_rel': { 'pep_yes': 5, 'pep_no': 0 },
        'modal_risk_txn': { '1': 1, '2': 2, '3': 3, '4': 5 },
        'modal_risk_trans': { 'yes': 1, 'no': 5 },
        'modal_risk_cust_biz': {
            'biz_1': 5, 'biz_2': 5, 'biz_3': 5, 'biz_4': 5, 'biz_5': 5, 'biz_6': 5, 'biz_7': 5, 'biz_8': 5, 'biz_9': 5, 'biz_10': 5,
            'biz_11': 5, 'biz_12': 5, 'biz_13': 5, 'biz_14': 5, 'biz_15': 5, 'biz_16': 5, 'biz_17': 5, 'biz_18': 5, 'biz_19': 5, 'biz_20': 5,
            'biz_21': 5, 'biz_22': 5, 'biz_23': 5, 'biz_24': 4, 'biz_25': 4, 'biz_26': 4, 'biz_27': 4, 'biz_28': 4, 'biz_29': 4, 'biz_30': 4,
            'biz_31': 4, 'biz_32': 4, 'biz_33': 4, 'biz_34': 4, 'biz_35': 4, 'biz_36': 4, 'biz_37': 3, 'biz_38': 3, 'biz_39': 3, 'biz_40': 3,
            'biz_41': 3, 'biz_42': 3, 'biz_43': 3, 'biz_44': 3, 'biz_45': 3, 'biz_46': 3, 'biz_47': 2, 'biz_48': 2, 'biz_49': 2, 'biz_50': 2,
            'biz_51': 2, 'biz_52': 1
        },
        'modal_risk_cust_prof': {
            'prof_1': 5, 'prof_2': 5, 'prof_3': 4, 'prof_4': 4, 'prof_5': 4, 'prof_6': 4, 'prof_7': 4, 'prof_8': 4, 'prof_9': 4,
            'prof_10': 3, 'prof_11': 3, 'prof_12': 3, 'prof_13': 2, 'prof_14': 2, 'prof_15': 2, 'prof_16': 2, 'prof_17': 1,
            'prof_18': 1, 'prof_19': 1
        }
    };

    let addedRisks = [];

    function updateRiskScore(select) {
        const scoreInput = document.getElementById(select.id + '_score');
        if (scoreInput) {
            const score = riskScores[select.id] ? riskScores[select.id][select.value] : '';
            scoreInput.value = score !== undefined ? score : '';
        }
    }

    function addRiskItem(selectId, factorName) {
        const select = document.getElementById(selectId);
        const scoreInput = document.getElementById(selectId + '_score');
        if (!select.value || scoreInput.value === '') return;

        addedRisks = addedRisks.filter(r => r.id !== selectId);
        addedRisks.push({
            id: selectId,
            factor: factorName,
            score: parseInt(scoreInput.value),
            text: select.options[select.selectedIndex].text,
            value: select.value
        });
        renderRiskTable();
        select.value = '';
        scoreInput.value = '';
    }

    function renderRiskTable() {
        const tbody = document.getElementById('modal_risk_summary_table').querySelector('tbody');
        tbody.innerHTML = '';
        let total = 0;
        addedRisks.forEach((item, index) => {
            total += item.score;
            const row = tbody.insertRow();
            row.innerHTML = `<td style="border:1px solid #ddd; padding:4px;">${item.factor}</td>
                <td style="border:1px solid #ddd; padding:4px;">${item.text}</td>
                <td style="border:1px solid #ddd; padding:4px; text-align:center;">${item.score}</td>
                <td style="border:1px solid #ddd; padding:4px; text-align:center;"><button type="button" onclick="addedRisks.splice(${index},1);renderRiskTable()" style="color:red; border:none; background:none; cursor:pointer;">&times;</button></td>`;
        });
        document.getElementById('modal_risk_total_score_display').innerText = total;
    }

    function populateRiskRating() {
        const score = addedRisks.reduce((s, r) => s + r.score, 0);
        const hasData = addedRisks.length > 0;

        setElementText('risk_score_total', hasData ? toBanglaDigits(score.toString()) : '');

        const highCell = document.getElementById('risk_rating_high');
        const lowCell = document.getElementById('risk_rating_low');

        if (highCell) highCell.innerText = 'উচ্চ';
        if (lowCell) lowCell.innerText = 'নিম্ন';

        if (hasData) {
            if (score >= 15 && highCell) highCell.innerText = 'উচ্চ  (✓)';
            else if (score < 15 && lowCell) lowCell.innerText = 'নিম্ন  (✓)';
        }
    }

    function renderRiskTable() {
        const tbody = document.getElementById('modal_risk_summary_table').querySelector('tbody');
        tbody.innerHTML = '';
        let total = 0;
        addedRisks.forEach((r, index) => {
            total += r.score;
            const row = tbody.insertRow();
            row.innerHTML = `<td style="border:1px solid #ddd; padding:10px;">${r.factor}</td>
                <td style="border:1px solid #ddd; padding:10px; text-align:center;">${r.score}</td>
                <td style="border:1px solid #ddd; padding:10px; text-align:center;"><button type="button" onclick="addedRisks.splice(${index},1);renderRiskTable()" style="color:red; border:none; background:none; cursor:pointer;">&times;</button></td>`;
        });
        document.getElementById('modal_risk_total_score_display').innerText = total;
    }

    /**
     * Converts numeric amounts to Bengali words.
     */
    function convertToBanglaWords(n) {
        const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগার', 'বার', 'তের', 'চৌদ্দ', 'পনের', 'ষোল', 'সতের', 'আঠার', 'ঊনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'ঊনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বর্তিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'ঊনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'ঊনপঞ্চাশ', 'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'ঊনষাট', 'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'ঊনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'ঊনআশি', 'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];
        if (n < 100) return units[n];
        if (n < 1000) return units[Math.floor(n / 100)] + 'শ' + (n % 100 !== 0 ? ' ' + convertToBanglaWords(n % 100) : '');
        if (n < 100000) return convertToBanglaWords(Math.floor(n / 1000)) + ' হাজার' + (n % 1000 !== 0 ? ' ' + convertToBanglaWords(n % 1000) : '');
        if (n < 10000000) return convertToBanglaWords(Math.floor(n / 100000)) + ' লক্ষ' + (n % 100000 !== 0 ? ' ' + convertToBanglaWords(n % 100000) : '');
        if (n >= 10000000) return convertToBanglaWords(Math.floor(n / 10000000)) + ' কোটি' + (n % 10000000 !== 0 ? ' ' + convertToBanglaWords(n % 10000000) : '');
        return '';
    }

    function distributeDigits(nodeList, valStr) {
        nodeList.forEach((input, i) => { if (i < valStr.length) input.value = valStr[i]; else input.value = ''; });
    }


    function toBanglaDigits(str) {
        if (!str) return "";
        const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
        return str.toString().replace(/\d/g, d => banglaDigits[d]);
    }

    function toEnglishDigits(str) {
        if (!str) return "";
        const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
        return str.toString().replace(/[০-৯]/g, d => banglaDigits.indexOf(d));
    }

    function applyData() {
        console.log("applyData() started");
        const depositType = document.getElementById('modal_deposit_type').value;
        const opMode = (depositType === 'fd') ? document.getElementById('modal_account_operation_fd').value : document.getElementById('modal_account_operation_scheme').value;

        // Reset specific scheme name fields to avoid cross-population
        setElementText('dps_fd_scheme_name', '');
        setElementText('dps_scheme_name', '');

        // Common Fields
        setElementText('account_title_bn', document.getElementById('modal_account_title_bn').value);
        setElementText('account_title_en', document.getElementById('modal_account_title_en').value);

        const titleBn = document.getElementById('modal_account_title_bn').value;
        const titleEn = document.getElementById('modal_account_title_en').value;
        setElementText('account_title', (titleBn ? titleBn : '') + (titleBn && titleEn ? ' / ' : '') + (titleEn ? titleEn : ''));
        setElementText('signature_account_title', titleEn);

        // Operation Mode (Page 2 Checkboxes)
        setCheck('account_operation_single', opMode === 'single');
        setCheck('account_operation_joint', opMode === 'joint');
        setCheck('account_operation_anyone', opMode === 'anyone');
        setCheck('account_operation_anyone_or_survivor', opMode === 'anyone_or_survivor');

        if (depositType === 'fd') {
            setElementText('dps_fd_scheme_name', document.getElementById('modal_dps_scheme_name').value);
            setElementText('dps_fd_amount', toBanglaDigits(document.getElementById('modal_amount_num').value));
            setElementText('dps_fd_amount_bn_words', document.getElementById('modal_amount_words').value);
            setElementText('dps_fd_rate', toBanglaDigits(document.getElementById('modal_dps_fd_rate').value));
            setElementText('dps_fd_tenor_year', toBanglaDigits(document.getElementById('modal_tenor_y').value));
            setElementText('dps_fd_tenor_month', toBanglaDigits(document.getElementById('modal_tenor_m').value));
            setElementText('dps_fd_tenor_day', toBanglaDigits(document.getElementById('modal_tenor_d').value));

            const maturityVal = document.getElementById('modal_maturity_date').value;
            if (maturityVal) {
                const [y, m, d] = maturityVal.split('-');
                setElementText('dps_fd_maturity_date', toBanglaDigits(`${d}/${m}/${y}`));
            }

            const renewalMethod = document.getElementById('modal_renewal_method').value;
            setCheck('fd_renew_all_tick', renewalMethod === 'renew_all');
            setCheck('fd_renew_principal_tick', renewalMethod === 'renew_principal');
            setCheck('fd_renew_none_tick', renewalMethod === 'none');

            const savAcc = document.getElementById('modal_renewal_savings_acc').value;
            setElementText('fd_renew_interest_acc', toBanglaDigits(savAcc));

            // --- START FDR SLIP POPULATION LOGIC ---
            const appDateVal = document.getElementById('modal_app_date').value;
            if (appDateVal) {
                const [y, m, d] = appDateVal.split('-');
                setElementText('date', toBanglaDigits(`${d}/${m}/${y}`));
            }

            setElementText('account_type', document.getElementById('modal_dps_scheme_name').value);

            // FDR Receipt No: raw string inputted by user (allows manual prefixes like 'FDR ')
            const modalFdrReceiptNo = document.getElementById('modal_fdr_account_no');
            if (modalFdrReceiptNo && modalFdrReceiptNo.value) {
                setElementText('fdr_receipt_no', modalFdrReceiptNo.value);
            } else {
                setElementText('fdr_receipt_no', '');
            }

            // Account No: from main Account Number field, Bangla digits, hyphen after 4th digit
            const mainAccNoEl = document.getElementById('modal_account_no');
            if (mainAccNoEl && mainAccNoEl.value) {
                setElementText('account_no', (typeof formatAccNo === 'function') ? formatAccNo(mainAccNoEl.value) : toBanglaDigits(mainAccNoEl.value));
            } else {
                setElementText('account_no', '');
            }

            const amtNum = document.getElementById('modal_amount_num').value;
            if (amtNum) {
                setElementText('amount_taka', toBanglaDigits(amtNum));
                setElementText('total_taka', toBanglaDigits(amtNum));
            }
            setElementText('amount_in_words', document.getElementById('modal_amount_words').value);

            let tenureStr = [];
            const ty = document.getElementById('modal_tenor_y').value;
            const tm = document.getElementById('modal_tenor_m').value;
            const td = document.getElementById('modal_tenor_d').value;
            if (ty && parseInt(ty) > 0) tenureStr.push(toBanglaDigits(ty) + ' বছর');
            if (tm && parseInt(tm) > 0) tenureStr.push(toBanglaDigits(tm) + ' মাস');
            if (td && parseInt(td) > 0) tenureStr.push(toBanglaDigits(td) + ' দিন');
            setElementText('tenure', tenureStr.join(', '));

            const fdRate = document.getElementById('modal_dps_fd_rate').value;
            setElementText('interest_rate', fdRate ? toBanglaDigits(fdRate) + '%' : '');

            const pContainer = document.getElementById('person_container');
            let depositorInfoArr = [];
            if (pContainer) {
                Array.from(pContainer.children).forEach(entry => {
                    const name = entry.querySelector('.modal_name_bn')?.value || '';
                    const father = entry.querySelector('.modal_father')?.value || '';
                    const spouse = entry.querySelector('.modal_spouse')?.value || '';
                    const vill = entry.querySelector('.modal_curr_vill')?.value || '';
                    const thana = entry.querySelector('.modal_curr_thana')?.value || '';
                    const dist = entry.querySelector('.modal_curr_dist')?.value || '';
                    
                    const relative = father ? 'পিতা: ' + father : (spouse ? 'স্বামী: ' + spouse : '');
                    
                    let line1 = name;
                    if (relative) line1 += ' (' + relative + ')';
                    
                    let line2 = [vill, thana, dist].filter(Boolean).join(', ');
                    
                    let fullString = line1;
                    if (line2) fullString += '\n' + line2;
                    
                    if (fullString) depositorInfoArr.push(fullString);
                });
            }
            const depositorInfoStr = depositorInfoArr.join('\n\n');
            setElementText('depositor_info', depositorInfoStr);
            setElementText('applicant_details', depositorInfoStr);
            // --- START FDR CHEQUE OVERLAY INJECTION ---
            const chequeContainer = document.getElementById('fdr-cheque-container');
            if (chequeContainer && typeof window.DB !== 'undefined') {
                const layoutStr = window.DB.getSetting('cheque_layout_fdr');
                if (layoutStr) {
                    try {
                        const layout = JSON.parse(layoutStr);
                        if (layout && layout.fields) {
                            chequeContainer.innerHTML = ''; // Clear existing
                            if (layout.width_mm) chequeContainer.style.width = `${layout.width_mm}mm`;
                            if (layout.height_mm) chequeContainer.style.height = `${layout.height_mm}mm`;
                            
                            const injectField = (key, value, isDate = false) => {
                                const fieldLayout = layout.fields[key];
                        if (!fieldLayout) return;
                        
                        if (isDate) {
                            const dateStr = (value || '').replace(/\D/g, '').padEnd(8, ' ');
                            const size = layout.date_config ? layout.date_config.size_mm : 5;
                            const gap = layout.date_config ? layout.date_config.gap_mm : 1;
                            
                            let html = `<div class="cheque-date-field" style="top: ${fieldLayout.top}; left: ${fieldLayout.left}; gap: ${gap}mm;">`;
                            for (let i = 0; i < 8; i++) {
                                html += `<div class="cheque-date-char" style="width: ${size}mm; height: ${size}mm;">${toBanglaDigits(dateStr[i])}</div>`;
                            }
                            html += `</div>`;
                            chequeContainer.insertAdjacentHTML('beforeend', html);
                        } else {
                            chequeContainer.insertAdjacentHTML('beforeend', 
                                `<div class="cheque-data-field" style="top: ${fieldLayout.top}; left: ${fieldLayout.left};">${value || ''}</div>`
                            );
                        }
                    };

                    const rawDate = document.getElementById('modal_app_date').value || '';
                    const dmyDate = rawDate ? rawDate.split('-').reverse().join('') : ''; // DDMMYYYY
                    
                    // We need maturity date. It's usually computed and set in 'fdr_maturity_date'. We'll pull it from there if it exists.
                    const matDateElem = document.getElementById('fdr_maturity_date');
                    let matDateDmy = '';
                    if (matDateElem && matDateElem.innerText) {
                        const parts = matDateElem.innerText.split('/');
                        if (parts.length === 3) matDateDmy = parts[0] + parts[1] + parts[2];
                    }

                    let fdrTitleArr = [];
                    if (data.persons && data.persons.length > 0) {
                        data.persons.forEach(person => {
                            let parts = [person.name_bn, person.father_name, person.vill, person.thana].filter(Boolean);
                            if (parts.length > 0) fdrTitleArr.push(parts.join(', '));
                        });
                    }
                    const fdrTitle = fdrTitleArr.join('\n');

                    const rawAmount = document.getElementById('modal_amount_num').value || '';
                    const fdrAmount = rawAmount ? toBanglaDigits(rawAmount) + '/-' : '';
                    
                    const wordsElem = document.getElementById('modal_amount_words');
                    const amountWords = wordsElem ? wordsElem.value : '';

                    let rawAccNo = document.getElementById('modal_account_no').value || '';
                    let cleanAccNo = rawAccNo.replace(/\D/g, '');
                    let formattedAccNo = cleanAccNo;
                    if (cleanAccNo.length > 4) {
                        formattedAccNo = cleanAccNo.substring(0, 4) + '-' + cleanAccNo.substring(4);
                    }

                    const schemeName = document.getElementById('modal_scheme_name').value || '';

                    injectField('fdr_date', dmyDate, true);
                    injectField('fdr_acc', toBanglaDigits(formattedAccNo));
                    injectField('fdr_title', fdrTitle);
                    injectField('fdr_amount', fdrAmount);
                    injectField('fdr_words', amountWords);
                    injectField('fdr_roi', fdRate ? toBanglaDigits(fdRate) + '%' : '');
                    injectField('fdr_tenure', tenureStr.join(', '));
                    injectField('fdr_matdate', matDateDmy, true);
                    injectField('fdr_remarks', schemeName); 
                        }
                    } catch (e) { console.error('Error parsing cheque layout:', e); }
                }
            }
            // --- END FDR CHEQUE OVERLAY INJECTION ---

            // --- END FDR SLIP POPULATION LOGIC ---
        }

        if (depositType === 'scheme') {
            setElementText('dps_scheme_name', document.getElementById('modal_scheme_name').value);
            let tenorMonths = parseInt(document.getElementById('modal_scheme_tenor').value) || 0;
            let tenorDisplay = '';
            if (tenorMonths > 0) {
                let y = Math.floor(tenorMonths / 12);
                let m = tenorMonths % 12;
                if (y > 0 && m > 0) tenorDisplay = `${y} বছর ${m} মাস`;
                else if (y > 0) tenorDisplay = `${y} বছর`;
                else tenorDisplay = `${m} মাস`;
            }
            setElementText('dps_scheme_tenor', toBanglaDigits(tenorDisplay));

            const instFreqVal = document.getElementById('modal_inst_freq').value;
            const freqMap = {
                'monthly': 'মাসিক',
                'quarterly': 'ত্রৈমাসিক',
                'half_yearly': 'ষাণ্মাসিক',
                'yearly': 'বার্ষিক'
            };
            setElementText('dps_installment_frequency', freqMap[instFreqVal] || '');


            setElementText('dps_installment_count', toBanglaDigits(document.getElementById('modal_inst_count').value));
            setElementText('dps_installment_amount', toBanglaDigits(document.getElementById('modal_inst_amount_num').value));
            setElementText('dps_installment_amount_bn_words', document.getElementById('modal_inst_amount_words').value);
            setElementText('dps_maturity_payout_amount', toBanglaDigits(document.getElementById('modal_maturity_amount_num').value));
            setElementText('dps_maturity_payout_amount_bn_words', document.getElementById('modal_maturity_amount_words').value);
            setElementText('dps_lump_sum_deposit', toBanglaDigits(document.getElementById('modal_one_time_dep_num').value));
            setElementText('dps_lump_sum_deposit_bn_words', document.getElementById('modal_one_time_dep_words').value);
            setElementText('dps_payout_frequency', document.getElementById('modal_payout_freq').value);
            setElementText('dps_payout_installment', toBanglaDigits(document.getElementById('modal_payout_amount_num').value));
            setElementText('dps_payout_installment_bn_words', document.getElementById('modal_payout_amount_words').value);
        }

        // Institution Info Population
        setElementText('org_name_bn', document.getElementById('modal_org_name_bn').value);
        setElementText('org_name_en', document.getElementById('modal_org_name_en').value);
        setElementText('org_trade_license', toBanglaDigits(document.getElementById('modal_org_trade_license').value));
        const tradeDate = document.getElementById('modal_org_trade_date').value;
        if (tradeDate) {
            const [y, m, d] = tradeDate.split('-');
            setElementText('org_trade_date', toBanglaDigits(`${d}/${m}/${y}`));
        }
        setElementText('org_trade_authority', document.getElementById('modal_org_trade_authority').value);
        setElementText('org_reg_no', toBanglaDigits(document.getElementById('modal_org_reg_no').value));
        const regDate = document.getElementById('modal_org_reg_date').value;
        if (regDate) {
            const [y, m, d] = regDate.split('-');
            setElementText('org_reg_date', toBanglaDigits(`${d}/${m}/${y}`));
        }
        setElementText('org_reg_authority', document.getElementById('modal_org_reg_authority').value);
        setElementText('org_registered_addr', document.getElementById('modal_org_registered_addr').value);
        setElementText('org_bin', toBanglaDigits(document.getElementById('modal_org_bin').value));
        setElementText('org_tin', toBanglaDigits(document.getElementById('modal_org_tin').value));
        setElementText('org_office_addr', document.getElementById('modal_org_office_addr').value);

        // Institution Type Dropdown to Ticks
        const orgType = document.getElementById('modal_org_type').value;
        ['sole', 'partnership', 'joint', 'pvt', 'pub', 'trust', 'ngo', 'club', 'edu', 'religious', 'others'].forEach(t => setCheck('org_type_' + t, false));
        setElementText('org_type_others_input', '');
        if (orgType) {
            setCheck('org_type_' + orgType, true);
            if (orgType === 'others') setElementText('org_type_others_input', document.getElementById('modal_org_type_others').value);
        }

        // Business Type Dropdown to Ticks
        const bizType = document.getElementById('modal_biz_type').value;
        ['trading', 'service', 'manufacturing', 'others'].forEach(t => setCheck('biz_type_' + t, false));
        setElementText('biz_type_others_input', '');
        if (bizType) {
            setCheck('biz_type_' + bizType, true);
            if (bizType === 'others') setElementText('biz_type_others_input', document.getElementById('modal_biz_type_others').value);
        }

        setElementText('org_biz_nature', document.getElementById('modal_org_biz_nature').value);
        setElementText('org_turnover', toBanglaDigits(document.getElementById('modal_org_turnover').value));

        // Dynamic Applicant Info Population (Segment: Person Info)
        const personEntries = document.querySelectorAll('.person-entry');
        if (personEntries.length > 0) {
            const p = personEntries[0]; // Populating the first applicant to Page 3
            const getVal = (cls) => p.querySelector('.' + cls).value;

            setElementText('applicant_name_bn', getVal('modal_name_bn'));
            setElementText('applicant_name_en', getVal('modal_name_en'));
            setElementText('applicant_father_name_bn', getVal('modal_father'));
            setElementText('applicant_mother_name_bn', getVal('modal_mother'));
            setElementText('applicant_spouse_name_bn', getVal('modal_spouse'));

            let natVal = getVal('modal_nationality');
            if (natVal === 'other') natVal = p.querySelector('.modal_nationality_other')?.value || '';
            setElementText('applicant_nationality', natVal);

            setElementText('applicant_profession', getVal('modal_profession'));
            setElementText('applicant_monthly_income', toBanglaDigits(getVal('modal_income')));
            setElementText('applicant_fund_source', getVal('modal_source'));
            setElementText('applicant_mobile', toBanglaDigits(getVal('modal_curr_phone')));
            setElementText('applicant_nid', toBanglaDigits(getVal('modal_id_number')));
            setElementText('applicant_tin', toBanglaDigits(getVal('modal_tin')));

            const dobVal = getVal('modal_dob');
            if (dobVal) {
                const [y, m, d] = dobVal.split('-');
                setElementText('applicant_dob', toBanglaDigits(`${d}/${m}/${y}`));
            }

            // Address Mapping (Page 3)
            setElementText('applicant_curr_addr_village', getVal('modal_curr_road'));
            setElementText('applicant_curr_addr_post', getVal('modal_curr_post'));
            setElementText('applicant_curr_addr_thana', getVal('modal_curr_thana'));
            setElementText('applicant_curr_addr_district', getVal('modal_curr_dist'));
            setElementText('applicant_email', getVal('modal_curr_email'));

            setElementText('applicant_perm_addr_village', getVal('modal_perm_road'));
            setElementText('applicant_perm_addr_post', getVal('modal_perm_post'));
            setElementText('applicant_perm_addr_thana', getVal('modal_perm_thana'));
            setElementText('applicant_perm_addr_district', getVal('modal_perm_dist'));
            setElementText('applicant_perm_phone', toBanglaDigits(getVal('modal_perm_phone')));
            setElementText('applicant_perm_email', getVal('modal_perm_email'));

            // Gender & Resident (Page 3)
            const gender = p.querySelector('.modal_gender').value;
            ['male', 'female', 'third'].forEach(t => setCheck('applicant_gender_' + t, false));
            if (gender) setCheck('applicant_gender_' + gender, true);

            const resStatus = p.querySelector('.modal_resident').value;
            ['resident', 'nonresident'].forEach(t => setCheck('applicant_resident_status_' + t, false));
            if (resStatus) {
                const targetResId = resStatus === 'nonres' ? 'applicant_resident_status_nonresident' : 'applicant_resident_status_resident';
                setCheck(targetResId, true);
            }

            // Photo Rendering
            const photoVal = p.querySelector('.modal_photo_data')?.value || '';
            const imgEl = document.getElementById('applicant_photo');
            const textEl = document.getElementById('applicant_photo_text');
            if (imgEl && photoVal) {
                imgEl.src = photoVal;
                imgEl.style.display = 'block';
                if (textEl) textEl.style.display = 'none';
            } else if (imgEl) {
                imgEl.src = '';
                imgEl.style.display = 'none';
                if (textEl) textEl.style.display = 'block';
            }
        }

        // KYC Profile Population (Page 5 & 6)
        setElementText('kyc_account_name', titleEn);
        const natureMap = { 'fd': 'স্থায়ী আমানত', 'scheme': 'সঞ্চয়ী/বিশেষ স্কিম' };
        setElementText('kyc_account_nature', natureMap[depositType] || '');
        setElementText('kyc_biz_nature', document.getElementById('modal_org_biz_nature').value);
        setElementText('kyc_net_worth', toBanglaDigits(document.getElementById('modal_org_turnover').value));
        setElementText('kyc_fund_source', document.getElementById('modal_applicant_fund_source')?.value || '');
        setElementText('kyc_source_verification', document.getElementById('modal_kyc_source_docs').value);
        setElementText('kyc_address_verification', document.getElementById('modal_kyc_addr_verify').value);

        const beneficialOwnerVal = document.getElementById('modal_kyc_beneficial_owner').value;
        setCheck('kyc_beneficial_owner_yes', beneficialOwnerVal === 'yes');
        setCheck('kyc_beneficial_owner_no', beneficialOwnerVal === 'no');

        // KYC Point 10: Non-Resident Info
        setElementText('kyc_opening_purpose', document.getElementById('modal_kyc_purpose').value);
        setElementText('kyc_visa_type', document.getElementById('modal_kyc_visa_type').value);
        const visaExpiry = document.getElementById('modal_kyc_visa_expiry').value;
        if (visaExpiry) {
            const [vy, vm, vd] = visaExpiry.split('-');
            setElementText('kyc_visa_expiry_date', toBanglaDigits(`${vd}/${vm}/${vy}`));
        }

        const wpApproval = document.getElementById('modal_kyc_work_permit_approval').value;
        setCheck('kyc_work_permit_yes', wpApproval === 'yes');
        setCheck('kyc_work_permit_no', wpApproval === 'no');

        // Identity Document Sync (Applicant 1 to KYC Page 5)
        if (personEntries.length > 0) {
            const p = personEntries[0];
            const idNum = p.querySelector('.modal_id_number').value;

            // Clear all ID values first
            ['passport', 'nid', 'birth', 'tin', 'vat', 'reg', 'other'].forEach(type => {
                setElementText(`kyc_id_${type}_value`, '');
                setCheck(`kyc_id_${type}_copy_checked`, false);
                setCheck(`kyc_id_${type}_verify_checked`, false);
            });

            const idType = p.querySelector('.modal_id_type').value;
            if (idNum && idType) {
                const fieldId = `kyc_id_${idType}_value`;
                setElementText(fieldId, toBanglaDigits(idNum));
                setCheck(`kyc_id_${idType}_copy_checked`, true);
                setCheck(`kyc_id_${idType}_verify_checked`, true);
            }

            // Populate Gender and Resident Status (Primary Applicant Page 3)
            const gender = p.querySelector('.modal_gender').value;
            ['male', 'female', 'third'].forEach(t => setCheck('applicant_gender_' + t, false));
            if (gender) setCheck('applicant_gender_' + gender, true);

            const res = p.querySelector('.modal_resident').value;
            ['resident', 'nonresident'].forEach(t => setCheck('applicant_resident_status_' + t, false));
            if (res) {
                const targetResId = res === 'nonres' ? 'applicant_resident_status_nonresident' : 'applicant_resident_status_resident';
                setCheck(targetResId, true);
            }

            // Non-Resident Status
            const resStatus = p.querySelector('.modal_resident').value;
            if (resStatus === 'nonres') {
                // Visa and Work Permit details for non-residents
                setElementText('kyc_visa_type', p.querySelector('.modal_visa_type').value);
                const workPermit = p.querySelector('.modal_work_permit').value;
                setCheck('kyc_work_permit_yes', workPermit === 'yes');
                setCheck('kyc_work_permit_no', workPermit === 'no');
            }
        }

        // Institution KYC documents (Point 9 on Page 5)
        const orgTin = document.getElementById('modal_org_tin').value;
        if (orgTin) {
            setElementText('kyc_id_tin_value', toBanglaDigits(orgTin));
            setCheck('kyc_id_tin_copy_checked', true);
            setCheck('kyc_id_tin_verify_checked', true);
        }

        const orgBin = document.getElementById('modal_org_bin').value;
        if (orgBin) {
            setElementText('kyc_id_vat_value', toBanglaDigits(orgBin));
            setCheck('kyc_id_vat_copy_checked', true);
            setCheck('kyc_id_vat_verify_checked', true);
        }

        const orgReg = document.getElementById('modal_org_reg_no').value;
        if (orgReg) {
            setElementText('kyc_id_reg_value', toBanglaDigits(orgReg));
            setCheck('kyc_id_reg_copy_checked', true);
            setCheck('kyc_id_reg_verify_checked', true);
        }

        const orgOtherText = document.getElementById('modal_org_type_others').value || document.getElementById('modal_biz_type_others').value;
        if (orgOtherText) {
            setElementText('kyc_id_other_value', orgOtherText);
            setCheck('kyc_id_other_copy_checked', true);
            setCheck('kyc_id_other_verify_checked', true);
        }

        // PEP & Sanction (Page 6)
        const pepVal = document.getElementById('modal_kyc_pep').value;
        setCheck('kyc_pep_status_yes', pepVal === 'yes');
        setCheck('kyc_pep_status_no', pepVal === 'no');
        if (pepVal === 'yes') {
            const appVal = document.getElementById('modal_kyc_pep_approval').value;
            setCheck('kyc_pep_approval_yes', appVal === 'yes');
            setCheck('kyc_pep_approval_no', appVal === 'no');
            const intVal = document.getElementById('modal_kyc_pep_interview').value;
            setCheck('kyc_pep_interview_yes', intVal === 'yes');
            setCheck('kyc_pep_interview_no', intVal === 'no');
        } else {
            ['approval_yes', 'approval_no', 'interview_yes', 'interview_no'].forEach(x => setCheck(`kyc_pep_${x}`, false));
        }

        const sancVal = document.getElementById('modal_kyc_sanction').value;
        setCheck('kyc_sanction_list_yes', sancVal === 'yes');
        setCheck('kyc_sanction_list_no', sancVal === 'no');
        if (sancVal === 'yes') {
            setElementText('kyc_sanction_action_details', document.getElementById('modal_kyc_sanction_details').value);
        }

        // Introducer Population (Segment: Introducer Info)
        setElementText('introducer_other_info', toBanglaDigits(document.getElementById('modal_introducer_other_id')?.value || ''));
        const introName = document.getElementById('modal_introducer_name')?.value || '';
        const introAcc = document.getElementById('modal_introducer_acc_details')?.value || '';
        const introNid = document.getElementById('modal_intro_nid')?.value || '';
        const introDob = document.getElementById('modal_intro_dob')?.value || '';

        setElementText('introducer_name', introName);

        let introStr = [];
        if (introAcc) introStr.push(introAcc);
        if (introNid) introStr.push(introNid);
        if (introDob) {
            const [y, m, d] = introDob.split('-');
            introStr.push(`${d}/${m}/${y}`);
        }
        setElementText('introducer_acc_details', toBanglaDigits(introStr.join(', ')));

        // Main Applicant Minor Info
        setElementText('applicant_minor_guardian_name', document.getElementById('modal_minor_guardian_name').value);
        setElementText('applicant_minor_guardian_relationship', document.getElementById('modal_minor_guardian_rel').value);

        // Special Instructions
        setElementText('special_instruction_1', document.getElementById('modal_special_instruction_1_input').value);
        setElementText('special_instruction_2', document.getElementById('modal_special_instruction_2_input').value);
        setElementText('special_instruction_3', document.getElementById('modal_special_instruction_3_input').value);

        // Signature Table Name Population
        for (let i = 0; i < Math.min(personEntries.length, 5); i++) {
            const name = personEntries[i].querySelector('.modal_name_bn').value || '';
            const nameCell = document.getElementById(`applicant_signature_name_${i + 1}`);
            if (nameCell) {
                nameCell.innerText = name;
            }
        }

        // Nominee Population (Segment: Nominee Info)
        const nomineeEntries = document.querySelectorAll('.nominee-entry');
        if (nomineeEntries.length > 0) {
            const n = nomineeEntries[0]; // First nominee
            const getVal = (cls) => n.querySelector('.' + cls).value;

            setElementText('nominee_1_name', getVal('modal_nom_name'));
            const nomDobVal = getVal('modal_nom_dob');
            if (nomDobVal) {
                const [y, m, d] = nomDobVal.split('-');
                setElementText('nominee_1_dob', toBanglaDigits(`${d}/${m}/${y}`));
            }
            setElementText('nominee_1_addr', getVal('modal_nom_addr'));
            setElementText('nominee_1_rel', getVal('modal_nom_rel'));
            setElementText('nominee_1_pct', toBanglaDigits(getVal('modal_nom_pct')));
            setElementText('nominee_1_id', toBanglaDigits(getVal('modal_nom_id')));
        }

        // Guardian Info (if minor)
        const guardianSection = document.getElementById('guardian_section');
        if (guardianSection && guardianSection.style.display !== 'none') {
            const gContainer = document.getElementById('guardian_container');
            const firstGuardian = gContainer.querySelector('.guardian-entry');
            if (firstGuardian) {
                const getVal = (cls) => firstGuardian.querySelector('.' + cls).value;
                setElementText('nominee_1_guardian_name', getVal('guardian_name'));
                setElementText('nominee_1_guardian_addr', getVal('guardian_address'));
                setElementText('nominee_1_guardian_rel', getVal('guardian_relationship'));

                const gIdType = getVal('guardian_id_type');
                const gIdNum = getVal('guardian_id_number');
                let idDisplay = '';
                if (gIdType && gIdNum) {
                    const idTypeLabel = { 'nid': 'এনআইডি', 'passport': 'পাসপোর্ট', 'birth': 'জন্ম নিবন্ধন' }[gIdType] || gIdType;
                    idDisplay = `${idTypeLabel}: ${gIdNum}`;
                }
                setElementText('nominee_1_guardian_id', idDisplay);
            }
        }

        // Risk Assessment Summary
        populateRiskRating();

        // Populate Page Banners (Account No & CID)
        const accNum = (document.getElementById('modal_account_no').value || '').replace(/\D/g, '');
        const bnAcc = toBanglaDigits(accNum);
        const fmtAcc = (typeof formatAccNo === 'function') ? formatAccNo(accNum) : bnAcc;
        if (accNum) {
            distributeDigits(document.querySelectorAll('#account_no_banner_p2 .box-input-p3'), bnAcc);
            distributeDigits(document.querySelectorAll('#account_no_header_p4 .box-input-p3'), bnAcc);
            distributeDigits(document.querySelectorAll('#account_no_banner_p5 .box-input-p3'), bnAcc);
            setElementText('account_no_p1', fmtAcc);

            const shortAcc = bnAcc.substring(8, 13);
            setElementText('photo_acc_num_display', shortAcc);
            setElementText('nominee_acc_num_display', shortAcc);
        }

        const uniqueId = document.getElementById('modal_unique_customer_id').value || '';
        const bnCID = toBanglaDigits(uniqueId);
        if (uniqueId) {
            distributeDigits(document.querySelectorAll('#customer_id_banner_p2 .box-input-p3'), bnCID);
            distributeDigits(document.querySelectorAll('#customer_id_banner_p5 .box-input-p3'), bnCID);
            setElementText('unique_customer_id_p1', bnCID);
        }

        // Auto-close modal after populating
        console.log("Form population complete.");
        if (typeof appToast === 'function') {
            appToast("Form populated successfully!");
        } else if (window.parent && typeof window.parent.showAppToast === 'function') {
            window.parent.showAppToast("Form populated successfully!");
        }
    }

    function setCheck(id, checked) {
        document.querySelectorAll('[id="' + id + '"]').forEach(el => {
            el.innerText = checked ? '✓' : '';
        });
    }

    function saveModalData() {
        const data = {};
        // Static Inputs
        document.querySelectorAll('#dataEntryModal input, #dataEntryModal select').forEach(el => {
            if (el.id && el.type !== 'radio') data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });

        // Dynamic Persons
        data.persons = [];
        document.querySelectorAll('.person-entry').forEach(p => {
            const pData = {};
            p.querySelectorAll('input, select').forEach(el => pData[el.className] = el.type === 'checkbox' ? el.checked : el.value);
            data.persons.push(pData);
        });

        // Dynamic Nominees
        data.nominees = [];
        document.querySelectorAll('.nominee-entry').forEach(n => {
            const nData = {};
            n.querySelectorAll('input, select').forEach(el => nData[el.className] = el.value);
            data.nominees.push(nData);
        });

        data.addedRisks = addedRisks;
        window.AppStorage.setItem('bkb_dps_mss_modal_cache', JSON.stringify(data));
        appToast('Data saved to local browser cache.');
    }

    // Add listeners for auto-maturity calculation
    document.getElementById('modal_app_date')?.addEventListener('change', calculateMaturityDate);
    document.getElementById('modal_app_date')?.addEventListener('change', calculateInstallmentCount);

    // Logic for Interest Rate % auto-generation
    const fdRateInput = document.getElementById('modal_dps_fd_rate');
    if (fdRateInput) {
        fdRateInput.addEventListener('blur', function () {
            let val = this.value.trim();
            if (val && !val.endsWith('%')) {
                this.value = val + '%';
            }
        });
        fdRateInput.addEventListener('focus', function () {
            this.value = this.value.replace('%', '');
        });
    }

    document.getElementById('modal_tenor_y')?.addEventListener('input', calculateMaturityDate);
    document.getElementById('modal_tenor_m')?.addEventListener('input', calculateMaturityDate);
    document.getElementById('modal_tenor_d')?.addEventListener('input', calculateMaturityDate);

    function clearModal() {
        if (typeof appConfirm === 'function') {
            appConfirm('সকল ডেটা মুছবেন?', function () {
                executeClearModal();
            });
        } else {
            if (confirm('সকল ডেটা মুছবেন?')) executeClearModal();
        }
    }

    function executeClearModal() {
        document.querySelectorAll('#dataEntryModal input, #dataEntryModal textarea').forEach(i => {
            if (i.type === 'checkbox' || i.type === 'radio') i.checked = false;
            else i.value = '';
        });
        document.querySelectorAll('#dataEntryModal select').forEach(s => s.selectedIndex = 0);
        
        const riskTbody = document.getElementById('modal_risk_summary_table')?.querySelector('tbody');
        if (riskTbody) riskTbody.innerHTML = '';
        if (typeof addedRisks !== 'undefined') addedRisks = [];

        const pContainer = document.getElementById('person_container');
        if (pContainer) { pContainer.innerHTML = ''; if (typeof addPerson === 'function') addPerson(); }
        const nContainer = document.getElementById('nominee_container');
        if (nContainer) { nContainer.innerHTML = ''; if (typeof addNominee === 'function') addNominee(); }
        const gContainer = document.getElementById('guardian_container');
        if (gContainer) { gContainer.innerHTML = ''; }
        
        const pImg = document.getElementById('applicant_photo');
        if (pImg) { pImg.src = ''; pImg.style.display = 'none'; }
        const pTxt = document.getElementById('applicant_photo_text');
        if (pTxt) pTxt.style.display = 'block';
    }
    function toggleTick(el) { el.innerText = el.innerText === '✓' ? '' : '✓'; }

    function populateFromCustomer(data) {
        if (!data) return;

        try {
            openModal();

            // Wait a tick for modal to render
            setTimeout(() => {
                const personContainer = document.getElementById('person_container');
                if (personContainer && personContainer.children.length === 0) {
                    addPerson();
                }


                const mapping = {
                    'applicant_name_bn': 'modal_name_bn',
                    'applicant_name_en': 'modal_name_en',
                    'applicant_dob': 'modal_dob',
                    'applicant_father_name_bn': 'modal_father',
                    'applicant_mother_name_bn': 'modal_mother',
                    'applicant_spouse_name_bn': 'modal_spouse',
                    'applicant_nationality': 'modal_nationality',
                    'applicant_nid': 'modal_id_number',
                    'applicant_nid_10': 'modal_id_number',
                    'applicant_mobile': 'modal_curr_phone',
                    'applicant_email': 'modal_curr_email',
                    'applicant_curr_addr_village': 'modal_curr_road',
                    'applicant_curr_addr_district': 'modal_curr_dist',
                    'applicant_present_district': 'modal_curr_dist',
                    'applicant_curr_addr_post_code': 'modal_curr_post',
                    'applicant_curr_addr_thana': 'modal_curr_thana',
                    'applicant_present_upozila': 'modal_curr_thana',
                    'applicant_perm_addr_village': 'modal_perm_road',
                    'applicant_perm_addr_district': 'modal_perm_dist',
                    'applicant_permanent_district': 'modal_perm_dist',
                    'applicant_perm_district': 'modal_perm_dist',
                    'applicant_perm_addr_post_code': 'modal_perm_post',
                    'applicant_perm_addr_thana': 'modal_perm_thana',
                    'applicant_permanent_upozila': 'modal_perm_thana',
                    'applicant_perm_upozila': 'modal_perm_thana',
                    'applicant_profession': 'modal_profession',
                    'photo': 'modal_photo_data',

                    // Institution Info Mapping
                    'org_name_bn': 'modal_org_name_bn',
                    'org_name_en': 'modal_org_name_en',
                    'org_trade_license': 'modal_org_trade_license',
                    'org_trade_date': 'modal_org_trade_date',
                    'org_trade_authority': 'modal_org_trade_authority',
                    'org_reg_no': 'modal_org_reg_no',
                    'org_reg_date': 'modal_org_reg_date',
                    'org_reg_authority': 'modal_org_reg_authority',
                    'org_registered_addr': 'modal_org_registered_addr',
                    'org_bin': 'modal_org_bin',
                    'org_tin': 'modal_org_tin',
                    'org_office_addr': 'modal_org_office_addr',
                    'org_type': 'modal_org_type',
                    'org_biz_nature': 'modal_org_biz_nature',
                    'org_turnover': 'modal_org_turnover'
                };


                const firstPersonEntry = personContainer ? personContainer.children[0] : null;
                if (firstPersonEntry) {
                    Object.keys(mapping).forEach(key => {
                        let mappedValue = data[key] || data[key.replace('_10', '')]; // Fallback
                        if (key === 'applicant_curr_addr_village') {
                            const house = (data.applicant_curr_addr_house || data.curr_addr_house_en || '').trim();
                            const village = (data.applicant_curr_addr_village || data.curr_addr_village_en || '').trim();
                            if (house && village) {
                                mappedValue = house + ', ' + village;
                            } else if (house) {
                                mappedValue = house;
                            } else {
                                mappedValue = village;
                            }
                        }
                        if (key === 'applicant_occupation') {
                            let parts = [];
                            if (data.occupation_type) parts.push(data.occupation_type);
                            if (data.occupation_bn) parts.push(data.occupation_bn);
                            mappedValue = parts.join(', ');
                        }
                        if (mappedValue !== undefined && mappedValue !== null && mappedValue !== '') {
                            const el = firstPersonEntry.querySelector('.' + mapping[key]);
                            if (el) {
                                el.value = mappedValue;
                                if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change'));
                            }
                        }
                    });

                    if (data.applicant_resident_status_nonresident === 'true') {
                        const rSelect = firstPersonEntry.querySelector('.modal_resident');
                        if (rSelect) rSelect.value = 'non_resident';
                    } else if (data.applicant_resident_status) {
                        const rSelect = firstPersonEntry.querySelector('.modal_resident');
                        if (rSelect) rSelect.value = data.applicant_resident_status.toLowerCase() === 'resident' ? 'resident' : 'non_resident';
                    } else if (data.applicant_resident_status_resident === 'true') {
                        const rSelect = firstPersonEntry.querySelector('.modal_resident');
                        if (rSelect) rSelect.value = 'resident';
                    }

                    if (data.applicant_gender) {
                        const genderMap = { 'M': 'male', 'F': 'female', 'O': 'third', 'Male': 'male', 'Female': 'female', 'Third': 'third', 'Other': 'third' };
                        const gSelect = firstPersonEntry.querySelector('.modal_gender');
                        if (gSelect) {
                            if (genderMap[data.applicant_gender]) {
                                gSelect.value = genderMap[data.applicant_gender];
                            } else {
                                gSelect.value = data.applicant_gender.toLowerCase();
                            }
                        }
                    }

                    const idTypeSelect = firstPersonEntry.querySelector('.modal_id_type');
                    const idNumInput = firstPersonEntry.querySelector('.modal_id_number');
                    if (idTypeSelect && idNumInput) {
                        let idTypeToSelect = '';
                        let idValToSet = '';

                        const nid10 = (data.applicant_nid_10 || '').trim();
                        const nid17 = (data.applicant_nid_17 || '').trim();
                        const passport = (data.applicant_passport_no || '').trim();
                        const birth = (data.applicant_birth_reg_no || '').trim();
                        const mainNid = (data.applicant_nid || '').trim();

                        if (nid10) {
                            idTypeToSelect = 'nid';
                            idValToSet = nid10;
                        } else if (nid17) {
                            idTypeToSelect = 'nid';
                            idValToSet = nid17;
                        } else if (mainNid && mainNid.length >= 10 && !mainNid.startsWith('TEMP-')) {
                            idTypeToSelect = 'nid';
                            idValToSet = mainNid;
                        } else if (birth) {
                            idTypeToSelect = 'birth';
                            idValToSet = birth;
                        } else if (passport) {
                            idTypeToSelect = 'passport';
                            idValToSet = passport;
                        }

                        if (idTypeToSelect) {
                            idTypeSelect.value = idTypeToSelect;
                            if (typeof updateIdInput === 'function') updateIdInput(idTypeSelect);
                            idNumInput.value = idValToSet;
                            idTypeSelect.dispatchEvent(new Event('change'));
                            idNumInput.dispatchEvent(new Event('input'));
                        }
                    }
                }

                if (data.applicant_name_bn) document.getElementById('modal_account_title_bn').value = data.applicant_name_bn;
                if (data.applicant_name_en) document.getElementById('modal_account_title_en').value = data.applicant_name_en;
                if (data.customer_id) document.getElementById('modal_unique_customer_id').value = data.customer_id;

                applyData();
                openModal();
            }, 100);
        } catch (err) {
            console.error('Error populating customer data:', err);
        }
    }

    // Suite Integration: Logic Export
    window.DPSMSSFormLogic = {
        openModal: openModal,
        startNewForm: () => { appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); }); },
        clearForm: () => { appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); }); },
        clearData: () => { appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); }); },
        populate: populateFromCustomer,
        saveForm: saveModalData,
        saveWork: () => { appToast('Document state saved to browser storage.'); },
        loadWork: () => { appToast('Restoring previous state...'); }
    };

    function setElementText(id, val) {
        document.querySelectorAll('[id="' + id + '"]').forEach(el => {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = val;
            else el.innerText = val;
        });
    }

    // Auto-resize font to fit box width
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.addEventListener('input', function () {
            let fontSize = parseInt(window.getComputedStyle(this).fontSize);
            while (this.scrollWidth > this.clientWidth && fontSize > 6) {
                fontSize--;
                this.style.fontSize = fontSize + 'px';
            }
        });
    });

    // Suite Integration: Branch Sync Logic
    let currentBranchCode = "";

    window.setBranchCode = function (code) {
        if (window.parent && typeof window.parent.getCentralBranchData === 'function') {
            const bData = window.parent.getCentralBranchData();
            const branchName = bData.nameBn || '';

            // Update branch name in ribbon and other places
            setElementText('branch_name', branchName);
            document.querySelectorAll('.branch-name-input').forEach(el => {
                if (el.tagName === 'INPUT') el.value = branchName;
                else el.innerText = branchName;
            });
        }

        if (!code || code === "undefined") return;

        currentBranchCode = code.toString().substring(0, 4);
        const bnCode = toBanglaDigits(currentBranchCode);

        // 1. Update Page 1 (main form fields)
        const p1Acc = document.getElementById('account_no_p1');
        if (p1Acc && (!p1Acc.value || !p1Acc.value.startsWith(bnCode))) {
            p1Acc.value = bnCode + toBanglaDigits(toEnglishDigits(p1Acc.value).replace(/\D/g, '').substring(4, 14));
        }
        const p1Cid = document.getElementById('unique_customer_id_p1');
        if (p1Cid && (!p1Cid.value || !p1Cid.value.startsWith(bnCode))) {
            p1Cid.value = bnCode + toBanglaDigits(toEnglishDigits(p1Cid.value).replace(/\D/g, '').substring(4, 10));
        }

        // 2. Update Banners (Page 2 and Page 5)
        ['account_no_banner_p2', 'customer_id_banner_p2', 'account_no_banner_p5', 'customer_id_banner_p5'].forEach(bannerId => {
            const banner = document.getElementById(bannerId);
            if (banner) {
                const inputs = banner.querySelectorAll('.box-input-p3');
                inputs.forEach((inp, i) => {
                    if (i < 4) {
                        inp.value = bnCode[i] || '';
                        inp.readOnly = true;
                        inp.classList.add('locked-digit');
                    }
                });
            }
        });

        // 3. Update Page 4 Header Account Number
        const p4HeaderAccInputs = document.querySelectorAll('#account_no_header_p4 .box-input-p3');
        p4HeaderAccInputs.forEach((inp, i) => {
            if (i < 4) {
                inp.value = bnCode[i] || '';
                inp.readOnly = true;
                inp.classList.add('locked-digit');
            }
        });

        ['modal_account_no', 'modal_unique_customer_id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const raw = el.value.replace(/\D/g, '');
                if (!raw.startsWith(currentBranchCode)) {
                    const suffix = raw.substring(currentBranchCode.length) || '';
                    const combined = currentBranchCode + suffix;
                    el.value = combined.length > 4
                        ? combined.substring(0, 4) + '-' + combined.substring(4)
                        : combined;
                }
            }
        });
    };

    function syncBranchState() {
        if (window.parent && typeof window.parent.getCentralBranchCode === 'function') {
            window.setBranchCode(window.parent.getCentralBranchCode());
        } else if (window.parent) {
            setTimeout(syncBranchState, 500);
        }
    }
    window.addEventListener('load', () => {
        syncBranchState();
        const pContainer = document.getElementById('person_container');
        if (pContainer && pContainer.children.length === 0) addPerson();
        const nContainer = document.getElementById('nominee_container');
        if (nContainer && nContainer.children.length === 0) addNominee();

        // Auto-hyphen for Account Number field: format as XXXX-XXXXXXXXXX
        const accNoInput = document.getElementById('modal_account_no');
        if (accNoInput) {
            accNoInput.addEventListener('keydown', (e) => {
                const pos = accNoInput.selectionStart;
                if (pos <= 5 && (e.key === 'Backspace' || e.key === 'Delete')) e.preventDefault();
            });
            accNoInput.addEventListener('input', () => {
                let digits = accNoInput.value.replace(/\D/g, '');
                if (digits.length > 14) digits = digits.substring(0, 14);
                accNoInput.value = digits.length > 4
                    ? digits.substring(0, 4) + '-' + digits.substring(4)
                    : digits;
            });
        }
    });



    // Hub Communication Bridge
    // Dynamic Section Logic (Segment: Person Info)
    function createPersonHTML(index) {
        return `
        <div class="entry-section person-entry">
            ${index > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <span style="font-weight:bold; color:var(--bank-green);">Applicant-${index + 1}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="fbtn-data" onclick="pullCustomerForSlot(this)" 
                        >
                        &#128269; Pull Customer Data
                    </button>
                    <button type="button" class="fbtn-remove" onclick="removeSection(this)"
                        >
                        Remove (-)
                    </button>
                </div>
            </div>` : ''}
            <input type="hidden" class="modal_photo_data">
            <div class="form-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <div class="form-group" style="grid-column: span 2;"><label>নাম (বাংলায়)</label><input type="text" class="modal_name_bn"></div>
                <div class="form-group" style="grid-column: span 2;"><label>নাম (ইংরেজি)</label><input type="text" class="modal_name_en" oninput="this.value = this.value.toUpperCase()"></div>
                <div class="form-group" style="grid-column: span 2;"><label>পিতার নাম</label><input type="text" class="modal_father"></div>
                <div class="form-group" style="grid-column: span 2;"><label>মাতার নাম</label><input type="text" class="modal_mother"></div>
                <div class="form-group" style="grid-column: span 2;"><label>স্বামী/স্ত্রীর নাম</label><input type="text" class="modal_spouse"></div>
                <div class="form-group"><label>জাতীয়তা</label>
                    <select class="modal_nationality" onchange="if(this.value==='other'){ this.nextElementSibling.style.display='block'; } else { this.nextElementSibling.style.display='none'; }">
                        <option value="">নির্বাচন করুন</option><option value="বাংলাদেশী">বাংলাদেশী</option><option value="other">অন্যান্য</option>
                    </select>
                    <input type="text" class="modal_nationality_other" placeholder="জাতীয়তা উল্লেখ করুন" style="display:none; margin-top:5px;">
                </div>
                <div class="form-group"><label>আইডির ধরণ</label>
                    <select class="modal_id_type" onchange="updateIdInput(this)">
                        <option value="">নির্বাচন করুন</option><option value="nid">এনআইডি</option><option value="birth">জন্মনিবন্ধন</option><option value="passport">পাসপোর্ট</option>
                    </select>
                </div>
                <div class="form-group"><label>আইডি নম্বর</label><input type="text" class="modal_id_number" placeholder="নম্বর এখানে লিখুন"></div>
                <div class="form-group"><label>জন্ম তারিখ</label><input type="date" class="modal_dob"></div>
                <div class="form-group"><label>লিঙ্গ</label>
                    <select class="modal_gender">
                        <option value="">নির্বাচন করুন</option><option value="male">পুরুষ</option><option value="female">মহিলা</option><option value="third">তৃতীয়</option>
                    </select>
                </div>
                <div class="form-group"><label>টিআইএন</label><input type="text" class="modal_tin" oninput="this.value = this.value.replace(/[^0-9]/g, '')"></div>
                <div class="form-group"><label>রেসিডেন্ট স্ট্যাটাস</label>
                    <select class="modal_resident" onchange="toggleNonResidentFields(this)">
                        <option value="">নির্বাচন করুন</option><option value="resident">রেসিডেন্ট</option><option value="nonres">নন রেসিডেন্ট</option>
                    </select>
                </div>
                <div class="form-group modal_visa_type_group" style="display:none;"><label>ভিসার প্রকৃতি--মেয়াদ</label><input type="text" class="modal_visa_type"></div>
                <div class="form-group modal_work_permit_group" style="display:none;"><label>কর্মানুমতি আছে/নাই</label>
                    <select class="modal_work_permit"><option value="">নির্বাচন করুন</option><option value="yes">হ্যাঁ</option><option value="no">না</option></select>
                </div>
                <div class="form-group"><label>পেশা</label><input type="text" class="modal_profession"></div>
                <div class="form-group"><label>মাসিক আয়</label><input type="text" class="modal_income" oninput="this.value = this.value.replace(/[^0-9]/g, '')"></div>
                <div class="form-group"><label>আয়ের উৎস</label><input type="text" class="modal_source"></div>
                <div class="full-width" style="grid-column: span 4; font-weight:bold; margin-top:5px; border-bottom: 1px solid #eee;">বর্তমান ঠিকানা</div>
                <div class="form-group" style="grid-column: span 2;"><label>রোড/গ্রাম</label><input type="text" class="modal_curr_road"></div>
                <div class="form-group"><label>পোস্ট</label><input type="text" class="modal_curr_post"></div>
                <div class="form-group"><label>থানা</label><input type="text" class="modal_curr_thana"></div>
                <div class="form-group"><label>জেলা</label><input type="text" class="modal_curr_dist"></div>
                <div class="form-group"><label>ফোন</label><input type="text" class="modal_curr_phone"></div>
                <div class="form-group" style="grid-column: span 2;"><label>ইমেইল</label><input type="text" class="modal_curr_email"></div>
                <div class="full-width" style="grid-column: span 4; font-weight:bold; margin-top:5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee;">
                    <span>স্থায়ী ঠিকানা</span>
                    <label style="font-weight: normal; font-size: 12px; cursor: pointer;"><input type="checkbox" class="same_as_current" onchange="copyAddress(this)"> বর্তমানের মতো</label>
                </div>
                <div class="form-group" style="grid-column: span 2;"><label>রোড/গ্রাম</label><input type="text" class="modal_perm_road"></div>
                <div class="form-group"><label>পোস্ট</label><input type="text" class="modal_perm_post"></div>
                <div class="form-group"><label>থানা</label><input type="text" class="modal_perm_thana"></div>
                <div class="form-group"><label>জেলা</label><input type="text" class="modal_perm_dist"></div>
                <div class="form-group"><label>ফোন</label><input type="text" class="modal_perm_phone"></div>
                <div class="form-group" style="grid-column: span 2;"><label>ইমেইল</label><input type="text" class="modal_perm_email"></div>
            </div>
        </div>`;
    }

    function createNomineeHTML(index) {
        return `
            <div class="entry-section nominee-entry" style="width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                    <span style="font-weight:bold; color:var(--bank-green);">Nominee-${index + 1}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button type="button" class="fbtn-data" onclick="pullCustomerForNominee(this)">
                            &#128269; Pull Customer Data
                        </button>
                        ${index > 0 ? `
                        <button type="button" class="fbtn-remove" onclick="removeSection(this)">
                            Remove (-)
                        </button>` : ''}
                    </div>
                </div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group"><label>Nominee Name</label><input type="text" class="modal_nom_name" oninput="this.value = this.value.toUpperCase()"></div>
                <div class="form-group"><label>Nominee DOB</label><input type="date" class="modal_nom_dob"></div>
                <div class="form-group"><label>Address</label><input type="text" class="modal_nom_addr"></div>
                <div class="form-group"><label>Relationship</label><input type="text" class="modal_nom_rel"></div>
                <div class="form-group"><label>Percentage (%)</label><input type="number" class="modal_nom_pct" placeholder="e.g. 50"></div>
                <div class="form-group"><label>Nominee ID</label><input type="text" class="modal_nom_id"></div>
            </div>
        </div>`;
    }

    function createGuardianHTML(index) {
        return `
        <div class="entry-section guardian-entry">
            <div style="font-weight:bold; color:var(--bank-green); margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">নমিনির পক্ষে আমানতের অর্থ গ্রহণকারী (Guardian)</div>
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group"><label>ক) নাম</label><input type="text" class="guardian_name"></div>
                <div class="form-group"><label>খ) স্থায়ী ঠিকানা</label><input type="text" class="guardian_address"></div>
                <div class="form-group"><label>গ) আইডি টাইপ</label><select class="guardian_id_type"><option value="">নির্বাচন করুন</option><option value="nid">এনআইডি</option><option value="passport">পাসপোর্ট নম্বর</option><option value="birth">জন্ম নিবন্ধন নম্বর</option></select></div>
                <div class="form-group"><label>আইডি নম্বর</label><input type="text" class="guardian_id_number"></div>
                <div class="form-group"><label>ঘ) সম্পর্ক</label><input type="text" class="guardian_relationship"></div>
            </div>
        </div>`;
    }

    function toggleNomineeSection() {
        const sec = document.getElementById('nominee_section');
        const btn = document.getElementById('btn-add-nominee');
        if (sec.style.display === 'none') {
            sec.style.display = 'block';
            btn.innerText = 'Hide Nominee Info';
        } else {
            sec.style.display = 'none';
            btn.innerText = '+ Add Nominee';
        }
    }

    function toggleNomineeMinor() {
        const sec = document.getElementById('guardian_section');
        sec.style.display = (sec.style.display === 'none') ? 'block' : 'none';
        if (sec.style.display === 'block' && document.getElementById('guardian_container').children.length === 0) addGuardian();
    }

    function addPerson() {
        const container = document.getElementById('person_container');
        const div = document.createElement('div');
        div.innerHTML = createPersonHTML(container.children.length);
        container.appendChild(div.firstElementChild);
    }

    // Context-aware customer pull for a specific applicant slot
    function pullCustomerForSlot(btn) {
        const personEntry = btn.closest('.person-entry');
        const container = document.getElementById('person_container');
        const index = Array.from(container.children).indexOf(personEntry);
        window.parent.postMessage({
            command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
            targetContext: 'person_' + index
        }, '*');
    }

    window.populatePersonSlot = function(idx, data) {
        const container = document.getElementById('person_container');
        if (!container) return;
        while (container.children.length <= idx) {
            if (typeof addPerson === 'function') addPerson();
        }
        const entry = container.children[idx];
        if (entry && typeof populatePersonEntry === 'function') {
            populatePersonEntry(entry, data);
        }
    };

    function populatePersonEntry(personEntry, data) {
        if (!personEntry || !data) return;

        const mapping = {
            'applicant_name_bn': 'modal_name_bn',
            'applicant_name_en': 'modal_name_en',
            'applicant_father_name_bn': 'modal_father',
            'applicant_mother_name_bn': 'modal_mother',
            'applicant_spouse_name_bn': 'modal_spouse',
            'applicant_dob': 'modal_dob',
            'applicant_nid': 'modal_id_number',
            'applicant_nid_10': 'modal_id_number',
            'applicant_phone': 'modal_phone',
            'applicant_curr_addr_village': 'modal_addr',
            'applicant_tin': 'modal_tin',
            'applicant_gender': 'modal_gender',
            'applicant_resident_status': 'modal_resident',
            'photo': 'modal_photo_data'
        };

        Object.keys(mapping).forEach(key => {
            let mappedValue = data[key] || data[key.replace('_10', '')];
            if (key === 'applicant_curr_addr_village') {
                const house = (data.applicant_curr_addr_house || data.curr_addr_house_en || '').trim();
                const vill = (data.applicant_curr_addr_village || data.curr_addr_village_en || '').trim();
                const po = (data.applicant_curr_addr_po || data.curr_addr_po_en || '').trim();
                const uz = (data.applicant_curr_addr_upazila || data.curr_addr_upazila_en || '').trim();
                const dist = (data.applicant_curr_addr_dist || data.curr_addr_dist_en || '').trim();
                const parts = [house, vill, po, uz, dist].filter(p => p.length > 0);
                mappedValue = parts.join(', ');
            }
            if (mappedValue) {
                const targetInput = personEntry.querySelector('.' + mapping[key]);
                if (targetInput) {
                    targetInput.value = mappedValue;
                }
                // Immediately render photo if it's the photo data
                if (mapping[key] === 'modal_photo_data') {
                    const imgEl = document.getElementById('applicant_photo');
                    const textEl = document.getElementById('applicant_photo_text');
                    if (imgEl) {
                        imgEl.src = mappedValue;
                        imgEl.style.display = 'block';
                        if (textEl) textEl.style.display = 'none';
                    }
                }
            }
        });

        // Trigger updates manually
        const nameEnInput = personEntry.querySelector('.modal_name_en');
        if (nameEnInput) nameEnInput.dispatchEvent(new Event('input', { bubbles: true }));

        const idTypeSelect = personEntry.querySelector('.modal_id_type');
        if (idTypeSelect && data.applicant_nid) {
            idTypeSelect.value = 'nid';
            if (typeof updateIdInput === 'function') updateIdInput(idTypeSelect);
        }
    }

    function pullCustomerForNominee(btn) {
        const nomineeEntry = btn.closest('.nominee-entry');
        const container = document.getElementById('nominee_container');
        const index = Array.from(container.children).indexOf(nomineeEntry);
        window.parent.postMessage({
            command: 'OPEN_CUSTOMER_SEARCH_FOR_SLOT',
            targetContext: 'nominee_' + index
        }, '*');
    }

    function populateNomineeEntry(nomineeEntry, data) {
        if (!nomineeEntry || !data) return;
        const mapping = {
            'applicant_name_bn': 'modal_nom_name',
            'applicant_name_en': 'modal_nom_name',
            'applicant_dob': 'modal_nom_dob',
            'applicant_nid': 'modal_nom_id',
            'applicant_nid_10': 'modal_nom_id',
            'applicant_curr_addr_village': 'modal_nom_addr'
        };
        Object.keys(mapping).forEach(key => {
            let mappedValue = data[key] || data[key.replace('_10', '')];
            if (key === 'applicant_curr_addr_village') {
                const house = (data.applicant_curr_addr_house || data.curr_addr_house_en || '').trim();
                const village = (data.applicant_curr_addr_village || data.curr_addr_village_en || '').trim();
                if (house && village) mappedValue = house + ', ' + village;
                else if (house) mappedValue = house;
                else mappedValue = village;
            }
            if (mappedValue !== undefined && mappedValue !== null && mappedValue !== '') {
                const el = nomineeEntry.querySelector('.' + mapping[key]);
                if (el) {
                    if (key === 'applicant_name_en' && !data['applicant_name_bn']) mappedValue = mappedValue.toUpperCase();
                    el.value = mappedValue;
                    el.dispatchEvent(new Event('input'));
                    el.dispatchEvent(new Event('change'));
                }
            }
        });

        if (data.applicant_nid || data.applicant_nid_10 || data.applicant_passport_no || data.applicant_birth_reg_no) {
            const idNumInput = nomineeEntry.querySelector('.modal_nom_id');
            if (idNumInput) {
                let idValToSet = data.applicant_nid_10 || data.applicant_nid_17 || data.applicant_nid || data.applicant_passport_no || data.applicant_birth_reg_no;
                idNumInput.value = idValToSet;
                idNumInput.dispatchEvent(new Event('input'));
            }
        }
    }

    function addNominee() {
        const container = document.getElementById('nominee_container');
        const div = document.createElement('div');
        div.innerHTML = createNomineeHTML(container.children.length);
        container.appendChild(div.firstElementChild);
    }

    function addGuardian() {
        const container = document.getElementById('guardian_container');
        const div = document.createElement('div');
        div.innerHTML = createGuardianHTML(container.children.length);
        container.appendChild(div.firstElementChild);
    }

    function removeSection(btn) { btn.closest('.entry-section').remove(); }

    function copyAddress(checkbox) {
        const section = checkbox.closest('.person-entry');
        const fields = ['road', 'dist', 'phone', 'post', 'thana', 'email'];
        if (checkbox.checked) {
            fields.forEach(f => section.querySelector('.modal_perm_' + f).value = section.querySelector('.modal_curr_' + f).value);
        } else {
            fields.forEach(f => section.querySelector('.modal_perm_' + f).value = '');
        }
    }

    function toggleNonResidentFields(select) {
        const p = select.closest('.person-entry');
        const display = select.value === 'nonres' ? 'block' : 'none';
        p.querySelector('.modal_visa_type_group').style.display = display;
        p.querySelector('.modal_work_permit_group').style.display = display;
    }

    function updateIdInput(select) {
        const idInput = select.closest('.person-entry').querySelector('.modal_id_number');
        const map = { 'nid': '10 বা 17 ডিজিট এনআইডি নম্বর', 'birth': 'জন্মনিবন্ধন নম্বর', 'passport': 'পাসপোর্ট নম্বর' };
        idInput.placeholder = map[select.value] || 'নম্বর এখানে লিখুন';
    }

    // Hub Communication Bridge
    // window.addEventListener('message', function (event) {
    //     if (event.data.command === 'FILL_SLOT') {
    //         const ctx = event.data.targetContext;
    //         const data = event.data.data;
    //         if (ctx && ctx.startsWith('person_') && data) {
    //             const idx = parseInt(ctx.split('_')[1]);
    //             const container = document.getElementById('person_container');
    //             if (container) {
    //                 while (container.children.length <= idx) {
    //                     if (typeof addPerson === 'function') addPerson();
    //                 }
    //                 const entry = container.children[idx];
    //                 if (entry && typeof populatePersonEntry === 'function') populatePersonEntry(entry, data);
    //             }
    //         } else if (ctx && ctx.startsWith('nominee_') && data) {
    //             const idx = parseInt(ctx.split('_')[1]);
    //             const container = document.getElementById('nominee_container');
    //             if (container) {
    //                 while (container.children.length <= idx) {
    //                     if (typeof addNominee === 'function') addNominee();
    //                 }
    //                 const entry = container.children[idx];
    //                 if (entry && typeof populateNomineeEntry === 'function') populateNomineeEntry(entry, data);
    //             }
    //         }
    //         return;
    //     }
    //     if (!event.data) return;
    // 
    //     // Handle command to fill form data
    //     if (event.data.command === 'FILL') {
    //         const data = event.data.data;
    //         if (!data) return;
    // 
    //         // Auto-populate the modal first
    //         populateFromCustomer(data);
    // 
    //         setTimeout(() => {
    //             // Apply the populated modal data to the main form document
    //             if (typeof applyData === 'function') {
    //                 applyData();
    //             }
    //             closeModal();
    //         }, 100);
    // 
    //         // Auto-fill account title with applicant name if empty
    //         const titleBn = document.getElementById('modal_account_title_bn');
    //         if (titleBn && !titleBn.value && data.applicant_name_bn) {
    //             titleBn.value = data.applicant_name_bn;
    //         }
    // 
    //         Object.keys(data).forEach(id => {
    //             const el = document.getElementById(id);
    //             if (el) {
    //                 if (el.tagName === 'INPUT') {
    //                     el.value = data[id];
    //                     el.dispatchEvent(new Event('input', { bubbles: true }));
    //                 } else if (el.contentEditable === 'true') {
    //                     el.innerText = data[id];
    //                     el.dispatchEvent(new Event('input', { bubbles: true }));
    //                 }
    //             }
    //         });
    //     }
    // 
    //     // Handle generic actions from the App Shell
    //     if (event.data.command === 'EXECUTE_ACTION') {
    //         switch (event.data.actionId) {
    //             case 'btn-data-entry': openModal(); break;
    //             case 'btn-print-form': window.print(); break;
    //             case 'btn-start-new':
    //             case 'btn-clear-form':
    //                 appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); });
    //                 break;
    //         }
    //     }
    // });

    window.saveCustomerToDB = function () {
        const firstPerson = document.querySelector('.person-entry');
        if (!firstPerson) {
            appToast('No customer data to save.');
            return;
        }

        const nameBn = (firstPerson.querySelector('.modal_name_bn').value || '').trim();
        const nameEn = (firstPerson.querySelector('.modal_name_en').value || '').trim();
        let nid = (firstPerson.querySelector('.modal_id_number').value || '').trim().replace(/[^0-9০-৯]/g, '');
        const idType = (firstPerson.querySelector('.modal_id_type').value || '').trim();

        if (!nameBn && !nameEn) {
            appToast('অনুগ্রহ করে কমপক্ষে নাম প্রদান করুন।\n(Please provide at least a name.)');
            return;
        }

        // Generate temporary ID if NID is missing
        if (!nid || (idType !== 'nid' && idType !== 'birth')) {
            const nameKey = (nameBn || nameEn).replace(/\s+/g, '_').substring(0, 20);
            nid = 'TEMP-' + nameKey + '-' + Date.now();
        }

        const customer = {
            photo: firstPerson.querySelector('.modal_photo_data')?.value || '',
            applicant_name_bn: nameBn,
            applicant_name_en: nameEn,
            applicant_father_name_bn: (firstPerson.querySelector('.modal_father').value || '').trim(),
            applicant_mother_name_bn: (firstPerson.querySelector('.modal_mother').value || '').trim(),
            applicant_spouse_name_bn: (firstPerson.querySelector('.modal_spouse').value || '').trim(),
            applicant_nid: nid,
            applicant_nid_10: (nid.length === 10) ? nid : '',
            applicant_nid_17: (nid.length === 17) ? nid : '',
            applicant_dob: (firstPerson.querySelector('.modal_dob').value || '').trim(),
            applicant_curr_addr_village: (firstPerson.querySelector('.modal_curr_road').value || '').trim(),
            applicant_curr_addr_post: (firstPerson.querySelector('.modal_curr_post').value || '').trim(),
            applicant_present_upozila: (firstPerson.querySelector('.modal_curr_thana').value || '').trim(),
            applicant_present_district: (firstPerson.querySelector('.modal_curr_dist').value || '').trim(),
            applicant_perm_addr_village: (firstPerson.querySelector('.modal_perm_road').value || '').trim(),
            applicant_perm_addr_post: (firstPerson.querySelector('.modal_perm_post').value || '').trim(),
            applicant_permanent_upozila: (firstPerson.querySelector('.modal_perm_thana').value || '').trim(),
            applicant_permanent_district: (firstPerson.querySelector('.modal_perm_dist').value || '').trim(),
            applicant_mobile: (firstPerson.querySelector('.modal_curr_phone').value || '').trim(),
            applicant_email: (firstPerson.querySelector('.modal_curr_email').value || '').trim(),
            applicant_nationality: (firstPerson.querySelector('.modal_nationality').value || '').trim(),
            applicant_profession: (firstPerson.querySelector('.modal_profession').value || '').trim(),
            monthly_income: (firstPerson.querySelector('.modal_income').value || '').trim(),
            applicant_fund_source: (firstPerson.querySelector('.modal_source').value || '').trim(),
            applicant_tin: (firstPerson.querySelector('.modal_tin').value || '').trim()
        };


        // Gather relationships for sync
        const rels = [];
        const persons = document.querySelectorAll('.person-entry');
        for (let i = 1; i < persons.length; i++) {
            const p = persons[i];
            let pNid = (p.querySelector('.modal_id_number').value || '').trim().replace(/[^0-9০-৯]/g, '');
            let nameEn = p.querySelector('.modal_name_en') ? p.querySelector('.modal_name_en').value : '';
            let nameBn = p.querySelector('.modal_name_bn') ? p.querySelector('.modal_name_bn').value : '';
            if (pNid) rels.push({ nid: pNid, name: nameEn || nameBn, type: 'Co-applicant', type_bn: 'সহ-আবেদনকারী', reverse: 'Co-applicant of this customer' });
        }
        const nominees = document.querySelectorAll('.nominee-entry');
        for (let i = 0; i < nominees.length; i++) {
            const n = nominees[i];
            let nNid = (n.querySelector('.modal_nom_id').value || '').trim().replace(/[^0-9০-৯]/g, '');
            let nName = n.querySelector('.modal_nom_name') ? n.querySelector('.modal_nom_name').value : '';
            if (nNid) rels.push({ nid: nNid, name: nName, type: 'Nominee', type_bn: 'নমিনী', reverse: 'Account Holder (Nominated by)' });
        }
        customer.relationships_to_sync = rels;

        const accountNo = (document.getElementById('modal_account_no')?.value || '').replace(/\D/g, '').trim();
        const customerCode = (document.getElementById('modal_unique_customer_id')?.value || '').trim();
        const rawDate = (document.getElementById('modal_app_date')?.value || '').trim();

        let accTypeStr = 'DPS/MSS';
        const depositType = document.getElementById('modal_deposit_type')?.value;
        if (depositType === 'fd') {
            accTypeStr = 'FDR';
        } else if (depositType === 'scheme') {
            accTypeStr = 'Deposit Savings Schemes';
        }

        if (accountNo) {
            customer.new_account = {
                account_no: accountNo,
                customer_code: customerCode,
                account_title: (document.getElementById('modal_account_title_en')?.value || document.getElementById('modal_account_title_bn')?.value || nameEn || nameBn || '').trim(),
                account_type: accTypeStr,
                opened_at: rawDate ? rawDate.split('-').reverse().join('/') : ''
            };
        }

        window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', customer: customer }, '*');
    };

    window.handleFormPhotoUpload = function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const dataUrl = e.target.result;
                const imgEl = document.getElementById('applicant_photo');
                const textEl = document.getElementById('applicant_photo_text');
                if (imgEl) {
                    imgEl.src = dataUrl;
                    imgEl.style.display = 'block';
                }
                if (textEl) {
                    textEl.style.display = 'none';
                }
                // Update the modal's hidden input as well
                const firstPersonEntry = document.querySelector('.person-entry');
                if (firstPersonEntry) {
                    const modalPhotoData = firstPersonEntry.querySelector('.modal_photo_data');
                    if (modalPhotoData) {
                        modalPhotoData.value = dataUrl;
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // ── Non-blocking Toast + Confirm helpers ──
    function appToast(msg, isError = false) {
        const color = isError ? '#dc3545' : '#28a745';
        let t = document.getElementById('_app_toast');
        if (!t) {
            t = document.createElement('div');
            t.id = '_app_toast';
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
        t.style.backgroundColor = color;
        t.style.opacity = '1';
        clearTimeout(t._tid);
        t._tid = setTimeout(() => { t.style.opacity = '0'; }, 3200);
    }

    function appConfirm(msg, onYes, onNo) {
        let overlay = document.getElementById('_app_confirm_overlay');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = '_app_confirm_overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: '99998', fontFamily: "'SolaimanLipi', Arial, sans-serif"
        });
        overlay.innerHTML = `
                <div style="background:white;border-radius:10px;padding:28px 32px;max-width:400px;width:90%;
                            box-shadow:0 8px 30px rgba(0,0,0,0.25);text-align:center;">
                    <p style="margin:0 0 22px;font-size:1rem;color:#333;line-height:1.5;">${msg}</p>
                    <div style="display:flex;gap:12px;justify-content:center;">
                        <button id="_app_confirm_yes" style="background:#dc3545;color:white;border:none;
                            padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;font-weight:bold;">
                            হ্যাঁ / Yes
                        </button>
                        <button id="_app_confirm_no" style="background:#6c757d;color:white;border:none;
                            padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;">
                            না / No
                        </button>
                    </div>
                </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#_app_confirm_yes').addEventListener('click', () => {
            overlay.remove(); if (onYes) onYes();
        });
        overlay.querySelector('#_app_confirm_no').addEventListener('click', () => {
            overlay.remove(); if (onNo) onNo();
        });
    }

    // Hub Communication Bridge
    // window.addEventListener('message', function (event) {
    //     if (!event.data) return;
    // 
    //     // Handle command to fill form data
    //     if (event.data.command === 'FILL') {
    //         const data = event.data.data;
    //         if (!data) return;
    // 
    //         // Auto-populate the modal first
    //         if (typeof populateFromCustomer === 'function') {
    //             populateFromCustomer(data);
    //         }
    //     }
    // 
    //     // Handle generic actions from the App Shell
    //     if (event.data.command === 'EXECUTE_ACTION') {
    //         switch (event.data.actionId) {
    //             case 'btn-data-entry': openModal(); break;
    //             case 'btn-print-form': window.print(); break;
    //             case 'btn-start-new':
    //             case 'btn-clear-form':
    //                 appConfirm('সকল ডেটা মুছে রিস্টার্ট করবেন?', function () { location.reload(); });
    //                 break;
    //         }
    //     }
    // });



    // Expose DPS functions to global scope for HTML buttons & message listener
    window.openModal = typeof openModal !== 'undefined' ? openModal : undefined;
    window.closeModal = typeof closeModal !== 'undefined' ? closeModal : undefined;
    window.applyData = typeof applyData !== 'undefined' ? applyData : undefined;
    window.populateFromCustomer = typeof populateFromCustomer !== 'undefined' ? populateFromCustomer : undefined;
    window.setBranchCode = typeof setBranchCode !== 'undefined' ? setBranchCode : undefined;
    window.syncBranchState = typeof syncBranchState !== 'undefined' ? syncBranchState : undefined;

    // --- AUTO-EXPOSED DPS FUNCTIONS ---
    if (typeof openModal !== 'undefined') window.openModal = openModal;
    if (typeof closeModal !== 'undefined') window.closeModal = closeModal;
    if (typeof handleRenewalChange !== 'undefined') window.handleRenewalChange = handleRenewalChange;
    if (typeof updateDepositTypeFields !== 'undefined') window.updateDepositTypeFields = updateDepositTypeFields;
    if (typeof calculateMaturityDate !== 'undefined') window.calculateMaturityDate = calculateMaturityDate;
    if (typeof calculateInstallmentCount !== 'undefined') window.calculateInstallmentCount = calculateInstallmentCount;
    if (typeof updateModalWords !== 'undefined') window.updateModalWords = updateModalWords;
    if (typeof updateRiskScore !== 'undefined') window.updateRiskScore = updateRiskScore;
    if (typeof addRiskItem !== 'undefined') window.addRiskItem = addRiskItem;
    if (typeof renderRiskTable !== 'undefined') window.renderRiskTable = renderRiskTable;
    if (typeof populateRiskRating !== 'undefined') window.populateRiskRating = populateRiskRating;
    if (typeof convertToBanglaWords !== 'undefined') window.convertToBanglaWords = convertToBanglaWords;
    if (typeof distributeDigits !== 'undefined') window.distributeDigits = distributeDigits;
    if (typeof toBanglaDigits !== 'undefined') window.toBanglaDigits = toBanglaDigits;
    if (typeof toEnglishDigits !== 'undefined') window.toEnglishDigits = toEnglishDigits;
    if (typeof applyData !== 'undefined') window.applyData = applyData;
    if (typeof setCheck !== 'undefined') window.setCheck = setCheck;
    if (typeof saveModalData !== 'undefined') window.saveModalData = saveModalData;
    if (typeof clearModal !== 'undefined') window.clearModal = clearModal;
    if (typeof toggleTick !== 'undefined') window.toggleTick = toggleTick;
    if (typeof populateFromCustomer !== 'undefined') window.populateFromCustomer = populateFromCustomer;
    if (typeof setElementText !== 'undefined') window.setElementText = setElementText;
    if (typeof syncBranchState !== 'undefined') window.syncBranchState = syncBranchState;
    if (typeof createPersonHTML !== 'undefined') window.createPersonHTML = createPersonHTML;
    if (typeof printFDRCheque !== 'undefined') window.printFDRCheque = printFDRCheque;
    if (typeof closeFDRChequePreview !== 'undefined') window.closeFDRChequePreview = closeFDRChequePreview;
    if (typeof createNomineeHTML !== 'undefined') window.createNomineeHTML = createNomineeHTML;
    if (typeof createGuardianHTML !== 'undefined') window.createGuardianHTML = createGuardianHTML;
    if (typeof toggleNomineeSection !== 'undefined') window.toggleNomineeSection = toggleNomineeSection;
    if (typeof toggleNomineeMinor !== 'undefined') window.toggleNomineeMinor = toggleNomineeMinor;
    if (typeof addPerson !== 'undefined') window.addPerson = addPerson;
    if (typeof pullCustomerForSlot !== 'undefined') window.pullCustomerForSlot = pullCustomerForSlot;
    if (typeof pullCustomerForNominee !== 'undefined') window.pullCustomerForNominee = pullCustomerForNominee;
    if (typeof populateNomineeEntry !== 'undefined') window.populateNomineeEntry = populateNomineeEntry;
    if (typeof addNominee !== 'undefined') window.addNominee = addNominee;
    if (typeof addGuardian !== 'undefined') window.addGuardian = addGuardian;
    if (typeof removeSection !== 'undefined') window.removeSection = removeSection;
    if (typeof copyAddress !== 'undefined') window.copyAddress = copyAddress;
    if (typeof toggleNonResidentFields !== 'undefined') window.toggleNonResidentFields = toggleNonResidentFields;
    if (typeof updateIdInput !== 'undefined') window.updateIdInput = updateIdInput;
    if (typeof appToast !== 'undefined') window.appToast = appToast;
    if (typeof appConfirm !== 'undefined') window.appConfirm = appConfirm;
    // ----------------------------------
})();
