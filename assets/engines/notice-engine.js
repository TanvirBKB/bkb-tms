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
            if (Array.isArray(loansArray) && loansArray.length > 0) {
                // Find original template page
                const originalPage = document.querySelector('.page');
                if (!originalPage) return;

                // Create additional pages if more than 1 loan is selected
                const pages = [originalPage];
                for (let i = 1; i < loansArray.length; i++) {
                    const newPage = originalPage.cloneNode(true);
                    newPage.removeAttribute('id');
                    document.body.appendChild(newPage);
                    pages.push(newPage);
                }

                // Helper to safely populate a page with a loan data object
                function fillPage(page, data) {
                    if (!page || !data) return;

                    // 1. Fill all elements with data-db-field
                    const dbElements = page.querySelectorAll('[data-db-field]');
                    dbElements.forEach(el => {
                        const key = el.getAttribute('data-db-field');
                        if (key && data[key] !== undefined && data[key] !== null) {
                            let val = data[key];
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
                    const idElements = page.querySelectorAll('[id]');
                    idElements.forEach(el => {
                        const key = el.id;
                        if (key && data[key] !== undefined && data[key] !== null) {
                            if (!el.hasAttribute('data-db-field') || el.getAttribute('data-db-field') === key) {
                                let val = data[key];
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

                // Populate each page with its corresponding borrower record
                loansArray.forEach((loan, idx) => {
                    fillPage(pages[idx], loan);
                });
            }
        } catch (e) {
            console.error("Error processing pending_notice_data:", e);
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
            el.innerText = '';
        });
    }
};

window.startNewForm = function() {
    if (confirm('Start a new notice? Unsaved data will be lost.')) {
        location.reload();
    }
};
