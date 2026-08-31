/**
 * Portal Management Logic
 * Implementing the "Webview Pattern" from process.md
 */
const framesContainer = document.getElementById('frames-container'); // This is where webviews will be appended
if (!framesContainer) {
    console.error('Error: #frames-container not found in the DOM. Webviews will fail to load.');
}

/**
 * Helper function to set up event listeners for navigation items with logging.
 */
function setupNavLink(id, handler, logName) {
    const element = document.getElementById(id);
    if (element) {
        console.log(`Found element: ${id}`);
        element.addEventListener('click', handler);
    } else {
        console.warn(`Element not found: ${id}`);
    }
}

// Global state to keep track of open tabs
const openTabs = {}; // { tabId: { title: '...', contentElement: Node, tabButton: Node } }
let activeTabId = null;

window.showAppToast = function (message, isError = false) {
    let toast = document.getElementById('app-toast-alert');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast-alert';
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '9999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'opacity 0.3s ease-in-out',
            opacity: '0',
            pointerEvents: 'none',
            fontFamily: "'SolaimanLipi', Arial, sans-serif"
        });
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#dc3545' : '#28a745';
    toast.style.opacity = '1';

    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
};

/**
 * Manages the creation and display of new tabs in the UI.
 * @param {string} tabTitle - The title to display on the tab.
 * @param {HTMLElement} contentElement - The iframe or webview element to display in the tab's content area.
 * @param {string} tabIdPrefix - Prefix for the generated tab ID (e.g., 'portal-', 'form-').
 * @returns {string} The ID of the newly created tab.
 */
function createTab(tabTitle, contentElement, tabIdPrefix = 'tab-') {
    const tabId = tabIdPrefix + Date.now(); // Unique ID for the tab

    // Create tab button
    const tabButton = document.createElement('div');
    tabButton.classList.add('tab');
    tabButton.setAttribute('data-tab-id', tabId);
    tabButton.innerHTML = `<span>${tabTitle}</span><span class="tab-close">&times;</span>`;

    // Create content wrapper for the frame/webview
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('tab-content');
    contentWrapper.setAttribute('data-tab-id', tabId);
    contentWrapper.appendChild(contentElement);

    // Append to DOM
    document.getElementById('tabs-bar').appendChild(tabButton);
    framesContainer.appendChild(contentWrapper);

    // Bind webview navigation events to update URL address bar
    if (contentElement && contentElement.tagName === 'WEBVIEW') {
        const updateUrlInput = () => {
            const currentActive = getActiveIframe();
            if (currentActive === contentElement) {
                const urlInput = document.getElementById('browser-url-input');
                if (urlInput) {
                    try {
                        urlInput.value = contentElement.getURL() || contentElement.getAttribute('src') || '';
                    } catch (e) {
                        urlInput.value = contentElement.getAttribute('src') || '';
                    }
                }
            }
        };
        contentElement.addEventListener('did-navigate', updateUrlInput);
        contentElement.addEventListener('did-navigate-in-page', updateUrlInput);
    }

    // Store tab info
    openTabs[tabId] = {
        title: tabTitle,
        contentElement: contentWrapper,
        tabButton: tabButton
    };

    // Activate the new tab
    activateTab(tabId);

    // Event listener for tab button click
    tabButton.addEventListener('click', (event) => {
        event.target.classList.contains('tab-close') ? closeTab(tabId) : activateTab(tabId);
    });

    return tabId;
}

/**
 * Creates a portal tab using <webview> instead of <iframe>.
 * This allows programmatic control over external domains (NID, CBS).
 */
function openExternalPortal(url, portalType) {
    document.getElementById('welcome-screen').style.display = 'none'; // Hide welcome screen
    framesContainer.style.display = 'flex'; // Show frames container

    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('plugins', 'true');
    webview.setAttribute('partition', 'persist:bkb-automation');

    webview.style.border = 'none';
    webview.style.backgroundColor = '#f0f2f5';
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.display = 'flex';
    webview.style.flex = '1';
    webview.setAttribute('allowpopups', 'true');

    webview.addEventListener('did-fail-load', (event) => {
        console.error(`[${portalType}] Webview failed to load:`, event.errorDescription, `URL: ${event.validatedURL}`);
    });

    webview.addEventListener('console-message', (e) => {
        console.log(`[${portalType} Webview Console] Level: ${e.level}, Message: ${e.message}`);
    });

    webview.addEventListener('dom-ready', () => {
        console.log(`[${portalType}] Portal ready. Manual login required for security.`);
    });

    createTab(portalType, webview, 'portal-');
}

/**
 * Opens a local HTML file in a new tab using an iframe.
 */
function openLocalForm(filePath, tabTitle, onLoad) {
    document.getElementById('welcome-screen').style.display = 'none';
    framesContainer.style.display = 'flex';

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', filePath);
    iframe.style.border = 'none';
    iframe.style.backgroundColor = '#f0f2f5';
    iframe.style.width = '100%';
    iframe.style.height = '100%';

    iframe.addEventListener('load', () => {
        try {
            const win = iframe.contentWindow;
        } catch (e) {
            console.warn('Could not inject zoom listener to iframe:', e);
        }
        console.log(`[${tabTitle}] Iframe loaded: ${filePath}`);
        try {
            const win = iframe.contentWindow;
            const logic = window.getFormLogic ? window.getFormLogic(win) : null;
            if (logic?.applyBranchInfo) {
                logic.applyBranchInfo();
            } else if (typeof win?.applyBranchInfo === 'function') {
                win.applyBranchInfo();
            }

            // Inject central branch data into forms standard FILL listener
            if (typeof window.getCentralBranchData === 'function') {
                const branchData = window.getCentralBranchData();
                win.postMessage({
                    command: 'FILL',
                    data: {
                        branch_name: branchData.nameBn || '',
                        branch_name_en: branchData.nameEn || '',
                        branch_location_1: branchData.locationBn || '',
                        branch_location_en: branchData.locationEn || '',
                        branch_upazila_en: branchData.upazilaEn || branchData.thanaEn || '',
                        branch_district_en: branchData.districtEn || '',
                        branch_location_2: branchData.districtBn || '',
                        branch_mobile: branchData.mobile || '',
                        branch_email: branchData.email || '',
                        manager_name: localStorage.getItem('bkb_manager_name') || ''
                    }
                }, '*');
            }
        } catch (error) {
            console.warn(`[${tabTitle}] Could not call applyBranchInfo on iframe load:`, error);
        }

        if (typeof onLoad === 'function') {
            try { onLoad(iframe); } catch (e) { console.warn('onLoad callback error:', e); }
        }

        if (typeof window.restoreAppFocus === 'function') {
            window.restoreAppFocus(50);
        }
    });
    iframe.addEventListener('error', (e) => {
        console.error(`[${tabTitle}] Iframe failed to load: ${filePath}`, e);
    });

    createTab(tabTitle, iframe, 'form-');
}

/**
 * Opens a local PDF file in a new tab using a webview.
 */
function openPDFViewer(filePath, title) {
    document.getElementById('welcome-screen').style.display = 'none';
    framesContainer.style.display = 'flex';

    const webview = document.createElement('webview');
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    webview.setAttribute('src', fileUrl);
    webview.setAttribute('plugins', 'true');
    webview.style.border = 'none';
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.backgroundColor = '#f0f2f5';

    createTab(title || 'PDF Viewer', webview, 'pdf-');
}

/**
 * Helper to get the iframe element from the currently active tab with robust DOM fallbacks.
 */
function getActiveIframe() {
    if (activeTabId && openTabs[activeTabId] && openTabs[activeTabId].contentElement) {
        const frame = openTabs[activeTabId].contentElement.querySelector('iframe, webview');
        if (frame) return frame;
    }
    // Fallback 1: search DOM for visible .tab-content container
    const visibleContent = document.querySelector('.tab-content[style*="display: flex"], .tab-content[style*="display:flex"]');
    if (visibleContent) {
        const frame = visibleContent.querySelector('iframe, webview');
        if (frame) return frame;
    }
    // Fallback 2: search for any visible iframe/webview in DOM
    const allFrames = Array.from(document.querySelectorAll('iframe, webview'));
    return allFrames.find(f => f.offsetWidth > 0 && f.offsetHeight > 0) || null;
}

/**
 * Global helper to restore keyboard & input focus to the active frame.
 */
window.restoreAppFocus = function (delay = 100) {
    setTimeout(() => {
        try {
            // CRITICAL: If a parent-window input/textarea/select is currently focused
            // (e.g. the "Import Customer Info" modal search box), do NOT steal focus.
            const parentActiveEl = document.activeElement;
            if (parentActiveEl && (
                parentActiveEl.tagName === 'INPUT' ||
                parentActiveEl.tagName === 'TEXTAREA' ||
                parentActiveEl.tagName === 'SELECT' ||
                parentActiveEl.isContentEditable
            )) {
                return;
            }

            const activeFrame = getActiveIframe();
            if (activeFrame && activeFrame.contentDocument) {
                const activeEl = activeFrame.contentDocument.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable)) {
                    // Do not steal focus if an input is already focused inside the iframe!
                    return;
                }
            }
            window.focus();
            if (activeFrame) {
                activeFrame.focus();
                if (activeFrame.contentWindow) {
                    activeFrame.contentWindow.focus();
                }
            }
        } catch (e) {
            console.warn('restoreAppFocus error:', e);
        }
    }, delay);
};

/**
 * Global custom non-blocking confirmation dialog to replace browser's native confirm().
 * Avoids browser events thread locks and input freeze issue in Electron.
 */
window.appConfirm = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('appConfirmModal');
        const msgEl = document.getElementById('appConfirmMessage');
        const yesBtn = document.getElementById('appConfirmYesBtn');
        const noBtn = document.getElementById('appConfirmNoBtn');

        if (!modal || !msgEl || !yesBtn || !noBtn) {
            console.warn('Custom confirm modal elements missing. Falling back to native confirm.');
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        modal.style.display = 'flex';
        modal.classList.add('visible');

        const cleanUp = (result) => {
            modal.classList.remove('visible');
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
            if (typeof window.restoreAppFocus === 'function') {
                window.restoreAppFocus(50);
            }
            resolve(result);
        };

        yesBtn.onclick = () => cleanUp(true);
        noBtn.onclick = () => cleanUp(false);
    });
};



/**
 * Manages the display of open tabs in the UI.
 */
function activateTab(tabId) {
    if (!tabId) return;
    console.log(`Activating tab: ${tabId}`);

    // Ensure container is visible and welcome is hidden
    document.getElementById('welcome-screen').style.display = 'none';
    framesContainer.style.display = 'flex';

    // Show/Hide form specific buttons in right panel
    const formSpecificContainer = document.querySelector('.form-specific-buttons');
    const formActionsSection = document.querySelector('.form-actions-section');
    const maintenanceSection = document.getElementById('system-maintenance-section');
    const rightPanel = document.getElementById('right-panel');

    const btnPullNid = document.getElementById('btn-pull-nid-data-show-modal');
    const btnDataEntry = document.getElementById('btn-data-entry');
    const btnGenerateNotice = document.getElementById('btn-generate-notice');
    const btnStartNew = document.getElementById('btn-start-new');
    const btnImport = document.getElementById('btn-import-customer');
    const btnInjectRtgs = document.getElementById('btn-inject-rtgs-data');
    const btnScanRtgs = document.getElementById('btn-scan-rtgs-form');
    const btnInjectEftn = document.getElementById('btn-inject-eftn-data');

    // Handle Browser Navigation Bar visibility (Show for portals, hide for local forms)
    const browserBar = document.getElementById('browser-bar');
    if (browserBar) browserBar.style.display = (tabId && tabId.startsWith('portal-')) ? 'flex' : 'none';

    const tabInfo = openTabs[tabId];
    const isForm = tabId && typeof tabId === 'string' && tabId.startsWith('form-');
    const isNidPortal = tabInfo && tabId.startsWith('portal-') &&
        (tabInfo.title.toUpperCase() === 'NID' || tabInfo.title.toUpperCase() === 'VERIFY NID' || tabInfo.title.toUpperCase() === 'VEIRFY NID');

    // Fetch current webview URL to detect custom-named portals
    let portalUrl = '';
    if (tabInfo && tabInfo.contentElement) {
        const webviewEl = tabInfo.contentElement.querySelector('webview');
        if (webviewEl) {
            try {
                portalUrl = webviewEl.getURL() || webviewEl.getAttribute('src') || '';
            } catch (e) {
                portalUrl = webviewEl.getAttribute('src') || '';
            }
            const urlInput = document.getElementById('browser-url-input');
            if (urlInput) {
                urlInput.value = portalUrl;
            }
        }
    }
    const titleUpper = tabInfo ? tabInfo.title.toUpperCase() : '';
    const urlUpper = portalUrl.toUpperCase();

    const isRtgsPortal = tabId && tabId.startsWith('portal-') && (titleUpper.includes('RTGS') || urlUpper.includes('10.0.6.18') || urlUpper.includes(':8080'));
    const isEftnPortal = tabId && tabId.startsWith('portal-') && (titleUpper.includes('EFTN') || urlUpper.includes('192.168.51.55') || urlUpper.includes(':9092'));
    const isCbsPortal = tabId && tabId.startsWith('portal-') && (titleUpper.includes('CBS') || urlUpper.includes('172.25.2.13') || urlUpper.includes(':9091'));

    // Reset visibility of all control panel components
    [formSpecificContainer, formActionsSection, maintenanceSection].forEach(c => {
        if (c) {
            c.classList.add('hidden-panel');
            c.style.display = ''; // Clear inline styles
        }
    });

    const borrowerControls = document.getElementById('borrower-list-controls');
    if (borrowerControls) borrowerControls.style.display = 'none';
    
    const borrowerListBtns = document.getElementById('borrower-list-buttons');
    if (borrowerListBtns) borrowerListBtns.style.display = 'none';

    const btnRestoreCbs = document.getElementById('btn-restore-cbs-data');
    const btnSmartMode = document.getElementById('btn-smart-mode');
    const btnClearForm = document.getElementById('btn-clear-form');
    const btnCustomizeCamp = document.getElementById('btn-customize-camp-notice');
    [btnPullNid, btnDataEntry, btnGenerateNotice, btnStartNew, btnImport, btnInjectRtgs, btnInjectEftn, btnScanRtgs, btnRestoreCbs, btnSmartMode, btnClearForm, btnCustomizeCamp].forEach(b => {
        if (b) {
            b.classList.add('hidden-panel');
            b.style.display = 'none';
        }
    });

    const calcButtonsSection = document.getElementById('calculator-buttons-section');
    if (calcButtonsSection) calcButtonsSection.style.display = 'none';

    // Show relevant buttons based on tab type
    if (isNidPortal) {
        if (formSpecificContainer) formSpecificContainer.classList.remove('hidden-panel');
        if (btnPullNid) btnPullNid.classList.remove('hidden-panel');

        // Automatically expand the right panel for NID interactions
        if (rightPanel) {
            rightPanel.classList.remove('collapsed');
            document.getElementById('right-toggle').innerHTML = '&#9654;';
        }
    } else if (isRtgsPortal) {
        if (formSpecificContainer) formSpecificContainer.classList.remove('hidden-panel');
        if (btnInjectRtgs) { btnInjectRtgs.classList.remove('hidden-panel'); btnInjectRtgs.style.display = 'inline-block'; }
        if (btnScanRtgs) { btnScanRtgs.classList.remove('hidden-panel'); btnScanRtgs.style.display = 'inline-block'; }

        if (rightPanel) {
            rightPanel.classList.remove('collapsed');
            document.getElementById('right-toggle').innerHTML = '&#9654;';
        }
    } else if (isEftnPortal) {
        if (formSpecificContainer) formSpecificContainer.classList.remove('hidden-panel');
        if (btnInjectEftn) { btnInjectEftn.classList.remove('hidden-panel'); btnInjectEftn.style.display = 'inline-block'; }
        if (btnScanRtgs) { btnScanRtgs.classList.remove('hidden-panel'); btnScanRtgs.style.display = 'inline-block'; }

        if (rightPanel) {
            rightPanel.classList.remove('collapsed');
            document.getElementById('right-toggle').innerHTML = '&#9654;';
        }
    } else if (isCbsPortal) {
        if (formSpecificContainer) formSpecificContainer.classList.remove('hidden-panel');
        if (btnSmartMode) { btnSmartMode.classList.remove('hidden-panel'); btnSmartMode.style.display = 'inline-block'; }
        if (btnRestoreCbs) { btnRestoreCbs.classList.remove('hidden-panel'); btnRestoreCbs.style.display = 'inline-block'; }

        if (rightPanel) {
            rightPanel.classList.remove('collapsed');
            document.getElementById('right-toggle').innerHTML = '&#9654;';
        }
    } else if (isForm) {
        if (formSpecificContainer) formSpecificContainer.classList.remove('hidden-panel');

        // Check if this is a calculator tab
        const calcIframe = tabInfo.contentElement.querySelector('iframe[src*="interest_calculator"]');
        const isCalculator = !!calcIframe;
        const noticeIframe = tabInfo.contentElement.querySelector('iframe[src*="notice"]');
        const isNotice = !!noticeIframe;
        const reportIframe = tabInfo.contentElement.querySelector('iframe[src*="borrower_list"]');
        const isReport = !!reportIframe;

        if (isCalculator) {
            // Show calculator buttons, hide standard form-specific buttons
            if (calcButtonsSection) calcButtonsSection.style.display = 'block';

            // Show form action and backup buttons
            if (formActionsSection) formActionsSection.classList.remove('hidden-panel');

            // Wire calculator buttons to trigger iframe actions
            window.CalculatorEngine.wireCalculatorButtons(calcIframe);

            // Wire the native print button to the calculator's print function
            const btnPrintForm = document.getElementById('btn-print-form');
            if (btnPrintForm) {
                btnPrintForm.onclick = () => {
                    if (calcIframe.contentWindow && calcIframe.contentWindow.savePrintReport) {
                        calcIframe.contentWindow.savePrintReport();
                    } else {
                        calcIframe.contentWindow.print();
                    }
                };
            }
        } else if (isNotice) {
            // Show standard form buttons for notices
            if (btnGenerateNotice) {
                btnGenerateNotice.classList.remove('hidden-panel');
                btnGenerateNotice.style.display = 'inline-block';
            }
            if (btnStartNew) {
                btnStartNew.classList.remove('hidden-panel');
                btnStartNew.style.display = 'inline-block';
            }

            // If Camp Notice is opened, show Customize Notice button under Start New Form
            const campIframe = tabInfo.contentElement.querySelector('iframe[src*="camp_notice"]');
            if (campIframe && btnCustomizeCamp) {
                btnCustomizeCamp.classList.remove('hidden-panel');
                btnCustomizeCamp.style.display = 'inline-block';
                btnCustomizeCamp.onclick = () => {
                    if (campIframe.contentWindow && typeof campIframe.contentWindow.openCampCustomizerModal === 'function') {
                        campIframe.contentWindow.openCampCustomizerModal();
                    }
                };
            }

            if (btnClearForm) {
                btnClearForm.classList.remove('hidden-panel');
                btnClearForm.style.display = 'inline-block';
            }
            if (formActionsSection) formActionsSection.classList.remove('hidden-panel');
        } else if (isReport) {
            // Show list buttons for reports
            if (formActionsSection) formActionsSection.classList.remove('hidden-panel');
            if (borrowerControls) borrowerControls.style.display = 'block';
            if (borrowerListBtns) borrowerListBtns.style.display = 'block';
        } else {
            // Show standard form buttons
            if (btnDataEntry) btnDataEntry.classList.remove('hidden-panel');
            if (btnStartNew) btnStartNew.classList.remove('hidden-panel');
            if (btnImport) btnImport.classList.remove('hidden-panel');
            if (formActionsSection) formActionsSection.classList.remove('hidden-panel');
        }

        // Automatically expand the right panel for form actions
        if (rightPanel) {
            rightPanel.classList.remove('collapsed');
            document.getElementById('right-toggle').innerHTML = '&#9654;';
        }
    } else {
        // Collapse panel if we are in a tab type that doesn't use the control panel
        if (rightPanel) rightPanel.classList.add('collapsed');
        document.getElementById('right-toggle').innerHTML = '&#9664;';
    }

    // Deactivate current active tab
    if (activeTabId && openTabs[activeTabId]) {
        openTabs[activeTabId].tabButton.classList.remove('active');
        openTabs[activeTabId].contentElement.style.display = 'none';

        // Explicitly blur all webviews and iframes in the deactivated tab to prevent focus theft
        const inactiveFrame = openTabs[activeTabId].contentElement.querySelector('iframe, webview');
        if (inactiveFrame) {
            try { inactiveFrame.blur(); } catch (e) { }
        }
    }

    // Activate new tab
    if (openTabs[tabId]) {
        openTabs[tabId].tabButton.classList.add('active');
        openTabs[tabId].contentElement.style.display = 'flex'; // Use flex to allow min-height:0 constraints
        activeTabId = tabId;

        // Also, explicitly blur any other webviews/iframes in other inactive tabs
        document.querySelectorAll('.tab-content').forEach(container => {
            if (container.getAttribute('data-tab-id') !== tabId) {
                const frame = container.querySelector('iframe, webview');
                if (frame) {
                    try { frame.blur(); } catch (e) { }
                }
            }
        });

        // Restore focus to the activated iframe/webview after display flex is applied
        window.restoreAppFocus(100);
    }
}

function closeTab(tabId) {
    if (!openTabs[tabId]) return;

    const { tabButton, contentElement } = openTabs[tabId];

    // Remove from DOM
    tabButton.remove();
    contentElement.remove();

    delete openTabs[tabId];

    // If the closed tab was active, activate another tab or show welcome screen
    if (activeTabId === tabId) {
        const remainingTabIds = Object.keys(openTabs);
        if (remainingTabIds.length > 0) {
            activateTab(remainingTabIds[0]);
            window.restoreAppFocus(150);
        } else {
            const formSpecificContainer = document.querySelector('.form-specific-buttons');
            const formActionsSection = document.querySelector('.form-actions-section');
            const maintenanceSection = document.getElementById('system-maintenance-section');
            const rightPanel = document.getElementById('right-panel');

            activeTabId = null;
            document.getElementById('welcome-screen').style.display = 'flex';
            framesContainer.style.display = 'none'; // Hide frames container if no tabs

            if (formSpecificContainer) formSpecificContainer.classList.add('hidden-panel');
            if (formActionsSection) formActionsSection.classList.add('hidden-panel');
            if (maintenanceSection) maintenanceSection.classList.add('hidden-panel');

            // Collapse the right panel when returning to the welcome screen
            if (rightPanel) {
                rightPanel.classList.add('collapsed');
                document.getElementById('right-toggle').innerHTML = '&#9664;';
            }
        }
    }
}

/**
 * Saves all modal inputs to window.AppStorage
 */
function saveSettings() {
    const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');

    // Helper to update settings only if element exists in the current open modal
    const syncField = (id, key) => {
        const el = document.getElementById(id);
        if (el) saved[key] = el.value;
    };

    // Update dynamic service link if the link modal is active
    const selector = document.getElementById('modalServiceSelector');
    const urlInput = document.getElementById('modalServiceUrl');
    if (selector && urlInput) {
        if (selector.value === 'new') {
            const nameInput = document.getElementById('modalServiceName');
            if (nameInput && (nameInput.value.trim() || urlInput.value.trim())) { // Save even if one is provided
                const finalName = nameInput.value.trim() || 'Unnamed Link';
                const finalUrl = urlInput.value.trim() || '';
                if (!saved.customLinks) saved.customLinks = [];
                const newId = 'custom_' + Date.now();
                saved.customLinks.push({ id: newId, name: finalName, url: finalUrl });
                saved[newId] = finalUrl;
                selector.dataset.pendingSelection = newId; // Mark for loadSettings
            }
        } else {
            const trimmedUrl = urlInput.value.trim();
            const nameInput = document.getElementById('modalServiceName');
            const trimmedName = nameInput ? nameInput.value.trim() : '';

            if (saved.customLinks && selector.value.startsWith('custom_')) {
                if (!trimmedUrl || !trimmedName) {
                    // Auto-delete if URL or Name is empty
                    saved.customLinks = saved.customLinks.filter(l => l.id !== selector.value);
                    delete saved[selector.value];
                    selector.value = 'cbsUrl';
                } else {
                    saved[selector.value] = trimmedUrl;
                    const link = saved.customLinks.find(l => l.id === selector.value);
                    if (link) {
                        link.name = trimmedName;
                        link.url = trimmedUrl;
                    }
                }
            } else {
                saved[selector.value] = trimmedUrl;
            }
        }
    }

    // Sync static fields from other modals (User/Branch Info)
    const mappings = {
        'modalUserNameBn': 'userNameBn', 'modalUserDesignationBn': 'userDesignationBn',
        'modalUserPFBn': 'userPFBn', 'modalUserNameEn': 'userNameEn',
        'modalUserDesignationEn': 'userDesignationEn', 'modalUserPFEn': 'userPFEn',
        'modalUserContact': 'userContact', 'modalUserRole': 'userRole',
        'modalBranchNameBn': 'branchNameBn', 'modalBranchLocationBn': 'branchLocationBn',
        'modalBranchThanaBn': 'branchThanaBn', 'modalBranchUpazilaBn': 'branchUpazilaBn',
        'modalBranchDistrictBn': 'branchDistrictBn', 'modalBranchDivisionBn': 'branchDivisionBn',
        'modalBranchNameEn': 'branchNameEn', 'modalBranchLocationEn': 'branchLocationEn',
        'modalBranchThanaEn': 'branchThanaEn', 'modalBranchUpazilaEn': 'branchUpazilaEn',
        'modalBranchDistrictEn': 'branchDistrictEn', 'modalBranchDivisionEn': 'branchDivisionEn',
        'modalBranchEmail': 'branchEmail', 'modalBranchCode': 'branchCode',
        'modalBranchMobile': 'branchMobile', 'modalBranchTel': 'branchTel'
    };

    Object.keys(mappings).forEach(id => syncField(id, mappings[id]));

    window.AppStorage.setItem('bkb_tms_settings', JSON.stringify(saved));
    console.log('Settings updated in local storage.');
    updateFooterUI(saved);

    const activeWin = getActiveIframe()?.contentWindow;
    const activeLogic = activeWin?.SBACFormLogic || activeWin?.AgriLoanLogic || activeWin?.CmsmeLoanLogic || activeWin?.cmsmeApp || activeWin?.DPSMSSFormLogic || activeWin?.RTGSFormLogic || activeWin?.DepositLoanLogic;
    if (activeLogic?.applyBranchInfo) {
        activeLogic.applyBranchInfo();
    } else if (typeof activeWin?.applyBranchInfo === 'function') {
        activeWin.applyBranchInfo();
    }
}

window.switchServiceLinkView = function () {
    const selector = document.getElementById('modalServiceSelector');
    const urlInput = document.getElementById('modalServiceUrl');
    const nameGroup = document.getElementById('group-service-name');
    const nameInput = document.getElementById('modalServiceName');
    const delBtn = document.getElementById('btn-delete-service-link');
    const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');

    if (selector && urlInput) {
        // Always show the fields so the user doesn't think they are missing
        if (nameGroup) nameGroup.style.display = 'block';
        if (delBtn) delBtn.style.display = 'inline-block';

        if (selector.value === 'new') {
            if (nameInput) {
                nameInput.readOnly = false;
                nameInput.value = '';
            }
            if (delBtn) {
                delBtn.disabled = false;
                delBtn.style.opacity = '1';
                delBtn.textContent = 'Clear Input'; // Acts as a clear button
            }
            urlInput.value = '';
        } else if (selector.value.startsWith('custom_')) {
            if (nameInput) {
                nameInput.readOnly = false;
                const link = saved.customLinks ? saved.customLinks.find(l => l.id === selector.value) : null;
                nameInput.value = link ? link.name : '';
            }
            if (delBtn) {
                delBtn.disabled = false;
                delBtn.style.opacity = '1';
                delBtn.textContent = 'Delete Link';
            }
            urlInput.value = saved[selector.value] || '';
        } else {
            if (nameInput) {
                nameInput.readOnly = true;
                const optionText = selector.options[selector.selectedIndex]?.text || '';
                nameInput.value = optionText;
            }
            if (delBtn) {
                delBtn.disabled = true;
                delBtn.style.opacity = '0.5';
                delBtn.textContent = 'Cannot Delete Default';
            }
            urlInput.value = saved[selector.value] || '';
        }
    }
};

/**
 * Loads settings from window.AppStorage into the modal inputs
 */
function loadSettings() {
    const saved = window.AppStorage.getItem('bkb_tms_settings');
    if (!saved) return;

    let settings = JSON.parse(saved);

    // Self-healing: Remove any corrupted links or the bugged 'CIB inquiry'
    if (settings.customLinks) {
        let changed = false;
        settings.customLinks = settings.customLinks.filter(l => {
            const isCorrupted = !l.id || typeof l.id !== 'string' || !l.id.startsWith('custom_') || l.name === 'CIB inquiry';
            if (isCorrupted) {
                changed = true;
                if (l.id) delete settings[l.id];
                return false;
            }
            return true;
        });
        if (changed) {
            window.AppStorage.setItem('bkb_tms_settings', JSON.stringify(settings));
        }
    }

    // Helper to safely populate if element exists
    const populate = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.value = settings[key] || '';
    };

    // Move initialization to the end so options are present
    // User Info
    populate('modalUserNameBn', 'userNameBn');
    populate('modalUserDesignationBn', 'userDesignationBn');
    populate('modalUserPFBn', 'userPFBn');
    populate('modalUserNameEn', 'userNameEn');
    populate('modalUserDesignationEn', 'userDesignationEn');
    populate('modalUserPFEn', 'userPFEn');
    populate('modalUserContact', 'userContact');
    const roleEl = document.getElementById('modalUserRole');
    if (roleEl) roleEl.value = settings.userRole || 'Manager';

    // Branch Info
    document.getElementById('modalBranchDivisionEn').value = settings.branchDivisionEn || '';
    populate('modalBranchNameBn', 'branchNameBn');
    populate('modalBranchLocationBn', 'branchLocationBn');
    populate('modalBranchThanaBn', 'branchThanaBn');
    populate('modalBranchUpazilaBn', 'branchUpazilaBn');
    populate('modalBranchDistrictBn', 'branchDistrictBn');
    populate('modalBranchDivisionBn', 'branchDivisionBn');
    populate('modalBranchNameEn', 'branchNameEn');
    populate('modalBranchLocationEn', 'branchLocationEn');
    populate('modalBranchThanaEn', 'branchThanaEn');
    populate('modalBranchUpazilaEn', 'branchUpazilaEn');
    populate('modalBranchDistrictEn', 'branchDistrictEn');
    populate('modalBranchDivisionEn', 'branchDivisionEn');
    populate('modalBranchEmail', 'branchEmail');
    populate('modalBranchCode', 'branchCode');
    populate('modalBranchMobile', 'branchMobile');
    populate('modalBranchTel', 'branchTel');

    updateFooterUI(settings);

    // Render custom links
    const customLinksList = settings.customLinks || [];
    const optgroup = document.getElementById('optgroup-custom-links');
    const navSubItems = document.getElementById('group-web-services')?.querySelector('.nav-sub-items');

    if (optgroup) {
        Array.from(optgroup.children).forEach(child => {
            if (child.value !== 'new') child.remove();
        });
        customLinksList.forEach(link => {
            const option = document.createElement('option');
            option.value = link.id;
            option.textContent = link.name;
            optgroup.insertBefore(option, optgroup.lastElementChild);
        });
    }

    if (navSubItems) {
        Array.from(navSubItems.querySelectorAll('.nav-sub-item.custom-link-item')).forEach(el => el.remove());
        const editLinkBtn = document.getElementById('nav-edit-all-service-links');
        customLinksList.forEach(link => {
            const div = document.createElement('div');
            div.className = 'nav-sub-item custom-link-item';
            div.textContent = link.name;
            div.id = 'nav-' + link.id;
            if (editLinkBtn) navSubItems.insertBefore(div, editLinkBtn);

            // Setup listener manually as setupNavLink requires DOM id
            div.addEventListener('click', () => {
                const s = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
                if (typeof openExternalPortal === 'function') {
                    openExternalPortal(s[link.id] || link.url, link.name);
                }
            });
        });
    }

    // Initialize Service Link Modal display
    // If we just saved a new link, select it now that the options exist
    const selector = document.getElementById('modalServiceSelector');
    if (selector && selector.dataset.pendingSelection) {
        selector.value = selector.dataset.pendingSelection;
        delete selector.dataset.pendingSelection;
    }
    window.switchServiceLinkView();
}

window.getCentralBranchCode = function () {
    const saved = window.AppStorage.getItem('bkb_tms_settings');
    if (!saved) return "";
    const settings = JSON.parse(saved);
    return settings.branchCode || "";
};

window.getCentralBranchData = function () {
    const saved = window.AppStorage.getItem('bkb_tms_settings');
    if (!saved) return {};
    const settings = JSON.parse(saved);
    return {
        nameBn: settings.branchNameBn || "",
        locationBn: settings.branchLocationBn || "",
        thanaBn: settings.branchThanaBn || "",
        upazilaBn: settings.branchUpazilaBn || "",
        districtBn: settings.branchDistrictBn || "",
        divisionBn: settings.branchDivisionBn || "",
        nameEn: settings.branchNameEn || "",
        locationEn: settings.branchLocationEn || "",
        thanaEn: settings.branchThanaEn || "",
        upazilaEn: settings.branchUpazilaEn || "",
        districtEn: settings.branchDistrictEn || "",
        divisionEn: settings.branchDivisionEn || "",
        email: settings.branchEmail || "",
        mobile: settings.branchMobile || "",
        tel: settings.branchTel || "",
        code: settings.branchCode || ""
    };
};

function updateFooterUI(s) {
    if (document.getElementById('display-user-name')) document.getElementById('display-user-name').textContent = s.userNameEn || 'Guest';
    if (document.getElementById('display-user-designation')) document.getElementById('display-user-designation').textContent = s.userDesignationEn || 'User';
    if (document.getElementById('display-user-pf')) document.getElementById('display-user-pf').textContent = s.userPFEn || '0000';
    if (document.getElementById('display-user-contact')) document.getElementById('display-user-contact').textContent = s.userContact || '';

    if (document.getElementById('display-branch-name')) document.getElementById('display-branch-name').textContent = s.branchNameBn || 'Branch';
    if (document.getElementById('display-branch-location')) document.getElementById('display-branch-location').textContent = s.branchLocationBn || 'Location';
    if (document.getElementById('display-branch-division')) document.getElementById('display-branch-division').textContent = s.branchDivisionBn || 'Division';

    if (document.getElementById('display-welcome-role')) document.getElementById('display-welcome-role').textContent = s.userRole || 'Guest';

    // Populate welcome screen placeholders
    if (document.getElementById('welcome-user-name')) document.getElementById('welcome-user-name').textContent = s.userNameEn || '';
    if (document.getElementById('welcome-user-designation')) document.getElementById('welcome-user-designation').textContent = s.userDesignationEn || '';
    if (document.getElementById('welcome-user-pf')) document.getElementById('welcome-user-pf').textContent = s.userPFEn ? 'PF-' + s.userPFEn : '';
    if (document.getElementById('welcome-user-contact')) document.getElementById('welcome-user-contact').textContent = s.userContact || '';
}

/**
 * Role-Based Task Alert System
 */
const systemBankTasks = [
    { id: 't1', role: 'Manager', text: 'Cash & Vault Balance Verification', freq: 'daily', type: 'General Task' },
    { id: 't2', role: 'Manager', text: 'Branch Monthly Performance Review', freq: 'monthly', type: 'General Task' },
    { id: 't3', role: 'Credit Officer', text: 'Loan Recovery Targets Update', freq: 'daily', type: 'General Task' },
    { id: 't4', role: 'Officer Cash', text: 'Physical Cash Reconciliation', freq: 'daily', type: 'General Task' },
    { id: 't5', role: '2nd Officer', text: 'System Day-End Backup Verification', freq: 'daily', type: 'General Task' },
    { id: 't6', role: 'Manager', text: 'Quarterly Risk Assessment Report', freq: 'quarterly', type: 'General Task' },
    { id: 't7', role: '2nd Officer', text: 'Monthly GL Reconciliation', freq: 'monthly', type: 'General Task' },
    { id: 't8', role: 'General Banking', text: 'Check Book Issuance Log Verification', freq: 'daily', type: 'General Task' }
];

/**
 * Sets the min date for all date inputs to today to prevent past scheduling
 */
function enforceFutureDates() {
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(el => {
        el.min = today;
    });
}

window.openTaskSchedulerModal = function () {
    enforceFutureDates();
    // Clear potential leftover values
    document.getElementById('sched_start_date').value = '';
    document.getElementById('sched_end_date').value = '';
    window.SchedulerEngine.renderSchedulerTable();
    document.getElementById('taskSchedulerModal').classList.add('visible');
};

document.getElementById('btn-open-calendar-events')?.addEventListener('click', () => {
    bulkCalendarDates = [];
    stagedDates = []; // Clear pending selections
    window.SchedulerEngine.renderStagedDates();
    document.getElementById('bulk-calendar-body').innerHTML = '';

    // --- Month Logic: Default to Current and Disable Past ---
    const monthDropdown = document.getElementById('bulk_month_name');
    if (monthDropdown) {
        const now = new Date();
        const currentMonthIdx = now.getMonth(); // 0-11

        // Set current month as default
        monthDropdown.selectedIndex = currentMonthIdx;

        // Disable past months
        Array.from(monthDropdown.options).forEach((opt, idx) => {
            if (idx < currentMonthIdx) {
                opt.disabled = true;
                opt.style.color = '#ccc';
            } else {
                opt.disabled = false;
                opt.style.color = 'inherit';
            }
        });
    }

    document.getElementById('calendarEventsModal').classList.add('visible');
    enforceFutureDates();
});

let stagedDates = []; // Staging area for multi-date selection

/**
 * Automatically stages a date when selected in the picker
 */
document.getElementById('bulk_date_picker')?.addEventListener('change', (e) => {
    const dateVal = e.target.value;
    if (!dateVal) return;

    if (stagedDates.includes(dateVal) || bulkCalendarDates.includes(dateVal)) {
        e.target.value = '';
        return;
    }

    stagedDates.push(dateVal);
    e.target.value = ''; // Reset input so user can pick another date immediately
    window.SchedulerEngine.renderStagedDates();
});






function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('visible');
    });
}

/**
 * Network Monitoring Logic
 * Checks connectivity to the Internet and the internal CBS server.
 */
async function checkConnection(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

        // Use 'no-cors' to allow health checks against external domains
        await fetch(url, {
            mode: 'no-cors',
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        return true;
    } catch (e) {
        return false;
    }
}

async function runNetworkChecks() {
    const lightInet = document.getElementById('light-inet');
    const textInet = document.getElementById('text-inet');
    const lightCbs = document.getElementById('light-cbs');
    const textCbs = document.getElementById('text-cbs');

    if (!lightInet || !lightCbs) return;

    // Indicate check in progress
    lightInet.classList.add('pulse');
    lightCbs.classList.add('pulse');

    // 1. Internet Check (Ping Google)
    const isInetUp = await checkConnection('https://www.google.com');
    lightInet.className = 'status-light ' + (isInetUp ? 'light-green' : 'light-red');
    if (textInet) textInet.textContent = isInetUp ? 'INTERNET OK' : 'INTERNET DOWN';

    // 2. CBS Check (Check against the saved Portal URL origin)
    const saved = window.AppStorage.getItem('bkb_tms_settings');
    let cbsTarget = 'http://172.25.2.13:9091'; // Fallback
    if (saved) {
        const settings = JSON.parse(saved);
        if (settings.cbsUrl) {
            try {
                const u = new URL(settings.cbsUrl);
                cbsTarget = u.origin;
            } catch (e) {
                cbsTarget = settings.cbsUrl;
            }
        }
    }

    const isCbsUp = await checkConnection(cbsTarget);
    lightCbs.className = 'status-light ' + (isCbsUp ? 'light-green' : 'light-red');
    if (textCbs) textCbs.textContent = isCbsUp ? 'CBS ACTIVE' : 'CBS OFFLINE';

    lightInet.classList.remove('pulse');
    lightCbs.classList.remove('pulse');
}

// Initial state: show welcome screen, hide frames container
document.addEventListener('DOMContentLoaded', async () => {
    // Check Hardware License
    const licenseInfo = await window.ipcRenderer.invoke('get-license-status');
    const badge = document.getElementById('license-status-badge');

    if (badge) {
        badge.style.display = 'inline-block';
        if (licenseInfo.status === 'activated') {
            badge.textContent = 'Activated';
            badge.style.background = '#27ae60';
        } else if (licenseInfo.status === 'trial') {
            badge.textContent = `Trial (${licenseInfo.daysRemaining} days)`;
            badge.style.background = '#f39c12';
        } else {
            badge.textContent = 'Expired';
            badge.style.background = '#e74c3c';
        }
    }

    window.showRegistrationModal = function () {
        document.getElementById('registrationModal').style.display = 'flex';
        if (licenseInfo.status === 'trial') {
            document.getElementById('btnSkipReg').style.display = 'block';
            document.getElementById('regStatusText').textContent = `You have ${licenseInfo.daysRemaining} days remaining in your trial.`;
        } else if (licenseInfo.status === 'activated') {
            document.getElementById('btnSkipReg').style.display = 'block';
            document.getElementById('regStatusText').textContent = `App is activated!`;
            document.getElementById('regStatusText').style.color = '#27ae60';
        } else {
            document.getElementById('btnSkipReg').style.display = 'none';
            document.getElementById('regStatusText').textContent = 'Your trial has expired. Please enter a serial key.';
            document.getElementById('regStatusText').style.color = '#e74c3c';
        }
    };

    window.skipRegistration = function () {
        document.getElementById('registrationModal').style.display = 'none';
    };

    window.activateLicense = async function () {
        const code = document.getElementById('serialKeyInput').value.trim();
        const res = await window.ipcRenderer.invoke('activate-license', code);
        if (res.success) {
            document.getElementById('registrationModal').style.display = 'none';
            if (badge) {
                badge.textContent = 'Activated';
                badge.style.background = '#27ae60';
            }
            window.showAppToast('✅ Activation successful! Thank you.');
            if (licenseInfo.status === 'expired') {
                location.reload();
            } else {
                licenseInfo.status = 'activated';
            }
        } else {
            const err = document.getElementById('regErrorText');
            err.textContent = res.error || 'Invalid Serial Key';
            err.style.display = 'block';
        }
    };

    if (licenseInfo.status !== 'activated') {
        showRegistrationModal();

        if (licenseInfo.status === 'expired') {
            return; // Halt further initialization until activated
        }

        setInterval(() => {
            window.ipcRenderer.invoke('ping-trial');
        }, 60000); // ping every 1 minute
    }

    loadSettings();
    document.getElementById('welcome-screen').style.display = 'flex';
    framesContainer.style.display = 'none';

    window.SchedulerEngine.renderTaskList();
    // Start Network Monitoring
    runNetworkChecks();
    setInterval(runNetworkChecks, 30000); // Re-check every 30 seconds

    // Modal Control Listeners
    document.getElementById('btn-save-service-links')?.addEventListener('click', () => {
        saveSettings();
        loadSettings();
        closeAllModals();
    });

    // Delete Service Link
    document.getElementById('btn-delete-service-link')?.addEventListener('click', () => {
        const selector = document.getElementById('modalServiceSelector');
        if (selector && selector.value === 'new') {
            // Just clear the inputs
            document.getElementById('modalServiceUrl').value = '';
            document.getElementById('modalServiceName').value = '';
            return;
        }

        if (selector && selector.value.startsWith('custom_')) {
            const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
            if (saved.customLinks) {
                saved.customLinks = saved.customLinks.filter(l => l.id !== selector.value);
                delete saved[selector.value];
                window.AppStorage.setItem('bkb_tms_settings', JSON.stringify(saved));
                loadSettings();

                // Switch selection back to CBS Portal
                selector.value = 'cbsUrl';
                window.switchServiceLinkView();
            }
        }
    });

    document.getElementById('btn-close-service-links')?.addEventListener('click', closeAllModals);

    document.getElementById('btn-save-user-info')?.addEventListener('click', () => {
        saveSettings();
        closeAllModals();
    });
    document.getElementById('btn-close-user-info')?.addEventListener('click', closeAllModals);

    document.getElementById('btn-save-branch-info')?.addEventListener('click', () => {
        saveSettings();
        closeAllModals();
    });
    document.getElementById('btn-close-branch-info')?.addEventListener('click', closeAllModals);

    // Sidebar/Panel Toggles
    document.getElementById('left-toggle')?.addEventListener('click', () => {
        const panel = document.getElementById('left-panel');
        panel.classList.toggle('collapsed');
        document.getElementById('left-toggle').innerHTML = panel.classList.contains('collapsed') ? '&#9654;' : '&#9664;';
    });

    document.getElementById('right-toggle')?.addEventListener('click', () => {
        const panel = document.getElementById('right-panel');
        panel.classList.toggle('collapsed');
        document.getElementById('right-toggle').innerHTML = panel.classList.contains('collapsed') ? '&#9664;' : '&#9654;';
    });

    // Toggle nav-group sub-items
    document.querySelectorAll('.nav-group').forEach(group => {
        const navLabel = group.querySelector('.nav-label');
        if (navLabel) {
            navLabel.addEventListener('click', () => {
                console.log(`Clicked nav-group label: ${navLabel.textContent.trim()}`);
                group.classList.toggle('active');
                const arrow = navLabel.querySelector('.arrow');
                if (arrow) {
                    arrow.textContent = group.classList.contains('active') ? '▼' : '▶';
                }
            });
        }
    });


    // Toggle nav-sub-head sub-lists
    document.querySelectorAll('.nav-sub-head').forEach(subHead => {
        subHead.addEventListener('click', () => {
            console.log(`Clicked nav-sub-head: ${subHead.textContent.trim()}`);
            subHead.classList.toggle('active');
            const arrow = subHead.querySelector('.arrow');
            if (arrow) {
                arrow.textContent = subHead.classList.contains('active') ? '▼' : '▶';
            }
        });
    });

    // Manage Tasks Button
    document.getElementById('btn-manage-tasks')?.addEventListener('click', () => {
        window.openTaskSchedulerModal();
    });

    // Portal Links
    setupNavLink('nav-verify-nid', () => {
        console.log('Clicked: Verify NID');
        const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const nidUrl = saved.nidUrl || 'http://10.0.68.2/nidportal/Login';
        openExternalPortal(nidUrl, 'Veirfy NID');
    }, 'Verify NID');

    setupNavLink('nav-cbs-link', () => {
        console.log('Clicked: CBS Link');
        const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const cbsUrl = saved.cbsUrl || 'http://172.25.2.13:9091/FloraBankWeb/';
        openExternalPortal(cbsUrl, 'CBS');
    }, 'CBS Link');

    setupNavLink('nav-cbs-report', () => {
        console.log('Clicked: CBS Report Link');
        const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const reportUrl = saved.reportUrl || 'http://172.25.2.13:9091/FloraBankWeb/';
        openExternalPortal(reportUrl, 'CBS Report');
    }, 'CBS Report Link');

    // Local Forms
    setupNavLink('nav-deposit-current', () => {
        console.log('Clicked: Current AC Form');
        openLocalForm('forms/deposit/cd_ac_form.html', 'Current AC');
    }, 'Current AC Form');

    setupNavLink('nav-deposit-savings', () => {
        console.log('Clicked: Savings AC Form');
        openLocalForm('forms/deposit/sb_ac_form.html', 'Savings AC');
    }, 'Savings AC Form');

    setupNavLink('nav-deposit-term', () => {
        console.log('Clicked: Term DP AC Form');
        openLocalForm('forms/deposit/dps_mss_form.html', 'Term DP AC');
    }, 'Term DP AC Form');

    setupNavLink('nav-deposit-farmer', () => {
        console.log('Clicked: Farmer AC Form');
        openLocalForm('forms/deposit/farmer_sb_ac_form.html', 'Farmer AC');
    }, 'Farmer AC Form');

    setupNavLink('nav-deposit-cheque-setup', () => {
        console.log('Clicked: Cheque Print Setup');
        openLocalForm('forms/deposit/cheque_print_setup.html', 'Cheque Print Setup');
    }, 'Cheque Print Setup');

    setupNavLink('nav-loan-agri-rcc', () => {
        console.log('Clicked: Agri RCC Loan Form');
        openLocalForm('forms/loan/Agri_Loan_Rcc_Disbursement.html', 'Agri RCC Loan');
    }, 'Agri RCC Loan Form');

    // Commented out: 'Agri Beef & Cow Loan' form not listed in readme.md
    // setupNavLink('nav-loan-beef', () => {
    //     console.log('Clicked: Agri Beef & Cow Loan Form');
    //     openLocalForm('forms/loan/beef_cow_loan_form.html', 'Beef & Cow Loan');
    // }, 'Agri Beef & Cow Loan Form');

    setupNavLink('nav-loan-deposit', () => {
        console.log('Clicked: Deposit Loan Form');
        openLocalForm('forms/loan/deposit_loan.html', 'Deposit Loan');
    }, 'Deposit Loan Form');

    setupNavLink('nav-loan-cmsme', () => {
        console.log('Clicked: CMSME Loan Form');
        openLocalForm('forms/loan/cmsme/cmsme_loan.html', 'CMSME Loan');
    }, 'CMSME Loan Form');

    setupNavLink('nav-loan-project', () => {
        console.log('Clicked: Project Loan Form');
        openLocalForm('forms/loan/project_loan.html', 'Project Loan');
    }, 'Project Loan Form');

    setupNavLink('nav-beftn', () => {
        console.log('Clicked: BEFTN Form');
        openLocalForm('forms/transaction/eftn.html', 'BEFTN');
    }, 'BEFTN Form');

    setupNavLink('nav-bangla-qr', () => {
        console.log('Clicked: Bangla Qr Application Form');
        openLocalForm('forms/transaction/bangla_qr_application.html', 'Bangla Qr Application');
    }, 'Bangla Qr Application Form');

    setupNavLink('nav-rtgs', () => {
        console.log('Clicked: RTGS Form');
        openLocalForm('forms/transaction/rtgs.html', 'RTGS');
    }, 'RTGS Form');

    setupNavLink('nav-salary-lunch', () => {
        console.log('Clicked: Lunch Bill Form');
        openLocalForm('forms/salary&bills/lunch_bill.html', 'Lunch Bill');
    }, 'Lunch Bill Form');

    setupNavLink('nav-customer-list', () => {
        console.log('Clicked: সংরক্ষিত গ্রাহক তালিকা');
        openLocalForm('forms/customer_list/customer_profile.html', 'সংরক্ষিত গ্রাহক তালিকা');
    }, 'সংরক্ষিত গ্রাহক তালিকা');

    setupNavLink('nav-calc-loan', () => {
        console.log('Clicked: Loan Calculator');
        openLocalForm('forms/calculators/interest_calculator.html', 'Loan Calculator');
    }, 'Loan Calculator');

    setupNavLink('nav-loan-classification', () => {
        console.log('Clicked: Loan Classification Tool');
        openLocalForm('forms/reportgeneration/loan_classification_Tool.html', 'Loan Classification');
    }, 'Loan Classification Tool');

    setupNavLink('nav-report-borrower-list', () => {
        console.log('Clicked: Borrower List');
        openLocalForm('forms/reportgeneration/borrower_list.html', 'Borrower List');
    }, 'Borrower List');

    setupNavLink('nav-report-loan-case', () => {
        console.log('Clicked: Loan Case Register');
        openLocalForm('forms/reportgeneration/loan_case_register.html', 'Loan Case Register');
    }, 'Loan Case Register');

    setupNavLink('nav-performance-branch', () => {
        console.log('Clicked: Branch Performance');
    }, 'Branch Performance');

    // Monitoring Notices
    setupNavLink('nav-monitoring-demand', () => {
        openLocalForm('forms/notice/demand_notice.html', 'Demand Notice');
    }, 'Demand Notice');
    setupNavLink('nav-monitoring-legal', () => {
        openLocalForm('forms/notice/legal_notice.html', 'Legal Notice');
    }, 'Legal Notice');
    setupNavLink('nav-monitoring-advocate', () => {
        openLocalForm('forms/notice/advocate_notice.html', 'Advocate Notice');
    }, 'Advocate Notice');
    setupNavLink('nav-monitoring-final', () => {
        openLocalForm('forms/notice/final_notice.html', 'Final Notice');
    }, 'Final Notice');
    setupNavLink('nav-monitoring-special', () => {
        openLocalForm('forms/notice/special_notice.html', 'Special Notice');
    }, 'Special Notice');
    setupNavLink('nav-monitoring-camp', () => {
        openLocalForm('forms/notice/camp_notice.html', 'Camp Notice');
    }, 'Camp Notice');

    window.closePulledNidDataModal = function () {
        document.getElementById('pulledNidDataModal').classList.remove('visible');
        if (typeof window.getActiveIframe === 'function') {
            const frame = window.getActiveIframe();
            if (frame) frame.focus();
        }
    };

    /**
     * Internal helper to normalize NID/Number inputs to standard English digits.
     */
    function toEnglishDigits(str) {
        if (!str) return "";
        const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
        return str.toString().replace(/[০-৯]/g, d => banglaDigits.indexOf(d)).replace(/[\s-]/g, '');
    }

    window.addCustomerFromPulledNidData = function () {
        const nameBn = (document.getElementById('pulled_nid_name_bn').value || '').trim();
        const nameEn = (document.getElementById('pulled_nid_name_en').value || '').trim().toUpperCase();
        const n10Input = toEnglishDigits(document.getElementById('pulled_nid_nid').value).replace(/\D/g, '');
        const n17Input = toEnglishDigits(document.getElementById('pulled_nid_pin').value).replace(/\D/g, '');
        let nid = n10Input || n17Input;

        // Require at least a name or a real NID to save
        if (!nid && !nameBn && !nameEn) {
            window.showAppToast('অনুগ্রহ করে কমপক্ষে নাম অথবা এনআইডি নম্বর প্রদান করুন।', true);
            return;
        }

        // If no NID, generate a temporary unique key so partial data can still be saved
        if (!nid) {
            const nameKey = (nameBn || nameEn).replace(/\s+/g, '_').substring(0, 20);
            nid = `TEMP-${nameKey}-${Date.now()}`;
        }

        const customer = {
            photo: document.getElementById('pulled_nid_photo').src,
            applicant_name_bn: nameBn,
            applicant_name_en: nameEn,
            applicant_father_name_bn: (document.getElementById('pulled_nid_father_name_bn').value || '').trim(),
            applicant_mother_name_bn: (document.getElementById('pulled_nid_mother_name_bn').value || '').trim(),
            applicant_spouse_name_bn: (document.getElementById('pulled_nid_spouse_name_bn')?.value || '').trim(),
            applicant_gender: (document.getElementById('pulled_nid_gender')?.value || '').trim(),
            applicant_nid: nid,
            applicant_nid_10: (n10Input.length === 10) ? n10Input : '',
            applicant_nid_17: (n17Input.length === 17) ? n17Input : '',
            applicant_dob: (document.getElementById('pulled_nid_dob').value || '').trim(),
            applicant_present_division: (document.getElementById('pulled_nid_present_division').value || '').trim(),
            applicant_present_district: (document.getElementById('pulled_nid_present_district').value || '').trim(),
            applicant_present_upozila: (document.getElementById('pulled_nid_present_upozila').value || '').trim(),
            applicant_curr_addr_house: (document.getElementById('pulled_nid_present_house')?.value || '').trim(),
            applicant_curr_addr_village: (document.getElementById('pulled_nid_present_village')?.value || '').trim(),
            applicant_curr_addr_post: (document.getElementById('pulled_nid_present_post')?.value || '').trim(),
            applicant_curr_addr_post_code: (document.getElementById('pulled_nid_present_post_code')?.value || '').trim(),
            applicant_curr_addr_union: (document.getElementById('pulled_nid_present_union')?.value || '').trim(),
            applicant_curr_city_corp: (document.getElementById('pulled_nid_present_city_corp')?.value || '').trim(),
            applicant_permanent_division: (document.getElementById('pulled_nid_permanent_division').value || '').trim(),
            applicant_permanent_district: (document.getElementById('pulled_nid_permanent_district').value || '').trim(),
            applicant_permanent_upozila: (document.getElementById('pulled_nid_permanent_upozila').value || '').trim(),
            applicant_perm_addr_house: (document.getElementById('pulled_nid_permanent_house')?.value || '').trim(),
            applicant_perm_addr_village: (document.getElementById('pulled_nid_permanent_village')?.value || '').trim(),
            applicant_perm_addr_post: (document.getElementById('pulled_nid_permanent_post')?.value || '').trim(),
            applicant_perm_addr_post_code: (document.getElementById('pulled_nid_permanent_post_code')?.value || '').trim(),
            applicant_perm_addr_union: (document.getElementById('pulled_nid_permanent_union')?.value || '').trim(),
            applicant_perm_city_corp: (document.getElementById('pulled_nid_permanent_city_corp')?.value || '').trim(),
            applicant_mobile: (document.getElementById('pulled_nid_mobile')?.value || '').trim(),
            applicant_nationality: 'Bangladeshi'
        };

        window.ipcRenderer.invoke('db-get-all-customers').then(res => {
            let existingCustomer = null;
            const allCustomers = (res && res.success) ? res.data : [];
            
            for (const c of allCustomers) {
                const hasNidMatch = 
                    (c.applicant_nid && (c.applicant_nid === n10Input || c.applicant_nid === n17Input)) ||
                    (c.applicant_nid_10 && (c.applicant_nid_10 === n10Input || c.applicant_nid_10 === n17Input)) ||
                    (c.applicant_nid_17 && (c.applicant_nid_17 === n17Input || c.applicant_nid_17 === n10Input));
                
                const hasDobMatch = !!c.applicant_dob && !!customer.applicant_dob && (c.applicant_dob === customer.applicant_dob);
                const hasNameMatch = (!!c.applicant_name_en && !!customer.applicant_name_en && c.applicant_name_en === customer.applicant_name_en) || 
                                     (!!c.applicant_name_bn && !!customer.applicant_name_bn && c.applicant_name_bn === customer.applicant_name_bn);

                // Require at least 2 matching variables to confirm existence
                if ((hasNidMatch && hasDobMatch) || (hasNidMatch && hasNameMatch) || (hasDobMatch && hasNameMatch)) {
                    existingCustomer = c;
                    break;
                }
            }

            let customerToSave = customer;
            
            if (existingCustomer) {
                customerToSave = { ...existingCustomer };
                // Keep the old NID as original_nid so main.js knows to update the primary key if it changed
                customerToSave.original_nid = existingCustomer.applicant_nid;
                
                // Update the primary key to the newly pulled nid (which might be the 10-digit)
                customerToSave.applicant_nid = nid;

                // Only overwrite if new field is not blank
                for (let key in customer) {
                    const newVal = customer[key];
                    if (newVal !== '' && newVal !== null && newVal !== undefined) {
                        // Avoid overwriting a valid photo with a blank src (e.g. localhost URL with no actual image)
                        if (key === 'photo' && (newVal === '' || newVal.endsWith('index.html') || newVal === window.location.href)) {
                            continue;
                        }
                        customerToSave[key] = newVal;
                    }
                }
            }

            window.DB.saveCustomer(customerToSave).then((res) => {
                if (res && res.success === false) { window.showAppToast('Error saving customer: ' + res.error, true); return; }
                window.showAppToast('✅ Customer saved to database.');
                window.closePulledNidDataModal();

                // Populate active form with the pulled data so it uses the real NID instead of generating a TEMP one
                if (typeof window.populateActiveForm === 'function') {
                    window.populateActiveForm(customerToSave);
                }

                // Refresh all open customer list frames to reflect the new data immediately
                const listIframe = document.querySelector('iframe[src*="customer_profile.html"]');
                if (listIframe) {
                    listIframe.contentWindow.postMessage({ command: 'REFRESH_CUSTOMER_LIST' }, '*');
                }
            });
        });
    };

    window.copyNidPresentToPermanent = function (isChecked) {
        if (isChecked) {
            const fields = [
                { p: 'pulled_nid_present_house', perm: 'pulled_nid_permanent_house' },
                { p: 'pulled_nid_present_village', perm: 'pulled_nid_permanent_village' },
                { p: 'pulled_nid_present_post', perm: 'pulled_nid_permanent_post' },
                { p: 'pulled_nid_present_post_code', perm: 'pulled_nid_permanent_post_code' },
                { p: 'pulled_nid_present_union', perm: 'pulled_nid_permanent_union' },
                { p: 'pulled_nid_present_city_corp', perm: 'pulled_nid_permanent_city_corp' },
                { p: 'pulled_nid_present_upozila', perm: 'pulled_nid_permanent_upozila' },
                { p: 'pulled_nid_present_district', perm: 'pulled_nid_permanent_district' },
                { p: 'pulled_nid_present_division', perm: 'pulled_nid_permanent_division' }
            ];
            fields.forEach(f => {
                const pVal = document.getElementById(f.p)?.value || '';
                const permEl = document.getElementById(f.perm);
                if (permEl) permEl.value = pVal;
            });
        }
    };

    window.closeCustomerInputModal = function () {
        document.getElementById('customerInputModal').classList.remove('visible');
    };

    function parseJsonArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        try {
            return JSON.parse(value || '[]');
        } catch (error) {
            return [];
        }
    }

    function createTableRow(values, columns, tableBodyId) {
        const tbody = document.querySelector(tableBodyId);
        if (!tbody) return;
        const row = document.createElement('tr');
        const html = columns.map((col, idx) => {
            if (col.type === 'button') {
                return `<td style="text-align:center;"><button type="button" class="modal-btn-secondary" onclick="removeCustomerRow(this)">Remove</button></td>`;
            }
            const value = values[col.name] || '';
            return `<td><input type="text" class="english-input" value="${String(value).replace(/"/g, '&quot;')}"></td>`;
        }).join('');
        row.innerHTML = html;
        tbody.appendChild(row);
    }

    window.addAccountRow = function (account = {}) {
        createTableRow(account, [
            { name: 'account_no' },
            { name: 'account_title' },
            { name: 'account_type' },
            { name: 'branch_name' },
            { name: 'bank_name' },
            { type: 'button' }
        ], '#customerAccountsTable tbody');
    };

    window.addLoanRow = function (loan = {}) {
        createTableRow(loan, [
            { name: 'product' },
            { name: 'outstanding_amount' },
            { name: 'status' },
            { name: 'account_no' },
            { name: 'loan_type' },
            { type: 'button' }
        ], '#customerLoansTable tbody');
    };

    window.addTransactionRow = function (tx = {}) {
        createTableRow(tx, [
            { name: 'date' },
            { name: 'type' },
            { name: 'amount' },
            { name: 'to_bank' },
            { name: 'reference' },
            { type: 'button' }
        ], '#customerTransactionsTable tbody');
    };

    window.removeCustomerRow = function (button) {
        const row = button.closest('tr');
        if (row) row.remove();
    };

    function getTableRows(tableBodyId, keys) {
        const tbody = document.querySelector(tableBodyId);
        if (!tbody) return [];
        return Array.from(tbody.querySelectorAll('tr')).map(row => {
            const inputs = Array.from(row.querySelectorAll('input'));
            const item = {};
            keys.forEach((key, index) => {
                item[key] = inputs[index]?.value.trim() || '';
            });
            return item;
        }).filter(item => Object.values(item).some(value => value));
    }

    function clearCustomerDetailTables() {
        document.querySelectorAll('#customerAccountsTable tbody, #customerLoansTable tbody, #customerTransactionsTable tbody').forEach(body => body.innerHTML = '');
    }

    // --- Photo Adjustment Tool Logic ---
    let cropState = {
        img: null,
        x: 0,
        y: 0,
        scale: 1,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    const adjustModal = document.getElementById('photoAdjustModal');
    const cropImg = document.getElementById('cropPreviewImage');
    const zoomSlider = document.getElementById('cropZoomSlider');
    const cropperCont = document.getElementById('cropperContainer');

    function updateCropPreview() {
        if (!cropImg) return;
        cropImg.style.transform = `translate(${cropState.x}px, ${cropState.y}px) scale(${cropState.scale})`;
    }

    document.getElementById('modalCustomerPhotoInput')?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    cropState.img = img;
                    cropImg.src = img.src;

                    // Initial centering calculation
                    const contRect = cropperCont.getBoundingClientRect();
                    cropState.scale = Math.max(132 / img.width, 170 / img.height);
                    cropState.x = (contRect.width - img.width * cropState.scale) / 2;
                    cropState.y = (contRect.height - img.height * cropState.scale) / 2;

                    if (zoomSlider) {
                        zoomSlider.value = cropState.scale;
                        zoomSlider.min = cropState.scale * 0.5;
                        zoomSlider.max = cropState.scale * 5;
                    }

                    updateCropPreview();
                    adjustModal.classList.add('visible');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    cropperCont?.addEventListener('mousedown', (e) => {
        cropState.isDragging = true;
        cropState.startX = e.clientX - cropState.x;
        cropState.startY = e.clientY - cropState.y;
    });

    window.addEventListener('mousemove', (e) => {
        if (!cropState.isDragging) return;
        cropState.x = e.clientX - cropState.startX;
        cropState.y = e.clientY - cropState.startY;
        updateCropPreview();
    });

    window.addEventListener('mouseup', () => {
        cropState.isDragging = false;
    });

    zoomSlider?.addEventListener('input', (e) => {
        const newScale = parseFloat(e.target.value);
        const contRect = cropperCont.getBoundingClientRect();
        const centerX = contRect.width / 2;
        const centerY = contRect.height / 2;

        cropState.x = centerX - (centerX - cropState.x) * (newScale / cropState.scale);
        cropState.y = centerY - (centerY - cropState.y) * (newScale / cropState.scale);
        cropState.scale = newScale;
        updateCropPreview();
    });

    document.getElementById('btn-apply-crop')?.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 132; // Passport Width
        canvas.height = 170; // Passport Height
        const ctx = canvas.getContext('2d');

        const contRect = cropperCont.getBoundingClientRect();
        const frameRect = document.getElementById('cropFrame').getBoundingClientRect();

        const relX = (frameRect.left - contRect.left - cropState.x) / cropState.scale;
        const relY = (frameRect.top - contRect.top - cropState.y) / cropState.scale;

        ctx.drawImage(cropState.img, relX, relY, 132 / cropState.scale, 170 / cropState.scale, 0, 0, 132, 170);
        document.getElementById('modalCustomerPhoto').src = canvas.toDataURL('image/jpeg', 0.9);
        adjustModal.classList.remove('visible');
    });

    document.getElementById('btn-cancel-crop')?.addEventListener('click', () => {
        adjustModal.classList.remove('visible');
    });

    document.getElementById('btn-pull-nid-data-show-modal')?.addEventListener('click', () => {
        window.WebEngine.pullNidDataAndShowModal();
    });

    document.getElementById('btn-add-customer-from-nid')?.addEventListener('click', () => {
        addCustomerFromPulledNidData();
    });

    // Edit Service Links Modal (already handled, ensure it doesn't interfere)
    setupNavLink('nav-edit-all-service-links', () => {
        document.getElementById('serviceLinksEditModal').classList.add('visible');
        window.switchServiceLinkView(); // Ensure the URL input matches the current selector
    }, 'Edit Service Links Modal');

    setupNavLink('btn-open-app-settings', () => {
        openLocalForm('assets/app_settings.html', 'App Settings');
    }, 'Open App Settings');

    // Right Panel - Form Actions Wiring
    window.getFormLogic = function (win) {
        if (!win) return null;
        try {
            return win.SBACFormLogic || win.DepositLoanLogic || win.AgriLoanLogic || win.CmsmeLoanLogic || win.cmsmeApp || win.DPSMSSFormLogic || win.RTGSFormLogic || win.EFTNFormLogic || win.InterestCalcLogic;
        } catch (e) {
            return null;
        }
    };
    const getFormLogic = window.getFormLogic;

    document.getElementById('btn-data-entry')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        console.log('btn-data-entry clicked. win:', win, 'EFTNFormLogic:', win?.EFTNFormLogic);
        const logic = getFormLogic(win);
        if (logic?.openModal) logic.openModal();
        else if (logic?.openDataInput) logic.openDataInput();
        else { try { if (typeof win?.openModal === 'function') win.openModal(); } catch (e) { } }
    });

    document.getElementById('btn-generate-notice')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.generateNotice === 'function') {
            win.generateNotice();
        } else {
            console.warn('generateNotice function not found on iframe window');
        }
    });


    document.getElementById('btn-start-new')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        const logic = getFormLogic(win);
        if (logic?.startNewForm) logic.startNewForm();
        else if (logic?.startNew) logic.startNew();
        else {
            try {
                if (typeof win?.startNewForm === 'function') win.startNewForm();
                else if (typeof win?.startNew === 'function') win.startNew();
            } catch (e) { }
        }
    });

    document.getElementById('btn-clear-form')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        const logic = getFormLogic(win);
        if (logic?.clearForm) logic.clearForm();
        else if (logic?.clearData) logic.clearData();
        else {
            try {
                if (typeof win?.clearForm === 'function') { win.clearForm(); return; }
                if (typeof win?.clearData === 'function') { win.clearData(); return; }
            } catch (e) { }
            // Fallback for cross-origin or if functions don't exist
            win?.postMessage({ command: 'EXECUTE_ACTION', actionId: 'btn-clear-form' }, '*');
        }

    });

    // Customer Import Modal - context-aware slot support
    window.currentImportContext = null;
    let selectedImportCustomer = null;

    function openImportModal(context) {
        window.currentImportContext = context || null;
        const modalTitle = document.querySelector('#customerImportModal h3');
        if (modalTitle) {
            if (context) {
                const readableContext = context
                    .replace('person_', 'Joint Applicant ')
                    .replace('cmsme_applicant_', 'Co-applicant ')
                    .replace('cmsme_guarantor_', 'Guarantor ')
                    .replace('cmsme_entity_owner', 'Entity Owner / Proprietor')
                    .replace(/_/g, ' ');
                modalTitle.textContent = String.fromCodePoint(0x1F50D) + ' Pull Customer: ' + readableContext;
            } else {
                modalTitle.textContent = 'গ্রাহক তথ্য ইমপোর্ট (Import Customer Info)';
            }
        }
        const searchInput = document.getElementById('import_search_query');
        searchInput.value = '';
        selectedImportCustomer = null;
        document.getElementById('import-result-preview').style.display = 'none';
        document.getElementById('import-no-result').style.display = 'none';
        document.getElementById('btn-confirm-import-populate').style.display = 'none';
        document.getElementById('import-accounts-container').style.display = 'none';
        document.getElementById('customerImportModal').classList.add('visible');
        setTimeout(() => requestAnimationFrame(() => searchInput.focus()), 200);
    }

    document.getElementById('btn-import-customer')?.addEventListener('click', () => {
        openImportModal(null);
    });

    document.getElementById('import_search_query')?.addEventListener('input', (e) => {
        const query = toEnglishDigits(e.target.value.trim());
        const preview = document.getElementById('import-result-preview');
        const noResult = document.getElementById('import-no-result');
        const populateBtn = document.getElementById('btn-confirm-import-populate');
        if (query.length < 3) {
            preview.style.display = 'none';
            noResult.style.display = 'none';
            populateBtn.style.display = 'none';
            return;
        }
        window.DB.searchCustomers(query).then(results => {
            if (results && results.length > 0) {
                const c = results[0];
                selectedImportCustomer = c;
                document.getElementById('import_preview_name').textContent = c.applicant_name_bn || c.applicant_name_en || 'N/A';
                document.getElementById('import_preview_father').textContent = c.applicant_father_name_bn || c.applicant_father_name_en || 'N/A';
                document.getElementById('import_preview_dob').textContent = c.applicant_dob || 'N/A';
                document.getElementById('import_preview_village').textContent = c.applicant_curr_addr_village || 'N/A';
                const photoImg = document.getElementById('import_preview_photo');
                if (c.photo && c.photo.startsWith('data:image')) { photoImg.src = c.photo; }
                else { photoImg.src = 'assets/images/user_placeholder.png'; }
                preview.style.display = 'block';
                noResult.style.display = 'none';
                populateBtn.style.display = 'inline-block';
                const accountsContainer = document.getElementById('import-accounts-container');
                const accountSelect = document.getElementById('import_account_select');
                const activeIframe = getActiveIframe();
                const isTransactionForm = activeIframe && (activeIframe.src.includes('rtgs.html') || activeIframe.src.includes('eftn.html'));
                if (isTransactionForm && c.accounts) {
                    try {
                        const accounts = typeof c.accounts === 'string' ? JSON.parse(c.accounts) : c.accounts;
                        if (Array.isArray(accounts) && accounts.length > 0) {
                            accountSelect.innerHTML = '';
                            accounts.forEach((acc, index) => {
                                const option = document.createElement('option');
                                option.value = index;
                                option.textContent = acc.account_no + ' - ' + (acc.account_type || 'N/A');
                                accountSelect.appendChild(option);
                            });
                            accountsContainer.style.display = 'block';
                        } else { accountsContainer.style.display = 'none'; }
                    } catch (e2) { accountsContainer.style.display = 'none'; }
                } else { accountsContainer.style.display = 'none'; }
            } else {
                selectedImportCustomer = null;
                preview.style.display = 'none';
                noResult.style.display = 'block';
                populateBtn.style.display = 'none';
                document.getElementById('import-accounts-container').style.display = 'none';
            }
        }).catch(err => {
            console.error('Search error:', err);
            window.showAppToast('Error searching customers: ' + err.message, true);
        });
    });

    document.getElementById('btn-confirm-import-populate')?.addEventListener('click', () => {
        if (!selectedImportCustomer) return;
        let targetIframe = getActiveIframe();
        if (!targetIframe) { window.showAppToast('Please open a target form before populating.', true); return; }
        const customerToPopulate = { ...selectedImportCustomer };
        const accountsContainer2 = document.getElementById('import-accounts-container');
        if (accountsContainer2 && accountsContainer2.style.display === 'block') {
            const accountSelect2 = document.getElementById('import_account_select');
            const selectedIdx = parseInt(accountSelect2.value);
            if (!isNaN(selectedIdx)) {
                try {
                    const accts = typeof customerToPopulate.accounts === 'string' ? JSON.parse(customerToPopulate.accounts) : customerToPopulate.accounts;
                    const selectedAcc = accts[selectedIdx];
                    if (selectedAcc) {
                        customerToPopulate.deposit_account_no = selectedAcc.account_no;
                        customerToPopulate.rtgs_sender_account = selectedAcc.account_no;
                        customerToPopulate.account_no = selectedAcc.account_no;
                        customerToPopulate.sender_account = selectedAcc.account_no;
                        if (selectedAcc.account_title) customerToPopulate.account_title = selectedAcc.account_title;
                    }
                } catch (e3) { console.error('Error selecting account:', e3); }
            }
        }
        if (window.currentImportContext === 'CBS_PORTAL') {
            window.WebEngine.injectCbsAutofill(customerToPopulate);
            document.getElementById('customerImportModal').classList.remove('visible');
            return;
        }
        populateActiveForm(customerToPopulate, window.currentImportContext);
        window.currentImportContext = null;
        document.getElementById('customerImportModal').classList.remove('visible');
        const tabId = targetIframe.closest('.tab-content').getAttribute('data-tab-id');
        activateTab(tabId);
        setTimeout(() => targetIframe.contentWindow.focus(), 200);
    });

    document.getElementById('btn-save-form')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        const logic = getFormLogic(win);
        if (logic?.saveForm) {
            console.log('Triggering saveForm() in iframe logic');
            logic.saveForm();
        } else if (logic?.saveData) {
            console.log('Triggering saveData() fallback in iframe logic');
            logic.saveData();
        } else if (typeof win?.saveForm === 'function') {
            console.log('Triggering saveForm() fallback in iframe global scope');
            win.saveForm();
        } else if (typeof win?.saveData === 'function') {
            console.log('Triggering saveData() fallback in iframe global scope');
            win.saveData();
        } else {
            console.warn('Active form does not have a saveForm or saveData function defined.');
        }
    });


    document.getElementById('btn-db-manager')?.addEventListener('click', () => {
        openLocalForm('forms/db_manager.html', 'Database Manager');
    });

    document.getElementById('btn-change-db')?.addEventListener('click', () => {
        if (typeof window.changeDbLocation === 'function') {
            window.changeDbLocation();
        }
    });

    document.getElementById('btn-save-work')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        const logic = getFormLogic(win);
        if (logic?.saveWork) {
            console.log('Saving Draft (Save Work) to LocalStorage');
            logic.saveWork();
        } else if (typeof win?.loadWork === 'function') {
            console.log('Active form supports loadWork but no explicit saveWork method. Skipping saveWork.');
        } else {
            console.warn('Active form does not support Save Work (Drafts).');
        }
        console.log('Initiating Full System Export for Migration...');
        const allLocalData = window.AppStorage.getAll();

        let branchName = 'Branch';
        let userName = 'User';
        const settingsStr = window.AppStorage.getItem('bkb_tms_settings');
        if (settingsStr) {
            try {
                const s = JSON.parse(settingsStr);
                if (s.branchInfo?.nameEn) branchName = s.branchInfo.nameEn.replace(/[^a-zA-Z0-9]/g, '');
                if (s.userInfo?.nameEn) userName = s.userInfo.nameEn.replace(/[^a-zA-Z0-9]/g, '');
            } catch (e) { }
        }
        const suggestedName = `${branchName}_${userName}.bkb`;

        window.ipcRenderer.invoke('app-full-export', allLocalData, suggestedName).then(res => {
            if (res.success) window.showAppToast(`✅ Backup created at: ${res.path}

You can now take this file to another branch.`);
            else if (res.error) window.showAppToast('Export failed: ' + res.error, true);
        });
    });

    document.getElementById('btn-load-work')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        const logic = getFormLogic(win);
        if (logic?.loadWork) {
            console.log('Loading Draft (Load Work) from LocalStorage');
            logic.loadWork();
        } else {
            console.warn('Active form does not support Load Work.');
        }
        console.log('Initiating Full System Import...');
        if (!confirm("Warning: Importing a backup will overwrite your current database and settings. Continue?")) return;

        window.ipcRenderer.invoke('app-full-import').then(res => {
            if (res.success) {
                if (res.settings) {
                    if (res.settings.userRole || res.settings.customLinks) {
                        window.AppStorage.setItem('bkb_tms_settings', JSON.stringify(res.settings));
                    } else {
                        for (const [key, value] of Object.entries(res.settings)) {
                            window.AppStorage.setItem(key, value);
                        }
                    }
                }
                window.showAppToast('✅ System restored. Reloading...');
                window.location.reload();
            } else {
                if (res.error !== 'cancelled') window.showAppToast('Import failed: ' + res.error, true);
            }
        });
    });

    document.getElementById('btn-reset-suite')?.addEventListener('click', () => {
        if (!confirm("WARNING: This will completely WIPE ALL DATA, SETTINGS, and DATABASES from the application, returning it to a factory state. Are you absolutely sure?")) return;
        window.ipcRenderer.invoke('app-reset-data').then(res => {
            if (res.success) {
                window.AppStorage.clear();
                window.showAppToast('✅ System reset successfully. Exiting...');
                window.close();
            } else {
                window.showAppToast('Reset failed: ' + res.error, true);
            }
        });
    });

    document.getElementById('btn-update-suite')?.addEventListener('click', () => {
        if (!confirm("This will prompt you to select an update file (.asar) and restart the application. Proceed?")) return;
        window.ipcRenderer.invoke('app-apply-update').then(res => {
            if (res.success) {
                console.log("Update initiated successfully");
            } else if (res.error !== 'cancelled') {
                window.showAppToast('Update failed: ' + res.error, true);
            }
        });
    });

    /**
     * Internal helper to sync current DOM values (inputs/selects) into HTML attributes.
     * This ensures prefilled data appears in PDF/Print generation.
     */
    function getSynchronizedHTML(iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const inputs = doc.querySelectorAll('input, select, textarea');
        inputs.forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') {
                if (el.checked) el.setAttribute('checked', 'checked');
                else el.removeAttribute('checked');
            } else if (el.tagName === 'SELECT') {
                Array.from(el.options).forEach(opt => {
                    if (opt.value === el.value) opt.setAttribute('selected', 'selected');
                    else opt.removeAttribute('selected');
                });
            } else if (el.tagName === 'TEXTAREA') {
                el.textContent = el.value;
            } else {
                el.setAttribute('value', el.value);
            }
        });
        return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
    }

    document.getElementById('btn-print-form')?.addEventListener('click', () => {
        const iframe = getActiveIframe();
        if (!iframe) return;

        const html = getSynchronizedHTML(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        let pSize = 'A4';
        if (doc.querySelector('#Stamps.active') || iframe.src.includes('stamps/')) {
            pSize = 'Legal';
        }

        const options = {
            pageRanges: document.getElementById('print-range-input')?.value || '',
            landscape: document.getElementById('print-orientation-input')?.value === 'landscape',
            pageSize: pSize
        };

        // Get the absolute path to the form to resolve relative CSS links correctly
        const baseUrl = new URL(iframe.src, window.location.href).href;

        // Invoke the Main process handler
        window.ipcRenderer.invoke('generate-print-preview', { html, options, baseUrl });
    });

    document.querySelector('.btn-pdf')?.addEventListener('click', () => {
        const iframe = getActiveIframe();
        if (!iframe) return;

        const html = getSynchronizedHTML(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        let pSize = 'A4';
        if (doc.querySelector('#Stamps.active') || iframe.src.includes('stamps/')) {
            pSize = 'Legal';
        }

        const options = {
            pageRanges: document.getElementById('print-range-input')?.value || '',
            landscape: document.getElementById('print-orientation-input')?.value === 'landscape',
            pageSize: pSize
        };

        const baseUrl = new URL(iframe.src, window.location.href).href;
        const fileName = (openTabs[activeTabId]?.title || 'Form') + '_' + Date.now() + '.pdf';

        window.ipcRenderer.invoke('save-as-pdf', {
            html,
            options,
            baseUrl,
            defaultName: fileName
        }).then(res => {
            if (res.success) console.log('PDF Saved to:', res.path);
        });
    });

    // Print preview controls
    document.getElementById('preview-scale-range')?.addEventListener('input', (e) => {
        const v = e.target.value; document.getElementById('preview-scale-value').textContent = v + '%';
    });

    document.getElementById('preview-margin')?.addEventListener('change', (e) => {
        const v = e.target.value;
        document.getElementById('preview-custom-margins').style.display = (v === 'custom') ? 'block' : 'none';
    });

    document.getElementById('preview-apply-settings')?.addEventListener('click', () => {
        // Re-open preview to apply new settings
        const iframe = getActiveIframe();
        if (!iframe) return;
        document.getElementById('btn-print-form')?.click();
    });

    document.getElementById('btn-do-print')?.addEventListener('click', () => {
        const previewIframe = document.querySelector('#printPreviewModal iframe#print-preview-iframe');
        if (previewIframe && previewIframe.contentWindow) {
            previewIframe.contentWindow.focus();
            previewIframe.contentWindow.print();
        }
    });

    document.getElementById('btn-close-print-preview')?.addEventListener('click', () => {
        const previewModal = document.getElementById('printPreviewModal');
        const previewIframe = document.querySelector('#printPreviewModal iframe#print-preview-iframe');
        if (previewModal) previewModal.classList.remove('visible');
        if (previewIframe) previewIframe.srcdoc = '';
    });

    function findOpenFormIframe() {
        const ids = Object.keys(openTabs);
        for (const id of ids) {
            const iframe = openTabs[id]?.contentElement.querySelector('iframe');
            if (!iframe) continue;
            const src = iframe.src || '';
            if (src.includes('customer_list/customer_profile.html') || src.includes('customer_list/drafts_list.html')) continue;
            if (src.includes('forms/')) return iframe;
        }
        return null;
    }

    function populateActiveForm(customer, targetContext) {
        if (!customer) {
            window.showAppToast('No customer selected to populate.', true);
            return;
        }

        let iframe = getActiveIframe();
        const currentSrc = iframe?.src || '';
        if (iframe && currentSrc.includes('customer_list/')) {
            iframe = findOpenFormIframe();
        }
        if (!iframe) {
            iframe = findOpenFormIframe();
        }

        if (!iframe) {
            window.showAppToast('No open form found to populate. Please open a form first.', true);
            return;
        }

        const win = iframe.contentWindow;
        const tabId = iframe.closest('.tab-content')?.getAttribute('data-tab-id');

        // ── Targeted slot fill (no relationship lookup, direct postMessage) ──
        if (targetContext) {
            win.postMessage({ command: 'FILL_SLOT', data: customer, targetContext }, '*');
            if (tabId) activateTab(tabId);
            return;
        }

        // ── Primary applicant fill (with relationships) ──
        const logic = getFormLogic(win);

        window.DB.getRelationships(customer.applicant_nid).then(relationships => {
            customer.relationships = relationships || [];

            let populated = false;
            if (logic?.populate) {
                logic.populate(customer);
                populated = true;
            } else if (typeof win?.populate === 'function') {
                win.populate(customer);
                populated = true;
            }

            if (populated) {
                if (tabId) activateTab(tabId);
            } else {
                window.showAppToast('The active form does not support centralized customer import.', true);
            }
        }).catch(err => {
            console.error('Failed to get relationships during populate:', err);
            customer.relationships = [];
            let populated = false;
            if (logic?.populate) {
                logic.populate(customer);
                populated = true;
            } else if (typeof win?.populate === 'function') {
                win.populate(customer);
                populated = true;
            }
            if (populated && tabId) activateTab(tabId);
        });
    }

    // Handle requests from Iframes (like Customer List)
    window.addEventListener('message', (event) => {
        // ── Slot-specific customer pull request from a form iframe ──
        if (event.data.command === 'OPEN_CUSTOMER_SEARCH_FOR_SLOT') {
            openImportModal(event.data.targetContext || null);
            return;
        }

        if (event.data.command === 'EXECUTE_SHELL_ACTION') {
            switch (event.data.actionId) {
                case 'open-customer-modal':

                    openLocalForm('forms/customer_list/customer_profile.html', 'গ্রাহক তালিকা (বিস্তারিত)');
                    break;
                case 'edit-customer':
                    if (!event.data.nid) { window.showAppToast('গ্রাহকের NID পাওয়া যায়নি।', true); break; }
                    openLocalForm(
                        'forms/customer_list/customer_profile.html',
                        'এডিট গ্রাহক',
                        function (editIframe) {
                            editIframe.contentWindow.postMessage({ command: 'LOAD_CUSTOMER_PROFILE', nid: event.data.nid }, '*');
                        }
                    );
                    break;
                case 'populate-customer':
                    if (!event.data.nid) {
                        window.showAppToast('Customer identifier missing.', true);
                        return;
                    }
                    window.DB.getCustomer(event.data.nid).then(customer => {
                        if (!customer) {
                            window.showAppToast('Customer record not found.', true);
                            return;
                        }
                        populateActiveForm(customer);
                    });
                    break;
                case 'update-calc-ui':
                    const config = event.data.config;
                    if (!config) return;
                    const btnPrimary = document.getElementById('calc-import-data');
                    const btnSecondary = document.getElementById('calc-import-secondary');
                    const btnManual = document.getElementById('calc-data-input');
                    const btnUpdateRates = document.getElementById('calc-update-rates');
                    const btnShowLoans = document.getElementById('calc-show-loans');
                    const btnAddLoan = document.getElementById('calc-add-loan');

                    if (btnPrimary && config.importLabel) btnPrimary.textContent = config.importLabel;
                    if (btnSecondary) {
                        btnSecondary.style.display = config.showSecondary ? 'block' : 'none';
                        if (config.secondaryLabel) btnSecondary.textContent = config.secondaryLabel;
                    }
                    if (btnManual) {
                        btnManual.style.display = config.showInput ? 'block' : 'none';
                        if (config.inputLabel) btnManual.textContent = config.inputLabel;
                    }
                    break;
            }
        } else if (event.data.command === 'REFRESH_CUSTOMER_LIST_PARENT') {
            // This command is sent from customer_list.html to trigger a refresh in the shell
            // (e.g., after a delete operation)
            const listIframe = document.querySelector('iframe[src*="customer_profile.html"]');
            if (listIframe) {
                listIframe.contentWindow.postMessage({ command: 'REFRESH_CUSTOMER_LIST' }, '*');
            }
        } else if (event.data.command === 'SAVE_CUSTOMER_PROFILE') {
            // Handle save request from customer_profile.html
            window.DB.saveCustomer(event.data.customer).then((res) => {
                if (res && res.success === false) { window.showAppToast('Error saving customer: ' + res.error, true); return; }
                window.showAppToast('✅ Customer Profile Saved to Database.', false);
                // Refresh customer list if open
                const listIframe = document.querySelector('iframe[src*="customer_profile.html"]');
                if (listIframe) {
                    listIframe.contentWindow.postMessage({ command: 'REFRESH_CUSTOMER_LIST' }, '*');
                }
                // Close the customer profile tab
                closeTab(activeTabId);
            }).catch(error => {
                console.error('Error saving customer profile:', error);
                window.showAppToast('Error saving customer profile: ' + error.message, true);
            });
        } else if (event.data.command === 'SAVE_CUSTOMER_FROM_FORM') {
            window.LoanEngine.processFormSave(event.data.customer).then((res) => {
                if (res && res.success === false) {
                    window.showAppToast('Error saving customer data: ' + res.error, true);
                    return;
                }
                window.showAppToast('Customer data saved successfully to Central Database.', false);
                const listIframe = document.querySelector('iframe[src*="customer_profile.html"]');
                if (listIframe) {
                    listIframe.contentWindow.postMessage({ command: 'REFRESH_CUSTOMER_LIST' }, '*');
                }
            }).catch(error => {
                console.error('Error saving customer from form:', error);
                window.showAppToast('Error saving customer: ' + error.message, true);
            });
        } else if (event.data.command === 'SAVE_TRANSACTION') {
            window.WebEngine.handleSaveTransaction(event.data);
        } else if (event.data.command === 'SAVE_TRANSACTION_FROM_FORM') {
            window.WebEngine.handleSaveTransactionFromForm(event.data);
        } else if (event.data.command === 'REQUEST_CUSTOMER_DATA') {
            // Handle request for customer data from customer_profile.html
            window.DB.getCustomer(event.data.nid).then(customer => {
                event.source.postMessage({ command: 'LOAD_CUSTOMER_PROFILE', customer: customer, ipcRenderer: window.ipcRenderer }, '*');
            }).catch(error => {
                console.error('Error fetching customer data:', error);
                event.source.postMessage({ command: 'LOAD_CUSTOMER_PROFILE', customer: null }, '*');
            });
        } else if (event.data.command === 'CLOSE_CURRENT_TAB') {
            if (activeTabId) closeTab(activeTabId);
        } else if (event.data.command === 'OPEN_CHEQUE_PRINT_TAB') {
            openLocalForm('forms/deposit/cheque_print_setup.html', 'Cheque Print Mgmt');
        }
    });

    // Download indicator listener
    let downloadCount = 0;
    if (window.ipcRenderer) {
        window.WebEngine.init(window.ipcRenderer);

        window.ipcRenderer.on('download-completed', (event, data) => {
            const filename = typeof data === 'string' ? data : data.filename;
            const filePath = typeof data === 'object' ? data.filePath : null;

            downloadCount++;
            const indicator = document.getElementById('download-indicator');
            const badge = document.getElementById('download-badge');
            if (indicator && badge) {
                indicator.style.display = 'flex';
                badge.style.display = 'flex';
                badge.innerText = downloadCount;
                indicator.title = 'Downloaded: ' + filename;

                // Animate background briefly
                indicator.style.background = '#d4edda';
                setTimeout(() => {
                    indicator.style.background = 'transparent';
                }, 1000);
            }

            if (filePath && filePath.toLowerCase().endsWith('.pdf')) {
                console.log(`Automatically opening downloaded PDF in-app viewer: ${filePath}`);
                openPDFViewer(filePath, filename);
            }
        });

        // Reset indicator on click
        document.getElementById('download-indicator')?.addEventListener('click', () => {
            downloadCount = 0;
            document.getElementById('download-badge').style.display = 'none';
            document.getElementById('download-indicator').title = 'Recent Downloads';
        });

        // Password Prompt Listener
        let pendingPasswordData = null;
        window.ipcRenderer.on('show-password-prompt', (event, hostname, username, password, isUpdate) => {
            pendingPasswordData = { hostname, username, password };
            const prompt = document.getElementById('password-save-prompt');
            const hostDisplay = document.getElementById('pwd-hostname');
            const saveBtn = document.getElementById('btn-save-password-confirm');

            if (prompt && hostDisplay) {
                hostDisplay.textContent = hostname;
                if (saveBtn) saveBtn.textContent = isUpdate ? 'Update Password' : 'Save Password';
                prompt.style.display = 'block';
            }
        });

        const btnSavePwd = document.getElementById('btn-save-password-confirm');
        if (btnSavePwd) {
            btnSavePwd.addEventListener('click', async () => {
                if (pendingPasswordData) {
                    // Use the new secure safeStorage handler
                    await window.ipcRenderer.invoke('secure-save-password', pendingPasswordData.hostname, pendingPasswordData.username, pendingPasswordData.password);
                    pendingPasswordData = null;
                }
                document.getElementById('password-save-prompt').style.display = 'none';
            });
        }

        const btnNeverSavePwd = document.getElementById('btn-never-save-password');
        if (btnNeverSavePwd) {
            btnNeverSavePwd.addEventListener('click', async () => {
                if (pendingPasswordData) {
                    // Save a dummy entry indicating "never save"
                    await window.ipcRenderer.invoke('secure-save-password', pendingPasswordData.hostname, '', 'NEVER_SAVE_FLAG_INTERNAL_89123');
                    // But we actually want a dedicated flag. We can handle it in the backend or just use a special string. 
                    // Better: update the secure handler in main to accept a neverSave flag. Wait, let's just pass 'NEVER' as username.
                    pendingPasswordData = null;
                }
                document.getElementById('password-save-prompt').style.display = 'none';
            });
        }
    }
});

// --- Settings & Master Save Logic ---
window.openSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        window.fetchDbLocation();
    }
};

window.closeSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.style.display = 'none';
};

window.fetchDbLocation = function () {
    if (window.ipcRenderer) {
        window.ipcRenderer.invoke('app-get-db-location').then(path => {
            document.getElementById('settings-db-path').innerText = path;
        }).catch(err => {
            document.getElementById('settings-db-path').innerText = 'Error fetching path';
        });
    }
};

window.changeDbLocation = async function () {
    if (!window.ipcRenderer) return;
    try {
        const res = await window.ipcRenderer.invoke('app-change-db-location');
        if (res && res.success) {
            // App will restart automatically from backend
        } else if (res && res.error) {
            window.showAppToast('Error: ' + res.error, true);
        }
    } catch (err) {
        window.showAppToast('Error changing location', true);
    }
};

window.exportBackup = async function () {
    if (!window.ipcRenderer) return;
    try {
        // Collect all localStorage data to bundle in the backup
        const settings = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            settings[key] = localStorage.getItem(key);
        }

        const res = await window.ipcRenderer.invoke('app-full-export', settings);
        if (res && res.success) {
            window.showAppToast('Backup exported successfully!', false);
        } else if (res && res.error) {
            window.showAppToast('Backup failed: ' + res.error, true);
        }
    } catch (err) {
        window.showAppToast('Export error', true);
    }
};

window.importBackup = async function () {
    if (!window.ipcRenderer) return;
    if (!confirm('WARNING: Importing a backup will completely overwrite your current database and settings. The application will restart. Do you want to proceed?')) return;

    try {
        const res = await window.ipcRenderer.invoke('app-full-import');
        if (res && res.success) {
            // Restore local storage settings
            if (res.settings) {
                localStorage.clear();
                Object.keys(res.settings).forEach(key => {
                    localStorage.setItem(key, res.settings[key]);
                });
            }
            window.showAppToast('Backup imported successfully. Restarting...', false);
            setTimeout(() => {
                location.reload(); // Reload UI
            }, 1000);
        } else if (res && res.error) {
            window.showAppToast('Import failed: ' + res.error, true);
        }
    } catch (err) {
        window.showAppToast('Import error', true);
    }
};

// ==========================================
// RTGS / EFTN Portal Injection Logic
// ==========================================

let currentInjectType = ''; // 'RTGS' or 'EFTN'

// ==========================================
// Smart Notice Tracker
// ==========================================
window.markTaskDone = function(taskId) {
    if (window.AppStorage) {
        window.AppStorage.setItem('task_done_' + taskId, Date.now().toString());
    }
};

function startSmartNoticeTracker() {
    const checkNotices = () => {
        const scrollArea = document.getElementById('task-scroll-area');
        if (!scrollArea) return;

        // 1. Fetch Custom Tasks from Scheduler
        const settings = window.AppStorage ? JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}') : {};
        const currentRole = settings.userRole || "Guest";
        const customTasksRaw = window.AppStorage ? window.AppStorage.getItem('bkb_custom_tasks') : null;
        const customTasks = customTasksRaw ? JSON.parse(customTasksRaw) : [];
        const activeCustomTasks = customTasks.filter(t => t.role === currentRole || currentRole === "Admin");

        // 2. Fetch Borrowers
        const borrowerListRaw = window.AppStorage ? window.AppStorage.getItem('borrower_list') : null;
        const borrowers = borrowerListRaw ? JSON.parse(borrowerListRaw) : [];

        if (activeCustomTasks.length === 0 && borrowers.length === 0) {
            // Show a welcome message if no tasks exist yet
            scrollArea.innerHTML = `
                <div class="task-item pending" style="border-left: 4px solid #17a2b8; padding: 10px; margin: 0; background: transparent;">
                    <strong>System Update:</strong> No active tasks right now. Add tasks or borrowers to start monitoring.
                </div>
            `;
            return;
        }

        let html = '';

        // Render Custom Tasks
        if (activeCustomTasks.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            html += activeCustomTasks.map(t => {
                let blinkClass = '';
                const doneTimestamp = window.AppStorage ? window.AppStorage.getItem(`task_done_${t.id}`) : null;

                if (doneTimestamp) {
                    const doneDate = new Date(parseInt(doneTimestamp));
                    if (doneDate.toDateString() === today.toDateString()) return '';
                }

                // Day frequency specific logic
                if (t.freq === 'Day') {
                    if (doneTimestamp) return ''; // Already done
                    if (t.dueDate) {
                        const taskDate = new Date(t.dueDate);
                        taskDate.setHours(0, 0, 0, 0);

                        const diffTime = taskDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 1 || diffDays < 0) return '';
                        if (diffDays === 0) blinkClass = 'task-warning-blink';
                    }
                }

                // Term frequency specific logic
                if (t.freq === 'Term') {
                    if (doneTimestamp) return ''; // Already done
                    if (t.startDate && t.dueDate) {
                        const startDate = new Date(t.startDate);
                        startDate.setHours(0, 0, 0, 0);

                        const endDate = new Date(t.dueDate);
                        endDate.setHours(0, 0, 0, 0);

                        const diffStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const diffEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                        if (diffStart > 1 || diffEnd < 0) return '';
                        if (diffStart <= 0 && diffEnd >= 0) blinkClass = 'task-warning-blink';
                    }
                }

                // Quarterly frequency specific logic
                if (t.freq === 'quarterly' && (t.dueDate || t.startDate)) {
                    let taskDate = new Date(t.dueDate || t.startDate);

                    if (doneTimestamp) {
                        const doneDate = new Date(parseInt(doneTimestamp));
                        taskDate = new Date(doneDate);
                        taskDate.setMonth(taskDate.getMonth() + 2); // Next quarter (3rd month)
                    }

                    taskDate.setHours(0, 0, 0, 0);

                    const diffTime = taskDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) return '';
                    if (diffDays <= 0) blinkClass = 'task-warning-blink';

                    t.displayDueDate = `${taskDate.getDate().toString().padStart(2, '0')}/${(taskDate.getMonth() + 1).toString().padStart(2, '0')}/${taskDate.getFullYear()}`;
                }

                // Yearly frequency specific logic
                if (t.freq === 'yearly' && (t.dueDate || t.startDate)) {
                    let taskDate = new Date(t.dueDate || t.startDate);

                    if (doneTimestamp) {
                        const doneDate = new Date(parseInt(doneTimestamp));
                        taskDate = new Date(doneDate);
                        taskDate.setFullYear(taskDate.getFullYear() + 1); // Next year
                    }

                    taskDate.setHours(0, 0, 0, 0);

                    const diffTime = taskDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) return '';
                    if (diffDays <= 0) blinkClass = 'task-warning-blink';

                    t.displayDueDate = `${taskDate.getDate().toString().padStart(2, '0')}/${(taskDate.getMonth() + 1).toString().padStart(2, '0')}/${taskDate.getFullYear()}`;
                }

                // Monthly frequency specific logic
                if (t.freq === 'monthly' && (t.dueDate || t.startDate)) {
                    let taskDate = new Date(t.dueDate || t.startDate);

                    if (doneTimestamp) {
                        const doneDate = new Date(parseInt(doneTimestamp));
                        taskDate = new Date(doneDate);
                        taskDate.setMonth(taskDate.getMonth() + 1); // Next month
                    }

                    taskDate.setHours(0, 0, 0, 0);

                    const diffTime = taskDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) return '';
                    if (diffDays <= 0) blinkClass = 'task-warning-blink';

                    t.displayDueDate = `${taskDate.getDate().toString().padStart(2, '0')}/${(taskDate.getMonth() + 1).toString().padStart(2, '0')}/${taskDate.getFullYear()}`;
                }

                // Daily frequency specific logic
                if (t.freq === 'daily') {
                    if (!t.dueDate && !t.startDate) {
                        if (doneTimestamp) {
                            const doneDate = new Date(parseInt(doneTimestamp));
                            if (today.toDateString() === doneDate.toDateString()) return '';
                        }
                    } else {
                    let taskDate = new Date(t.dueDate || t.startDate);

                    if (doneTimestamp) {
                        const doneDate = new Date(parseInt(doneTimestamp));
                        taskDate = new Date(doneDate);
                        taskDate.setDate(taskDate.getDate() + 1); // Next day
                    }

                    taskDate.setHours(0, 0, 0, 0);

                    const diffTime = taskDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) return '';
                    if (diffDays <= 0) blinkClass = 'task-warning-blink';

                    t.displayDueDate = `${taskDate.getDate().toString().padStart(2, '0')}/${(taskDate.getMonth() + 1).toString().padStart(2, '0')}/${taskDate.getFullYear()}`;
                }
                }

                let color = '#28a745'; // Normal
                if (t.flag === 'Urgent') color = '#dc3545';
                else if (t.flag === 'Important') color = '#ffc107';

                let displayDate = t.displayDueDate || (t.dueDate ? t.dueDate.split('-').reverse().join('/') : 'N/A');

                return `
                    <div class="task-item pending" style="/* removed border */ color: ${color}; padding: 10px; margin: 0; background: transparent; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong class="${blinkClass}">${t.type || 'Scheduled Task'}:</strong> <span class="${blinkClass}">${t.text}</span> - Due: ${displayDate}
                        </div>
                        <button onclick="markTaskDone('${t.id}'); setTimeout(startSmartNoticeTracker, 100);" style="background: #28a745; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">Done</button>
                    </div>
                `;
            }).join('');
        }

        // Dummy alert to show the UI is wired and working in the Task/Alert container.
        if (borrowers.length > 0) {
            html += `
                <div class="task-item pending" style="border-left: 4px solid #f39c12; padding: 10px; margin: 0; background: transparent; cursor: pointer;" onclick="document.getElementById('nav-monitoring-demand').click()">
                    <strong>Notice Pending:</strong> A/C-0123456789 (Demand Notice) - 3 months to expiry.
                </div>
                <div class="task-item pending" style="border-left: 4px solid #e74c3c; padding: 10px; margin: 0; background: transparent; cursor: pointer;" onclick="document.getElementById('nav-monitoring-final').click()">
                    <strong>Notice Pending:</strong> A/C-9876543210 (Final Notice) - Exceeded expiry.
                </div>
            `;
        }

        if (html.trim() === '') {
            html = `
                <div class="task-item pending" style="border-left: 4px solid #17a2b8; padding: 10px; margin: 0; background: transparent;">
                    <strong>All Caught Up! No active tasks pending at the moment.</strong>
                </div>
            `;
        }

        const singleCopy = `<div class="ticker-content" style="display: flex; gap: 15px; padding-right: 50vw;">${html}</div>`;
        scrollArea.innerHTML = singleCopy + singleCopy;
        
        setTimeout(() => {
            const firstChild = scrollArea.firstElementChild;
            if (firstChild) {
                const width = firstChild.offsetWidth;
                const duration = Math.max(5, width / 70);
                scrollArea.style.animationDuration = `${duration}s`;
            }
        }, 100);
    };

    checkNotices();
    if(window.smartNoticeTrackerInterval) clearInterval(window.smartNoticeTrackerInterval);
    window.smartNoticeTrackerInterval = setInterval(checkNotices, 5 * 60 * 1000);
}

window.refreshSmartNoticeTracker = function() {
    if(typeof startSmartNoticeTracker === 'function') {
        startSmartNoticeTracker();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startSmartNoticeTracker, 2000);
    document.getElementById('btn-download-excel-format')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.downloadExcelFormat === 'function') win.downloadExcelFormat();
    });

    document.getElementById('btn-upload-filled-excel')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.triggerFilledExcelUpload === 'function') win.triggerFilledExcelUpload();
    });

    document.getElementById('btn-update-from-module')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.triggerStatusUpload === 'function') win.triggerStatusUpload();
    });

    document.getElementById('btn-apply-classification')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.applyClassificationsToList === 'function') win.applyClassificationsToList();
    });

    document.getElementById('btn-unify-borrower-list')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.triggerUnifyUpload === 'function') win.triggerUnifyUpload();
    });

    document.getElementById('btn-progress-report')?.addEventListener('click', () => {
        const modal = document.getElementById('progressReportModal');
        if (modal) modal.style.display = 'flex';
    });

    document.getElementById('btn-run-progress-report')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.generateProgressReport === 'function') win.generateProgressReport();
    });

    document.getElementById('btn-performance-analysis')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.showBreakdown === 'function') win.showBreakdown();
    });

    document.getElementById('btn-generate-excel')?.addEventListener('click', () => {
        const win = getActiveIframe()?.contentWindow;
        if (typeof win?.exportToExcel === 'function') win.exportToExcel();
    });
});

// =========================================================================
// NID PORTAL INTEGRATION (ADDED BY FIX)
// =========================================================================

window.pullNidDataFromView = function() {
    if (window.WebEngine && window.WebEngine.pullNidDataAndShowModal) {
        window.WebEngine.pullNidDataAndShowModal();
    } else {
        window.showAppToast('WebEngine not ready. Cannot pull NID data.', true);
    }
};

window.closePulledNidDataModal = function() {
    const modal = document.getElementById('pulledNidDataModal');
    if (modal) {
        modal.classList.remove('visible');
    }
    if (typeof window.getActiveIframe === 'function') {
        const frame = window.getActiveIframe();
        if (frame) frame.focus();
    }
};

window.savePulledNidDataToDB = async function() {
    const nid = document.getElementById('pulled_nid_nid')?.value;
    if (!nid) {
        window.showAppToast('NID number is required to save.', true);
        return;
    }

    const customerData = {
        applicant_nid: nid,
        applicant_name_bn: document.getElementById('pulled_nid_name_bn')?.value || '',
        applicant_name_en: document.getElementById('pulled_nid_name_en')?.value || '',
        applicant_dob: document.getElementById('pulled_nid_dob')?.value || '',
        applicant_mobile: document.getElementById('pulled_nid_mobile')?.value || '',
        applicant_father_name_bn: document.getElementById('pulled_nid_father_name_bn')?.value || '',
        applicant_mother_name_bn: document.getElementById('pulled_nid_mother_name_bn')?.value || '',
        applicant_spouse_name_bn: document.getElementById('pulled_nid_spouse_name_bn')?.value || '',
        applicant_gender: document.getElementById('pulled_nid_gender')?.value || 'Male',
        applicant_curr_addr_house: document.getElementById('pulled_nid_present_house')?.value || '',
        applicant_perm_addr_house: document.getElementById('pulled_nid_permanent_house')?.value || '',
        
        applicant_curr_addr_house: document.getElementById('pulled_nid_present_house')?.value || '',
        applicant_curr_addr_village: document.getElementById('pulled_nid_present_village')?.value || '',
        applicant_present_post: document.getElementById('pulled_nid_present_post')?.value || '',
        applicant_present_post_code: document.getElementById('pulled_nid_present_post_code')?.value || '',
        applicant_present_union: document.getElementById('pulled_nid_present_union')?.value || '',
        applicant_present_city_corp: document.getElementById('pulled_nid_present_city_corp')?.value || '',
        applicant_present_upozila: document.getElementById('pulled_nid_present_upozila')?.value || '',
        applicant_present_district: document.getElementById('pulled_nid_present_district')?.value || '',
        applicant_present_division: document.getElementById('pulled_nid_present_division')?.value || '',
        
        applicant_perm_addr_house: document.getElementById('pulled_nid_permanent_house')?.value || '',
        applicant_perm_addr_village: document.getElementById('pulled_nid_permanent_village')?.value || '',
        applicant_permanent_post: document.getElementById('pulled_nid_permanent_post')?.value || '',
        applicant_permanent_post_code: document.getElementById('pulled_nid_permanent_post_code')?.value || '',
        applicant_permanent_union: document.getElementById('pulled_nid_permanent_union')?.value || '',
        applicant_permanent_city_corp: document.getElementById('pulled_nid_permanent_city_corp')?.value || '',
        applicant_permanent_upozila: document.getElementById('pulled_nid_permanent_upozila')?.value || '',
        applicant_permanent_district: document.getElementById('pulled_nid_permanent_district')?.value || '',
        applicant_permanent_division: document.getElementById('pulled_nid_permanent_division')?.value || ''
    };

    // Use the central Database Engine to save the customer
    if (window.DB && typeof window.DB.saveCustomer === 'function') {
        const rawPhotoSrc = document.getElementById('pulled_nid_photo')?.getAttribute('src') || '';
        if (rawPhotoSrc.startsWith('data:image')) {
            customerData.photo = rawPhotoSrc;
        }

        try {
            const res = await window.DB.saveCustomer(customerData);
            if (res && res.success) {
                // Populate active form with the pulled data
                if (typeof window.populateActiveForm === 'function') {
                    window.populateActiveForm(customerData);
                }
                
                // Show success toast and close modal
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast('Customer data successfully saved and auto-filled.', false);
                } else {
                    window.showAppToast('✅ Customer data saved successfully.');
                }
                window.closePulledNidDataModal();
            } else {
                window.showAppToast('Failed to save customer: ' + (res?.error || 'Unknown error'), true);
            }
        } catch (err) {
            console.error('Error saving NID data:', err);
            window.showAppToast('Database error: ' + err.message, true);
        }
    } else {
        window.showAppToast('Database Engine is not available.', true);
    }
};
