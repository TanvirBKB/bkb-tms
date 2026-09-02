
// ---- Reliable App Storage & IPC Bridge ----
function getAppIPC() {
    try {
        if (window.ipcRenderer) return window.ipcRenderer;
        if (window.parent && window.parent.ipcRenderer) return window.parent.ipcRenderer;
        if (window.require) {
            const electron = window.require('electron');
            if (electron && electron.ipcRenderer) return electron.ipcRenderer;
        }
        if (window.parent && window.parent.require) {
            const electron = window.parent.require('electron');
            if (electron && electron.ipcRenderer) return electron.ipcRenderer;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function loadAppData(key) {
    const ipc = getAppIPC();
    if (ipc) {
        try {
            let r = ipc.sendSync('db-get-kv', key);
            if (typeof r === 'string') {
                try { r = JSON.parse(r); } catch(e) {}
            }
            if (r && typeof r === 'object') return r;
        } catch(e) {}
    }
    try {
        const local = localStorage.getItem(key) || (window.parent && window.parent.localStorage && window.parent.localStorage.getItem(key));
        return local ? JSON.parse(local) : {};
    } catch(e) {
        
return {};
    }
}

function saveAppData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        if (window.parent && window.parent.localStorage) {
            window.parent.localStorage.setItem(key, JSON.stringify(data));
        }
    } catch(e) {}
    const ipc = getAppIPC();
    if (ipc) {
        try {
            ipc.sendSync('db-set-kv', key, data);
        } catch(e) {}
    }
}


function showToast(message, isError = false) {
    // 1. Trigger parent toast if available
    try {
        if (window.parent && typeof window.parent.showAppToast === 'function') {
            window.parent.showAppToast(message, isError);
        }
    } catch(e) {}

    // 2. Local floating toast inside frame
    const toast = document.getElementById('calcFloatingToast');
    const toastMsg = document.getElementById('calcToastMsg');
    const toastContent = document.getElementById('calcToastContent');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (toastContent) {
        if (isError) {
            toastContent.className = 'px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold text-white bg-red-600 border border-red-400 flex items-center gap-2 animate-bounce';
        } else {
            toastContent.className = 'px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold text-white bg-green-700 border border-green-500 flex items-center gap-2';
        }
    }

    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -10px)';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}

window.InterestCalcLogic = (function() {

/* IndexedDB setup (kept for future extensions; not used yet in this file) */

// Global state to determine the calculation mode (moved inside the module)
let calculationMethod = 'cbs'; // Default to 'cbs'

// Global state for penalty rates (moved inside the module)

const penaltyState = {
    originalRates: null
};

let isAutoRecalcActive = false;

const DB_NAME='LoanCalculatorDB', STORE_NAME='loanData'; let db;

// Function to open IndexedDB (kept for future extensions)
function openDatabase(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=(e)=>{db=e.target.result; if(!db.objectStoreNames.contains(STORE_NAME)){db.createObjectStore(STORE_NAME,{keyPath:'id'});}};
    req.onsuccess=(e)=>{db=e.target.result; resolve(db)};
    req.onerror=()=>{showMessageBox('Error opening IndexedDB.'); reject('Error opening IndexedDB');};
  });
}

/* Loan type map (as provided) */
const loanTypeMap = {
  '0134': 'CASH CREDIT HYPOTHICATION',
  '0138': 'WORKING CAPITAL CMSME REFINANCE',
  '0139': 'CASH CREDIT CMSME (MANUFACTURING)',
  '0141': 'CASH CREDIT CMSME (SERVICE)',
  '0142': 'CASH CREDIT CMSME (TRADING)',
  '1020': 'PAST DUE CASH CREDIT HYPOTHICATION',
  '1234': 'CMSME TERM (PRONODONA)',
  '1235': 'SMEF REVOLVING FUND',
  '1238': 'MID TERM CMSME (MANUFACTURING)',
  '1240': 'MID TERM CMSME (TRADING)',
  '1050': 'CONSUMER CREDIT',
  '1201': 'AGRI (MID TERM) GENERAL',
  '1200': 'PROJECT (MID TERM)',
  '1300': 'PROJECT (LONG TERM)',
  '1801': 'PAST DUE (AGRI)- MID TERM',
  '1901': 'PAST DUE (AGRI)- LONG TERM',
  '1231': 'PERSONAL LOAN (OTHERS)',
  '1237': 'PERSONAL LOAN (BKB STAFF)',
  '1232': 'FID LOAN',
  '1233': 'GHORE FERA, COVID-19',
  '1101': 'AGRI (SHORT TERM) GENERAL',
  '1106': 'AGRI SHORT TERM (BEEF FATTING)',
  '1108': 'AGRI (SHORT TERM) SHAWNIRVAR CREDIT',
  '1131': 'POVERTY ALLEVIATION(MUJIB YEAR)',
  '1701': 'PAST DUE (AGRI)- SHORT TERM',
  '1708': 'PAST DUE SHAWNIRVAR',
  '1029': 'PAST DUE (LAND LESS FARMER)',
  '1040': 'COTTAGE INDUSTRIES LOANS',
  '1132': 'AGRI LOAN (COVID-19)',
  '1110': 'AGRI SHORT (HILL TRACTS)',
};

const capitalizationMap = {
  'CASH CREDIT HYPOTHICATION': 'quarterly',
  'WORKING CAPITAL CMSME REFINANCE': 'quarterly',
  'CASH CREDIT CMSME (MANUFACTURING)': 'quarterly',
  'CASH CREDIT CMSME (SERVICE)': 'quarterly',
  'CASH CREDIT CMSME (TRADING)': 'quarterly',
  'PAST DUE CASH CREDIT HYPOTHICATION': 'quarterly',
  'CMSME TERM (PRONODONA)': 'quarterly',
  'SMEF REVOLVING FUND': 'quarterly',
  'MID TERM CMSME (MANUFACTURING)': 'quarterly',
  'MID TERM CMSME (TRADING)': 'quarterly',
  'CONSUMER CREDIT': 'quarterly',
  'AGRI (MID TERM) GENERAL': 'quarterly',
  'PROJECT (MID TERM)': 'quarterly',
  'PROJECT (LONG TERM)': 'quarterly',
  'PAST DUE (AGRI)- MID TERM': 'quarterly',
  'PAST DUE (AGRI)- LONG TERM': 'quarterly',
  'PERSONAL LOAN (OTHERS)': 'monthly',
  'PERSONAL LOAN (BKB STAFF)': 'monthly',
  'FID LOAN': 'yearly',
  'GHORE FERA, COVID-19': 'yearly',
  'AGRI (SHORT TERM) GENERAL': 'yearly',
  'AGRI SHORT TERM (BEEF FATTING)': 'yearly',
  'AGRI (SHORT TERM) SHAWNIRVAR CREDIT': 'yearly',
  'POVERTY ALLEVIATION(MUJIB YEAR)': 'yearly',
  'PAST DUE (AGRI)- SHORT TERM': 'yearly',
  'PAST DUE SHAWNIRVAR': 'yearly',
  'PAST DUE (LAND LESS FARMER)': 'yearly',
  'COTTAGE INDUSTRIES LOANS': 'yearly',
  'AGRI LOAN (COVID-19)': 'yearly',
  'AGRI SHORT (HILL TRACTS)': 'yearly'
};

const loanCategoryMap = {
  'CASH CREDIT HYPOTHICATION': 'CC',
  'PAST DUE CASH CREDIT HYPOTHICATION': 'CC',
  'WORKING CAPITAL CMSME REFINANCE': 'CMSME',
  'CASH CREDIT CMSME (MANUFACTURING)': 'CMSME',
  'CASH CREDIT CMSME (SERVICE)': 'CMSME',
  'CASH CREDIT CMSME (TRADING)': 'CMSME',
  'CMSME TERM (PRONODONA)': 'CMSME',
  'SMEF REVOLVING FUND': 'CMSME',
  'MID TERM CMSME (MANUFACTURING)': 'CMSME',
  'MID TERM CMSME (TRADING)': 'CMSME',
  'CONSUMER CREDIT': 'Consumer Credit',
  'PROJECT (MID TERM)': 'Project Loan',
  'PROJECT (LONG TERM)': 'Project Loan',
  'PERSONAL LOAN (OTHERS)': 'Personal Loan',
  'PERSONAL LOAN (BKB STAFF)': 'Personal Loan',
  'FID LOAN': 'Agri Loans',
  'GHORE FERA, COVID-19': 'Agri Loans',
  'AGRI (SHORT TERM) GENERAL': 'Agri Loans',
  'AGRI SHORT TERM (BEEF FATTING)': 'Agri Loans',
  'AGRI (SHORT TERM) SHAWNIRVAR CREDIT': 'Agri Loans',
  'POVERTY ALLEVIATION(MUJIB YEAR)': 'Agri Loans',
  'PAST DUE (AGRI)- SHORT TERM': 'Agri Loans',
  'PAST DUE SHAWNIRVAR': 'Agri Loans',
  'PAST DUE (LAND LESS FARMER)': 'Agri Loans',
  'COTTAGE INDUSTRIES LOANS': 'Agri Loans',
  'AGRI SHORT (HILL TRACTS)': 'Agri Loans',
  'AGRI LOAN (COVID-19)': 'Agri Loans',
  'AGRI (MID TERM) GENERAL': 'Agri Loans',
  'PAST DUE (AGRI)- LONG TERM': 'Agri Loans',
  'PAST DUE (AGRI)- MID TERM': 'Agri Loans'
};

// ---- Load Custom Loan Products from Database & Storage ----
try {
    const customProducts = loadAppData('custom_loan_products');
    if (customProducts && typeof customProducts === 'object') {
        Object.keys(customProducts).forEach(code => {
            const prod = customProducts[code];
            if (prod && prod.name) {
                loanTypeMap[code] = prod.name;
                if (prod.category) loanCategoryMap[prod.name] = prod.category;
                if (prod.termType) loanStructureMap[prod.name] = prod.termType;
                if (prod.capitalization) capitalizationMap[prod.name] = prod.capitalization.toLowerCase();
                if (prod.penaltyApplicable !== undefined && window.InterestRateManager && typeof window.InterestRateManager.setLoanTypePenaltyExemption === 'function') {
                    window.InterestRateManager.setLoanTypePenaltyExemption(prod.name, !prod.penaltyApplicable);
                }
            if (prod.interestType) interestTypeMap[prod.name] = prod.interestType;
            }
        });
    }
} catch (e) {
    console.warn("Failed to load custom loan products:", e);
}
// --------------------------------------------------

// This map determines if a loan has a fixed term for installment calculations.
function resolveTermType(loanName) {
    if (!loanName) return 'Continuous';
    const upper = loanName.toUpperCase().trim();
    if (loanStructureMap[loanName] && ['Short Term', 'Mid Term', 'Long Term', 'Continuous'].includes(loanStructureMap[loanName])) {
        return loanStructureMap[loanName];
    }
    if (loanStructureMap[upper] && ['Short Term', 'Mid Term', 'Long Term', 'Continuous'].includes(loanStructureMap[upper])) {
        return loanStructureMap[upper];
    }
    if (upper.includes('LONG TERM') || upper.includes('LONG-TERM')) return 'Long Term';
    if (upper.includes('SHORT TERM') || upper.includes('SHORT-TERM') || upper.includes('SHORT')) return 'Short Term';
    if (upper.includes('MID TERM') || upper.includes('MID-TERM') || upper.includes('TERM')) return 'Mid Term';
    if (upper.includes('CASH CREDIT') || upper.includes('WORKING CAPITAL') || upper.includes('CC ') || upper.includes('HYPOTHICATION')) return 'Continuous';
    return 'Continuous';
}

const interestTypeMap = {};
const loanStructureMap = {
  'CASH CREDIT HYPOTHICATION': 'Continuous',
  'WORKING CAPITAL CMSME REFINANCE': 'Continuous',
  'CASH CREDIT CMSME (MANUFACTURING)': 'Continuous',
  'CASH CREDIT CMSME (SERVICE)': 'Continuous',
  'CASH CREDIT CMSME (TRADING)': 'Continuous',
  'PAST DUE CASH CREDIT HYPOTHICATION': 'Continuous',
  'CMSME TERM (PRONODONA)': 'Term',
  'SMEF REVOLVING FUND': 'Term',
  'MID TERM CMSME (MANUFACTURING)': 'Term',
  'MID TERM CMSME (TRADING)': 'Term',
  'CONSUMER CREDIT': 'Term',
  'AGRI (MID TERM) GENERAL': 'Term',
  'PROJECT (MID TERM)': 'Project',
  'PROJECT (LONG TERM)': 'Project',
  'PAST DUE (AGRI)- MID TERM': 'Term',
  'PAST DUE (AGRI)- LONG TERM': 'Term',
  'PERSONAL LOAN (OTHERS)': 'Term',
  'PERSONAL LOAN (BKB STAFF)': 'Term',
  'FID LOAN': 'Term',
  'GHORE FERA, COVID-19': 'Term',
  'AGRI (SHORT TERM) GENERAL': 'Agri',
  'AGRI SHORT TERM (BEEF FATTING)': 'Agri',
  'AGRI (SHORT TERM) SHAWNIRVAR CREDIT': 'Agri',
  'POVERTY ALLEVIATION(MUJIB YEAR)': 'Term',
  'PAST DUE (AGRI)- SHORT TERM': 'Agri',
  'PAST DUE SHAWNIRVAR': 'Agri',
  'PAST DUE (LAND LESS FARMER)': 'Agri',
  'COTTAGE INDUSTRIES LOANS': 'Agri',
  'AGRI LOAN (COVID-19)': 'Agri',
  'AGRI SHORT (HILL TRACTS)': 'Agri'
};


function getPenaltyRateForDate(date, loanType) {
    if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltyRate === 'function') {
        return window.InterestRateManager.getPenaltyRate(date, loanType);
    }
    // Fallback default timeline
    const d = new Date(date);
    if (!isNaN(d.getTime()) && d >= new Date('2024-05-20')) {
        return 1.50;
    }
    return 2.00;
}

function isPenaltyExempt(loanType) {
    if (!loanType) return false;
    if (window.InterestRateManager && typeof window.InterestRateManager.isPenaltyExempt === 'function') {
        return window.InterestRateManager.isPenaltyExempt(loanType);
    }
    const nameUpper = String(loanType).toUpperCase().trim();
    return penaltyExemptLoanTypes.some(t => t.toUpperCase().trim() === nameUpper);
}

function updatePenaltyField(loanType) {
    const penaltyInput = document.getElementById('penaltyRate');
    if (!penaltyInput) return;
    const lType = loanType || document.getElementById('loan_scheme_name')?.value || '';
    if (!lType) {
        penaltyInput.value = 'Applicable';
        penaltyInput.style.color = '#27ae60';
        return;
    }
    const exempt = isPenaltyExempt(lType);
    if (exempt) {
        penaltyInput.value = 'N/A';
        penaltyInput.style.color = '#7f8c8d';
    } else {
        penaltyInput.value = 'Applicable';
        penaltyInput.style.color = '#27ae60';
    }
}

const penaltyExemptLoanTypes = [
    'AGRI (SHORT TERM) GENERAL',
    'AGRI SHORT TERM (BEEF FATTING)',
    'AGRI (SHORT TERM) SHAWNIRVAR CREDIT',
    'POVERTY ALLEVIATION(MUJIB YEAR)',
    'PAST DUE (AGRI)- SHORT TERM',
    'PAST DUE SHAWNIRVAR',
    'PAST DUE (LAND LESS FARMER)',
    'COTTAGE INDUSTRIES LOANS',
    'AGRI SHORT (HILL TRACTS)',
    'AGRI LOAN (COVID-19)'
];

const fixedTermLoanRates = {
  'CMSME TERM (PRONODONA)': 7,
  'SMEF REVOLVING FUND': 6,
  'FID LOAN': 7,
  'GHORE FERA, COVID-19': 6,
  'POVERTY ALLEVIATION(MUJIB YEAR)': 7,
  'AGRI SHORT (HILL TRACTS)': 5,
  'AGRI LOAN (COVID-19)': 4
};

/*
 * ===========================================================
 *  Interest Rate History (1990 - 2025)
 * ===========================================================
 */
// --- Shared Histories ---
// This history is shared by CC, CMSME (Trading/Service) loan types.
const ccAndTradingServiceHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1991-07-01'), rate: 15.00 },
    { date: new Date('1991-12-01'), rate: 14.00 }, { date: new Date('1992-07-01'), rate: 15.00 },
    { date: new Date('1993-02-01'), rate: 14.50 }, { date: new Date('1993-07-01'), rate: 14.00 },
    { date: new Date('1994-01-01'), rate: 13.00 }, { date: new Date('1994-07-01'), rate: 12.50 },
    { date: new Date('1995-01-01'), rate: 12.50 }, { date: new Date('1995-07-01'), rate: 12.50 },
    { date: new Date('1996-01-01'), rate: 13.00 }, { date: new Date('1996-02-01'), rate: 15.00 },
    { date: new Date('1996-07-01'), rate: 15.00 }, { date: new Date('2003-07-01'), rate: 16.00 },
    { date: new Date('2003-10-01'), rate: 10.00 }, { date: new Date('2004-05-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 9.00 },  { date: new Date('2006-01-01'), rate: 10.00 },
    { date: new Date('2006-08-06'), rate: 12.00 }, { date: new Date('2007-07-01'), rate: 13.00 },
    { date: new Date('2011-10-01'), rate: 15.00 }, { date: new Date('2013-01-01'), rate: 15.50 },
    { date: new Date('2016-07-01'), rate: 13.00 }, { date: new Date('2018-08-09'), rate: 9.00 },
    { date: new Date('2023-07-01'), rate: 10.10 }, { date: new Date('2023-10-05'), rate: 10.70 },
    { date: new Date('2023-10-10'), rate: 11.10 }, { date: new Date('2023-11-27'), rate: 11.18 },
    { date: new Date('2023-12-01'), rate: 11.47 }, { date: new Date('2024-01-01'), rate: 11.89 },
    { date: new Date('2024-02-01'), rate: 12.43 }, { date: new Date('2024-03-03'), rate: 13.11 },
    { date: new Date('2024-04-01'), rate: 13.55 }, { date: new Date('2024-05-20'), rate: 13.00 },
    { date: new Date('2025-04-01'), rate: 13.75 }
];

// This history is specific to CMSME (Manufacturing) loans.
const cmsmeManufacturingHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1991-07-01'), rate: 15.00 },
    { date: new Date('1991-12-01'), rate: 14.00 }, { date: new Date('1992-07-01'), rate: 15.00 },
    { date: new Date('1993-02-01'), rate: 14.50 }, { date: new Date('1993-07-01'), rate: 14.00 },
    { date: new Date('1994-01-01'), rate: 13.00 }, { date: new Date('1994-07-01'), rate: 12.50 },
    { date: new Date('1995-01-01'), rate: 12.50 }, { date: new Date('1995-07-01'), rate: 12.50 },
    { date: new Date('1996-01-01'), rate: 13.00 }, { date: new Date('1996-02-01'), rate: 15.00 },
    { date: new Date('1996-07-01'), rate: 15.00 }, { date: new Date('2003-07-01'), rate: 16.00 },
    { date: new Date('2003-10-01'), rate: 10.00 }, { date: new Date('2004-05-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 9.00 },  { date: new Date('2006-01-01'), rate: 10.00 },
    { date: new Date('2006-08-06'), rate: 12.00 }, { date: new Date('2007-07-01'), rate: 13.00 },
    { date: new Date('2011-10-01'), rate: 15.00 }, { date: new Date('2013-01-01'), rate: 15.50 },
    { date: new Date('2016-07-01'), rate: 13.00 }, { date: new Date('2018-08-09'), rate: 9.00 },
    { date: new Date('2023-07-01'), rate: 10.10 }, { date: new Date('2023-10-05'), rate: 10.70 },
    { date: new Date('2023-10-10'), rate: 11.10 }, { date: new Date('2023-11-27'), rate: 11.18 },
    { date: new Date('2023-12-01'), rate: 11.47 }, { date: new Date('2024-01-01'), rate: 11.89 },
    { date: new Date('2024-02-01'), rate: 12.43 }, { date: new Date('2024-03-03'), rate: 13.11 },
    { date: new Date('2024-04-01'), rate: 13.55 }, { date: new Date('2024-05-20'), rate: 13.00 },
    { date: new Date('2025-04-01'), rate: 13.00 } // This rate is different
];

const agriLoanHistory = [
    { date: new Date('1991-07-01'), rate: 16.00 }, { date: new Date('1992-04-01'), rate: 15.00 },
    { date: new Date('1994-07-01'), rate: 11.00 }, { date: new Date('1995-07-01'), rate: 12.00 },
    { date: new Date('1996-07-01'), rate: 14.00 }, { date: new Date('2003-07-01'), rate: 13.00 },
    { date: new Date('2004-07-01'), rate: 8.00 },  { date: new Date('2006-01-01'), rate: 8.00 },
    { date: new Date('2006-08-06'), rate: 8.00 },  { date: new Date('2007-07-01'), rate: 11.00 },
    { date: new Date('2008-11-01'), rate: 10.00 }, { date: new Date('2011-07-01'), rate: 10.00 },
    { date: new Date('2013-07-01'), rate: 12.00 }, { date: new Date('2015-01-01'), rate: 11.00 },
    { date: new Date('2016-07-01'), rate: 10.00 }, { date: new Date('2017-07-01'), rate: 9.00 },
    { date: new Date('2018-08-09'), rate: 9.00 },  { date: new Date('2021-04-01'), rate: 8.00 },
    { date: new Date('2023-07-01'), rate: 9.10 },  { date: new Date('2023-10-05'), rate: 9.70 },
    { date: new Date('2023-10-10'), rate: 10.10 }, { date: new Date('2023-11-27'), rate: 10.18 },
    { date: new Date('2023-12-01'), rate: 10.47 }, { date: new Date('2024-01-01'), rate: 10.89 },
    { date: new Date('2024-02-01'), rate: 11.43 }, { date: new Date('2024-03-03'), rate: 12.11 },
    { date: new Date('2024-04-01'), rate: 12.55 }, { date: new Date('2024-05-20'), rate: 12.00 },
    { date: new Date('2025-04-01'), rate: 12.50 }
];

const projectLoanHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1993-07-01'), rate: 11.00 },
    { date: new Date('1994-01-01'), rate: 10.00 }, { date: new Date('1996-01-01'), rate: 9.50 },
    { date: new Date('1996-02-01'), rate: 12.00 }, { date: new Date('2003-10-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 8.00 },  { date: new Date('2006-01-01'), rate: 9.00 },
    { date: new Date('2006-08-01'), rate: 11.50 }, { date: new Date('2007-07-01'), rate: 12.50 },
    { date: new Date('2011-10-01'), rate: 13.00 }, { date: new Date('2012-03-01'), rate: 15.00 },
    { date: new Date('2013-07-01'), rate: 14.50 }, { date: new Date('2016-07-01'), rate: 13.00 },
    { date: new Date('2018-08-09'), rate: 9.00 },  { date: new Date('2023-07-01'), rate: 10.10 },
    { date: new Date('2023-10-05'), rate: 10.70 }, { date: new Date('2023-10-10'), rate: 11.10 },
    { date: new Date('2023-11-27'), rate: 11.18 }, { date: new Date('2023-12-01'), rate: 11.47 },
    { date: new Date('2024-01-01'), rate: 11.89 }, { date: new Date('2024-02-01'), rate: 12.43 },
    { date: new Date('2024-03-03'), rate: 13.11 }, { date: new Date('2024-04-01'), rate: 13.55 },
    { date: new Date('2024-05-20'), rate: 13.00 }, { date: new Date('2025-04-01'), rate: 13.75 }
];

const personalLoanHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1991-07-01'), rate: 15.00 },
    { date: new Date('1991-12-01'), rate: 14.00 }, { date: new Date('1992-07-01'), rate: 15.00 },
    { date: new Date('1993-02-01'), rate: 14.50 }, { date: new Date('1993-07-01'), rate: 14.00 },
    { date: new Date('1994-01-01'), rate: 13.00 }, { date: new Date('1994-07-01'), rate: 12.50 },
    { date: new Date('1995-01-01'), rate: 12.50 }, { date: new Date('1995-07-01'), rate: 12.50 },
    { date: new Date('1996-01-01'), rate: 13.00 }, { date: new Date('1996-02-01'), rate: 15.00 },
    { date: new Date('1996-07-01'), rate: 15.00 }, { date: new Date('2003-07-01'), rate: 16.00 },
    { date: new Date('2003-10-01'), rate: 10.00 }, { date: new Date('2004-05-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 9.00 },  { date: new Date('2006-01-01'), rate: 10.00 },
    { date: new Date('2006-08-06'), rate: 12.00 }, { date: new Date('2007-07-01'), rate: 13.00 },
    { date: new Date('2011-10-01'), rate: 15.00 }, { date: new Date('2013-01-01'), rate: 15.50 },
    { date: new Date('2016-07-01'), rate: 13.00 }, { date: new Date('2018-08-09'), rate: 9.00 },
    { date: new Date('2023-07-01'), rate: 10.10 }, { date: new Date('2023-10-05'), rate: 10.70 },
    { date: new Date('2023-10-10'), rate: 11.10 }, { date: new Date('2023-11-27'), rate: 11.18 },
    { date: new Date('2023-12-01'), rate: 11.47 }, { date: new Date('2024-01-01'), rate: 11.89 },
    { date: new Date('2024-02-01'), rate: 12.43 }, { date: new Date('2024-03-03'), rate: 13.11 },
    { date: new Date('2024-04-01'), rate: 13.55 }, { date: new Date('2024-05-20'), rate: 13.00 },
    { date: new Date('2025-04-01'), rate: 13.75 }
];

const personalLoanBKBStaffHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1991-07-01'), rate: 15.00 },
    { date: new Date('1991-12-01'), rate: 14.00 }, { date: new Date('1992-07-01'), rate: 15.00 },
    { date: new Date('1993-02-01'), rate: 14.50 }, { date: new Date('1993-07-01'), rate: 14.00 },
    { date: new Date('1994-01-01'), rate: 13.00 }, { date: new Date('1994-07-01'), rate: 12.50 },
    { date: new Date('1995-01-01'), rate: 12.50 }, { date: new Date('1995-07-01'), rate: 12.50 },
    { date: new Date('1996-01-01'), rate: 13.00 }, { date: new Date('1996-02-01'), rate: 15.00 },
    { date: new Date('1996-07-01'), rate: 15.00 }, { date: new Date('2003-07-01'), rate: 16.00 },
    { date: new Date('2003-10-01'), rate: 10.00 }, { date: new Date('2004-05-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 9.00 },  { date: new Date('2006-01-01'), rate: 10.00 },
    { date: new Date('2006-08-06'), rate: 12.00 }, { date: new Date('2007-07-01'), rate: 13.00 },
    { date: new Date('2011-10-01'), rate: 15.00 }, { date: new Date('2013-01-01'), rate: 15.50 },
    { date: new Date('2016-07-01'), rate: 13.00 }, { date: new Date('2018-08-09'), rate: 9.00 },
    { date: new Date('2023-07-01'), rate: 10.10 }, { date: new Date('2023-10-05'), rate: 10.70 },
    { date: new Date('2023-10-10'), rate: 11.10 }, { date: new Date('2023-11-27'), rate: 11.18 },
    { date: new Date('2023-12-01'), rate: 11.47 }, { date: new Date('2024-01-01'), rate: 11.89 },
    { date: new Date('2024-02-01'), rate: 12.43 }, { date: new Date('2024-03-03'), rate: 13.11 },
    { date: new Date('2024-04-01'), rate: 13.55 }, { date: new Date('2024-05-20'), rate: 13.00 },
    { date: new Date('2025-04-01'), rate: 10.00 } // Different rate for staff
];

const consumerCreditHistory = [
    { date: new Date('1990-01-01'), rate: 14.00 }, { date: new Date('1991-07-01'), rate: 15.00 },
    { date: new Date('1991-12-01'), rate: 14.00 }, { date: new Date('1992-07-01'), rate: 15.00 },
    { date: new Date('1993-02-01'), rate: 14.50 }, { date: new Date('1993-07-01'), rate: 14.00 },
    { date: new Date('1994-01-01'), rate: 13.00 }, { date: new Date('1994-07-01'), rate: 12.50 },
    { date: new Date('1995-01-01'), rate: 12.50 }, { date: new Date('1995-07-01'), rate: 12.50 },
    { date: new Date('1996-01-01'), rate: 13.00 }, { date: new Date('1996-02-01'), rate: 15.00 },
    { date: new Date('1996-07-01'), rate: 15.00 }, { date: new Date('2003-07-01'), rate: 16.00 },
    { date: new Date('2003-10-01'), rate: 10.00 }, { date: new Date('2004-05-01'), rate: 10.00 },
    { date: new Date('2004-07-01'), rate: 9.00 },  { date: new Date('2006-01-01'), rate: 10.00 },
    { date: new Date('2006-08-06'), rate: 12.00 }, { date: new Date('2007-07-01'), rate: 13.00 },
    { date: new Date('2011-10-01'), rate: 15.00 }, { date: new Date('2013-01-01'), rate: 15.50 },
    { date: new Date('2016-07-01'), rate: 13.00 }, { date: new Date('2018-08-09'), rate: 9.00 },
    { date: new Date('2023-07-01'), rate: 10.10 }, { date: new Date('2023-10-05'), rate: 10.70 },
    { date: new Date('2023-10-10'), rate: 11.10 }, { date: new Date('2023-11-27'), rate: 11.18 },
    { date: new Date('2023-12-01'), rate: 11.47 }, { date: new Date('2024-01-01'), rate: 11.89 },
    { date: new Date('2024-02-01'), rate: 12.43 }, { date: new Date('2024-03-03'), rate: 13.11 },
    { date: new Date('2024-04-01'), rate: 13.55 }, { date: new Date('2024-05-20'), rate: 13.00 },
    { date: new Date('2025-04-01'), rate: 13.75 }
];

const interestRateHistory = {
    // --- 1. CC (Cash Credit) ---
    'CASH CREDIT HYPOTHICATION': ccAndTradingServiceHistory,
    'PAST DUE CASH CREDIT HYPOTHICATION': ccAndTradingServiceHistory,

    // --- 2. CMSME (Cottage, Micro, Small and Medium Enterprises) ---
    'WORKING CAPITAL CMSME REFINANCE': ccAndTradingServiceHistory, // Continuous - Assuming default
    'CASH CREDIT CMSME (MANUFACTURING)': cmsmeManufacturingHistory, // Continuous
    'CASH CREDIT CMSME (SERVICE)': ccAndTradingServiceHistory, // Continuous
    'CASH CREDIT CMSME (TRADING)': ccAndTradingServiceHistory, // Continuous
    'CMSME TERM (PRONODONA)': ccAndTradingServiceHistory, // Term - Assuming default
    'SMEF REVOLVING FUND': ccAndTradingServiceHistory, // Term - Assuming default
    'MID TERM CMSME (MANUFACTURING)': cmsmeManufacturingHistory, // Term
    'MID TERM CMSME (TRADING)': ccAndTradingServiceHistory, // Term

    // --- 3. Project Loans ---
    'PROJECT (MID TERM)': projectLoanHistory,
    'PROJECT (LONG TERM)': projectLoanHistory,

    // --- 4. Consumer Credit ---
    'CONSUMER CREDIT': consumerCreditHistory,

    // --- 5. Personal Loans ---
    'PERSONAL LOAN (OTHERS)': personalLoanHistory,
    'PERSONAL LOAN (BKB STAFF)': personalLoanBKBStaffHistory,

    // --- 6. Agri Loans ---
    'FID LOAN': agriLoanHistory,
    'GHORE FERA, COVID-19': agriLoanHistory,
    'AGRI (SHORT TERM) GENERAL': agriLoanHistory,
    'AGRI SHORT TERM (BEEF FATTING)': agriLoanHistory,
    'AGRI (SHORT TERM) SHAWNIRVAR CREDIT': agriLoanHistory,
    'POVERTY ALLEVIATION(MUJIB YEAR)': agriLoanHistory,
    'PAST DUE (AGRI)- SHORT TERM': agriLoanHistory,
    'PAST DUE SHAWNIRVAR': agriLoanHistory,
    'PAST DUE (LAND LESS FARMER)': agriLoanHistory,
    'COTTAGE INDUSTRIES LOANS': agriLoanHistory,
    'AGRI SHORT (HILL TRACTS)': agriLoanHistory,
    'AGRI LOAN (COVID-19)': agriLoanHistory,
    'AGRI (MID TERM) GENERAL': agriLoanHistory,
    'PAST DUE (AGRI)- LONG TERM': agriLoanHistory,
    'PAST DUE (AGRI)- MID TERM': agriLoanHistory
};

/* Helpers */
const excelDateToJSDate=(excelDate)=>{
  if(typeof excelDate==='number'){return new Date(Math.round((excelDate-25569)*86400*1000));}
  return new Date(excelDate);
};
const formatDate=(d)=>{
  if(!(d instanceof Date)||isNaN(d))return '';
  const dd=String(d.getUTCDate()).padStart(2,'0'), mm=String(d.getUTCMonth()+1).padStart(2,'0'), yy=d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
};
const formatDateForInput = (d) => {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const parseDateFromDisplay = (str) => {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  // Use Date.UTC to create a date in UTC, avoiding timezone offsets.
  return new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
};
const formatRate = (rate) => {
    if (typeof rate !== 'number' || isNaN(rate)) return '';
    return rate.toFixed(2) + '%';
};

// Helper to add months to a date, handles month-end correctly
const addMonths = (date, months) => {
    if(!date) return null;
    const d = new Date(date.getTime()); // Create a copy
    const originalDate = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + months);
    // If the new date is not the same day of the month, it means we rolled over,
    // so set to the last day of the previous month.
    if (d.getUTCDate() !== originalDate)
        d.setUTCDate(0);
    return d;
};

const calculateOverdueDuration = (calcEndDate, loanDueDate) => {
    if (calcEndDate <= loanDueDate) return "";

    let d2 = new Date(calcEndDate.getTime());
    let d1 = new Date(loanDueDate.getTime());

    let months = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12;
    months -= d1.getUTCMonth();
    months += d2.getUTCMonth();
    
    let days = d2.getUTCDate() - d1.getUTCDate();
    if (days < 0) {
        months--;
        // Get days in previous month in UTC
        days += new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), 0)).getUTCDate();
    }

    if (months < 0) months = 0;

    let years = Math.floor(months / 12);
    months %= 12;

    let parts = [];
    if (years > 0) parts.push(years + "Y");
    if (months > 0) parts.push(months + "M");
    
    if (parts.length === 0 && days > 0) parts.push(days + "D");
    if (parts.length === 0) return "";

    return ` (OD- ${parts.join(" ")})`;
};

const determineClassification = (calcEndDate, loanDueDate) => {
    if (!calcEndDate || !loanDueDate || isNaN(calcEndDate) || isNaN(loanDueDate)) {
        return "";
    }

    let classification = "";
    if (calcEndDate <= loanDueDate) classification = "UC-STD-0";
    else if (calcEndDate < addMonths(loanDueDate, 1)) classification = "UC-STD-1";
    else if (calcEndDate < addMonths(loanDueDate, 2)) classification = "UC-STD-2";
    else if (calcEndDate < addMonths(loanDueDate, 3)) classification = "SMA";
    else if (calcEndDate < addMonths(loanDueDate, 6)) classification = "SS";
    else if (calcEndDate < addMonths(loanDueDate, 12)) classification = "DF";
    else classification = "BL";

    if (classification !== "UC-STD-0") {
        classification += calculateOverdueDuration(calcEndDate, loanDueDate);
    }
    return classification;
};

/* ===== Installment Modal Functions ===== */
function showInstallmentModal() {
    // Pre-fill with any existing values from the main form
    document.getElementById('gracePeriodModal').value = (document.getElementById('gracePeriod').value || '').replace(/\D/g, '');
    document.getElementById('installmentFrequencyModal').value = document.getElementById('installmentFrequency').value || '';

    document.getElementById('installmentModal').classList.remove('hidden');
    document.getElementById('installmentModal').classList.add('flex');
}

function hideInstallmentModal() {
    document.getElementById('installmentModal').classList.add('hidden');
    document.getElementById('installmentModal').classList.remove('flex');
}

function saveInstallmentDataAndContinue() {
    const gracePeriod = document.getElementById('gracePeriodModal').value;
    const frequency = document.getElementById('installmentFrequencyModal').value;

    if (!gracePeriod || !frequency) {
        InterestCalcLogic.showMessageBox("Please provide both a Grace Period and an Installment Frequency.", true);
        return;
    }

    // Update the main form's readonly fields
    const gracePeriodInput = document.getElementById('gracePeriod');
    gracePeriodInput.value = gracePeriod;
    // Trigger the blur event to add the " Months" suffix
    gracePeriodInput.dispatchEvent(new Event('blur'));

    document.getElementById('installmentFrequency').value = frequency;

    // Now that we have the required info, proceed with the penalty logic
    proceedWithPenaltyApplication();

    hideInstallmentModal();
}

function cancelAndContinue() {
    finalizeAndCalculateTable();
    hideInstallmentModal();
}

/* ===== Available Loans Modal Functions ===== */
let allAvailableLoansData = [];


// =========================================================================
// BULK UPDATE RATES (EXCEL TEMPLATE & IMPORT)
// =========================================================================
let parsedBulkRatesState = [];

function showBulkRateUpdateModal() {
    InterestCalcLogic.hideAvailableLoansModal();
    parsedBulkRatesState = [];
    const tbody = document.getElementById('bulkRatePreviewTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 font-medium">Upload an Excel file or download the template to view rate records.</td></tr>`;
    }
    const badge = document.getElementById('bulkPreviewBadge');
    if (badge) {
        badge.textContent = 'No file uploaded';
        badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-gray-200 text-gray-700';
    }
    const statsEl = document.getElementById('bulkUploadStats');
    if (statsEl) statsEl.classList.add('hidden');
    const applyBtn = document.getElementById('btnApplyBulkRates');
    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    const fileInp = document.getElementById('bulkRateUploadInput');
    if (fileInp) fileInp.value = '';

    const modal = document.getElementById('bulkRateUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideBulkRateUpdateModal() {
    const modal = document.getElementById('bulkRateUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function downloadBulkRatesTemplate() {
    if (typeof ExcelJS === 'undefined') {
        showToast('ExcelJS library not loaded.', true);
        return;
    }

    const loanHeads = Object.keys(loanTypeMap).sort((a, b) => Number(a) - Number(b));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Interest Rates');
    
    const loanDataList = [];
    
    loanHeads.forEach(head => {
        const loanName = loanTypeMap[head];
        const upper = loanName.toUpperCase().trim();
        const history = interestRateHistory[upper] || [];
        const loanRows = [];
        
        if (history && history.length > 0) {
            const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
            sorted.forEach((h, idx) => {
                const d = new Date(h.date);
                const frmDate = formatDate(d);
                let toDate = '';
                if (idx < sorted.length - 1) {
                    const nextD = new Date(sorted[idx + 1].date);
                    nextD.setDate(nextD.getDate() - 1);
                    toDate = formatDate(nextD);
                }
                const rateVal = typeof h.rate === 'number' ? Number(h.rate.toFixed(2)) : parseFloat(h.rate) || 9.0;
                loanRows.push([loanName, frmDate, toDate, rateVal]);
            });
        } else {
            const baseRate = fixedTermLoanRates[upper] !== undefined ? fixedTermLoanRates[upper] : 9.0;
            loanRows.push([loanName, "01/01/2020", "", baseRate]);
        }
        loanDataList.push(loanRows);
    });

    let maxRows = 0;
    loanDataList.forEach(list => {
        if (list.length > maxRows) maxRows = list.length;
    });

    const headerData = [];
    loanDataList.forEach((_, idx) => {
        headerData.push("Loan Type", "From date", "To date", "Rate");
        if (idx < loanDataList.length - 1) {
            headerData.push(""); // Blank column separator
        }
    });
    
    const headerRow = sheet.addRow(headerData);
    
    headerRow.eachCell((cell) => {
        if (cell.value) { 
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203764' } }; // Dark blue
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }
    });

    for (let r = 0; r < maxRows; r++) {
        const dataRow = [];
        loanDataList.forEach((list, idx) => {
            if (r < list.length) {
                dataRow.push(...list[r]);
            } else {
                dataRow.push("", "", "", "");
            }
            if (idx < loanDataList.length - 1) {
                dataRow.push("");
            }
        });
        sheet.addRow(dataRow);
    }

    let colIdx = 1;
    loanDataList.forEach((_, idx) => {
        sheet.getColumn(colIdx++).width = 25; 
        sheet.getColumn(colIdx++).width = 15; 
        sheet.getColumn(colIdx++).width = 15; 
        sheet.getColumn(colIdx++).width = 10; 
        if (idx < loanDataList.length - 1) {
            sheet.getColumn(colIdx++).width = 5; 
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Bulk_Rates_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(" Downloaded Bulk_Rates_Template.xlsx");
}

function parseBulkRatesExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showToast('Excel parser library (XLSX) not available.', true);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            parsedBulkRatesState = [];
            
            if (json.length < 2) {
                showToast("The Excel file doesn't seem to have valid data rows.", true);
                return;
            }

            const headerRow = json[0];
            
            // The file is built with blocks of 4 columns, optionally separated by a blank column.
            // We iterate column blocks by finding "Loan Type" headers.
            const blocks = [];
            for (let c = 0; c < headerRow.length; c++) {
                if (typeof headerRow[c] === 'string' && headerRow[c].toLowerCase().includes('loan type')) {
                    blocks.push(c); // starting column index of a block
                }
            }

            // Now iterate rows and blocks to extract data
            for (let r = 1; r < json.length; r++) {
                const row = json[r];
                if (!row || row.length === 0) continue;

                blocks.forEach(c => {
                    const loanTypeStr = row[c];
                    const fromDateStr = row[c + 1];
                    const toDateStr = row[c + 2] || '';
                    const rateStr = row[c + 3];

                    if (loanTypeStr && fromDateStr && rateStr !== undefined) {
                        const parsedRate = parseFloat(String(rateStr).replace(/[^0-9.]/g, ''));
                        if (!isNaN(parsedRate)) {
                            parsedBulkRatesState.push({
                                loanType: String(loanTypeStr).trim().toUpperCase(),
                                fromDate: String(fromDateStr).trim(),
                                toDate: String(toDateStr).trim(),
                                rate: parsedRate
                            });
                        }
                    }
                });
            }

            if (parsedBulkRatesState.length === 0) {
                showToast("No valid rates found in the uploaded file.", true);
            } else {
                showToast(`Successfully parsed ${parsedBulkRatesState.length} rates from Excel!`);
                renderBulkRatesPreview();
            }

        } catch (err) {
            console.error("Error parsing Excel:", err);
            showToast("Failed to parse the Excel file.", true);
        }
        
        // Reset file input
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function applyBulkRates() {
    if (!parsedBulkRatesState || parsedBulkRatesState.length === 0) {
        showMessageBox('No rate entries loaded to apply.', true);
        return;
    }

    // Group parsed rates by normalized Loan Type
    const grouped = {};
    parsedBulkRatesState.forEach(item => {
        if (!item.isValid) return;
        const norm = item.loanType.toUpperCase().trim();
        if (!grouped[norm]) grouped[norm] = [];

        const dt = parseDateFromDisplay(item.frmDate);
        if (dt && !isNaN(dt)) {
            grouped[norm].push({
                date: dt,
                dateStr: dt.toISOString().split('T')[0],
                rate: item.rate
            });
        }
    });

    let updatedCount = 0;
    Object.keys(grouped).forEach(normLoanName => {
        const rates = grouped[normLoanName].sort((a, b) => a.date - b.date);
        if (rates.length > 0) {
            interestRateHistory[normLoanName] = rates;
            if (window.InterestRateManager && typeof window.InterestRateManager.overwriteCustomRates === 'function') {
                window.InterestRateManager.overwriteCustomRates(normLoanName, rates.map(r => ({ dateStr: r.dateStr, rate: r.rate })));
            }
            updatedCount++;
        }
    });

    hideBulkRateUpdateModal();
    showAvailableLoansModal();
    showToast(` Successfully updated rates for ${updatedCount} loan products!`);
}

function showAvailableLoansModal() {
    const tableBody = document.getElementById('availableLoansTableBody');
    if (!tableBody) return;

    // Get loan heads and sort them numerically
    const loanHeads = Object.keys(loanTypeMap).sort((a, b) => Number(a) - Number(b));
    allAvailableLoansData = [];

    loanHeads.forEach(head => {
        const loanName = loanTypeMap[head];
        const category = loanCategoryMap[loanName] || 'Other';
        const structure = resolveTermType(loanName);
        const cap = (resolveCapFreq(loanName) || capitalizationMap[loanName] || 'quarterly').toLowerCase();
        const capDisplay = cap.charAt(0).toUpperCase() + cap.slice(1);
        const isExempt = isPenaltyExempt(loanName);

        let rateDisplay = '-';
        if (window.InterestRateManager && typeof window.InterestRateManager.getLatestRate === 'function') {
            const r = window.InterestRateManager.getLatestRate(loanName);
            if (r !== null && r !== undefined) {
                rateDisplay = typeof r === 'number' ? r.toFixed(2) + '%' : r;
            }
        } else if (fixedTermLoanRates[loanName.toUpperCase().trim()] !== undefined) {
            rateDisplay = fixedTermLoanRates[loanName.toUpperCase().trim()] + '%';
        }

        allAvailableLoansData.push({
            head,
            name: loanName,
            category,
            structure,
            capitalization: capDisplay,
            isExempt,
            rate: rateDisplay
        });
    });

    renderAvailableLoansRows(allAvailableLoansData);

    const searchInput = document.getElementById('searchAvailableLoans');
    if (searchInput) searchInput.value = '';

    const countBadge = document.getElementById('availableLoansCountBadge');
    if (countBadge) countBadge.textContent = `Total: ${allAvailableLoansData.length} Products`;

    document.getElementById('availableLoansModal').classList.remove('hidden');
    document.getElementById('availableLoansModal').classList.add('flex');
}

function renderAvailableLoansRows(dataList) {
    const tableBody = document.getElementById('availableLoansTableBody');
    if (!tableBody) return;

    if (!dataList || dataList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-gray-500 font-medium">No matching loan products found.</td></tr>`;
        return;
    }

    let html = '';
    dataList.forEach((item, index) => {
        // Capitalization badge styling
        let capBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
        if (item.capitalization.toLowerCase().includes('year')) capBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
        else if (item.capitalization.toLowerCase().includes('month')) capBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

        // Term Type badge styling (Long Term, Mid Term, Short Term, Continuous)
        let structBadgeClass = 'bg-gray-100 text-gray-700';
        if (item.structure === 'Long Term') structBadgeClass = 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold';
        else if (item.structure === 'Mid Term') structBadgeClass = 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold';
        else if (item.structure === 'Short Term') structBadgeClass = 'bg-teal-50 text-teal-700 border border-teal-200 font-semibold';
        else if (item.structure === 'Continuous') structBadgeClass = 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold';

        // Penalty badge styling
        const penBadge = item.isExempt
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-300"> N/A (Exempt)</span>'
            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 border border-green-300"> Applicable</span>';

        html += `
            <tr class="border-b hover:bg-green-50/40 transition">
                <td class="p-2 text-center font-bold text-gray-400">${index + 1}</td>
                <td class="p-2 font-mono font-bold text-gray-900">${item.head}</td>
                <td class="p-2 font-semibold text-gray-800">${item.name}</td>
                <td class="p-2 text-gray-600">${item.category}</td>
                <td class="p-2"><span class="px-2 py-0.5 rounded text-[11px] font-medium ${structBadgeClass}">${item.structure}</span></td>
                <td class="p-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-semibold border ${capBadgeClass}">${item.capitalization}</span></td>
                <td class="p-2 text-center">${penBadge}</td>
                <td class="p-2 text-right font-mono font-bold text-green-700">${item.rate}</td>
                <td class="p-2.5 text-center">
                    <button type="button" onclick="InterestCalcLogic.editProductFromViewLoans('${item.name.replace(/'/g, "\\'")}')"
                        class="btn-unified btn-modal-warning text-xs h-8 px-3 whitespace-nowrap">
                         Edit
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function filterAvailableLoansTable(query) {
    if (!query || !query.trim()) {
        renderAvailableLoansRows(allAvailableLoansData);
        const countBadge = document.getElementById('availableLoansCountBadge');
        if (countBadge) countBadge.textContent = `Total: ${allAvailableLoansData.length} Products`;
        return;
    }
    const q = query.toLowerCase().trim();
    const filtered = allAvailableLoansData.filter(item => {
        return item.head.toLowerCase().includes(q) ||
               item.name.toLowerCase().includes(q) ||
               item.category.toLowerCase().includes(q) ||
               item.structure.toLowerCase().includes(q) ||
               item.capitalization.toLowerCase().includes(q) ||
               (item.isExempt ? 'n/a exempt no' : 'applicable yes').includes(q) ||
               item.rate.toLowerCase().includes(q);
    });
    renderAvailableLoansRows(filtered);
    const countBadge = document.getElementById('availableLoansCountBadge');
    if (countBadge) countBadge.textContent = `Showing: ${filtered.length} of ${allAvailableLoansData.length}`;
}




/* replaced addNewLoanFromViewLoans */

function editProductFromViewLoans(loanName) {
    modalOrigin = 'viewLoans';
    hideAvailableLoansModal();
    showRateChangeModal('rates', 'viewLoans');

    const sel = document.getElementById('rateManagerLoanSelector');
    if (sel) {
        sel.value = loanName;
        refreshRateManagerTable();
        editSelectedProduct();
    }
}

function goBackToPreviousModal() {
    if (modalOrigin === 'viewLoans') {
        hideRateChangeModal();
        modalOrigin = null;
        showAvailableLoansModal();
    } else {
        hideRateChangeModal();
    }
}

function openViewLoansFromConfigurator() {
    hideRateChangeModal();
    modalOrigin = null;
    showAvailableLoansModal();
}


function hideAvailableLoansModal() {
    document.getElementById('availableLoansModal').classList.add('hidden');
    document.getElementById('availableLoansModal').classList.remove('flex');
}
function handleNewLoanRateTypeChange() {
    const rateType = document.getElementById('newLoanRateType').value;
    const specialContainer = document.getElementById('specialRateContainer');
    const pullLabel = document.getElementById('pullRateHistoryLabel');

    if (rateType === 'special') {
        specialContainer.classList.remove('hidden');
        pullLabel.innerText = 'Loan Group (for Rate Updates)';
    } else {
        specialContainer.classList.add('hidden');
        pullLabel.innerText = 'Pull Interest Rate History From';
    }
}

function handleNewLoanGroupChange() {
    const loanGroup = document.getElementById('newLoanCopyRates').value;
    const cmsmeContainer = document.getElementById('newLoanCmsmeSubTypeContainer');
    const personalLoanContainer = document.getElementById('newLoanPersonalLoanSubTypeContainer');

    cmsmeContainer.classList.toggle('hidden', loanGroup !== 'CMSME');
    personalLoanContainer.classList.toggle('hidden', loanGroup !== 'Personal Loan');
}

/* ===== Add New Loan Type Modal Functions ===== */
function showAddLoanTypeModal() {
    const copyRatesSelect = document.getElementById('newLoanCopyRates');

    // Populate loan categories from existing map
    const categories = [...new Set(Object.values(loanCategoryMap))];
    const categoryOptions = categories.sort().map(c => `<option value="${c}">${c}</option>`).join('');

    copyRatesSelect.innerHTML = categoryOptions;

    // Clear previous values
    document.getElementById('newLoanHead').value = '';
    document.getElementById('newLoanTypeName').value = '';

    // Set initial state
    document.getElementById('newLoanRateType').value = 'general';
    handleNewLoanRateTypeChange();
    handleNewLoanGroupChange();

    document.getElementById('addLoanTypeModal').classList.remove('hidden');
    document.getElementById('addLoanTypeModal').classList.add('flex');
}

function hideAddLoanTypeModal() {
    document.getElementById('addLoanTypeModal').classList.add('hidden');
    document.getElementById('addLoanTypeModal').classList.remove('flex');
}

function saveNewLoanType() {
    // 1. Get all values from the modal form
    const head = document.getElementById('newLoanHead').value.trim();
    const rateType = document.getElementById('newLoanRateType').value;
    const typeName = document.getElementById('newLoanTypeName').value.trim().toUpperCase();
    const copyRatesFrom = document.getElementById('newLoanCopyRates').value;
    const capitalization = document.getElementById('newLoanCapitalization').value;
    const structure = document.getElementById('newLoanStructure').value;
    const applyPenalty = document.getElementById('newLoanPenalty').value === 'yes';
    const group = copyRatesFrom;
    const fixedRate = parseFloat(document.getElementById('newFixedRate').value);
    const applicableTill = document.getElementById('newFixedRateApplicableTill').value;

    // 2. Validation
    if (!head || !typeName || !group || !structure) {
        InterestCalcLogic.showMessageBox("Please fill all required fields.", true);
        return;
    }
    if (!/^\d{4}$/.test(head)) {
        showMessageBox("Loan Head must be a 4-digit code.", true);
        return;
    }
    if (loanTypeMap[head]) {
        InterestCalcLogic.showMessageBox(`Loan Head ${head} already exists for '${loanTypeMap[head]}'.`, true);
        return;
    }

    // 3. Construct the full loan type name
    let subType = '';
    if (group === 'CMSME') {
        subType = document.getElementById('newLoanCmsmeSubType').value.trim().toUpperCase();
    } else if (group === 'Personal Loan') {
        subType = document.getElementById('newLoanPersonalLoanSubType').value.trim().toUpperCase();
    }
    const fullLoanTypeName = subType ? `${typeName} (${subType})` : typeName;

    if (Object.values(loanTypeMap).includes(fullLoanTypeName)) {
         InterestCalcLogic.showMessageBox(`Loan Type Name '${fullLoanTypeName}' already exists.`, true);
        return;
    }
    if (rateType === 'special' && isNaN(fixedRate)) {
        showMessageBox("Please enter a valid number for the Fixed Interest Rate.", true);
        return;
    }

    // 4. Update all the relevant maps
    loanTypeMap[head] = fullLoanTypeName;
    capitalizationMap[fullLoanTypeName] = capitalization;
    loanCategoryMap[fullLoanTypeName] = group;
    loanStructureMap[fullLoanTypeName] = structure;

    if (!applyPenalty) {
        penaltyExemptLoanTypes.push(fullLoanTypeName);
    }

    // 5. Handle interest rate history based on loan rate type
    if (rateType === 'special') {
        if (applicableTill === 'whole_period') {
            interestRateHistory[fullLoanTypeName] = [{ date: new Date('1900-01-01'), rate: fixedRate }];
        } else { // 'loan_due_date'
            fixedTermLoanRates[fullLoanTypeName] = fixedRate;
            // Still need to copy a history for after the due date
            copyRateHistory(fullLoanTypeName, copyRatesFrom);
        }
    } else {
        copyRateHistory(fullLoanTypeName, copyRatesFrom);
    }

    // 6. Close modal and show success message
    hideAddLoanTypeModal();
    InterestCalcLogic.showMessageBox(`Successfully added new loan type: '${fullLoanTypeName}'. It is now available for calculations.`, false);
}

function copyRateHistory(newLoanType, sourceCategory) {
    let sourceLoanTypeForRates = Object.keys(loanCategoryMap).find(ltype => loanCategoryMap[ltype] === sourceCategory);

    if (sourceLoanTypeForRates && interestRateHistory[sourceLoanTypeForRates]) {
        InterestCalcLogic.interestRateHistory[newLoanType] = JSON.parse(JSON.stringify(interestRateHistory[sourceLoanTypeForRates]));
    } else {
        InterestCalcLogic.showMessageBox(`Could not find a source loan type for category '${sourceCategory}' to copy rates. New loan type added without rate history.`, true);
        InterestCalcLogic.interestRateHistory[newLoanType] = []; // empty history
    }
}

/* ===== Calculation Method Modal Functions ===== */
function showCalculationMethodModal() {
    const el = document.getElementById('calculationMethodModal');
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function hideCalculationMethodModal() {
    const el = document.getElementById('calculationMethodModal');
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

function selectCalculationMethod(method) {
    calculationMethod = method;
    
    // Prepare configuration for the App Shell Right Panel
    const config = {
        importLabel: method === 'ledger' ? 'Import Loan Data' : (method === 'headChange' ? 'Import 0134 Data' : 'Import Statement Data'),
        showSecondary: method === 'headChange',
        secondaryLabel: 'Import New Head Data',
        showInput: method === 'ledger',
        inputLabel: 'Manual Ledger Input',
    };

    // Notify App Shell to update button visibility/labels
    window.parent.postMessage({
        command: 'EXECUTE_SHELL_ACTION',
        actionId: 'update-calc-ui',
        config: config
    }, '*');

    InterestCalcLogic.log("Selected calculation method:", method);
    hideCalculationMethodModal();
}

/* ===== Manual Data Entry Functions ===== */
function addManualTransactionRow() {
    const tableBody = document.getElementById('loanTableBody');
    const totalRow = document.getElementById('total-row');
    const sl = totalRow ? tableBody.rows.length : tableBody.rows.length + 1;

    // Determine if this is the first row to make balance editable
    const isFirstRow = sl === 1;
    const balanceEditable = isFirstRow ? 'contentEditable="true"' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="p-2 border border-gray-400 text-center">${sl}</td>
        <td class="p-2 border border-gray-400 text-center" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 particulars-col" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 text-center" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 text-center" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 text-center" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 text-center" contentEditable="true"></td>
        <td class="p-2 border border-gray-400 text-center" ${balanceEditable}></td>
        <td class="p-2 border border-gray-400 text-center"></td>
        <td class="p-2 border border-gray-400 text-center"></td>
        <td class="p-2 border border-gray-400 text-center"></td>
    `;

    // Insert before the total row if it exists, otherwise append to the end
    tableBody.insertBefore(tr, totalRow);
}

/* ===== CSV Import (offline) =====
   You can later paste the minified SheetJS library into the placeholder
   below to re-enable .xlsx/.xls parsing without internet.
*/
function parseCSV(text){
  // simple CSV parser (handles commas, quotes, and newlines)
  const rows=[]; let i=0, cur='', inQuotes=false, row=[];
  while(i<text.length){
    const ch=text[i];
    if(inQuotes){
      if(ch==='"' && text[i+1]==='"'){cur+='"'; i+=2; continue;}
      if(ch==='"'){inQuotes=false; i++; continue;}
      cur+=ch; i++; continue;
    }else{
      if(ch==='"'){inQuotes=true; i++; continue;}
      if(ch===','){row.push(cur.trim()); cur=''; i++; continue;}
      if(ch==='\n'){row.push(cur.trim()); rows.push(row); row=[]; cur=''; i++; continue;}
      if(ch==='\r'){i++; continue;}
      cur+=ch; i++; continue;
    }
  }
  row.push(cur.trim()); rows.push(row);
  return rows.filter(r=>r.length && r.some(c=>c!=='')); // drop blank lines
}


    // Helper to resiliently resolve Capitalization Frequency from maps
    const resolveCapFreq = (val) => {
        if (!val) return null;
        let freq = capitalizationMap[val];
        if (freq) return freq;
        
        const resolvedName = loanTypeMap[val];
        if (resolvedName && capitalizationMap[resolvedName]) return capitalizationMap[resolvedName];
        
        // Handle "1101 - AGRI" format natively so it works everywhere
        if (val.includes('-')) {
            const parts = val.split('-');
            const code = parts[0].trim();
            const name = parts.slice(1).join('-').trim();
            
            // Try resolving by code
            if (loanTypeMap[code] && capitalizationMap[loanTypeMap[code]]) return capitalizationMap[loanTypeMap[code]];
            if (capitalizationMap[code]) return capitalizationMap[code];
            
            // Try resolving by name
            const upperName = name.toUpperCase().trim();
            const matchedNameKey = Object.keys(capitalizationMap).find(k => k.toUpperCase().trim() === upperName);
            if (matchedNameKey) return capitalizationMap[matchedNameKey];
        }

        const upperVal = val.toUpperCase().trim();
        const matchedKey = Object.keys(capitalizationMap).find(k => k.toUpperCase().trim() === upperVal);
        if (matchedKey) return capitalizationMap[matchedKey];
        return null;
    };

function processAndDisplayData(rows, appendData = false, ignoreStartDate = false) {
    const calcStartDateInput = document.getElementById('calcStartDate');
    const calcEndDateInput = document.getElementById('calcEndDate');
    penaltyState.originalRates = null; // Reset penalty state on new import

    if (rows.length < 11) { // Need at least up to row 11 for all data points
        showMessageBox("The imported Excel file does not have enough data. Please check the file format.", true);
        return;
    }

    // Dynamic Header Row Detection: Scan first 20 rows for key transactional headers
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i];
        if (row && row.some(cell => {
            const val = String(cell).trim().toUpperCase();
            return ['ACCOUNTNO', 'TXNDATE', 'GLHEAD', 'REFERENCE', 'LIMIT'].includes(val);
        })) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        // Fallback to legacy index 8 if no headers detected
        headerRowIndex = 8;
    }

    const headerRow = rows[headerRowIndex] || [];
    const dataRowIndex = headerRowIndex + 1;

    const findColIndex = (names) => {
        const searchNames = Array.isArray(names) ? names : [names];
        return headerRow.findIndex(cell => cell && searchNames.includes(String(cell).trim().toUpperCase()));
    };

    const metaIndices = {
        branch: findColIndex(['BRANCH_NAME', 'BRANCH']),
        accountNo: findColIndex(['ACCOUNTNO', 'ACCOUNT_NO', 'A/C NO']),
        acName: findColIndex(['ACNAME', 'ACCOUNT_NAME', 'A/C NAME']),
        opend: findColIndex(['OPEND', 'OPEN_DATE', 'SANCTION_DATE']),
        expiry: findColIndex(['EXPIRY_DT', 'EXPIRY_DATE', 'DUE_DATE']),
        glHead: findColIndex(['GLHEAD', 'GL_HEAD', 'LOAN_TYPE']),
        address: findColIndex(['PRE_ADD', 'ADDRESS']),
        installment: findColIndex(['INSTALMENT', 'INSTALLMENT_SIZE']),
        limit: findColIndex(['LIMIT', 'SANCTION_LIMIT']),
        interestRate: findColIndex(['INTEREST_RATE', 'RATE'])
    };

    // Define column mappings based on headers, with fallbacks for standard positions
    let colMap = {
        date: findColIndex(['TXNDATE', 'DATE', 'TRANSACTION_DATE']),
        particulars: findColIndex(['REFERENCE', 'PARTICULARS', 'DESCRIPTION']), 
        debit: findColIndex(['DEBIT', 'DR_AMT']),
        credit: findColIndex(['CREDIT', 'CR_AMT']),
        balance: findColIndex(['BALANCE', 'BAL_AMT'])
    };
    
    // Transactional Column Fallbacks (if headers not found, use default indices)
    if (colMap.date === -1) colMap.date = 12;
    if (colMap.particulars === -1) colMap.particulars = 13;
    if (colMap.debit === -1) colMap.debit = 14;
    if (colMap.credit === -1) colMap.credit = 15;
    if (colMap.balance === -1) colMap.balance = 16;

    // --- 1. Populate Input Fields from specific cells ---
    if (!appendData || (calculationMethod === 'headChange' && appendData)) {
        try {
            // Helper to get a value from a specific cell
            const getCellValue = (r, c) => rows[r]?.[c] ?? '';

        // Sanction Date
        const sanctionDateRaw = metaIndices.opend !== -1 ? getCellValue(dataRowIndex, metaIndices.opend) : getCellValue(dataRowIndex, 17);
        const sanctionDate = excelDateToJSDate(sanctionDateRaw);
        document.getElementById('sanction_date').value = formatDate(sanctionDate);

        // Loan Due Date
        const loanDueDateRaw = metaIndices.expiry !== -1 ? getCellValue(dataRowIndex, metaIndices.expiry) : getCellValue(dataRowIndex, 18);
        const loanDueDate = excelDateToJSDate(loanDueDateRaw);
        document.getElementById('loanDueDate').value = formatDate(loanDueDate);

        // --- New logic for Loan Term ---
        if (sanctionDate && loanDueDate && !isNaN(sanctionDate) && !isNaN(loanDueDate)) {
            let months;
            months = (loanDueDate.getFullYear() - sanctionDate.getFullYear()) * 12;
            months -= sanctionDate.getMonth();
            months += loanDueDate.getMonth();
            if (loanDueDate.getDate() < sanctionDate.getDate()) {
                months--;
            }
            document.getElementById('loanTerm').value = months <= 0 ? 0 : months;
        } else {
            document.getElementById('loanTerm').value = '';
        }

        // --- New logic for CL Date ---
        if (loanDueDate && !isNaN(loanDueDate)) {
            const clDate = addMonths(loanDueDate, 3);
            document.getElementById('clDate').value = formatDate(clDate);
        }

        // Other text/number fields
        let accountNumber = '';
        // Try to extract from Row 4 (Index 3) as requested
        const row4 = rows[3];
        if (row4) {
            const accCell = row4.find(cell => cell && String(cell).includes('Account No'));
            if (accCell) {
                const parts = String(accCell).split(':');
                accountNumber = parts[parts.length - 1].trim();
            }
        }
        // Fallback to ACCOUNTNO header if extraction from text failed
        if (!accountNumber) accountNumber = metaIndices.accountNo !== -1 ? getCellValue(9, metaIndices.accountNo) : getCellValue(9, 9); 

        const branchElem = document.getElementById('branch_name');
        if (branchElem) {
            const val = metaIndices.branch !== -1 ? getCellValue(dataRowIndex, metaIndices.branch) : getCellValue(dataRowIndex, 0);
            if (branchElem.tagName === 'INPUT') branchElem.value = val;
            else branchElem.innerText = val;
        } 
        document.getElementById('deposit_account_no').value = accountNumber;
        document.getElementById('applicant_name_bn').value = metaIndices.acName !== -1 ? getCellValue(dataRowIndex, metaIndices.acName) : getCellValue(dataRowIndex, 19);    
        document.getElementById('address').value = metaIndices.address !== -1 ? getCellValue(dataRowIndex, metaIndices.address) : getCellValue(dataRowIndex, 20); // U10
        document.getElementById('installmentSize').value = metaIndices.installment !== -1 ? getCellValue(dataRowIndex, metaIndices.installment) : getCellValue(dataRowIndex, 24); // Y10
        document.getElementById('sanctionAmount').value = metaIndices.limit !== -1 ? getCellValue(dataRowIndex, metaIndices.limit) : getCellValue(dataRowIndex, 23);    // X10
        
        let rateRaw = '0';
        if (metaIndices.interestRate !== -1) {
            rateRaw = getCellValue(dataRowIndex, metaIndices.interestRate);
        } else {
            rateRaw = getCellValue(headerRowIndex + 2, 33); // Legacy fallback
        }
        document.getElementById('sanctionRate').value = formatRate(parseFloat(rateRaw || '0'));

        // Determine Loan Type (Strictly from Account Number to follow internal structure)
        let loanTypeVal = 'Unknown Loan Type';
        if (accountNumber) {
            const hyphenIndex = accountNumber.indexOf('-');
            if (hyphenIndex > -1 && accountNumber.length >= hyphenIndex + 5) {
                const loanCode = accountNumber.substr(hyphenIndex + 1, 4);
                loanTypeVal = loanTypeMap[loanCode] || 'Unknown Loan Type';
            }
        }
        document.getElementById('loan_scheme_name').value = loanTypeVal;
        updatePenaltyField(loanTypeVal);

    } catch (e) {
        showMessageBox("Error reading header data from the Excel file. Please ensure the format is correct. Error: " + e.message, true);
        return;
    }
    }

    // --- 3. Determine Classification ---
    const calcEndDateForClass = new Date(calcEndDateInput.value);
    const loanDueDateForClass = parseDateFromDisplay(document.getElementById('loanDueDate').value);
    document.getElementById('classification').value = determineClassification(calcEndDateForClass, loanDueDateForClass);


    // --- 2. Populate Table from transactional data ---
    const calcStartDate = ignoreStartDate ? new Date('1900-01-01') : new Date(calcStartDateInput.value);
    const calcEndDate = new Date(calcEndDateInput.value);
    const tableBody = document.getElementById('loanTableBody');
    
    if (!appendData) {
        tableBody.innerHTML = '';
    } else {
        // Remove existing "Calculation End Date" row if appending, to add it back at the very end
        const tableRows = Array.from(tableBody.rows);
        if (tableRows.length > 0) {
            const lastRow = tableRows[tableRows.length - 1];
            if (lastRow.cells[2].innerText === 'Calculation End Date') {
                lastRow.remove();
            }
        }
    }
    
    let sl = tableBody.rows.length + 1;
    let dataFound = false;
    let initialBalanceSet = false; // Flag to ensure we only pull the first balance
    if (calculationMethod === 'headChange' && appendData) {
        initialBalanceSet = true;
    }
    let positiveDataWarning = false; // Flag for warning if data is already positive
    let firstDateInTable = null;

    // Loop starts from the detected data row for transactional data
    for (let i = dataRowIndex; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue; // Skip empty rows
        const rawDate = r[colMap.date]; // Use map
        if (rawDate == null || rawDate === '') continue;

        let d;
        if (!isNaN(Number(rawDate))) {
            d = excelDateToJSDate(Number(rawDate));
        } else {
            const norm = String(rawDate).replace(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/, (m, a, b, c) => `${c}-${b}-${a}`);
            const dt = new Date(isNaN(Date.parse(rawDate)) ? norm : rawDate);
            d = isNaN(dt) ? null : dt;
        }

        if (!d || (!ignoreStartDate && d < calcStartDate) || d > calcEndDate) continue;

        const balanceRaw = parseFloat(String(r[colMap.balance] || '0').replace(/,/g, '')); // Use map

        // If we haven't set the initial balance, we must find a non-zero balance OR a transaction to start.
        // Don't skip if there is a transaction amount, even with a zero balance.
        const debitVal = r[colMap.debit] || '';
        const creditVal = r[colMap.credit] || '';
        if (!initialBalanceSet && balanceRaw === 0 && debitVal === '' && creditVal === '') {
            continue;
        }

        // For most loans, negative balance indicates outstanding debt (which is correct)
        // Only warn if balance is positive (which would be unusual for a loan)
        // For term/installment-based loans, negative balances are expected
        const currentLoanType = document.getElementById('loan_scheme_name').value.toUpperCase().trim();
        const loanStructure = loanStructureMap[currentLoanType];
        if (balanceRaw > 0 && loanStructure !== 'Term') {
            positiveDataWarning = true;
        }

        if (!firstDateInTable) firstDateInTable = new Date(d);

        dataFound = true;
        // Ensure particulars is pulled as a clean string. 
        // If the cell contains a number (like a Reference ID), it converts it exactly.
        const particulars = (r[colMap.particulars] !== undefined && r[colMap.particulars] !== null) ? String(r[colMap.particulars]).trim() : '';
        if (initialBalanceSet && particulars.toLowerCase().includes('interest')) continue;

        let balance = '';
        if (!initialBalanceSet) {
            balance = Math.abs(balanceRaw); // Use absolute value from Column Q for the first row
            initialBalanceSet = true;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 border border-gray-400 text-center">${sl++}</td>
            <td class="p-2 border border-gray-400 text-center" contentEditable="true">${formatDate(d)}</td>
            <td class="p-2 border border-gray-400 particulars-col" contentEditable>${particulars}</td>
            <td class="p-2 border border-gray-400 text-center" contentEditable>${debitVal}</td>
            <td class="p-2 border border-gray-400 text-center" contentEditable></td>
            <td class="p-2 border border-gray-400 text-center" contentEditable></td>
            <td class="p-2 border border-gray-400 text-center" contentEditable>${creditVal}</td>
            <td class="p-2 border border-gray-400 text-center">${balance}</td>
            <td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td>
          `;
        tableBody.appendChild(tr);
    }

    // Add Loan Due Date and Calculation End Date to the table
    const loanDueDate = parseDateFromDisplay(document.getElementById('loanDueDate').value);

    // Add Loan Due Date row if it's within the calculation period
    // Check if it already exists to avoid duplicates when appending
    let loanDueDateExists = false;
    for (let i = 0; i < tableBody.rows.length; i++) {
        if (tableBody.rows[i].cells[2].innerText === 'Loan Due Date') {
            loanDueDateExists = true;
            break;
        }
    }

    if (!loanDueDateExists && loanDueDate && firstDateInTable && loanDueDate > firstDateInTable && loanDueDate <= calcEndDate) {
        dataFound = true;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 border border-gray-400 text-center">${sl++}</td>
            <td class="p-2 border border-gray-400 text-center">${formatDate(loanDueDate)}</td>
            <td class="p-2 border border-gray-400 particulars-col">Loan Due Date</td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
          `;
        tableBody.appendChild(tr);
    }

    // Add Calculation End Date row
    if (calcEndDate && !isNaN(calcEndDate)) {
        dataFound = true;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 border border-gray-400 text-center">${sl++}</td>
            <td class="p-2 border border-gray-400 text-center">${formatDate(calcEndDate)}</td>
            <td class="p-2 border border-gray-400 particulars-col">Calculation End Date</td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
            <td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center"></td>
          `;
        tableBody.appendChild(tr);
    }

    if (dataFound) {
        // --- New Automated Logic ---
        const allRowsData = [];
        for (let i = 0; i < tableBody.rows.length; ++i) {
            const row = tableBody.rows[i];
            allRowsData.push({
                originalIndex: i,
                date: parseDateFromDisplay(row.cells[1].innerText),
                particulars: row.cells[2].innerText,
                amount: row.cells[3].innerText, debit: row.cells[4].innerText,
                penalty: row.cells[5].innerText, credit: row.cells[6].innerText,
                balance: row.cells[7].innerText, rate: row.cells[9].innerText
            });
        }

        const loanType = document.getElementById('loan_scheme_name').value;
        const startDate = allRowsData[0].date;
        let uiEndDate = new Date(document.getElementById('calcEndDate').value);
        const endDate = (!isNaN(uiEndDate.getTime())) ? uiEndDate : allRowsData[allRowsData.length - 1].date;

        // 1. Get Capitalization Dates
        const capFrequency = resolveCapFreq(loanType);
        if (capFrequency) { // Check if capFrequency is defined
            const capDates = [];
            // Start at the 1st of the month to avoid skipping months like February (Use UTC to align with calculation engine)
            let currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)); 
            while (currentDate <= endDate) { // Loop until current date exceeds end date
                let month = currentDate.getUTCMonth();
                let year = currentDate.getUTCFullYear();
                let capitalizationDate = null;
                if (capFrequency === 'monthly') capitalizationDate = new Date(Date.UTC(year, month + 1, 0));
                else if (capFrequency === 'quarterly') { if ([2, 5, 8, 11].includes(month)) capitalizationDate = new Date(Date.UTC(year, month + 1, 0)); } // March, June, Sep, Dec
                else if (capFrequency === 'yearly') { if (month === 5) capitalizationDate = new Date(Date.UTC(year, 5, 30)); } // June 30

                if (capitalizationDate && capitalizationDate >= startDate && capitalizationDate <= endDate) {
                    if (!capDates.some(d => d.getTime() === capitalizationDate.getTime())) capDates.push(capitalizationDate);
                } // Add capitalization date if it's within the range and not already present
                currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
            }
            capDates.forEach(date => {
                // Check if a capitalization row specifically exists for this date, not just ANY transaction
                const capExists = allRowsData.some(r => r.date && r.date.getFullYear() === date.getFullYear() && r.date.getMonth() === date.getMonth() && r.date.getDate() === date.getDate() && (r.isCapitalization || r.particulars === 'Interest Capitalization'));
                if (!capExists) {
                    allRowsData.push({ date: date, particulars: 'Interest Capitalization', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
                }
            });
        }

        // 2. Get Interest Rate Change Dates
        const rateChanges = interestRateHistory[loanType.toUpperCase().trim()];
        if (rateChanges && rateChanges.length > 0) { // Check if rateChanges exist and have elements
            rateChanges.sort((a, b) => a.date - b.date);
            rateChanges.forEach(change => {
                if (change.date >= startDate && change.date <= endDate) {
                    const dateExists = allRowsData.some(r => r.date && r.date.getTime() === change.date.getTime());
                    if (!dateExists) allRowsData.push({ date: change.date, particulars: '', amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
                }
            });
        }

        // 3. Sort all rows by date
        allRowsData.sort((a, b) => {
            const dateA = a.date ? a.date.getTime() : 0;
            const dateB = b.date ? b.date.getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            if (a.isCapitalization && !b.isCapitalization) return 1; // Ensure cap row is last on same day
            if (!a.isCapitalization && b.isCapitalization) return -1;
            return (a.originalIndex !== undefined ? a.originalIndex : Infinity) - (b.originalIndex !== undefined ? b.originalIndex : Infinity);
        });

        // 4. Apply the correct rate to each row
        const loanTypeUpper = document.getElementById('loan_scheme_name').value.toUpperCase().trim();
        const fixedRate = fixedTermLoanRates[loanTypeUpper];
        const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;
        const loanDueDateForRates = parseDateFromDisplay(document.getElementById('loanDueDate').value);

        allRowsData.forEach(row => {
            let applicableRate = sanctionRate; // Start with sanction rate as a fallback

            if (fixedRate !== undefined && row.date < loanDueDateForRates) {
                // It's a special fixed-rate loan, and we are before or on the due date
                applicableRate = fixedRate;
            } else {
                // It's either not a special loan, or we are past the due date. Apply historical rates.
                if (rateChanges && rateChanges.length > 0) {
                    rateChanges.forEach(change => {
                        if (row.date && change.date <= row.date) {
                            applicableRate = change.rate;
                        }
                    });
                }
            }
            row.rate = formatRate(applicableRate);
        });

        // 5. Rebuild and recalculate the table
        rebuildTable(allRowsData);
        recalculateTable(true); // Suppress message
        
        // 6. Show final message
        if (positiveDataWarning) {
            showMessageBox("Data imported and rates applied. WARNING: Balance data was positive, which may cause incorrect results.", true);
        } else {
            showMessageBox('Data imported and all rates applied successfully!');
        }
    } else {
        InterestCalcLogic.showMessageBox('No data found within the specified date range. Please check the dates or the source file.', true);
    }
}

function applyRatesAndRecalculate() {
    const tableBody = document.getElementById('loanTableBody');
    if (tableBody.rows.length === 0) return;

    const allRowsData = [];
    for (let i = 0; i < tableBody.rows.length; ++i) {
        const row = tableBody.rows[i];
        // Exclude any rows that were just for rate changes to avoid re-inserting them
        if (row.cells[2].innerText === '' && row.cells[3].innerText === '' && row.cells[4].innerText === '' && row.cells[6].innerText === '') continue;
        allRowsData.push({
            originalIndex: i,
            date: parseDateFromDisplay(row.cells[1].innerText),
            particulars: row.cells[2].innerText,
            amount: row.cells[3].innerText, debit: row.cells[4].innerText,
            penalty: row.cells[5].innerText, credit: row.cells[6].innerText,
            balance: row.cells[7].innerText, rate: row.cells[9].innerText
        });
    }

    const loanType = document.getElementById('loan_scheme_name').value; // Corrected ID
    const startDate = allRowsData[0].date;
    let uiEndDate = new Date(document.getElementById('calcEndDate').value);
        const endDate = (!isNaN(uiEndDate.getTime())) ? uiEndDate : allRowsData[allRowsData.length - 1].date;

    // Get Interest Rate Change Dates from the (potentially updated) history
    const rateChanges = interestRateHistory[loanType.toUpperCase().trim()];
    if (rateChanges && rateChanges.length > 0) {
        rateChanges.forEach(change => {
            if (change.date >= startDate && change.date <= endDate) {
                const dateExists = allRowsData.some(r => r.date && r.date.getTime() === change.date.getTime());
                if (!dateExists) allRowsData.push({ date: change.date, particulars: '', amount: '', debit: '', penalty: '', credit: '', balance: '' });
            }
        });
    }

    // Sort all rows by date
    allRowsData.sort((a, b) => {
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.originalIndex !== undefined ? a.originalIndex : Infinity) - (b.originalIndex !== undefined ? b.originalIndex : Infinity);
    });

    // Apply the correct rate to each row
    if (rateChanges && rateChanges.length > 0) {
        const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;
        allRowsData.forEach(row => {
            let applicableRate = sanctionRate;
            rateChanges.forEach(change => {
                if (change.date <= row.date) applicableRate = change.rate;
            });
            row.rate = formatRate(applicableRate);
        });
    }

    // Rebuild and recalculate the table
    rebuildTable(allRowsData);
    recalculateTable(true);
}

function updateRatesForManualEntry() {
    const tableBody = document.getElementById('loanTableBody');
    if (tableBody.rows.length === 0) return;

    const loanTypeUpper = (document.getElementById('loan_scheme_name')?.value || '').toUpperCase().trim();
    const fixedRate = fixedTermLoanRates[loanTypeUpper];
    const sanctionRate = parseFloat(String(document.getElementById('sanctionRate')?.value || '0').replace(/[^\d.]/g, '')) || 0;
    const loanDueDateForRates = parseDateFromDisplay(document.getElementById('loanDueDate')?.value);
    const rateChanges = interestRateHistory[loanTypeUpper];
    const loanStructure = loanStructureMap[loanTypeUpper];
    const isExempt = isPenaltyExempt(loanTypeUpper);

    let penaltyStartDate = null;
    if (!isExempt && loanDueDateForRates) {
        const graceMonths = parseInt((document.getElementById('gracePeriod')?.value || '').match(/\d+/)?.[0] || '0', 10);
        if (loanStructure === 'Term' && graceMonths > 0) {
            penaltyStartDate = addMonths(loanDueDateForRates, graceMonths);
        } else {
            penaltyStartDate = loanDueDateForRates;
        }
    }

    for (let i = 0; i < tableBody.rows.length; i++) {
        const row = tableBody.rows[i];
        const rowDate = parseDateFromDisplay(row.cells[1].innerText);
        if (!rowDate) continue;

        let applicableRate = sanctionRate; // Fallback

        if (fixedRate !== undefined && rowDate < loanDueDateForRates) {
            applicableRate = fixedRate;
        } else if (rateChanges && rateChanges.length > 0) {
            rateChanges.forEach(change => {
                if (change.date <= rowDate) applicableRate = change.rate;
            });
        }

        if (penaltyStartDate && rowDate >= penaltyStartDate) {
            const dynamicPenaltyRate = getPenaltyRateForDate(rowDate, loanTypeUpper);
            applicableRate += dynamicPenaltyRate;
        }

        row.cells[9].innerText = formatRate(applicableRate);
    }
}

function importData(append = false, ignoreStartDate = false) {
  const calcStartDateInput=document.getElementById('calcStartDate');
  const calcEndDateInput=document.getElementById('calcEndDate');
  let isValid=true;
  const isDateInvalid = (input) => !input.value || isNaN(new Date(input.value).getTime());
        const markInvalid = (el) => {
        el.style.setProperty('outline', '2pt solid #e53e3e', 'important');
        el.style.setProperty('background-color', '#fff5f5', 'important');
        el.style.setProperty('border-radius', '3pt', 'important');
    };
    const markValid = (el) => {
        el.style.removeProperty('outline');
        el.style.removeProperty('background-color');
        el.style.removeProperty('border-radius');
    };

    if (!ignoreStartDate && isDateInvalid(calcStartDateInput)) {
        markInvalid(calcStartDateInput);
        isValid = false;
    } else {
        markValid(calcStartDateInput);
    }
    if (isDateInvalid(calcEndDateInput)) {
        markInvalid(calcEndDateInput);
        isValid = false;
    } else {
        markValid(calcEndDateInput);
    }
  if(!isValid){showMessageBox("Please provide valid dates before importing.", true); return;}

  const fileInput=document.createElement('input');
  fileInput.type='file';
  fileInput.accept='.csv,.xls,.xlsx';
  fileInput.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const ext=file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            let rows;
            if (ext === 'csv') {
                rows = parseCSV(ev.target.result);
            } else { // .xls or .xlsx
                if (typeof XLSX === 'undefined') {
                    showMessageBox('Error: SheetJS library not found. Cannot process Excel files.', true);
                    return;
                }
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            }
            processAndDisplayData(rows, append, ignoreStartDate);
        } catch (err) {
            console.error("File parsing error:", err);
            showMessageBox(`Failed to parse the file. It might be corrupted or in an unsupported format. Error: ${err.message}`, true);
        }
    };
    if (ext === 'csv') {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
  };
  fileInput.click();
}

function recalculateTable(suppressMessage = false) {
    try {
        // ALWAYS remove total row first
        const existingTotal = document.getElementById("total-row");
        if (existingTotal) existingTotal.remove();

        const tableBody = document.getElementById('loanTableBody');
        const rows = tableBody.rows;
        if (rows.length === 0) return;

        // --- Step 1: Read all data from the DOM into a structured array ---
        const tableData = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.cells && row.cells.length > 2 && typeof cleanParticulars === "function") {
                row.cells[2].innerText = cleanParticulars(row.cells[2].innerText);
            }
            tableData.push({
                date: parseDateFromDisplay(row.cells[1].innerText),
                amount: parseFloat(row.cells[3].innerText) || 0,
                debit: parseFloat(row.cells[4].innerText) || 0,
                penalty: parseFloat(row.cells[5].innerText) || 0,
                credit: parseFloat(row.cells[6].innerText) || 0,
                balance: parseFloat(row.cells[7].innerText) || 0,
                rate: parseFloat(String(row.cells[9].innerText).replace('%','')) || 0,
                // These will be calculated
                days: 0
            });
        }

        // Get loan details for rate logic
        const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;

        // --- Step 2: Perform all calculations on the data array ---
        if (tableData.length > 0) {
            // The first row's balance is the starting point. We don't need to do anything.
        }

        for (let i = 0; i < tableData.length; i++) {
            const currentRow = tableData[i];
            
            if (i > 0) {
                // For subsequent rows, calculate the balance based on the previous row's balance and current transactions.
                const prevRow = tableData[i-1];
                const newBalance = prevRow.balance + currentRow.amount + currentRow.debit + currentRow.penalty - currentRow.credit;
                currentRow.balance = Math.round(newBalance);
            }
            // For the first row (i=0), its balance is already set from the import. We don't recalculate it.

            // Calculate Days, Rate, and Interest for the period *following* this row
            const nextRow = tableData[i + 1];
            if (nextRow) {
                currentRow.days = (currentRow.date && nextRow.date) ? Math.round((nextRow.date - currentRow.date) / (1000 * 60 * 60 * 24)) : 0;
                // Add +1 to the first day calculation to include the start date
                if (i === 0) { currentRow.days += 1; }
            }
        }

        // --- Step 3: Write the calculated data back to the DOM ---
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const data = tableData[i];
            row.cells[7].innerText = data.balance !== 0 ? data.balance : "";
            // Leave last row's calculation columns blank
            if (i === rows.length - 1) { // Last row has 0 days
                row.cells[8].innerText = "";
                row.cells[9].innerText = "";
            } else {
                row.cells[8].innerText = String(data.days);
                row.cells[9].innerText = typeof data.rate === 'number' ? formatRate(data.rate) : "";
            }
        }
        if (typeof updateCalculationSummary === 'function') updateCalculationSummary();
if (!suppressMessage) showMessageBox("Balance calculated successfully!");
    } catch (error) {
        console.error("Auto-calculation failed:", error);
        showMessageBox("Calculation failed. Please check your inputs. Error: " + error.message, true);
    }
}
/**
 * ==================================================================
 * Penalty Interest Application
 * ==================================================================
 */
function applyPenaltyRates() {
    const loanType = document.getElementById('loan_scheme_name').value || "";

    if (isPenaltyExempt(loanType)) {
        showMessageBox("Penalty is not applicable (N/A) for this loan type.", true);
        return;
    }

    const loanDueDate = parseDateFromDisplay(document.getElementById('loanDueDate').value);
    const structure = loanStructureMap[loanType.toUpperCase().trim()];

    // For Term loans, ensure installment details are present
    if (
        (structure === 'Term' || loanType.toUpperCase().trim() === 'CONSUMER CREDIT')
    ) { // Check if loan is a Term loan or Consumer Credit
        if (!loanDueDate || isNaN(loanDueDate)) {
             showMessageBox("Loan Due Date is required for Term Loan penalty calculations.", true);
             return;
        }

        const frequency = document.getElementById('installmentFrequency').value;
        const gracePeriod = document.getElementById('gracePeriod').value;
        if (!frequency || !gracePeriod) {
            showMessageBox("This is a Term Loan. Please provide Installment Frequency and Grace Period to apply penalties.", true);
            showInstallmentModal(); // This modal will now need to trigger the penalty logic
            return;
        }
    }
    
    // If we get here, either it's not a term loan, or the data is present.
    proceedWithPenaltyApplication();
}

/**
 * ==================================================================
 * Penalty Application - Refactored Helper Functions
 * ==================================================================
 */

/**
 * Handles the specific penalty logic for Term Loans, including fixed penalties
 * for missed installments and determining the Bad/Loss (BL) trigger date.
 * @param {Array} allRowsData The array of all transaction rows.
 * @param {object} loanDetails An object containing all necessary loan parameters.
 */
function handleTermLoanPenalties(allRowsData, loanDetails) {
  const { sanctionDate, frequency, gracePeriodMonths } = loanDetails;
  let installmentSize = Number(loanDetails.installmentSize) || 0;
  const penaltyRate = Number(loanDetails.penaltyRate) || 0;
  const { loanDueDate, calcEndDate, calcStartDate } = loanDetails; // Destructure loanDetails

  if (installmentSize === 0) {
    showMessageBox("Installment Size is required for Term Loan penalty calculation.", true);
    return;
  }

  let firstInstallmentDate = addMonths(sanctionDate, gracePeriodMonths);
  if (firstInstallmentDate) {
    const year = firstInstallmentDate.getUTCFullYear();
    const month = firstInstallmentDate.getUTCMonth(); // 0-11
    
    if (frequency === 'quarterly') {
        const quarter = Math.floor(month / 3);
        const quarterEndMonth = quarter * 3 + 2;
        let targetDate = new Date(Date.UTC(year, quarterEndMonth + 1, 0));
        if (firstInstallmentDate > targetDate) {
            if (quarter === 3) firstInstallmentDate = new Date(Date.UTC(year + 1, 3, 0)); // If last quarter, move to next year's March
            else firstInstallmentDate = new Date(Date.UTC(year, quarterEndMonth + 4, 0));
        } else {
            firstInstallmentDate = targetDate;
        }
    } else if (frequency === 'half-yearly') {
        const half = Math.floor(month / 6);
        const halfEndMonth = half * 6 + 5;
        let targetDate = new Date(Date.UTC(year, halfEndMonth + 1, 0));
        if (firstInstallmentDate > targetDate) { // If last half, move to next year's June
            if (half === 1) firstInstallmentDate = new Date(Date.UTC(year + 1, 6, 0));
            else firstInstallmentDate = new Date(Date.UTC(year, 12, 0));
        } else {
            firstInstallmentDate = targetDate;
        }
    } else if (frequency === 'yearly') {
        let targetDate = new Date(Date.UTC(year, 6, 0)); // June 30
        if (firstInstallmentDate > targetDate) firstInstallmentDate = new Date(Date.UTC(year + 1, 6, 0)); // If past June, move to next year's June
        else firstInstallmentDate = targetDate;
    } else { // monthly
        firstInstallmentDate = new Date(Date.UTC(year, month + 1, 0));
    }
    document.getElementById('installmentDueDate').value = formatDate(firstInstallmentDate);
  }

  const increment = { 'monthly': 1, 'quarterly': 3, 'half-yearly': 6, 'yearly': 12 }[frequency] || 0;
  if (increment === 0 || !firstInstallmentDate) return;

  // Build installment dates up to loanDueDate
  const installmentDates = [];
  let current = new Date(firstInstallmentDate);
  while (current <= loanDueDate) {
    installmentDates.push(new Date(current));
    current.setUTCDate(1); // Set to 1st of month to avoid issues with month-end dates
    current.setUTCMonth(current.getUTCMonth() + increment);
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
  }

  // Prepare transactions sorted by date for credit accumulation
  const txRows = allRowsData
    .filter(r => r.date instanceof Date && !isNaN(r.date))
    .map(r => ({ ...r, credit: parseFloat(String(r.credit).replace(/[^\d.]/g, '')) || 0 }))
    .sort((a, b) => a.date - b.date);

  let txIdx = 0;
  let availableCredits = 0;
  const missedList = []; // array of objects {date, row}

  const findOrCreateInstallmentRow = (date) => {
    // Find if any row already exists for this exact date.
    let row = allRowsData.find(r => r.date && r.date.getTime() === date.getTime());

    if (row) {
        // A row for this date already exists (e.g., a payment or capitalization date).
        // Mark it as having an installment due (via a flag) to avoid redundant text.
        if (!row.hasInstallmentDue) {
            if (!/installment due/i.test(row.particulars)) {
                row.particulars = (row.particulars ? row.particulars + ' / ' : '') + 'Installment Due';
            }
            row.hasInstallmentDue = true;
        }
    } else {
        // No row exists for this date, so create a new one.
      row = { date: new Date(date), particulars: 'Installment Due', amount: '', debit: '', penalty: 0, credit: '', balance: '', hasInstallmentDue: true };
      allRowsData.push(row);
    }
    // Ensure penalty is a number for subsequent calculations.
    row.penalty = Number(row.penalty) || 0;
    return row;
  };

  // helper to apply fixed penalty amount (installmentSize * penaltyRate%) to a given row
  const applyFixedPenaltyToRow = (row, mode = 'add') => {
    // For all Term Loans (including Consumer Credit), the fixed penalty for a
    // missed installment is based on the Installment Size.
    const dynamicPenRate = getPenaltyRateForDate(rowDate, loanDetails.loanType);
    const amount = Math.round(loanDetails.installmentSize * (dynamicPenRate / 100));
    if (mode === 'set') {
      row.penalty = amount;
    } else {
      row.penalty = (Number(row.penalty || 0) + amount);
    }
  };

  // iterate installments
  for (const instDate of installmentDates) {
    // Only process installments that fall within the calculation period.
    if (instDate > calcEndDate || instDate < calcStartDate) continue;

    // accumulate credits up to and including this installment date
    while (txIdx < txRows.length && txRows[txIdx].date <= instDate) {
      availableCredits += txRows[txIdx].credit;
      txIdx++;
    }

    // First, if there are previously missed installments, try to cover them FIFO
    while (availableCredits >= installmentSize && missedList.length > 0) {
      const missed = missedList.shift();
      const row = missed.row || findOrCreateInstallmentRow(missed.date);
      // mark as covered
      row.penalty = 0; // Waive penalty if paid within loan period
      row.isUC = true;
      availableCredits -= installmentSize;
    }

    // Now check if this installment is covered by availableCredits
    if (availableCredits >= installmentSize) {
      // Covered (could be by advance or current payment)
      availableCredits -= installmentSize;
      // mark this installment as UC/paid
      const row = findOrCreateInstallmentRow(instDate);
      row.isUC = true;
    } else {
      // Missed
      const row = findOrCreateInstallmentRow(instDate);
      missedList.push({ date: new Date(instDate), row });
      // New logic: Always apply fixed penalty for missed installments before/on due date.
      // The installmentDates loop already ensures instDate <= loanDueDate.
      applyFixedPenaltyToRow(row, 'set');
    }
  }

  // After iterating installments, there might be remaining credits after calcEndDate that cover missed installments
  while (txIdx < txRows.length) { availableCredits += txRows[txIdx].credit; txIdx++; }
  while (availableCredits >= installmentSize && missedList.length > 0) {
    const missed = missedList.shift();
    const row = missed.row || findOrCreateInstallmentRow(missed.date);
    if (calcEndDate < loanDueDate) row.penalty = 0; // Waive if still within loan period
    row.isUC = true;
    availableCredits -= installmentSize;
  }

}

/**
 * Applies the correct base interest rate to every row based on loan type and date.
 * @param {Array} allRowsData - The array of all transaction rows.
 * @param {object} loanDetails - An object containing all necessary loan parameters.
 */
function applyBaseInterestRates(allRowsData, loanDetails) {
    const { loanTypeUpper, fixedRate, rateChanges, sanctionRate, loanDueDate } = loanDetails;

    allRowsData.forEach(row => {
        let applicableRate = sanctionRate; // Fallback to sanction rate

        if (fixedRate !== undefined && row.date < loanDueDate) {
            applicableRate = fixedRate;
        } else {
            if (rateChanges && rateChanges.length > 0) {
                rateChanges.forEach(change => {
                    if (row.date && change.date <= row.date) {
                        applicableRate = change.rate;
                    }
                });
            }
        }
        row.rate = applicableRate; // Set the base rate (unformatted)
    });
}

/**
 * The main orchestrator for applying all penalty logic.
 */
function proceedWithPenaltyApplication() {
    const tableBody = document.getElementById('loanTableBody');
    if (tableBody.rows.length === 0) {
        showMessageBox("Please import data before applying penalties.", true);
        return;
    }

    // --- Determine the effective start date for calculations ---
    // This is the later of the user-defined start date and the first date in the table.
    // This prevents inserting penalty rows before any actual data exists.
    const calcStartDateInput = document.getElementById('calcStartDate');
    if (!calcStartDateInput.value || isNaN(new Date(calcStartDateInput.value))) {
        showMessageBox("Please provide a valid Calculation Start Date.", true);
        markInvalid(calcStartDateInput);
        return;
    }
    const userCalcStartDate = new Date(calcStartDateInput.value);

    const firstRowDate = tableBody.rows.length > 0 ? parseDateFromDisplay(tableBody.rows[0].cells[1].innerText) : null;
    
    // The calculation should not begin before the first piece of data in the table.
    const calcStartDate = (firstRowDate && firstRowDate > userCalcStartDate) ? firstRowDate : userCalcStartDate;

    const calcEndDateInput = document.getElementById('calcEndDate');
    markValid(calcEndDateInput);
    if (!calcEndDateInput.value || isNaN(new Date(calcEndDateInput.value))) {
        showMessageBox("Please provide a valid Calculation End Date.", true);
        markInvalid(calcEndDateInput);
        return;
    }
    const calcEndDate = new Date(calcEndDateInput.value);

    // --- 1. Gather all data and parameters ---
    const loanDetails = {
        loanType: document.getElementById('loan_scheme_name').value,
        sanctionDate: parseDateFromDisplay(document.getElementById('sanction_date').value),
        loanDueDate: parseDateFromDisplay(document.getElementById('loanDueDate').value),
        frequency: document.getElementById('installmentFrequency').value,
        gracePeriodStr: document.getElementById('gracePeriod').value || "0",
        installmentSize: parseFloat(String(document.getElementById('installmentSize').value).replace(/[^\d.]/g, '')) || 0,
        sanctionAmount: parseFloat(String(document.getElementById('sanctionAmount').value).replace(/[^\d.]/g, '')) || 0,
        sanctionRate: parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0,
        penaltyRate: parseFloat(String(document.getElementById('penaltyRate').value).replace(/[^\d.]/g, '')) || 1.5,        
        calcStartDate: calcStartDate,
        calcEndDate: calcEndDate
    };
    loanDetails.loanTypeUpper = loanDetails.loanType.toUpperCase().trim();
    loanDetails.structure = loanStructureMap[loanDetails.loanTypeUpper];
    loanDetails.gracePeriodMonths = parseInt(loanDetails.gracePeriodStr.match(/\d+/)?.[0] || "0", 10);
    loanDetails.fixedRate = fixedTermLoanRates[loanDetails.loanTypeUpper];
    loanDetails.rateChanges = interestRateHistory[loanDetails.loanTypeUpper];

    let allRowsData = [];
    for (let i = 0; i < tableBody.rows.length; ++i) {
        const row = tableBody.rows[i];
        allRowsData.push({
            originalIndex: i,
            date: parseDateFromDisplay(row.cells[1].innerText),
            particulars: row.cells[2].innerText,
            amount: row.cells[3].innerText, debit: row.cells[4].innerText,
            penalty: row.cells[5].innerText, credit: row.cells[6].innerText,
            balance: row.cells[7].innerText, rate: row.cells[9].innerText
        });
    }

    // --- 2. Handle Term Loan specific penalties (fixed amounts, BL trigger) ---
    // For Term/Consumer loans, if the calculation starts before the due date,
    // run the pre-due-date penalty logic (missed installments).
    if ( (loanDetails.structure === 'Term' || loanDetails.loanTypeUpper === 'CONSUMER CREDIT') && // Check if loan is Term or Consumer Credit
         (loanDetails.calcStartDate < loanDetails.loanDueDate)
    ) {
        handleTermLoanPenalties(allRowsData, loanDetails);
    }

    // --- 3. Sort data again to include any new penalty/installment rows ---
    allRowsData.sort((a, b) => {
        const dateA = a.date ? a.date.getTime() : 0;
        const dateB = b.date ? b.date.getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.originalIndex !== undefined ? a.originalIndex : Infinity) - (b.originalIndex !== undefined ? b.originalIndex : Infinity);
    });

    // Clear transaction data for the first row (Opening Balance)
    if (allRowsData.length > 0) {
        allRowsData[0].amount = '';
        allRowsData[0].debit = ''; // Clear debit for opening balance
        allRowsData[0].penalty = '';
        allRowsData[0].credit = '';
    }

    // --- 4. Apply base interest rates to all rows ---
    applyBaseInterestRates(allRowsData, loanDetails);

    // --- 5. Determine when to start applying the penalty interest rate ---
    // For Term/Consumer loans, apply penalty interest from loan due date onwards
    // BUT only if the date is AFTER the grace period
    let penaltyStartDate = null;

    if (loanDetails.loanDueDate && loanDetails.calcEndDate > loanDetails.loanDueDate) {
        // For term loans with grace period, penalty interest starts after grace period ends
        if (loanDetails.structure === 'Term') { // Check if loan is a Term loan
            // Calculate when grace period ends
            if (loanDetails.gracePeriodMonths > 0) {
                penaltyStartDate = addMonths(loanDetails.loanDueDate, loanDetails.gracePeriodMonths);
            } else {
                // No grace period, penalty starts immediately from loan due date
                penaltyStartDate = loanDetails.loanDueDate;
            }
        } else {
            // For other loan types, penalty interest starts from the loan due date
            penaltyStartDate = loanDetails.loanDueDate;
        }
    }

    // --- 6. Apply the additional penalty interest rate ---
    if (penaltyStartDate) {
        if (!loanDetails.loanDueDate) {
            showMessageBox("Loan Due Date is required to apply penalties.", true);
            return;
        }
        allRowsData.forEach(data => {
            // Apply dynamic penalty rate only from penaltyStartDate onwards (after grace period)
            if (data.date >= penaltyStartDate && !data.isPenaltyExempt) {
                const originalRate = data.rate;
                if (originalRate != null) {
                    const dynRate = getPenaltyRateForDate(data.date, loanDetails.loanType);
                    data.rate = originalRate + dynRate;
                }
            }
        });
    }
    
    // Format all rates for display
    allRowsData.forEach(data => {
        data.rate = formatRate(data.rate);
    });

    // --- 7. Rebuild table and finalize calculations ---
    rebuildTable(allRowsData);
    recalculateTable();
    showMessageBox("Penalty interest applied successfully.");
}

function calculateAndCapitalizeInterest(isAuto = false) {
    const btn = document.getElementById('calculateBalance');
    if (!isAuto && btn) {
        isAutoRecalcActive = true;
        btn.setAttribute('disabled', true);
        btn.classList.add('button-disabled');
    } else {
        if (btn && btn.hasAttribute('disabled')) return;
    }

    const tableBody = document.getElementById('loanTableBody');
    const rowsInTable = tableBody.rows;
    if (rowsInTable.length === 0) {
        if (!isAuto) showMessageBox("Please import data first.", true);
        if (btn) { btn.removeAttribute('disabled'); btn.classList.remove('button-disabled'); isAutoRecalcActive = false; }
        return;
    }

    // --- 0. Robust Date Range Detection ---
    let calcStartInput = document.getElementById('calcStartDate');
    let calcEndInput = document.getElementById('calcEndDate');
    
    // If dates are missing, fallback to the table's actual data range
    if (!calcStartInput.value || !calcEndInput.value) {
        const firstDate = parseDateFromDisplay(rowsInTable[0].cells[1].innerText);
        const lastDate = parseDateFromDisplay(rowsInTable[rowsInTable.length - 1].cells[1].innerText);
        
        if (!calcStartInput.value && firstDate) calcStartInput.value = formatDateForInput(firstDate);
        if (!calcEndInput.value && lastDate) calcEndInput.value = formatDateForInput(lastDate);
    }

    const startParts = calcStartInput.value.split('-');
    const calcStartDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
    const endParts = calcEndInput.value.split('-');
    const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));

    if (isNaN(calcStartDate.getTime()) || isNaN(endDate.getTime())) {
        if (!isAuto) showMessageBox("Calculation range is invalid. Please check your start and end dates.", true);
        if (btn) { btn.removeAttribute('disabled'); btn.classList.remove('button-disabled'); isAutoRecalcActive = false; }
        return;
    }

    const tableFirstDate = rowsInTable.length > 0 ? parseDateFromDisplay(rowsInTable[0].cells[1].innerText) : null;
    const effectiveCapStart = (tableFirstDate && tableFirstDate > calcStartDate) ? tableFirstDate : calcStartDate;

    // 1. Remove existing total row to prevent it being treated as a data row
    const existingTotalRow = document.getElementById('total-row');
    if (existingTotalRow) existingTotalRow.remove();

    // 2. Extract current rows into an array for processing/augmentation
    let allRowsData = [];
    for (let i = 0; i < rowsInTable.length; i++) {
        const row = rowsInTable[i];
        // Extract all existing rows, but we will tag those marked as capitalization
        const particularsText = (row.cells[2].innerText || "").trim();
        const isCapRow = row.dataset.isCapitalization === 'true' || 
                         particularsText === 'Interest Capitalization' || 
                         particularsText.includes('Int. Cap');
                         
        if (isCapRow || particularsText === 'Calculation End Date') {
            continue; // Strip out existing capitalization and end-date rows to prevent duplicates on recalculation
        }

        allRowsData.push({
            originalIndex: i,
            date: parseDateFromDisplay(row.cells[1].innerText),
            particulars: row.cells[2].innerText,
            amount: parseFloat(row.cells[3].innerText.replace(/,/g, '')) || 0,
            debit: parseFloat(row.cells[4].innerText.replace(/,/g, '')) || 0,
            penalty: parseFloat(row.cells[5].innerText.replace(/,/g, '')) || 0,
            credit: parseFloat(row.cells[6].innerText.replace(/,/g, '')) || 0,
            balance: parseFloat(row.cells[7].innerText.replace(/,/g, '')) || 0,
            rate: String(row.cells[9].innerText).trim(),
            isCapitalization: isCapRow
        });
    }

    // 3. Inject Missing Capitalization Rows (The "Yearly/Quarterly" Logic)
    const loanInputVal = (document.getElementById('loan_scheme_name').value || "").trim();
    
    // PRIORITY 1: Use the UI Inst. Frequency field set by the user
    const uiFrequency = (document.getElementById('installmentFrequency').value || '').trim().toLowerCase();
    
    // PRIORITY 2: Fall back to the capitalizationMap (product-based)
        // 1. Resolve Capitalization Frequency strictly from loan name/code
    let capFrequency = null;
    
    // Helper to check the maps


    capFrequency = resolveCapFreq(loanInputVal);


    
    // If STILL not found, check if it's a known Term Loan that might use uiFrequency or default to yearly?
    // Based on user feedback: Inst. Frequency is for PENALTY, not capitalization.
    // So we will NOT use uiFrequency. If we can't find it, we throw an error.
    if (!capFrequency) {
        if (!isAuto) showMessageBox("Capitalization frequency (Yearly/Quarterly) could not be determined for loan: " + loanInputVal + ". Please ensure the loan name/code is correct.", true);
        if (btn) { btn.removeAttribute('disabled'); btn.classList.remove('button-disabled'); isAutoRecalcActive = false; }
        return;
    }

    // Read sanction date to use its month/day as the anniversary anchor for yearly/half-yearly
    const sanctionDateStr = (document.getElementById('sanction_date') ? document.getElementById('sanction_date').value : '') || '';
    let anchorMonth = 5; // Default June (0-indexed) for legacy fallback
    let anchorDay   = 30;
    if (sanctionDateStr) {
        const sancParsed = parseDateFromDisplay(sanctionDateStr);
        if (sancParsed && !isNaN(sancParsed)) {
            anchorMonth = sancParsed.getUTCMonth();
            anchorDay   = sancParsed.getUTCDate();
        }
    }
    
    console.log('[CAP DEBUG] uiFrequency:', uiFrequency, '| capFrequency:', capFrequency, '| effectiveCapStart:', effectiveCapStart ? effectiveCapStart.toISOString() : null, '| endDate:', endDate ? endDate.toISOString() : null);
    if (capFrequency) {
        const capDates = [];
        let cursor = new Date(Date.UTC(effectiveCapStart.getUTCFullYear(), effectiveCapStart.getUTCMonth(), 1));
        
        while (cursor <= endDate) {
            let month = cursor.getUTCMonth();
            let year  = cursor.getUTCFullYear();
            let targetDate = null;
            
            if (capFrequency === 'monthly') {
                // Last day of every month
                targetDate = new Date(Date.UTC(year, month + 1, 0));
            } else if (capFrequency === 'quarterly') {
                // Fiscal year quarters: 30/09, 31/12, 31/03, 30/06
                // months: Sep=8, Dec=11, Mar=2, Jun=5
                if ([8, 11, 2, 5].includes(month)) targetDate = new Date(Date.UTC(year, month + 1, 0));
            } else if (capFrequency === 'half-yearly') {
                // Fiscal year halves: 31/12 and 30/06
                // months: Dec=11, Jun=5
                if ([11, 5].includes(month)) targetDate = new Date(Date.UTC(year, month + 1, 0));
            } else if (capFrequency === 'yearly') {
                // Economic year end: always 30/06 (June, month index 5)
                if (month === 5) targetDate = new Date(Date.UTC(year, 5, 30));
            }

            if (targetDate && targetDate >= effectiveCapStart && targetDate <= endDate) {
                if (!capDates.some(d => d.getTime() === targetDate.getTime())) capDates.push(targetDate);
            }
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        
        capDates.forEach(date => {
            // If the cap date is exactly the end date, combine them into one row
            if (date.getTime() === endDate.getTime()) {
                allRowsData.push({ date: date, particulars: 'Calculation End Date', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
            } else {
                allRowsData.push({ date: date, particulars: 'Interest Capitalization', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
            }
        });

        // Always ensure the final calc end date is present and acts as a capitalization row
        const lastCapAlreadyOnEndDate = capDates.some(d => d.getTime() === endDate.getTime());
        if (!lastCapAlreadyOnEndDate) {
            allRowsData.push({ date: endDate, particulars: 'Calculation End Date', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
        }
    }

    // NEW: Inject Interest Rate Change Dates to ensure period breaks during calculation
    const rateChanges = interestRateHistory[loanInputVal.toUpperCase().trim()];
    if (rateChanges && rateChanges.length > 0) {
        rateChanges.sort((a, b) => a.date - b.date);
        rateChanges.forEach(change => {
            if (change.date >= effectiveCapStart && change.date <= endDate) {
                const dateExists = allRowsData.some(r => r.date && r.date.getTime() === change.date.getTime());
                if (!dateExists) {
                    allRowsData.push({ date: change.date, particulars: '', amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
                }
            }
        });
    }

    // 4. Chronological Sort (Ensuring capitalization rows come AFTER transactions on the same day)
    allRowsData.sort((a, b) => {
        const diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        if (a.isCapitalization && !b.isCapitalization) return 1;
        if (!a.isCapitalization && b.isCapitalization) return -1;
        return 0;
    });

    // 4b. Apply correct Interest Rates to all rows (The "Between dates" logic) with AUTOMATED DYNAMIC PENALTY
    const loanTypeUpper = loanInputVal.toUpperCase().trim();
    const fixedRate = fixedTermLoanRates[loanTypeUpper];
    const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;
    const loanDueDateForRates = parseDateFromDisplay(document.getElementById('loanDueDate').value);
    const loanStructure = loanStructureMap[loanTypeUpper];
    const isExempt = isPenaltyExempt(loanTypeUpper);

    // Auto-determine penalty start date (if loan is not exempt from penalty)
    let penaltyStartDate = null;
    if (!isExempt && loanDueDateForRates && endDate > loanDueDateForRates) {
        const graceMonths = parseInt((document.getElementById('gracePeriod')?.value || '').match(/\d+/)?.[0] || '0', 10);
        if (loanStructure === 'Term' && graceMonths > 0) {
            penaltyStartDate = addMonths(loanDueDateForRates, graceMonths);
        } else {
            penaltyStartDate = loanDueDateForRates;
        }
    }

    allRowsData.forEach(row => {
        let applicableRate = sanctionRate;
        if (fixedRate !== undefined && row.date < loanDueDateForRates) {
            applicableRate = fixedRate;
        } else if (rateChanges && rateChanges.length > 0) {
            // Find the latest rate where change date <= row date
            rateChanges.forEach(change => {
                if (row.date && change.date <= row.date) {
                    applicableRate = change.rate;
                }
            });
        }

        // Automated Dynamic Penalty Integration:
        if (penaltyStartDate && row.date >= penaltyStartDate && !row.isPenaltyExempt) {
            const dynamicPenaltyRate = getPenaltyRateForDate(row.date, loanTypeUpper);
            applicableRate += dynamicPenaltyRate;
        }

        row.rate = formatRate(applicableRate);
    });
    
    rebuildTable(allRowsData);

    // ==================================================================
    // STEP 3: Interest Recalculation loop
    // ==================================================================
    const activeRows = tableBody.rows;
    recalculateTable(true); // Ensure balances/days are updated for the new rows

    const capitalizationIndices = [];
    for (let i = 0; i < activeRows.length; i++) {
        // Identify rows tagged as capitalization or the very last row (final settlement)
        if (activeRows[i].dataset.isCapitalization === 'true' || activeRows[i].cells[2].innerText === 'Interest Capitalization') {
            capitalizationIndices.push(i);
        }
    }
    if (activeRows.length > 0 && !capitalizationIndices.includes(activeRows.length - 1)) capitalizationIndices.push(activeRows.length - 1);
    const uniqueIndices = [...new Set(capitalizationIndices)].sort((a, b) => a - b);

    // 2. Iterate through capitalization periods, calculating and capitalizing sequentially.
    let lastIndex = 0;
    uniqueIndices.forEach(capIndex => {
        // A. Recalculate balances to incorporate debits from previous periods.
        recalculateTable(true);

        // B. Calculate interest for the current period using the updated balances.
        let interestSum = 0;
        for (let i = lastIndex; i < capIndex; i++) {
            const row = activeRows[i];
            if (row.id === 'total-row' || row.cells.length < 11) continue;
            const balance = parseFloat(String(row.cells[7].innerText).replace(/,/g, '')) || 0;
            const days = parseInt(String(row.cells[8].innerText).replace(/,/g, '')) || 0;
            const rate = parseFloat(String(row.cells[9].innerText).replace(/[%,]/g, '')) || 0;
            let currentInterest = 0;
            if (days > 0 && rate > 0 && balance > 0) {
                // Standard formula: Interest = Principal x Rate% x Days / 365
                currentInterest = Math.round(balance * rate * days / 36500);
            }
            row.cells[10].innerText = currentInterest > 0 ? currentInterest : '0'; // Update interest cell
            interestSum += currentInterest;
        }

        // C. Put the sum in the debit column of the capitalization row.
        if (capIndex > 0) {
            const debitCell = activeRows[capIndex].cells[4];
            debitCell.innerText = Math.round(interestSum);
            activeRows[capIndex].classList.add('bg-inserted-row');
        }

        lastIndex = capIndex; // The next period starts ON this capitalization date
    });

    // 3. Finalize and Recalculate
    if (activeRows.length > 0) {
        activeRows[0].cells[2].innerText = 'Opening Balance';
    }
    recalculateTable(true);

    // Last row's interest is always 0
    if (activeRows.length > 0) {
    const lastR = activeRows[activeRows.length - 1];
    if (lastR.id !== "total-row" && lastR.cells && lastR.cells.length > 10) {
        lastR.cells[10].innerText = "0";
    } else if (activeRows.length > 1 && activeRows[activeRows.length - 2].cells && activeRows[activeRows.length - 2].cells.length > 10) {
        activeRows[activeRows.length - 2].cells[10].innerText = "0";
    }
}

    // Total row generation removed as per request, summary table is used instead.

    if (!isAuto) {
        InterestCalcLogic.showMessageBox("Interest capitalized and balances recalculated.", true);
        // Re-enable the button after calculation is complete
        if (btn) { btn.removeAttribute('disabled'); btn.classList.remove('button-disabled'); } // isAutoRecalcActive is reset earlier
    }
}

/* ===== Rate Manager Modal (Editable Table) ===== */
let currentRateManagerState = [];

let editingOldProductName = null;

function editSelectedProduct() {
    const productName = document.getElementById('rateManagerLoanSelector') ? document.getElementById('rateManagerLoanSelector').value : '';
    if (!productName) {
        InterestCalcLogic.showMessageBox('Please select a Loan Product to edit.', true);
        return;
    }

    let code = Object.keys(loanTypeMap).find(k => loanTypeMap[k] === productName) || '';
    let cat = loanCategoryMap[productName] || 'CMSME';
    let cap = capitalizationMap[productName] || 'yearly';

    // Populate the form
    document.getElementById('newProductCode').value = code;
    document.getElementById('newProductName').value = productName;
    document.getElementById('newProductCategory').value = cat;
    const termTypeVal = resolveTermType(productName);
    const termSelect = document.getElementById('newProductTermType');
    if (termSelect) {
        for (let i = 0; i < termSelect.options.length; i++) {
            if (termSelect.options[i].value.toLowerCase() === termTypeVal.toLowerCase()) {
                termSelect.selectedIndex = i;
                break;
            }
        }
    }

    const isExempt = isPenaltyExempt(productName);
const penCheck = document.getElementById('newProductPenalty');
if (penCheck) {
penCheck.value = isExempt ? 'Exempt' : 'Applicable';
}
const intTypeEl = document.getElementById('newProductInterestType');
if (intTypeEl && typeof interestTypeMap !== 'undefined') {
intTypeEl.value = interestTypeMap[productName] || 'Fixed';
}
    
    // Select capitalization (capitalize first letter to match options like 'Monthly', 'Yearly')
    let capSelect = document.getElementById('newProductCap');
    for(let i=0; i<capSelect.options.length; i++) {
        if(capSelect.options[i].value.toLowerCase() === cap.toLowerCase()) {
            capSelect.selectedIndex = i;
            break;
        }
    }

    editingOldProductName = productName;
    toggleAddProductMode(true);
}


// =========================================================================
// NEW DEDICATED ADD LOAN PRODUCT MODAL LOGIC
// =========================================================================

function showAddLoanProductModal() {
    hideAvailableLoansModal();
    hideRateChangeModal();
    
    // Clear the form
    document.getElementById('addLoanHead').value = '';
    document.getElementById('addLoanSchemeName').value = '';
    document.getElementById('addLoanType').value = 'Agri';
    
    document.getElementById('addLoanTermType').value = 'Short Term';
    
    document.getElementById('addLoanCapPeriod').value = 'Monthly';
    
    const penaltySel = document.getElementById('addLoanPenaltyToggle');
    if (penaltySel) {
        penaltySel.value = 'Applicable';
    }
    
    // Reset rates container
    document.getElementById('addLoanRatesContainer').classList.add('hidden');
    const tbody = document.getElementById('addLoanRatesTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        appendAddLoanRateRow(); // Start with 1 empty row
    }

    const modal = document.getElementById('addLoanProductModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideAddLoanProductModal() {
    const modal = document.getElementById('addLoanProductModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    showAvailableLoansModal(); // Go back to catalogue
}

// Override existing addNewLoanFromViewLoans to use the new modal
function addNewLoanFromViewLoans() {
    showAddLoanProductModal();
}

function toggleAddLoanRatesTable() {
    const container = document.getElementById('addLoanRatesContainer');
    if (container) {
        container.classList.toggle('hidden');
    }
}



async function downloadAddLoanRatesTemplate() {
    if (typeof ExcelJS === 'undefined') {
        showToast('ExcelJS library not loaded.', true);
        return;
    }
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rates Template');
    
    // Add Headers
    const headerRow = sheet.addRow(["Loan Type", "From Date (dd/mm/yyyy)", "To Date (dd/mm/yyyy)", "Interest Rate (%)"]);
    
    // Apply styling to headers
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203764' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });
    
    // Add example row
    sheet.addRow(["New Loan", "01/01/2020", "", 9.00]);
    
    // Set column widths
    sheet.columns = [
        { width: 25 }, { width: 25 }, { width: 25 }, { width: 20 }
    ];
    
    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'New_Loan_Rates_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleAddLoanRatesUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Ensure rates container is visible
            const container = document.getElementById('addLoanRatesContainer');
            if (container) container.classList.remove('hidden');

            const tbody = document.getElementById('addLoanRatesTableBody');
            if (tbody) {
                // Clear existing
                tbody.innerHTML = '';
                
                // Skip header row, start from index 1
                let addedCount = 0;
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    
                    // Header format: Loan Type, From Date (dd/mm/yyyy), To Date (dd/mm/yyyy), Interest Rate (%)
                    const fromDate = row[1] || '';
                    const toDate = row[2] || '';
                    const rateStr = row[3] !== undefined ? String(row[3]).replace(/[^0-9.]/g, '') : '';
                    
                    if (fromDate && rateStr) {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-gray-100 hover:bg-slate-50 transition';
                        tr.innerHTML = `
                            <td class="p-2 text-center text-gray-500 font-bold border-r">${addedCount + 1}</td>
                            <td class="p-1 border-r"><input type="text" class="add-loan-frmdate w-full h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="dd/mm/yyyy" value="${fromDate}"></td>
                            <td class="p-1 border-r"><input type="text" class="add-loan-todate w-full h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="Open" value="${toDate}"></td>
                            <td class="p-1 border-r"><input type="number" step="0.01" class="add-loan-rate w-full h-8 px-2 text-xs border border-gray-300 rounded text-right font-bold text-emerald-700 focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="e.g. 9.00" value="${parseFloat(rateStr).toFixed(2)}"></td>
                            <td class="p-1 text-center"><button type="button" onclick="this.closest('tr').remove(); updateAddLoanRateSl();" class="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">X</button></td>
                        `;
                        tbody.appendChild(tr);
                        addedCount++;
                    }
                }
                
                if (addedCount === 0) {
                    showToast("No valid rates found in the uploaded file.", true);
                    appendAddLoanRateRow();
                } else {
                    showToast(`Successfully populated ${addedCount} rate(s) from Excel!`);
                }
            }
        } catch (err) {
            console.error("Error parsing rates Excel:", err);
            showToast("Failed to parse the Excel file.", true);
        }
        
        // Reset the file input so the same file can be uploaded again if needed
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function appendAddLoanRateRow() {
    const tbody = document.getElementById('addLoanRatesTableBody');
    if (!tbody) return;
    
    const rowCount = tbody.rows.length;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 hover:bg-slate-50 transition';
    
    // Auto-generate "From Date" if there's a previous row
    let suggestedFromDate = '';
    if (rowCount > 0) {
        const prevRow = tbody.rows[rowCount - 1];
        const prevToDateInput = prevRow.querySelector('.add-loan-todate');
        if (prevToDateInput && prevToDateInput.value) {
            const dt = parseDateFromDisplay(prevToDateInput.value);
            if (dt && !isNaN(dt)) {
                dt.setDate(dt.getDate() + 1); // Next day
                suggestedFromDate = formatDate(dt);
            }
        }
    }
    
    tr.innerHTML = `
        <td class="p-2 text-center text-gray-500 font-bold border-r">${rowCount + 1}</td>
        <td class="p-1 border-r"><input type="text" class="add-loan-frmdate w-full h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="dd/mm/yyyy" value="${suggestedFromDate}"></td>
        <td class="p-1 border-r"><input type="text" class="add-loan-todate w-full h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="Open"></td>
        <td class="p-1 border-r"><input type="number" step="0.01" class="add-loan-rate w-full h-8 px-2 text-xs border border-gray-300 rounded text-right font-bold text-emerald-700 focus:ring-1 focus:ring-blue-400 focus:outline-none" placeholder="e.g. 9.00"></td>
        <td class="p-1 text-center"><button type="button" onclick="this.closest('tr').remove(); updateAddLoanRateSl();" class="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">X</button></td>
    `;
    tbody.appendChild(tr);
}

function updateAddLoanRateSl() {
    const tbody = document.getElementById('addLoanRatesTableBody');
    if (!tbody) return;
    Array.from(tbody.rows).forEach((row, idx) => {
        row.cells[0].textContent = idx + 1;
    });
}

function saveNewDedicatedProduct() {
    const code = document.getElementById('addLoanHead').value.trim();
    let name = document.getElementById('addLoanSchemeName').value.trim().toUpperCase();
    const sector = document.getElementById('addLoanType').value;
    
    const repayment = document.getElementById('addLoanTermType').value;
    
    const cap = document.getElementById('addLoanCapPeriod').value;
    const isPenaltyApplicable = document.getElementById('addLoanPenaltyToggle') ? document.getElementById('addLoanPenaltyToggle').value === 'Yes' : true;

    if (!code || !name) {
        showMessageBox("Please provide both GL Code and Scheme Name.", true);
        return;
    }

    if (customProducts[code] || loanTypeMap[code] || loanCategoryMap[name]) {
        showMessageBox("A loan product with this GL Code or Name already exists.", true);
        return;
    }

    // Save rates if provided and container is visible
    const ratesContainer = document.getElementById('addLoanRatesContainer');
    const hasRates = ratesContainer && !ratesContainer.classList.contains('hidden');
    let ratesArrayToSave = [];
    let initialRateDisplay = '-';

    if (hasRates) {
        const tbody = document.getElementById('addLoanRatesTableBody');
        const rows = tbody ? tbody.rows : [];
        for (let i = 0; i < rows.length; i++) {
            const frm = rows[i].querySelector('.add-loan-frmdate').value.trim();
            const rt = rows[i].querySelector('.add-loan-rate').value.trim();
            
            if (frm && rt) {
                const dt = parseDateFromDisplay(frm);
                if (dt && !isNaN(dt)) {
                    ratesArrayToSave.push({
                        date: dt,
                        dateStr: dt.toISOString().split('T')[0],
                        rate: parseFloat(rt)
                    });
                }
            }
        }
    }

    // Update Data Structures
    customProducts[code] = { 
        name: name, 
        category: sector, 
        termType: repayment,
        capitalization: cap, 
        penaltyApplicable: isPenaltyApplicable 
    };

    loanTypeMap[code] = name;
    loanCategoryMap[name] = sector;
    loanStructureMap[name] = repayment;
    capitalizationMap[name] = cap.toLowerCase();

    // Ensure it triggers custom product persistence in `interestRateManager` if applicable
    saveCustomProducts();

    if (ratesArrayToSave.length > 0) {
        ratesArrayToSave.sort((a, b) => a.date - b.date);
        interestRateHistory[name] = ratesArrayToSave;
        if (window.InterestRateManager && typeof window.InterestRateManager.overwriteCustomRates === 'function') {
            window.InterestRateManager.overwriteCustomRates(name, ratesArrayToSave.map(r => ({ dateStr: r.dateStr, rate: r.rate })));
        }
        initialRateDisplay = ratesArrayToSave[ratesArrayToSave.length - 1].rate.toFixed(2) + '%';
    }

    showToast(" Successfully added " + name);

    // Append to "Recently Added Loans" Table
    const recentBody = document.getElementById('recentlyAddedLoansTableBody');
    if (recentBody) {
        if (recentBody.innerHTML.includes('No loans added')) {
            recentBody.innerHTML = '';
        }
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100/50 hover:bg-white/50 transition';
        // Calculate new Sl number
        const slNumber = recentBody.children.length + (recentBody.innerHTML.includes('No loans added') ? 0 : 1);
        
        tr.innerHTML = `
            <td class="px-3 py-2 text-center text-gray-500 font-bold">${slNumber}</td>
            <td class="px-3 py-2 font-mono font-bold text-gray-700 text-center">${code}</td>
            <td class="px-3 py-2 font-bold text-gray-800">${name}</td>
            <td class="px-3 py-2">${sector}</td>
            <td class="px-3 py-2">${repayment}</td>
            <td class="px-3 py-2">${cap}</td>
            <td class="px-3 py-2 text-center">
                ${isPenaltyApplicable ? '<span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold">Yes</span>' : '<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold">No</span>'}
            </td>
            <td class="px-3 py-2 text-center font-bold text-emerald-700">${initialRateDisplay}</td>
        `;
        recentBody.insertBefore(tr, recentBody.firstChild); // Insert at top
    }

    // Clear form for next entry
    document.getElementById('addLoanHead').value = '';
    document.getElementById('addLoanSchemeName').value = '';
}



function toggleAddProductMode(show) {
    if (show) {
        document.getElementById('productSelectMode').classList.add('hidden');
        document.getElementById('productPropertiesDisplay').classList.add('hidden');
        document.getElementById('productAddMode').classList.remove('hidden');
        document.getElementById('btnAddRateRow').disabled = true;
        document.getElementById('btnSaveRates').disabled = true;
        
        // Only clear if not editing
        if (!editingOldProductName) {
            document.getElementById('newProductCode').value = '';
            document.getElementById('newProductName').value = '';
            document.getElementById('newProductCategory').value = 'CMSME';
            if (document.getElementById('newProductTermType')) document.getElementById('newProductTermType').value = 'Continuous';
            document.getElementById('newProductCap').value = 'Monthly';
            document.getElementById('newProductExcelFile').value = '';
            const penCheck = document.getElementById('newProductPenalty');
if (penCheck) {
penCheck.value = 'Applicable';
}
const intTypeEl = document.getElementById('newProductInterestType');
if (intTypeEl) intTypeEl.value = 'Fixed';
            currentRateManagerState = [];
            renderRateManagerTableFromState();
        }
    } else {
        document.getElementById('productSelectMode').classList.remove('hidden');
        document.getElementById('productAddMode').classList.add('hidden');
        document.getElementById('btnAddRateRow').disabled = false;
        document.getElementById('btnSaveRates').disabled = false;
        editingOldProductName = null; // reset
        
        // Re-load rates for the currently selected product
        const productName = document.getElementById('rateManagerLoanSelector').value;
        if (!productName) {
            currentRateManagerState = [];
            renderRateManagerTableFromState();
            updateProductPropertiesDisplay('');
        } else {
            refreshRateManagerTable();
        }
    }
}

function saveNewProduct() {
    const code = document.getElementById('newProductCode').value.trim();
    const name = document.getElementById('newProductName').value.trim().toUpperCase();
    const cat = document.getElementById('newProductCategory').value;
    const termType = document.getElementById('newProductTermType') ? document.getElementById('newProductTermType').value : 'Continuous';
    const cap = document.getElementById('newProductCap').value;
const interestType = document.getElementById('newProductInterestType') ? document.getElementById('newProductInterestType').value : 'Fixed';

    if (!code || code.length !== 4) {
        InterestCalcLogic.showMessageBox('Please enter a valid 4-digit GL Code.', true);
        return;
    }
    if (!name) {
        InterestCalcLogic.showMessageBox('Please enter a valid Loan Type Name.', true);
        return;
    }

    // Save to DB
    try {
        const ipc = (window.require && window.require('electron')) ? window.require('electron').ipcRenderer : null;
        if (ipc) {
            let customProductsRaw = ipc.sendSync('db-get-kv', 'custom_loan_products');
            let customProducts = {};
            if (typeof customProductsRaw === 'string') {
                try { customProducts = JSON.parse(customProductsRaw); } catch(e) {}
            } else if (customProductsRaw && typeof customProductsRaw === 'object') {
                customProducts = customProductsRaw;
            }
            
            // If editing and name or code changed, remove old entry from DB
            if (editingOldProductName) {
                let oldCode = Object.keys(customProducts).find(c => customProducts[c].name === editingOldProductName);
                if (oldCode && oldCode !== code) {
                    delete customProducts[oldCode];
                }
                
                // If the name changed, we should migrate the rate history to the new name
                if (editingOldProductName !== name && window.InterestRateManager) {
                    let oldRates = interestRateHistory[editingOldProductName] || [];
                    // We only migrate if we haven't uploaded an Excel sheet just now
                    if (currentRateManagerState.length === 0 && oldRates.length > 0) {
                        currentRateManagerState = oldRates.map(r => ({
                            dateStr: r.date.toISOString().split('T')[0],
                            rate: r.rate
                        }));
                    }
                    InterestRateManager.overwriteCustomRates(editingOldProductName, []); // wipe old
                    delete interestRateHistory[editingOldProductName];
                }
            }
            
                        const isPenaltyApplicable = document.getElementById('newProductPenalty') ? (document.getElementById('newProductPenalty').value === 'Applicable') : true;
            customProducts[code] = { name: name, category: cat, termType: termType, capitalization: cap, penaltyApplicable: isPenaltyApplicable, interestType: interestType };
if (typeof interestTypeMap !== 'undefined') interestTypeMap[name] = interestType;
            ipc.sendSync('db-set-kv', 'custom_loan_products', customProducts);

            // Update in-memory maps
            loanTypeMap[code] = name;
            loanCategoryMap[name] = cat;
            loanStructureMap[name] = termType;
            capitalizationMap[name] = cap.toLowerCase();

            // Save Penalty Exemption status directly into InterestRateManager & localStorage
            if (window.InterestRateManager && typeof window.InterestRateManager.setLoanTypePenaltyExemption === 'function') {
                window.InterestRateManager.setLoanTypePenaltyExemption(name, !isPenaltyApplicable);
            }

            // If rates were imported via Excel (or migrated from edit), save them too!
            let ratesSavedMsg = '';
            if (currentRateManagerState.length > 0) {
                if (window.InterestRateManager && typeof InterestRateManager.overwriteCustomRates === 'function') {
                    InterestRateManager.overwriteCustomRates(name, currentRateManagerState);
                    interestRateHistory[name] = currentRateManagerState.map(r => ({ date: new Date(r.dateStr), rate: parseFloat(r.rate) }));
                    interestRateHistory[name].sort((a, b) => a.date - b.date);
                    interestRateHistory[code] = interestRateHistory[name];
                    ratesSavedMsg = ` with ${currentRateManagerState.length} rates`;
                }
            }

            showToast(` Loan Product "${name}" saved successfully!`);

            // Re-populate dropdown and select it
            populateProductDropdown();
            document.getElementById('rateManagerLoanSelector').value = name;

            // Update UI elements
            updatePenaltyField(name);
            updateProductPropertiesDisplay(name);
            refreshPenaltyLoanStatus();

            toggleAddProductMode(false);
        } else {
            InterestCalcLogic.showMessageBox('Database connection unavailable.', true);
        }
    } catch (e) {
        InterestCalcLogic.showMessageBox('Error saving product.', true);
        console.error(e);
    }
}

function deleteSelectedProduct() {
    const productName = document.getElementById('rateManagerLoanSelector') ? document.getElementById('rateManagerLoanSelector').value : '';
    if (!productName) {
        showToast('Please select a Loan Product to delete.', true);
        return;
    }

    if (confirm(`Are you sure you want to completely delete the product '${productName}' and its rate history? This cannot be undone.`)) {
        try {
            let customProducts = loadAppData('custom_loan_products') || {};
            let codeToDelete = Object.keys(customProducts).find(c => customProducts[c].name === productName);
            
            if (codeToDelete) {
                delete customProducts[codeToDelete];
                saveAppData('custom_loan_products', customProducts);

                // Remove from in-memory maps
                delete loanTypeMap[codeToDelete];
                delete loanCategoryMap[productName];
                delete capitalizationMap[productName];
                delete interestRateHistory[productName];
                delete interestRateHistory[codeToDelete];

                if (window.InterestRateManager && typeof InterestRateManager.overwriteCustomRates === 'function') {
                    InterestRateManager.overwriteCustomRates(productName, []);
                }

                showToast(` Loan Product "${productName}" has been deleted.`);
                populateProductDropdown();
                document.getElementById('rateManagerLoanSelector').value = '';
                refreshRateManagerTable();
            } else {
                showToast(`Cannot delete default core product '${productName}'. Only custom products can be deleted.`, true);
            }
        } catch (e) {
            showToast('Error deleting product: ' + e.message, true);
        }
    }
}

function importRatesFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            if (typeof XLSX === 'undefined') {
                InterestCalcLogic.showMessageBox('Excel parser library (XLSX) not found.', true);
                return;
            }
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON (array of arrays to be safe from header names)
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            if (json.length < 2) {
                InterestCalcLogic.showMessageBox('Excel file appears to be empty or missing data rows.', true);
                return;
            }
            
            let parsedRates = [];
            // Skip the header row (index 0)
            for (let i = 1; i < json.length; i++) {
                const row = json[i];
                if (!row || row.length < 2) continue;
                
                // Heuristically find the date and rate in each row
                let dateStr = null;
                let rateVal = null;
                
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (cell === undefined || cell === null || cell === '') continue;
                    
                    // Is it a date string? (dd/mm/yyyy)
                    if (typeof cell === 'string' && cell.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
                        let parts = cell.split(/[\/\-]/);
                        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } 
                    // Excel serial date (e.g. 44197 for year 2021+)
                    else if (typeof cell === 'number' && cell > 30000 && dateStr === null) {
                        let d = new Date(Math.round((cell - 25569) * 86400 * 1000));
                        dateStr = d.toISOString().split('T')[0];
                    } 
                    // Probably the rate (e.g. 9.0)
                    else if (typeof cell === 'number' && cell < 100 && rateVal === null) {
                        rateVal = cell;
                    } 
                    // Or if rate is string like "9.00" or "9%"
                    else if (typeof cell === 'string' && !isNaN(parseFloat(cell.replace('%', ''))) && rateVal === null && !cell.includes('/')) {
                        rateVal = parseFloat(cell.replace('%', ''));
                    }
                }
                
                if (dateStr && rateVal !== null) {
                    parsedRates.push({ dateStr: dateStr, rate: rateVal });
                }
            }
            
            if (parsedRates.length > 0) {
                // Set to current state
                currentRateManagerState = parsedRates;
                currentRateManagerState.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
                renderRateManagerTableFromState();
                InterestCalcLogic.showMessageBox(`Successfully imported ${parsedRates.length} rates from Excel!`);
            } else {
                InterestCalcLogic.showMessageBox('Could not find valid Date (dd/mm/yyyy) and Rate columns in the Excel file.', true);
            }
        } catch (err) {
            InterestCalcLogic.showMessageBox('Error parsing Excel file.', true);
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
    
    // Clear input so the same file can be uploaded again if needed
    event.target.value = '';
}

function populateProductDropdown() {
    const sel = document.getElementById('rateManagerLoanSelector');
    if (!sel) return;
    
    // Combine hardcoded and custom products
    // `loanTypeMap` has all codes -> names. 
    // We want to list all unique product names, preferably with their code if available.
    let productNames = new Set(Object.values(loanTypeMap));
    
    // Also include any history keys just in case
    if (window.InterestRateManager) {
        Object.keys(InterestRateManager.getRateHistory()).forEach(k => productNames.add(k));
    }
    
    // Build an array of objects to sort by code first, then name
    let items = [...productNames].map(name => {
        let code = Object.keys(loanTypeMap).find(k => loanTypeMap[k] === name) || '9999'; // default to end if no code
        
function showBulkPenaltyModal() {
    if (typeof InterestCalcLogic !== 'undefined') InterestCalcLogic.hideAvailableLoansModal();
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideBulkPenaltyModal() {
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function applyBulkPenaltyRate() {
    const dateInput = document.getElementById('bulkPenaltyDate').value;
    const rateInput = document.getElementById('bulkPenaltyRate').value;
    if (!dateInput || !rateInput) {
        showToast("Please enter both Effective Date and Penalty Rate!", "error");
        return;
    }
    
    if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltySchedule === 'function') {
        const currentRates = window.InterestRateManager.getPenaltySchedule();
        currentRates.push({ dateStr: dateInput, rate: parseFloat(rateInput) });
        // Assuming savePenaltySchedule accepts the array and saves it
        if (typeof window.InterestRateManager.savePenaltySchedule === 'function') {
            window.InterestRateManager.savePenaltySchedule(currentRates);
            hideBulkPenaltyModal();
            showToast(" Global bulk penalty rate applied successfully!");
            // Refresh table if needed
            if (typeof refreshPenaltyManagerTable === 'function') refreshPenaltyManagerTable();
            if (typeof applyRatesAndRecalculate === 'function') applyRatesAndRecalculate();
        } else {
            console.error("savePenaltySchedule not found in InterestRateManager!");
        }
    } else {
        console.error("InterestRateManager or getPenaltySchedule not found!");
    }
}

return { name: name, code: code, display: code !== '9999' ? `${code} - ${name}` : name };
    });
    
    items.sort((a, b) => {
        if (a.code !== b.code) return a.code.localeCompare(b.code);
        return a.name.localeCompare(b.name);
    });
    
    let options = `<option value="">-- Select Loan Product --</option>`;
    items.forEach(item => {
        options += `<option value="${item.name}">${item.display}</option>`;
    });
    
    sel.innerHTML = options;
}

function updateProductPropertiesDisplay(productName) {
    const dispContainer = document.getElementById('productPropertiesDisplay');
    if (!dispContainer) return;
    
    if (!productName) {
        dispContainer.classList.add('hidden');
        return;
    }
    
    dispContainer.classList.remove('hidden');
    
    let code = Object.keys(loanTypeMap).find(k => loanTypeMap[k] === productName) || 'N/A';
    let cat = loanCategoryMap[productName] || 'Unknown';
    let cap = capitalizationMap[productName] || 'Unknown';
    
    document.getElementById('dispProductCode').textContent = code;
    document.getElementById('dispProductCategory').textContent = cat;
    document.getElementById('dispProductCap').textContent = cap;

    const penEl = document.getElementById('dispProductPenalty');
    if (penEl) {
        const exempt = isPenaltyExempt(productName);
        penEl.innerHTML = exempt
            ? '<span class="text-gray-500 font-bold"> N/A</span>'
            : '<span class="text-green-700 font-bold"> Applicable</span>';
    }
}


let currentPenaltyManagerState = [];

function switchRateModalTab(tab) {
    const tabBase = document.getElementById('rateModalTabBaseRates');
    const tabPen = document.getElementById('rateModalTabPenaltyRates');
    const btnBase = document.getElementById('tab-btn-base-rates');
    const btnPen = document.getElementById('tab-btn-penalty-rates');
    const btnSaveRates = document.getElementById('btnSaveRates');
    const btnSavePenalty = document.getElementById('btnSavePenalty');
    const tipEl = document.getElementById('rateModalFooterTip');

    if (tab === 'penalty') {
        if (tabBase) { tabBase.classList.add('hidden'); tabBase.style.display = 'none'; }
        if (tabPen) { tabPen.classList.remove('hidden'); tabPen.style.display = 'flex'; }
        
        // Active Penalty Tab Color Styling (Vibrant Purple)
        if (btnBase) {
            btnBase.className = "px-4 py-1.5 text-xs font-bold rounded-lg text-gray-700 hover:text-green-800 transition cursor-pointer";
            btnBase.style.backgroundColor = "transparent";
            btnBase.style.color = "#374151";
            btnBase.style.boxShadow = "none";
        }
        if (btnPen) {
            btnPen.className = "px-4 py-1.5 text-xs font-bold rounded-lg bg-purple-700 text-white shadow-sm transition cursor-pointer";
            btnPen.style.backgroundColor = "#7e22ce";
            btnPen.style.color = "#ffffff";
            btnPen.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
        }
        if (btnSaveRates) btnSaveRates.classList.add('hidden');
        if (btnSavePenalty) btnSavePenalty.classList.remove('hidden');
        if (tipEl) tipEl.textContent = "Penalty rates are applied dynamically according to transaction dates.";
        
        refreshPenaltyManagerTable();
        populatePenaltyLoanSelector();
        refreshPenaltyLoanStatus();
    } else {
        if (tabPen) { tabPen.classList.add('hidden'); tabPen.style.display = 'none'; }
        if (tabBase) { tabBase.classList.remove('hidden'); tabBase.style.display = 'flex'; }
        
        // Active Base Rates Tab Color Styling (Vibrant Forest Green)
        if (btnBase) {
            btnBase.className = "px-4 py-1.5 text-xs font-bold rounded-lg bg-green-700 text-white shadow-sm transition cursor-pointer";
            btnBase.style.backgroundColor = "#047857";
            btnBase.style.color = "#ffffff";
            btnBase.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
        }
        if (btnPen) {
            btnPen.className = "px-4 py-1.5 text-xs font-bold rounded-lg text-gray-700 hover:text-purple-900 transition cursor-pointer";
            btnPen.style.backgroundColor = "transparent";
            btnPen.style.color = "#374151";
            btnPen.style.boxShadow = "none";
        }
        if (btnSaveRates) btnSaveRates.classList.remove('hidden');
        if (btnSavePenalty) btnSavePenalty.classList.add('hidden');
        if (tipEl) tipEl.textContent = "Select a loan product to review or modify effective rate history.";
        
        refreshRateManagerTable();
    }
}

function populatePenaltyLoanSelector() {
    const sel = document.getElementById('penaltyLoanSelector');
    if (!sel) return;
    sel.innerHTML = '';
    const products = Object.values(loanTypeMap).filter((v, i, a) => a.indexOf(v) === i).sort();
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        sel.appendChild(opt);
    });

    const curr = document.getElementById('loan_scheme_name')?.value?.trim();
    if (curr && products.includes(curr)) {
        sel.value = curr;
    }
    refreshPenaltyLoanStatus();
}

function refreshPenaltyLoanStatus() {
    const sel = document.getElementById('penaltyLoanSelector');
    const badge = document.getElementById('penaltyStatusBadge');
    const btnToggle = document.getElementById('btnTogglePenaltyExempt');
    if (!sel || !badge) return;

    const loanType = sel.value;
    const exempt = isPenaltyExempt(loanType);

    if (exempt) {
        badge.textContent = 'N/A (Exempt)';
        badge.className = 'px-3 py-2 rounded-md font-bold text-xs whitespace-nowrap bg-gray-200 text-gray-700 border border-gray-300';
        if (btnToggle) btnToggle.textContent = 'Set Applicable';
    } else {
        badge.textContent = 'Applicable';
        badge.className = 'px-3 py-2 rounded-md font-bold text-xs whitespace-nowrap bg-green-100 text-green-800 border border-green-300';
        if (btnToggle) btnToggle.textContent = 'Set N/A (Exempt)';
    }
}

function toggleCurrentLoanPenaltyExemption() {
    const sel = document.getElementById('penaltyLoanSelector');
    if (!sel) return;
    const loanType = sel.value;
    const currentExempt = isPenaltyExempt(loanType);
    if (window.InterestRateManager && typeof window.InterestRateManager.setLoanTypePenaltyExemption === 'function') {
        window.InterestRateManager.setLoanTypePenaltyExemption(loanType, !currentExempt);
    }
    refreshPenaltyLoanStatus();
    updatePenaltyField();
}

function refreshPenaltyManagerTable() {
    const tbody = document.getElementById('penaltyManagerTableBody');
    if (!tbody) return;

    if (currentPenaltyManagerState.length === 0) {
        if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltySchedule === 'function') {
            const sched = window.InterestRateManager.getPenaltySchedule();
            currentPenaltyManagerState = sched.map(s => ({
                dateStr: s.dateStr || new Date(s.date).toISOString().split('T')[0],
                rate: s.rate
            }));
        } else {
            currentPenaltyManagerState = [
                { dateStr: '2024-05-20', rate: 1.50 },
                { dateStr: '2018-08-09', rate: 2.00 }
            ];
        }
    }

    // Sort ascending by date for chronological presentation
    currentPenaltyManagerState.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

    tbody.innerHTML = '';
    currentPenaltyManagerState.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';

        let toDateDisplay = 'Present / Onwards';
        if (index < currentPenaltyManagerState.length - 1) {
            const nextStart = new Date(currentPenaltyManagerState[index + 1].dateStr);
            nextStart.setDate(nextStart.getDate() - 1);
            toDateDisplay = `${String(nextStart.getDate()).padStart(2, '0')}/${String(nextStart.getMonth() + 1).padStart(2, '0')}/${nextStart.getFullYear()}`;
        }

        tr.innerHTML = `
            <td class="p-2 text-center text-xs font-bold text-gray-500">${index + 1}</td>
            <td class="p-2">
                <input type="date" value="${item.dateStr}" onchange="InterestCalcLogic.updatePenaltyState(${index}, 'dateStr', this.value)"
                  class="p-1 border rounded text-xs w-full">
            </td>
            <td class="p-2 text-xs text-gray-600 font-medium">${toDateDisplay}</td>
            <td class="p-2">
                <div class="flex items-center gap-1">
                    <input type="number" step="0.01" value="${item.rate}" onchange="InterestCalcLogic.updatePenaltyState(${index}, 'rate', this.value)"
                      class="p-1 border rounded text-xs w-20 text-right font-bold text-green-700">
                    <span class="text-xs text-gray-500 font-bold">%</span>
                </div>
            </td>
            <td class="p-2 text-center">
                <button type="button" onclick="InterestCalcLogic.deletePenaltyRow(${index})"
                  class="text-red-500 hover:text-red-700 font-bold text-sm px-2 py-1" title="Delete Span">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addPenaltyRow() {
    currentPenaltyManagerState.push({
        dateStr: new Date().toISOString().split('T')[0],
        rate: 1.50
    });
    refreshPenaltyManagerTable();
}

function deletePenaltyRow(index) {
    if (currentPenaltyManagerState.length <= 1) {
        showMessageBox("At least one penalty rate span must be configured.", true);
        return;
    }
    currentPenaltyManagerState.splice(index, 1);
    refreshPenaltyManagerTable();
}

function updatePenaltyState(index, field, value) {
    if (currentPenaltyManagerState[index]) {
        if (field === 'rate') {
            currentPenaltyManagerState[index].rate = parseFloat(value) || 0;
        } else {
            currentPenaltyManagerState[index].dateStr = value;
        }
        refreshPenaltyManagerTable();
    }
}


function quickAddPenaltyEntry() {
    const dateInput = document.getElementById('quickPenaltyDate');
    const rateInput = document.getElementById('quickPenaltyRate');

    if (!dateInput || !dateInput.value) {
        showMessageBox("Please select an effective date for the penalty rate.", true);
        return;
    }
    const rateVal = parseFloat(rateInput ? rateInput.value : '');
    if (isNaN(rateVal) || rateVal < 0) {
        showMessageBox("Please enter a valid penalty rate percentage (e.g. 1.50).", true);
        return;
    }

    // Check if date already exists in state, update or push
    const existingIndex = currentPenaltyManagerState.findIndex(item => item.dateStr === dateInput.value);
    if (existingIndex >= 0) {
        currentPenaltyManagerState[existingIndex].rate = rateVal;
    } else {
        currentPenaltyManagerState.push({
            dateStr: dateInput.value,
            rate: rateVal
        });
    }

    refreshPenaltyManagerTable();
    rateInput.value = '';
    showMessageBox(`Penalty rate ${rateVal}% for date ${dateInput.value} added to schedule.`);
}

function savePenaltyManager() {
    if (window.InterestRateManager && typeof window.InterestRateManager.savePenaltySchedule === 'function') {
        window.InterestRateManager.savePenaltySchedule(currentPenaltyManagerState);
    }
    showToast(" Penalty rate schedule and settings saved successfully!");
    hideRateChangeModal();
    updatePenaltyField();
    if (typeof applyRatesAndRecalculate === 'function') {
        applyRatesAndRecalculate();
    }
}

function resetDefaultPenaltySchedule() {
    currentPenaltyManagerState = [
        { dateStr: '2024-05-20', rate: 1.50 },
        { dateStr: '2018-08-09', rate: 2.00 }
    ];
    refreshPenaltyManagerTable();
}

function showRateChangeModal(initialTab = 'rates') {
    InterestCalcLogic.hideAvailableLoansModal();
    populateProductDropdown();
    toggleAddProductMode(false);

    const rateManagerSel = document.getElementById('rateManagerLoanSelector');
    if (rateManagerSel) {
        // Auto-select current loan type if one is loaded
        const currentLoanTypeField = document.getElementById('loan_scheme_name');
        if (currentLoanTypeField && currentLoanTypeField.value) {
            const val = currentLoanTypeField.value.toUpperCase().trim();
            // It could be a code or a name
            let name = loanTypeMap[val] || val; 
            if (Array.from(rateManagerSel.options).some(o => o.value === name)) {
                rateManagerSel.value = name;
            }
        }
    }

    const modal = document.getElementById('rateChangeModal');
    if (modal) {
        // Always act as Standalone Mode to separate UI components
        const headerTabs = modal.querySelector('.bg-slate-200\\/90');
        if (headerTabs) {
            headerTabs.style.display = 'none';
        }
        
        const modalTitle = modal.querySelector('h3');
        const modalDesc = modal.querySelector('p');
        if (initialTab === 'penalty') {
            if (modalTitle) modalTitle.textContent = " Dynamic Penalty Rates Configurator";
            if (modalDesc) modalDesc.textContent = "Manage global penalty schedules applicable across the system";
        } else {
            if (modalTitle) modalTitle.textContent = "Loan Product & Rate Configurator";
            if (modalDesc) modalDesc.textContent = "Manage products and their effective base interest rate timelines";
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    refreshRateManagerTable();
    
    // Switch to the correct tab (rates vs penalty)
    if (typeof InterestCalcLogic !== 'undefined' && InterestCalcLogic.switchRateModalTab) {
        InterestCalcLogic.switchRateModalTab(initialTab);
    } else if (typeof switchRateModalTab === 'function') {
        switchRateModalTab(initialTab);
    }
}

function hideRateChangeModal() {
    const modal = document.getElementById('rateChangeModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function refreshRateManagerTable() {
    const sel = document.getElementById('rateManagerLoanSelector');
    const productName = sel ? sel.value : '';
    
    updateProductPropertiesDisplay(productName);
    
    if (!productName) {
        currentRateManagerState = [];
        renderRateManagerTableFromState();
        return;
    }
    
    let arr = [];
    if (window.InterestRateManager) {
        const histories = InterestRateManager.getRateHistory();
        arr = histories[productName] || [];
    } else {
        arr = interestRateHistory[productName] || [];
    }
    
    // Deep copy to local state
    currentRateManagerState = arr.map(entry => {
        
function showBulkPenaltyModal() {
    if (typeof InterestCalcLogic !== 'undefined') InterestCalcLogic.hideAvailableLoansModal();
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideBulkPenaltyModal() {
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function applyBulkPenaltyRate() {
    const dateInput = document.getElementById('bulkPenaltyDate').value;
    const rateInput = document.getElementById('bulkPenaltyRate').value;
    if (!dateInput || !rateInput) {
        showToast("Please enter both Effective Date and Penalty Rate!", "error");
        return;
    }
    
    if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltySchedule === 'function') {
        const currentRates = window.InterestRateManager.getPenaltySchedule();
        currentRates.push({ dateStr: dateInput, rate: parseFloat(rateInput) });
        // Assuming savePenaltySchedule accepts the array and saves it
        if (typeof window.InterestRateManager.savePenaltySchedule === 'function') {
            window.InterestRateManager.savePenaltySchedule(currentRates);
            hideBulkPenaltyModal();
            showToast(" Global bulk penalty rate applied successfully!");
            // Refresh table if needed
            if (typeof refreshPenaltyManagerTable === 'function') refreshPenaltyManagerTable();
            if (typeof applyRatesAndRecalculate === 'function') applyRatesAndRecalculate();
        } else {
            console.error("savePenaltySchedule not found in InterestRateManager!");
        }
    } else {
        console.error("InterestRateManager or getPenaltySchedule not found!");
    }
}

return {
            dateStr: entry.date.toISOString().split('T')[0],
            rate: entry.rate
        };
    });
    // Sort descending by date so latest is first
    currentRateManagerState.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
    
    renderRateManagerTableFromState();
}

function renderRateManagerTableFromState() {
    const tbody = document.getElementById('rateManagerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const productName = document.getElementById('rateManagerLoanSelector') ? document.getElementById('rateManagerLoanSelector').value : '';
    const btnAdd = document.getElementById('btnAddRateRow');
    const btnSave = document.getElementById('btnSaveRates');
    
    if (!productName) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Please select a Loan Product to view or edit rates.</td></tr>`;
        if (btnAdd) btnAdd.disabled = true;
        if (btnSave) btnSave.disabled = true;
        return;
    }
    
    if (btnAdd) btnAdd.disabled = false;
    if (btnSave) btnSave.disabled = false;

    if (currentRateManagerState.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">No rates found for this product. Click '+ Add Rate Row' to add one.</td></tr>`;
        return;
    }

    currentRateManagerState.forEach((item, index) => {
        // Auto-calculate To Date based on the next chronological row (which is the PREVIOUS item in our descending array)
        let toDateDisplay = 'Present';
        if (index > 0) {
            // The row above this one (index - 1) is the NEXT chronological rate.
            // So this rate ends the day before that rate starts.
            let nextRateDate = new Date(currentRateManagerState[index - 1].dateStr);
            if (!isNaN(nextRateDate)) {
                nextRateDate.setDate(nextRateDate.getDate() - 1);
                toDateDisplay = nextRateDate.toISOString().split('T')[0];
            }
        }

        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="p-2 border text-center">${currentRateManagerState.length - index}</td>
            <td class="p-2 border">
                <input type="date" value="${item.dateStr}" onchange="InterestCalcLogic.updateRateState(${index}, 'dateStr', this.value)" class="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
            </td>
            <td class="p-2 border text-gray-600">${toDateDisplay}</td>
            <td class="p-2 border">
                <input type="number" step="0.01" value="${item.rate}" onchange="InterestCalcLogic.updateRateState(${index}, 'rate', this.value)" class="w-full p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right">
            </td>
            <td class="p-2 border text-center">
                <button type="button" onclick="InterestCalcLogic.deleteRateRow(${index})" class="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-500 rounded styled-button">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateRateState(index, field, value) {
    if (currentRateManagerState[index]) {
        currentRateManagerState[index][field] = value;
        // Re-sort the array if a date changes, so the "To Date" logic stays correct
        if (field === 'dateStr') {
            currentRateManagerState.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
            renderRateManagerTableFromState();
        }
    }
}

function deleteRateRow(index) {
    currentRateManagerState.splice(index, 1);
    renderRateManagerTableFromState();
}

function addRateRow() {
    const productName = document.getElementById('rateManagerLoanSelector') ? document.getElementById('rateManagerLoanSelector').value : '';
    if (!productName) {
        InterestCalcLogic.showMessageBox('Please select a Loan Product first.', true);
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    currentRateManagerState.unshift({ dateStr: today, rate: 0 });
    currentRateManagerState.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
    renderRateManagerTableFromState();
}

function saveRateManager() {
    const productName = document.getElementById('rateManagerLoanSelector') ? document.getElementById('rateManagerLoanSelector').value : '';
    if (!productName) {
        InterestCalcLogic.showMessageBox('Please select a Loan Product.', true);
        return;
    }
    
    // Validate
    let hasError = false;
    currentRateManagerState.forEach(item => {
        if (!item.dateStr || isNaN(parseFloat(item.rate))) hasError = true;
    });

    if (hasError) {
        InterestCalcLogic.showMessageBox('Please ensure all rows have a valid start date and rate.', true);
        return;
    }

    if (confirm(`Save ${currentRateManagerState.length} rate(s) for ${productName} permanently?`)) {
        if (window.InterestRateManager && typeof InterestRateManager.overwriteCustomRates === 'function') {
            InterestRateManager.overwriteCustomRates(productName, currentRateManagerState);
            
            // Also update in-memory arrays if they are being used directly in the current session
            // `productName` could map to multiple GL codes or just one. Usually it's 1-to-1 or Many-to-1 in interestRateHistory.
            interestRateHistory[productName] = currentRateManagerState.map(r => ({ date: new Date(r.dateStr), rate: parseFloat(r.rate) }));
            interestRateHistory[productName].sort((a, b) => a.date - b.date);
            
            // Also update any GL codes that map to this product name
            Object.keys(loanTypeMap).forEach(code => {
                if (loanTypeMap[code] === productName) {
                    interestRateHistory[code] = interestRateHistory[productName];
                }
            });
            
            InterestCalcLogic.showMessageBox('Rates saved successfully to the database!');
            hideRateChangeModal();
            // Force recalculate if open
            if (InterestCalcLogic.isAutoRecalcActive) InterestCalcLogic.calculateAndCapitalizeInterest(true);
        } else {
            InterestCalcLogic.showMessageBox('Error: Database saving function is missing.', true);
        }
    }
}

function saveRateChange() {
    const dateInput = document.getElementById('rateChangeDate');
    const rateInput = document.getElementById('newRateValue');
    const loanCategory = document.getElementById('rateChangeLoanType').value;
    const cmsmeSubType = document.getElementById('rateChangeCmsmeSubType').value;
    const personalLoanSubType = document.getElementById('rateChangePersonalLoanSubType').value;
    const tableBody = document.getElementById('loanTableBody');

    const newDate = new Date(dateInput.value);
    const newRate = parseFloat(rateInput.value);

    if (isNaN(newDate.getTime()) || isNaN(newRate)) {
        InterestCalcLogic.showMessageBox("Please enter a valid date and rate.", true);
        return;
    }

    const modifiedHistories = new Set();
    let updateCount = 0;

    Object.keys(loanCategoryMap).forEach(key => {
        let categoryMatch = (loanCategoryMap[key] === loanCategory);
        let subTypeMatch = true;
        if (loanCategory === 'CMSME') {
            subTypeMatch = key.includes(cmsmeSubType.toUpperCase());
        } else if (loanCategory === 'Personal Loan') {
            subTypeMatch = key.includes(personalLoanSubType.toUpperCase());
        }

        if (categoryMatch && subTypeMatch) {
            const historyArray = interestRateHistory[key];
            if (historyArray && !modifiedHistories.has(historyArray)) {
                // Check if a rate for this exact date already exists and update it
                const existingRate = historyArray.find(r => r.date.getTime() === newDate.getTime());
                if (existingRate) {
                    existingRate.rate = newRate;
                } else {
                    historyArray.push({ date: newDate, rate: newRate });
                }
                historyArray.sort((a, b) => a.date - b.date);
                modifiedHistories.add(historyArray);
                updateCount++;
            }
        }
    });

    if (tableBody.rows.length > 0) {
        applyRatesAndRecalculate();
    }

    // Persist the new rate permanently via the shared InterestRateManager
    if (window.InterestRateManager) {
        const dateStr = dateInput.value;
        Object.keys(loanCategoryMap).forEach(key => {
            let categoryMatch = (loanCategoryMap[key] === loanCategory);
            let subTypeMatch = true;
            if (loanCategory === 'CMSME') subTypeMatch = key.includes(cmsmeSubType.toUpperCase());
            else if (loanCategory === 'Personal Loan') subTypeMatch = key.includes(personalLoanSubType.toUpperCase());
            if (categoryMatch && subTypeMatch) {
                InterestRateManager.saveCustomRate(key, dateStr, newRate);
            }
        });
    }

    hideRateChangeModal();
    InterestCalcLogic.showMessageBox(`Rate history updated for ${updateCount} category list(s). This rate is now permanently saved.`);
}
function savePrintReport(){
  const el = document.querySelector('.printable-area');
  if(!el){ window.print(); return; }

  const saveBtn = document.getElementById('savePrintReport');
  saveBtn.setAttribute('disabled', '');
  saveBtn.classList.add('button-disabled'); // Disable button during PDF generation
  showMessageBox('Generating PDF, please wait...');

  const form = document.getElementById('loanDetailsForm');
  const table = document.getElementById('loanTable');
  const orig = {
    elWidth: el.style.width || '',
    elMaxWidth: el.style.maxWidth || '',
    elMinWidth: el.style.minWidth || '',
    elPadding: el.style.padding || '',
    formMinWidth: form.style.minWidth || '',
    tableLayout: table.style.tableLayout || '',
    tableWidth: table.style.width || ''
  };

  el.style.width = 'calc(210mm - 10mm)';
  el.style.maxWidth = 'calc(210mm - 10mm)';
  el.style.minWidth = 'auto';
  el.style.padding = '5mm';
  form.style.minWidth = '0'; // Reset min-width for form
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';

  requestAnimationFrame(() => {
    const displayWidth = Math.round(el.getBoundingClientRect().width) || el.scrollWidth || el.offsetWidth || 1200;
    const viewportWidth = Math.max(displayWidth, 1200);
    const opt = {
      margin: 4,
      filename: 'Loan_Calculation_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, width: displayWidth, windowWidth: viewportWidth, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.no-print'] }
    };

    html2pdf().set(opt).from(el).save().then(() => {
      el.style.width = orig.elWidth;
      el.style.maxWidth = orig.elMaxWidth;
      el.style.minWidth = orig.elMinWidth;
      el.style.padding = orig.elPadding;
      form.style.minWidth = orig.formMinWidth; // Restore original min-width
      table.style.tableLayout = orig.tableLayout;
      table.style.width = orig.tableWidth;

      saveBtn.removeAttribute('disabled');
      saveBtn.classList.remove('button-disabled');
      hideMessageBox();
    }).catch(err => {
      console.error('html2pdf export failed', err);
      el.style.width = orig.elWidth;
      el.style.maxWidth = orig.elMaxWidth;
      el.style.minWidth = orig.elMinWidth;
      el.style.padding = orig.elPadding;
      form.style.minWidth = orig.formMinWidth; // Restore original min-width
      table.style.tableLayout = orig.tableLayout;
      table.style.width = orig.tableWidth;

      saveBtn.removeAttribute('disabled');
      saveBtn.classList.remove('button-disabled');
      hideMessageBox();
      window.print();
    });
  });
}
function updateHeaderMeta() {
  const accountNumber = document.getElementById('deposit_account_no')?.value || '';
  const calcStartDateRaw = document.getElementById('calcStartDate')?.value || '';
  const calcEndDateRaw = document.getElementById('calcEndDate')?.value || '';
  const formattedStart = calcStartDateRaw ? formatDate(new Date(calcStartDateRaw)) : '';
  const formattedEnd = calcEndDateRaw ? formatDate(new Date(calcEndDateRaw)) : '';
  document.getElementById('headerAccountNumber').textContent = accountNumber ? `A/C No: ${accountNumber}` : ''; // Update account number in header
  document.getElementById('headerCalculationDate').textContent = (formattedStart && formattedEnd) ? `Calculation Date: ${formattedStart} - ${formattedEnd}` : '';
}

function clearAllData() {
  const form = document.getElementById('loanDetailsForm');
  // Clear all text and date inputs, resetting defaults where necessary
  Array.from(form.querySelectorAll('input[type="text"], input[type="date"]')).forEach(input => {
    if (input.id === 'penaltyRate') {
      updatePenaltyField();
    } else { // Clear other inputs
      input.value = '';
    }
  });
  // Reset select elements
  Array.from(form.querySelectorAll('select')).forEach(select => {
    select.value = '';
  });
  document.getElementById('loanTableBody').innerHTML = '';
  penaltyState.originalRates = null;
  isAutoRecalcActive = false;

  // Re-enable the calculate button after clearing data
  const calculateBtn = document.getElementById('calculateBalance');
  if (calculateBtn) {
    calculateBtn.removeAttribute('disabled');
    calculateBtn.classList.remove('button-disabled');
  }
  updateHeaderMeta();
  showCalculationMethodModal();
}

function rebuildTable(allRowsData) {
    const tableBody = document.getElementById('loanTableBody');
    tableBody.innerHTML = '';
    allRowsData.forEach((data, index) => {
        const tr = document.createElement('tr'); // Create new table row
        if (data.isCapitalization) { // Add data attribute for capitalization rows
            tr.dataset.isCapitalization = 'true';
        }
        if (data.isCapitalization || data.particulars === 'Loan Due Date' || data.particulars === 'Calculation End Date') {
            tr.classList.add('bg-inserted-row');
        }
        tr.innerHTML = `<td class="p-2 border border-gray-400 text-center">${index + 1}</td><td class="p-2 border border-gray-400 text-center">${formatDate(data.date)}</td><td class="p-2 border border-gray-400 particulars-col" contentEditable>${data.particulars}</td><td class="p-2 border border-gray-400 text-center" contentEditable>${data.amount}</td><td class="p-2 border border-gray-400 text-center" contentEditable>${data.debit}</td><td class="p-2 border border-gray-400 text-center" contentEditable>${data.penalty}</td><td class="p-2 border border-gray-400 text-center" contentEditable>${data.credit}</td><td class="p-2 border border-gray-400 text-center">${data.balance}</td><td class="p-2 border border-gray-400 text-center"></td><td class="p-2 border border-gray-400 text-center">${data.rate}</td><td class="p-2 border border-gray-400 text-center"></td>`;
        tableBody.appendChild(tr);
    });
}


/* Message box */
function showMessageBox(message, isWarning) {
  const messageTextEl = document.getElementById('messageText');
  const messageBoxContentEl = document.getElementById('messageBoxContent');

  messageTextEl.innerText = message;
  
  // Reset classes
  messageTextEl.classList.remove('text-red-600');
  messageBoxContentEl.classList.remove('bg-red-50', 'bg-blue-50');

  if (isWarning) {
    messageTextEl.classList.add('text-red-600');
    messageBoxContentEl.classList.add('bg-red-50');
  } else {
    messageBoxContentEl.classList.add('bg-blue-50');
  }

  const box=document.getElementById('messageBox');
  box.classList.remove('hidden'); box.classList.add('flex');
}
function hideMessageBox() {
  const box=document.getElementById('messageBox');
  box.classList.add('hidden'); box.classList.remove('flex');
}


    async function downloadExcel() {
        if (typeof ExcelJS === 'undefined') {
            alert('ExcelJS library is not loaded!');
            return;
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Loan Calculation');

        // Column Setup
        ws.columns = [
            { width: 5 },   // A: Sl
            { width: 12 },  // B: Date
            { width: 30 },  // C: Particulars
            { width: 15 },  // D: Amount
            { width: 15 },  // E: Debit
            { width: 12 },  // F: Penalty
            { width: 15 },  // G: Credit
            { width: 18 },  // H: Balance
            { width: 6 },   // I: Days
            { width: 8 },   // J: Rate
            { width: 15 }   // K: Interest
        ];

        // 1. Headers
        ws.mergeCells('A1:K1');
        const r1 = ws.getCell('A1');
        r1.value = 'Bangladesh Krishi Bank';
        r1.font = { bold: true, size: 16 };
        r1.alignment = { horizontal: 'center' };

        ws.mergeCells('A2:K2');
        const r2 = ws.getCell('A2');
        const branchEl = document.getElementById('branch_name');
        r2.value = branchEl ? branchEl.innerText : 'Branch Name';
        r2.font = { bold: true, size: 12 };
        r2.alignment = { horizontal: 'center' };

        ws.mergeCells('A3:K3');
        const r3 = ws.getCell('A3');
        r3.value = 'Default Loan Calculator';
        r3.font = { bold: true, size: 14 };
        r3.alignment = { horizontal: 'center' };

        ws.mergeCells('A4:K4');
        const r4 = ws.getCell('A4');
        const calcStart = document.getElementById('calcStartDate') ? document.getElementById('calcStartDate').value : '';
        const calcEnd = document.getElementById('calcEndDate') ? document.getElementById('calcEndDate').value : '';
        r4.value = `Calculation from: ${calcStart} to ${calcEnd}`;
        r4.font = { size: 11 };
        r4.alignment = { horizontal: 'center' };

        // 2. Loan Details Form (Left and Right columns)
        const leftLabels = ['A/C Number', 'A/C Name', 'Address', 'Loan Type', 'Sanction Amount', 'Sanction Rate', 'Duration (in months)', 'Classification'];
        const leftIds = ['deposit_account_no', 'applicant_name_bn', 'address', 'loan_scheme_name', 'sanctionAmount', 'sanctionRate', 'loanTerm', 'classification'];
        
        const rightLabels = ['Sanction Date', 'Inst. Due Date', 'Loan Due Date', 'Inst. Size', 'CL Date', 'Grace Period', 'Inst. Frequency', 'Penalty Rate'];
        const rightIds = ['sanction_date', 'installmentDueDate', 'loanDueDate', 'installmentSize', 'clDate', 'gracePeriod', 'installmentFrequency', 'penaltyRate'];

        let rowOffset = 6;
        for (let i = 0; i < Math.max(leftLabels.length, rightLabels.length); i++) {
            const leftLabel = leftLabels[i] || '';
            let leftVal = '';
            if (leftIds[i]) {
                const el = document.getElementById(leftIds[i]);
                leftVal = el ? el.value : '';
            }

            const rightLabel = rightLabels[i] || '';
            let rightVal = '';
            if (rightIds[i]) {
                const el = document.getElementById(rightIds[i]);
                rightVal = el ? el.value : '';
            }

            ws.getCell(`A${rowOffset}`).value = leftLabel ? leftLabel + ':' : '';
            ws.getCell(`A${rowOffset}`).font = { bold: true };
            ws.getCell(`C${rowOffset}`).value = leftVal;
            
            ws.getCell(`G${rowOffset}`).value = rightLabel ? rightLabel + ':' : '';
            ws.getCell(`G${rowOffset}`).font = { bold: true };
            ws.getCell(`H${rowOffset}`).value = rightVal;
            
            rowOffset++;
        }

        rowOffset += 2; // Space before table

        // 3. Table Headers
        const tableHeaders = ['Sl', 'Date', 'Particulars', 'Amount', 'Debit', 'Penalty', 'Credit', 'Balance', 'Days', 'Rate', 'Interest'];
        const headerRow = ws.getRow(rowOffset);
        headerRow.values = tableHeaders;
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE5E7EB' } // Gray 200 background for headers
            };
        });
        rowOffset++;

        // 4. Table Body
        const tbody = document.getElementById('loanTableBody');
        if (tbody) {
            const trs = tbody.querySelectorAll('tr');
            trs.forEach(tr => {
                const row = ws.getRow(rowOffset);
                const tds = tr.querySelectorAll('td');
                let vals = [];
                tds.forEach((td, index) => {
                    let text = td.innerText.trim();
                    // Col 9 in JS (0-indexed) is Rate, which is colNumber 10 in ExcelJS.
                    if (index === 9) {
                        text = text.replace('%', '').trim();
                    }
                    // For numeric columns (index 3 to 10)
                    if (index >= 3 && index <= 10 && text !== '') {
                        let num = parseFloat(text.replace(/,/g, ''));
                        if (!isNaN(num)) {
                            vals.push(num);
                        } else {
                            vals.push(text);
                        }
                    } else {
                        vals.push(text);
                    }
                });
                row.values = vals;
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'top', wrapText: colNumber === 3 };
                    
                    if (colNumber > 3 && colNumber !== 9 && colNumber !== 10) {
                        cell.alignment.horizontal = 'right';
                    } else if (colNumber === 1 || colNumber === 2 || colNumber === 9 || colNumber === 10) {
                        cell.alignment.horizontal = 'center';
                    }
                    
                    // Col 10 (Rate) format
                    if (colNumber === 10) {
                        cell.numFmt = '0.00'; // 2 decimal places
                    }
                    
                    // Apply shading for inserted rows (capitalization and calc end date rows)
                    if (tr.classList.contains('bg-inserted-row') || tr.classList.contains('bg-gray-200')) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE5E7EB' } // Gray 200 equivalent
                        };
                        cell.font = { bold: true };
                    } else if (tr.querySelector('.font-bold') && !tr.querySelector('.font-bold').parentElement.classList.contains('no-print')) {
                        cell.font = { bold: true };
                    }
                });
                rowOffset++;
            });
        }

        // 5. Generate and Download
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const acNoEl = document.getElementById('deposit_account_no');
        const acNo = acNoEl ? acNoEl.value : 'Report';
        a.download = `Loan_Calculation_${acNo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }



// Populates form fields with customer data from the App Shell
function populate(data) {
    if (!data) return;
    const mapping = {
        'applicant_name_bn': 'applicant_name_bn',
        'applicant_present_address_bn': 'address'
    };
    Object.keys(mapping).forEach(key => {
        const el = document.getElementById(mapping[key]);
        if (el && data[key]) el.value = data[key];
    });
    updateHeaderMeta();
}

// Communication Bridge between App Shell and Calculator Engine
window.addEventListener('message', (event) => {
    const { command, data, action } = event.data;
    if (command === 'FILL') {
        if (window.InterestCalcLogic) window.InterestCalcLogic.populate(data);
    } else if (command === 'EXECUTE_ACTION') {
        if (!window.InterestCalcLogic) return;
        
        // Map action IDs from app-logic.js wireCalculatorButtons() to engine functions
        switch (action) {
            case 'importPrimary': InterestCalcLogic.importData(false, false); break;
            case 'importSecondary': InterestCalcLogic.importData(true, false); break;
            case 'manualInput': InterestCalcLogic.addManualTransactionRow(); break;
            case 'applyPenalty': InterestCalcLogic.applyPenaltyRates(); break;
            case 'calculate': InterestCalcLogic.calculateAndCapitalizeInterest(); break;
            case 'saveReport': InterestCalcLogic.savePrintReport(); break;
            case 'downloadExcel': InterestCalcLogic.downloadExcel(); break;
            case 'clear': InterestCalcLogic.clearAllData(); break;
            case 'updateRates': InterestCalcLogic.showRateChangeModal('rates'); break;
            case 'penaltyRates': InterestCalcLogic.showRateChangeModal('penalty'); break;
            case 'showLoans': InterestCalcLogic.showAvailableLoansModal(); break;
            case 'addLoan': InterestCalcLogic.showAddLoanTypeModal(); break;
        }
    }
});

// Expose functions to the global scope for event listeners and external calls

function showBulkPenaltyModal() {
    if (typeof InterestCalcLogic !== 'undefined') InterestCalcLogic.hideAvailableLoansModal();
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideBulkPenaltyModal() {
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function applyBulkPenaltyRate() {
    const dateInput = document.getElementById('bulkPenaltyDate').value;
    const rateInput = document.getElementById('bulkPenaltyRate').value;
    if (!dateInput || !rateInput) {
        showToast("Please enter both Effective Date and Penalty Rate!", "error");
        return;
    }
    
    if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltySchedule === 'function') {
        const currentRates = window.InterestRateManager.getPenaltySchedule();
        currentRates.push({ dateStr: dateInput, rate: parseFloat(rateInput) });
        // Assuming savePenaltySchedule accepts the array and saves it
        if (typeof window.InterestRateManager.savePenaltySchedule === 'function') {
            window.InterestRateManager.savePenaltySchedule(currentRates);
            hideBulkPenaltyModal();
            showToast(" Global bulk penalty rate applied successfully!");
            // Refresh table if needed
            if (typeof refreshPenaltyManagerTable === 'function') refreshPenaltyManagerTable();
            if (typeof applyRatesAndRecalculate === 'function') applyRatesAndRecalculate();
        } else {
            console.error("savePenaltySchedule not found in InterestRateManager!");
        }
    } else {
        console.error("InterestRateManager or getPenaltySchedule not found!");
    }
}


function showBulkPenaltyModal() {
    if (typeof InterestCalcLogic !== 'undefined') InterestCalcLogic.hideAvailableLoansModal();
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideBulkPenaltyModal() {
    const modal = document.getElementById('bulkPenaltyUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function applyBulkPenaltyRate() {
    const dateInput = document.getElementById('bulkPenaltyDate').value;
    const rateInput = document.getElementById('bulkPenaltyRate').value;
    if (!dateInput || !rateInput) {
        showToast("Please enter both Effective Date and Penalty Rate!", "error");
        return;
    }
    
    if (window.InterestRateManager && typeof window.InterestRateManager.getPenaltySchedule === 'function') {
        const currentRates = window.InterestRateManager.getPenaltySchedule();
        currentRates.push({ dateStr: dateInput, rate: parseFloat(rateInput) });
        if (typeof window.InterestRateManager.savePenaltySchedule === 'function') {
            window.InterestRateManager.savePenaltySchedule(currentRates);
            hideBulkPenaltyModal();
            showToast(" Global bulk penalty rate applied successfully!");
            if (typeof refreshPenaltyManagerTable === 'function') refreshPenaltyManagerTable();
            if (typeof applyRatesAndRecalculate === 'function') applyRatesAndRecalculate();
        } else {
            console.error("savePenaltySchedule not found in InterestRateManager!");
        }
    } else {
        console.error("InterestRateManager or getPenaltySchedule not found!");
    }
}
return {
    // Exposed properties
    loanTypeMap: loanTypeMap,
    capitalizationMap: capitalizationMap,
    loanCategoryMap: loanCategoryMap,
    loanStructureMap: loanStructureMap,
    penaltyExemptLoanTypes: penaltyExemptLoanTypes,
    fixedTermLoanRates: fixedTermLoanRates,
    interestRateHistory: interestRateHistory,
    penaltyState: penaltyState,
    isAutoRecalcActive: isAutoRecalcActive,
    penaltyExemptLoanTypes: penaltyExemptLoanTypes,
    loanStructureMap: loanStructureMap,

    // Exposed functions
    openDatabase: openDatabase,
    parseDateFromDisplay: parseDateFromDisplay,
    determineClassification: determineClassification,
    formatRate: formatRate,
    showCalculationMethodModal: showCalculationMethodModal,
    updateRatesForManualEntry: updateRatesForManualEntry,
    hideRateChangeModal: hideRateChangeModal,
    showInstallmentModal: showInstallmentModal,
    hideInstallmentModal: hideInstallmentModal,
    saveInstallmentDataAndContinue: saveInstallmentDataAndContinue,
    cancelAndContinue: cancelAndContinue,
    showAvailableLoansModal: showAvailableLoansModal,
    showBulkRateUpdateModal: showBulkRateUpdateModal,
    hideBulkRateUpdateModal: hideBulkRateUpdateModal,
showBulkPenaltyModal: showBulkPenaltyModal,
hideBulkPenaltyModal: hideBulkPenaltyModal,
applyBulkPenaltyRate: applyBulkPenaltyRate,
    downloadBulkRatesTemplate: downloadBulkRatesTemplate,
    parseBulkRatesExcel: parseBulkRatesExcel,
    applyBulkRates: applyBulkRates,
    filterAvailableLoansTable: filterAvailableLoansTable,
    addNewLoanFromViewLoans: addNewLoanFromViewLoans,
    editProductFromViewLoans: editProductFromViewLoans,
    goBackToPreviousModal: goBackToPreviousModal,
    openViewLoansFromConfigurator: openViewLoansFromConfigurator,
    hideAvailableLoansModal: hideAvailableLoansModal,
    handleNewLoanRateTypeChange: handleNewLoanRateTypeChange,
    handleNewLoanGroupChange: handleNewLoanGroupChange,
    showAddLoanTypeModal: showAddLoanTypeModal,
    hideAddLoanTypeModal: hideAddLoanTypeModal,
    saveNewLoanType: saveNewLoanType,
    selectCalculationMethod: selectCalculationMethod,
    addManualTransactionRow: addManualTransactionRow,
    processAndDisplayData: processAndDisplayData,
    importData: importData,
    recalculateTable: recalculateTable,
    applyPenaltyRates: applyPenaltyRates,
    calculateAndCapitalizeInterest: calculateAndCapitalizeInterest,
    showRateChangeModal: showRateChangeModal,
    hideRateChangeModal: hideRateChangeModal,
    saveRateChange: saveRateChange,
    toggleAddProductMode: toggleAddProductMode,
    editSelectedProduct: editSelectedProduct,
    saveNewProduct: saveNewProduct,
    hideAddLoanProductModal: hideAddLoanProductModal,
    toggleAddLoanRatesTable: toggleAddLoanRatesTable,
    appendAddLoanRateRow: appendAddLoanRateRow,
    saveNewDedicatedProduct: saveNewDedicatedProduct,
    downloadAddLoanRatesTemplate: downloadAddLoanRatesTemplate,
    handleAddLoanRatesUpload: handleAddLoanRatesUpload,
    deleteSelectedProduct: deleteSelectedProduct,
    importRatesFromExcel: importRatesFromExcel,
    updateRateState: updateRateState,
    deleteRateRow: deleteRateRow,
    addRateRow: addRateRow,
    saveRateManager: saveRateManager,
    refreshRateManagerTable: refreshRateManagerTable,
    switchRateModalTab: switchRateModalTab,
    refreshPenaltyManagerTable: refreshPenaltyManagerTable,
    addPenaltyRow: addPenaltyRow,
    deletePenaltyRow: deletePenaltyRow,
    updatePenaltyState: updatePenaltyState,
    populatePenaltyLoanSelector: populatePenaltyLoanSelector,
    refreshPenaltyLoanStatus: refreshPenaltyLoanStatus,
    toggleCurrentLoanPenaltyExemption: toggleCurrentLoanPenaltyExemption,
    savePenaltyManager: savePenaltyManager,
    resetDefaultPenaltySchedule: resetDefaultPenaltySchedule,
    quickAddPenaltyEntry: quickAddPenaltyEntry,
    updatePenaltyField: updatePenaltyField,
    isPenaltyExempt: isPenaltyExempt,
    savePrintReport: savePrintReport,
    updateHeaderMeta: updateHeaderMeta,
    showCalculationMethodModal: showCalculationMethodModal,
    clearAllData: clearAllData,
    rebuildTable: rebuildTable,
    showToast: showToast,
    showMessageBox: showMessageBox,
    hideMessageBox: hideMessageBox,
    populate: populate,
    downloadExcel: downloadExcel,
    log: console.log // Expose console.log for internal debugging if needed
};
})();

// Event listeners & initial setup (outside the IIFE to attach to DOM elements)
function initInterestCalculator() {
    InterestCalcLogic.showCalculationMethodModal();
    
    // Auto-recalculation on table edit
    let debounceTimer;
    function handleTableEdit(event) {
        if (!InterestCalcLogic.isAutoRecalcActive) return;
        let target = event.target;

        while (target && target.tagName !== 'TD' && target.id !== 'loanTableBody') {
            target = target.parentNode;
        }
        if (target && target.tagName === 'TD' && target.isContentEditable) {
            const cellIndex = target.cellIndex;
            if ([3, 4, 5, 6, 7].includes(cellIndex)) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => InterestCalcLogic.calculateAndCapitalizeInterest(true), 750);
            } else if (cellIndex === 1) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => { InterestCalcLogic.updateRatesForManualEntry(); InterestCalcLogic.calculateAndCapitalizeInterest(true); }, 750);
            }
        }
    }
    const tableBodyEl = document.getElementById('loanTableBody');
    if (tableBodyEl) tableBodyEl.addEventListener('input', handleTableEdit);

    const gracePeriodInput = document.getElementById('gracePeriod');
    if (gracePeriodInput) {
        gracePeriodInput.addEventListener('blur', () => {
            const v = (gracePeriodInput.value || '').trim();
            if (v && !/months?$/i.test(v)) gracePeriodInput.value = v + ' Months';
        });
    }

    const loanSchemeInput = document.getElementById('loan_scheme_name');
    if (loanSchemeInput) {
        ['input', 'change', 'blur'].forEach(evt => {
            loanSchemeInput.addEventListener(evt, () => {
                InterestCalcLogic.updatePenaltyField(loanSchemeInput.value);
            });
        });
    }
    InterestCalcLogic.updatePenaltyField();

    const calcEndDateInputForClass = document.getElementById('calcEndDate');
    if (calcEndDateInputForClass) {
        calcEndDateInputForClass.addEventListener('change', () => {
            const dateParts = calcEndDateInputForClass.value.split('-');
            const calcEndDateForClass = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
            const loanDueDateForClass = InterestCalcLogic.parseDateFromDisplay(document.getElementById('loanDueDate').value);
            document.getElementById('classification').value = InterestCalcLogic.determineClassification(calcEndDateForClass, loanDueDateForClass);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInterestCalculator);
} else {
    initInterestCalculator();
}

// Number to Words Converter for Summary
function convertNumberToWords(amount) {
    var words = new Array();
    words[0] = ''; words[1] = 'One'; words[2] = 'Two'; words[3] = 'Three'; words[4] = 'Four';
    words[5] = 'Five'; words[6] = 'Six'; words[7] = 'Seven'; words[8] = 'Eight'; words[9] = 'Nine';
    words[10] = 'Ten'; words[11] = 'Eleven'; words[12] = 'Twelve'; words[13] = 'Thirteen'; words[14] = 'Fourteen';
    words[15] = 'Fifteen'; words[16] = 'Sixteen'; words[17] = 'Seventeen'; words[18] = 'Eighteen'; words[19] = 'Nineteen';
    words[20] = 'Twenty'; words[30] = 'Thirty'; words[40] = 'Forty'; words[50] = 'Fifty';
    words[60] = 'Sixty'; words[70] = 'Seventy'; words[80] = 'Eighty'; words[90] = 'Ninety';
    amount = amount.toString();
    var atemp = amount.split(".");
    var number = atemp[0].split(",").join("");
    var n_length = number.length;
    var words_string = "";
    if (n_length <= 9) {
        var n_array = new Array(0, 0, 0, 0, 0, 0, 0, 0, 0);
        var received_n_array = new Array();
        for (var i = 0; i < n_length; i++) {
            received_n_array[i] = number.substr(i, 1);
        }
        for (var i = 9 - n_length, j = 0; i < 9; i++, j++) {
            n_array[i] = received_n_array[j];
        }
        for (var i = 0, j = 1; i < 9; i++, j++) {
            if (i == 0 || i == 2 || i == 4 || i == 7) {
                if (n_array[i] == 1) {
                    n_array[j] = 10 + parseInt(n_array[j]);
                    n_array[i] = 0;
                }
            }
        }
        value = "";
        for (var i = 0; i < 9; i++) {
            if (i == 0 || i == 2 || i == 4 || i == 7) {
                value = n_array[i] * 10;
            } else {
                value = n_array[i];
            }
            if (value != 0) {
                words_string += words[value] + " ";
            }
            if ((i == 1 && value != 0) || (i == 0 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Crore ";
            }
            if ((i == 3 && value != 0) || (i == 2 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Lakh ";
            }
            if ((i == 5 && value != 0) || (i == 4 && value != 0 && n_array[i + 1] == 0)) {
                words_string += "Thousand ";
            }
            if (i == 6 && value != 0 && (n_array[i + 1] != 0 && n_array[i + 2] != 0)) {
                words_string += "Hundred and ";
            } else if (i == 6 && value != 0) {
                words_string += "Hundred ";
            }
        }
        words_string = words_string.split("  ").join(" ");
    }
    return words_string.trim();
}
window.convertNumberToWords = convertNumberToWords;

function updateCalculationSummary() {
    const tableBody = document.getElementById('loanTableBody');
    if (!tableBody || tableBody.rows.length === 0) return;

    let finalBalance = 0;
    let finalDate = '';
    let totalAmount = 0; // The standard Dr
    let totalDr = 0; // The interest/capitalized Dr
    let totalCr = 0;
    let totalPenalty = 0;

    const rows = tableBody.rows;
    let lastDataRow = null;

    // Remove old total row/tfoot if it exists
    let tfoot = document.getElementById('loanTableFoot');
    if (tfoot) tfoot.remove();
    
    // We create a tfoot so it doesn't interfere with tableBody.rows
    const table = document.getElementById('loanTableBody').parentNode;
    tfoot = document.createElement('tfoot');
    tfoot.id = 'loanTableFoot';
    
    const totalRow = document.createElement('tr');
    totalRow.id = 'total-row';
    totalRow.classList.add('bg-purple-50', 'font-bold', 'text-purple-900', 'border-t-2', 'border-purple-300');
    
    let combinedDr = Math.round(totalAmount + totalDr);
    
    totalRow.innerHTML = `
        <td colspan="11" class="p-3 border border-purple-200">
            <div class="flex flex-col gap-2">
                <!-- Top Row: Sums -->
                <div class="flex flex-wrap gap-4 items-center justify-start text-sm">
                    <span><span class="text-gray-600">Total Dr:</span> ${combinedDr.toLocaleString('en-IN')}</span>
                    <span class="text-gray-300">|</span>
                    <span><span class="text-gray-600">Cr:</span> ${Math.round(totalCr).toLocaleString('en-IN')}</span>
                    <span class="text-gray-300">|</span>
                    <span><span class="text-gray-600">Other Dr (Penalty):</span> <span class="text-red-600">${Math.round(totalPenalty).toLocaleString('en-IN')}</span></span>
                    <span class="text-gray-300">|</span>
                    <span class="text-lg"><span class="text-gray-600 text-sm">Balance:</span> <span class="text-purple-700">${Math.round(finalBalance).toLocaleString('en-IN')}</span></span>
                </div>
                
                <!-- Bottom Row: Comments -->
                <div class="text-sm italic text-gray-700 bg-white p-2 rounded border border-purple-100">
                    <div class="font-bold text-purple-800 mb-1">Total Due: ${Math.round(finalBalance).toLocaleString('en-IN')} as of ${finalDate}</div>
                    <div>In words: ${wordsText} Taka Only.</div>
                    <div class="text-xs mt-1 text-gray-500">This calculation is subject to interest rate, penalty rate, and calculation date.</div>
                </div>
            </div>
        </td>
    `;
    
    tfoot.appendChild(totalRow);
    table.appendChild(tfoot);
}
window.updateCalculationSummary = updateCalculationSummary;

function cleanParticulars(text) {
    if (!text) return "";
    let cleaned = text.trim();
    
    // 1. Remove anything from "Batch" to the end of the line
    // This matches "Batch", "Batch-", "Batch 123", etc.
    cleaned = cleaned.replace(/(?:^|\s)batch[- :]*.*$/i, '').trim();
    
    // 2. Remove duplicate consecutive phrases (e.g., "Excise Duty Excise Duty" -> "Excise Duty")
    // This regex finds any word or sequence of words that repeats immediately
    cleaned = cleaned.replace(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+\1\b/gi, '$1').trim();
    
    // 3. Clean up trailing hyphens or weird spaces
    cleaned = cleaned.replace(/[- \s]+$/, '').trim();
    
    return cleaned;
}
