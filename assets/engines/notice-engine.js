/**
 * Notice Engine
 * Handles dynamically generating notice pages based on selected loans.
 */

(function() {
    // Attempt to load pending notice data from sessionStorage (via window.parent if in iframe)
    let pendingDataStr = null;
    try {
        pendingDataStr = window.parent.sessionStorage.getItem('pending_notice_data') || window.sessionStorage.getItem('pending_notice_data');
    } catch (e) {
        console.warn("Could not access sessionStorage.");
    }

    if (pendingDataStr) {
        try {
            const loansArray = JSON.parse(pendingDataStr);
            if (loansArray && loansArray.length > 0) {
                // Find the original page container to use as a template
                const originalPage = document.querySelector('.page');
                if (!originalPage) return;

                // Create additional pages if more than one loan is selected
                const pages = [originalPage];
                for (let i = 1; i < loansArray.length; i++) {
                    const newPage = originalPage.cloneNode(true);
                    // Ensure the ID is unique or removed
                    newPage.removeAttribute('id');
                    document.body.appendChild(newPage);
                    pages.push(newPage);
                }

                // English to Bangla number mapping
                const enToBn = {
                    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
                    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
                };

                // Populate each page with the corresponding loan data
                loansArray.forEach((loan, index) => {
                    const page = pages[index];
                    Object.keys(loan).forEach(key => {
                        const queryStr = '#' + key + ', .' + key + ', [data-db-field="' + key + '"]';
                        const els = page.querySelectorAll(queryStr);
                        els.forEach(el => {
                            let val = loan[key] || '';
                            
                            // Check for dates from DB and format them
                            if (val && typeof val === 'string' && val.match(/^\\d{4}-\\d{2}-\\d{2}/)) {
                                const parts = val.split('-');
                                val = `${parts[2]}-${parts[1]}-${parts[0]}`;
                            }

                            if (el.classList.contains('bangla-numbers') && val) {
                                val = String(val).replace(/[0-9]/g, match => enToBn[match]);
                            }

                            if (el.tagName === 'SPAN' || el.tagName === 'DIV') {
                                el.innerText = val;
                            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                                el.value = val;
                            }
                        });
                    });
                });
            }
        } catch (e) {
            console.error("Error processing pending_notice_data:", e);
        }
    }
})();

// Retain legacy functions for manual testing if needed
window.generateNotice = function() {
    const accountNo = prompt('Enter Loan Account No (or leave blank for demo):', '');
    
    if (accountNo !== null) {
        const mockData = {
            applicant_name_bn: 'মোক ডাটা কাস্টমার',
            applicant_father_name_bn: 'মোক ডাটা পিতা',
            applicant_curr_addr_village: 'মোক গ্রাম',
            applicant_curr_addr_post: 'মোক পোস্ট',
            applicant_present_upozila: 'মোক উপজেলা',
            applicant_present_district: 'মোক জেলা',
            loan_type: 'সিসি (কৃষি)',
            loan_account_no: accountNo || '0123456789',
            total_due_calculated: '15200'
        };

        window.postMessage({ command: 'FILL', data: mockData }, '*');
        
        if (window.parent && window.parent.showNotification) {
            window.parent.showNotification('Notice auto-filled using calculated due amounts.', 'success');
        }
    }
};

window.clearForm = function() {
    if (confirm('Are you sure you want to clear all data?')) {
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.innerText = '';
        });
    }
};

window.startNewForm = function() {
    if (confirm('Start a new notice? Unsaved data will be lost.')) {
        location.reload();
    }
};
