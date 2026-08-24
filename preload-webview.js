const { ipcRenderer } = require('electron');

// ==========================================
// AUTOCOMPLETE SUGGESTIONS
// ==========================================

function attachAutocomplete() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"]');
    
    inputs.forEach(input => {
        // Skip hidden or tiny inputs
        if (input.type === 'hidden' || input.style.display === 'none') return;
        
        // Give the input an ID if it doesn't have one (needed for datalist)
        if (!input.id) {
            input.id = 'input-' + Math.random().toString(36).substr(2, 9);
        }
        
        const listId = input.id + '-datalist';
        
        // Attach datalist if not already there
        if (!document.getElementById(listId)) {
            const datalist = document.createElement('datalist');
            datalist.id = listId;
            document.documentElement.appendChild(datalist);
            input.setAttribute('list', listId);
        }

        input.addEventListener('focus', () => {
            // Request suggestions from main process
            ipcRenderer.invoke('get-autocomplete-suggestions', window.location.hostname, input.name || input.id).then(suggestions => {
                const datalist = document.getElementById(listId);
                if (datalist && suggestions) {
                    datalist.innerHTML = '';
                    suggestions.forEach(val => {
                        const option = document.createElement('option');
                        option.value = val;
                        datalist.appendChild(option);
                    });
                }
            }).catch(e => console.error(e));
        });

        input.addEventListener('blur', () => {
            if (input.value && input.value.trim().length > 2) {
                // Save value
                ipcRenderer.send('save-autocomplete-suggestion', window.location.hostname, input.name || input.id, input.value.trim());
            }
        });
    });
}

// ==========================================
// PASSWORD MANAGER
// ==========================================

function attachPasswordManager() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const passwordInput = form.querySelector('input[type="password"]');
            if (passwordInput && passwordInput.value) {
                // Find nearest text/email input before the password field as username
                const inputs = Array.from(form.querySelectorAll('input'));
                const passIndex = inputs.indexOf(passwordInput);
                let usernameInput = null;
                for (let i = passIndex - 1; i >= 0; i--) {
                    if (inputs[i].type === 'text' || inputs[i].type === 'email') {
                        usernameInput = inputs[i];
                        break;
                    }
                }
                
                const username = usernameInput ? usernameInput.value : '';
                const password = passwordInput.value;
                const hostname = window.location.hostname;
                
                // Do not prompt for CBS (as requested by user) - REMOVED per user request
                if (hostname) {
                    ipcRenderer.send('offer-save-password', hostname, username, password);
                }
            }
        });
    });
    
    // Auto-fill passwords if they exist
    const hostname = window.location.hostname;
    ipcRenderer.invoke('get-saved-password', hostname).then(credentials => {
        if (credentials && credentials.username && credentials.password) {
            const passwordInput = document.querySelector('input[type="password"]');
            if (passwordInput) {
                const form = passwordInput.closest('form');
                if (form) {
                    const inputs = Array.from(form.querySelectorAll('input'));
                    const passIndex = inputs.indexOf(passwordInput);
                    let usernameInput = null;
                    for (let i = passIndex - 1; i >= 0; i--) {
                        if (inputs[i].type === 'text' || inputs[i].type === 'email') {
                            usernameInput = inputs[i];
                            break;
                        }
                    }
                    if (usernameInput) usernameInput.value = credentials.username;
                    passwordInput.value = credentials.password;
                }
            }
        }
    }).catch(e => console.error(e));
}

// Run when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Disabled attachAutocomplete() because modifying DOM datalists can break external React/Vue portals
    // Fixed: Now appending to documentElement instead of body to avoid React interference
    attachAutocomplete();
    attachPasswordManager();
    attachAutosaveRecorder();
    
    // Also observe DOM changes in case of SPA or dynamically loaded forms
    const observer = new MutationObserver((mutations) => {
        let shouldAttach = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) shouldAttach = true;
        });
        if (shouldAttach) {
            attachAutocomplete();
            attachPasswordManager();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// ==========================================
// CBS FORM AUTOSAVE RECORDER
// ==========================================
function getUniqueSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.name) return '[name="' + el.name + '"]';
    
    let selector = el.tagName.toLowerCase();
    let sibling = el;
    let nth = 1;
    while (sibling = sibling.previousElementSibling) {
        if (sibling.tagName === el.tagName) nth++;
    }
    return selector + ':nth-of-type(' + nth + ')';
}

function attachAutosaveRecorder() {
    const handleInput = (e) => {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
            if (el.type === 'password') return;
            const selector = getUniqueSelector(el);
            const value = el.value;
            const path = window.location.pathname;
            ipcRenderer.send('cbs-field-input', path, selector, value);
        }
    };
    
    function attachToDoc(doc) {
        if (!doc || doc._autosaveAttached) return;
        doc.addEventListener('input', handleInput);
        doc.addEventListener('change', handleInput);
        doc._autosaveAttached = true;
    }

    attachToDoc(document);

    // Periodically check and attach to any iframes
    setInterval(() => {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) attachToDoc(doc);
            } catch(e) {}
        });
    }, 2000);
}
