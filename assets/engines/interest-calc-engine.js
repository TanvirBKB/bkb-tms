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

// ---- Load Custom Loan Products from Database ----
try {
    const ipc = (window.require && window.require('electron')) ? window.require('electron').ipcRenderer : null;
    if (ipc) {
        let customProductsRaw = ipc.sendSync('db-get-kv', 'custom_loan_products');
        let customProducts = null;
        if (typeof customProductsRaw === 'string') {
            try { customProducts = JSON.parse(customProductsRaw); } catch(e) {}
        } else if (customProductsRaw && typeof customProductsRaw === 'object') {
            customProducts = customProductsRaw;
        }

        if (customProducts && typeof customProducts === 'object') {
            Object.keys(customProducts).forEach(code => {
                const prod = customProducts[code];
                if (prod && prod.name) {
                    loanTypeMap[code] = prod.name;
                    if (prod.category) loanCategoryMap[prod.name] = prod.category;
                    if (prod.capitalization) capitalizationMap[prod.name] = prod.capitalization.toLowerCase();
                }
            });
        }
    }
} catch (e) {
    console.warn("Failed to load custom loan products:", e);
}
// --------------------------------------------------

// This map determines if a loan has a fixed term for installment calculations.
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
function showAvailableLoansModal() {
    const tableBody = document.getElementById('availableLoansTableBody');
    tableBody.innerHTML = ''; // Clear existing content

    // Get loan heads and sort them numerically
    const loanHeads = Object.keys(loanTypeMap).sort((a, b) => a - b);

    let rowsHtml = '';
    let slNo = 1;
    loanHeads.forEach(head => {
        const loanName = loanTypeMap[head];
        rowsHtml += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-1 py-2 text-center">${slNo++}</td>
                <td class="px-2 py-2 font-medium text-gray-900">${head}</td>
                <td class="px-2 py-2">${loanName}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;

    document.getElementById('availableLoansModal').classList.remove('hidden');
    document.getElementById('availableLoansModal').classList.add('flex');
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
    document.getElementById('calculationMethodModal').classList.remove('hidden');
    document.getElementById('calculationMethodModal').classList.add('flex');
}

function hideCalculationMethodModal() {
    document.getElementById('calculationMethodModal').classList.add('hidden');
    document.getElementById('calculationMethodModal').classList.remove('flex');
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
        showPenalty: true,
        penaltyLabel: 'Apply Penalty'
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

        document.getElementById('branch_name').value = metaIndices.branch !== -1 ? getCellValue(dataRowIndex, metaIndices.branch) : getCellValue(dataRowIndex, 0); 
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

        // Determine Loan Type
        let loanTypeVal = '';
        if (metaIndices.glHead !== -1) {
            const glCode = String(getCellValue(9, metaIndices.glHead)).trim();
            loanTypeVal = loanTypeMap[glCode] || glCode;
        } else {
            const hyphenIndex = accountNumber.indexOf('-');
            if (hyphenIndex > -1 && accountNumber.length >= hyphenIndex + 5) {
                const loanCode = accountNumber.substr(hyphenIndex + 1, 4);
                loanTypeVal = loanTypeMap[loanCode] || 'Unknown Loan Type';
            }
        }
        document.getElementById('loan_scheme_name').value = loanTypeVal;

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
        const endDate = new Date(document.getElementById('calcEndDate').value);

        // 1. Get Capitalization Dates
        const capFrequency = capitalizationMap[loanType];
        if (capFrequency) { // Check if capFrequency is defined
            const capDates = [];
            let currentDate = new Date(startDate.getTime()); // UTC copy
            while (currentDate <= endDate) { // Loop until current date exceeds end date
                let month = currentDate.getUTCMonth();
                let year = currentDate.getUTCFullYear();
                let capitalizationDate = null;
                if (capFrequency === 'monthly') capitalizationDate = new Date(Date.UTC(year, month + 1, 0));
                else if (capFrequency === 'quarterly') { if ([2, 5, 8, 11].includes(month)) capitalizationDate = new Date(Date.UTC(year, month + 1, 0)); } // March, June, Sep, Dec
                else if (capFrequency === 'yearly') { if (month === 5) capitalizationDate = new Date(Date.UTC(year, 6, 0)); } // June 30

                if (capitalizationDate && capitalizationDate >= startDate && capitalizationDate <= endDate) {
                    if (!capDates.some(d => d.getTime() === capitalizationDate.getTime())) capDates.push(capitalizationDate);
                } // Add capitalization date if it's within the range and not already present
                currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
            }
            capDates.forEach(date => {
            const dateExists = allRowsData.some(r => r.date && r.date.getTime() === date.getTime());
            if (!dateExists) allRowsData.push({ date: date, particulars: 'Interest Capitalization', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
            else {
                const match = allRowsData.find(r => r.date && r.date.getTime() === date.getTime());
                if (match) match.isCapitalization = true;
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
    const endDate = new Date(document.getElementById('calcEndDate').value);

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

    const loanTypeUpper = document.getElementById('loan_scheme_name').value.toUpperCase().trim();
    const fixedRate = fixedTermLoanRates[loanTypeUpper];
    const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;
    const loanDueDateForRates = parseDateFromDisplay(document.getElementById('loanDueDate').value);
    const rateChanges = interestRateHistory[loanTypeUpper];

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
        row.cells[9].innerText = formatRate(applicableRate);
    }
}

function importData(append = false, ignoreStartDate = false) {
  const calcStartDateInput=document.getElementById('calcStartDate');
  const calcEndDateInput=document.getElementById('calcEndDate');
  let isValid=true;
  const isDateInvalid = (input) => !input.value || isNaN(new Date(input.value).getTime());

  if(!ignoreStartDate && isDateInvalid(calcStartDateInput)){
    calcStartDateInput.classList.add('border-red-500');
    isValid=false;
  } else {
    calcStartDateInput.classList.remove('border-red-500');
  }

  if(isDateInvalid(calcEndDateInput)){
    calcEndDateInput.classList.add('border-red-500');
    isValid=false;
  } else {
    calcEndDateInput.classList.remove('border-red-500');
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
        const tableBody = document.getElementById('loanTableBody');
        const rows = tableBody.rows;
        if (rows.length === 0) return;

        // --- Step 1: Read all data from the DOM into a structured array ---
        const tableData = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
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
            row.cells[7].innerText = data.balance > 0 ? data.balance : "";
            // Leave last row's calculation columns blank
            if (i === rows.length - 1) { // Last row has 0 days
                row.cells[8].innerText = "";
                row.cells[9].innerText = "";
            } else {
                row.cells[8].innerText = String(data.days);
                row.cells[9].innerText = typeof data.rate === 'number' ? formatRate(data.rate) : "";
            }
        }
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

    if (penaltyExemptLoanTypes.includes(loanType.toUpperCase().trim())) {
        showMessageBox("Penalty is not applicable for this loan type.", true);
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
    const amount = Math.round(loanDetails.installmentSize * (loanDetails.penaltyRate / 100));
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
        calcStartDateInput.classList.add('border-red-500');
        return;
    }
    const userCalcStartDate = new Date(calcStartDateInput.value);

    const firstRowDate = tableBody.rows.length > 0 ? parseDateFromDisplay(tableBody.rows[0].cells[1].innerText) : null;
    
    // The calculation should not begin before the first piece of data in the table.
    const calcStartDate = (firstRowDate && firstRowDate > userCalcStartDate) ? firstRowDate : userCalcStartDate;

    const calcEndDateInput = document.getElementById('calcEndDate');
    calcEndDateInput.classList.remove('border-red-500');
    if (!calcEndDateInput.value || isNaN(new Date(calcEndDateInput.value))) {
        showMessageBox("Please provide a valid Calculation End Date.", true);
        calcEndDateInput.classList.add('border-red-500');
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
            // Apply penalty rate only from penaltyStartDate onwards (after grace period)
            if (data.date >= penaltyStartDate && !data.isPenaltyExempt) {
                const originalRate = data.rate;
                if (originalRate != null) {
                    data.rate = originalRate + loanDetails.penaltyRate;
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
    
    // Robust lookup: check Name, then Code, then Case-insensitive
    let capFrequency = capitalizationMap[loanInputVal];
    if (!capFrequency) {
        // Try to find the name if input is a GL code
        const resolvedName = loanTypeMap[loanInputVal];
        if (resolvedName) capFrequency = capitalizationMap[resolvedName];
    }
    if (!capFrequency) {
        // Case-insensitive fallback
        const upperVal = loanInputVal.toUpperCase();
        const matchedKey = Object.keys(capitalizationMap).find(k => k.toUpperCase() === upperVal);
        if (matchedKey) capFrequency = capitalizationMap[matchedKey];
    }
    
    if (capFrequency) {
        const capDates = [];
        let cursor = new Date(Date.UTC(effectiveCapStart.getUTCFullYear(), effectiveCapStart.getUTCMonth(), 1));
        
        while (cursor <= endDate) {
            let month = cursor.getUTCMonth();
            let year = cursor.getUTCFullYear();
            let targetDate = null;
            
            if (capFrequency === 'monthly') targetDate = new Date(Date.UTC(year, month + 1, 0));
            else if (capFrequency === 'quarterly') { if ([2, 5, 8, 11].includes(month)) targetDate = new Date(Date.UTC(year, month + 1, 0)); }
            else if (capFrequency === 'yearly') { if (month === 5) targetDate = new Date(Date.UTC(year, 6, 0)); }

            if (targetDate && targetDate >= effectiveCapStart && targetDate <= endDate) {
                if (!capDates.some(d => d.getTime() === targetDate.getTime())) capDates.push(targetDate);
            }
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        
        capDates.forEach(date => {
            const exists = allRowsData.some(r => r.date && r.date.getTime() === date.getTime());
            if (!exists) {
                allRowsData.push({ date: date, particulars: 'Interest Capitalization', isCapitalization: true, amount: 0, debit: 0, penalty: 0, credit: 0, balance: 0 });
            } else {
                const match = allRowsData.find(r => r.date && r.date.getTime() === date.getTime());
                match.isCapitalization = true;
                if (!match.particulars) match.particulars = 'Interest Capitalization';
            }
        });
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

    // 4b. Apply correct Interest Rates to all rows (The "Between dates" logic)
    const fixedRate = fixedTermLoanRates[loanInputVal.toUpperCase().trim()];
    const sanctionRate = parseFloat(String(document.getElementById('sanctionRate').value).replace(/[^\d.]/g, '')) || 0;
    const loanDueDateForRates = parseDateFromDisplay(document.getElementById('loanDueDate').value);

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
            const balance = parseFloat(row.cells[7].innerText) || 0;
            const days = parseInt(row.cells[8].innerText) || 0;
            const rate = parseFloat(String(row.cells[9].innerText).replace('%', '')) || 0;
            let currentInterest = 0;
            if (days > 0 && rate > 0 && balance > 0) {
                currentInterest = Math.round(balance * rate * days / 36000);
            }
            row.cells[10].innerText = currentInterest; // Update interest cell
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
    if (activeRows.length > 0) activeRows[activeRows.length - 1].cells[10].innerText = "";

    // 4. Add a total row at the end of the table
    let totalAmount = 0, totalDebit = 0, totalCredit = 0;
    for (let i = 0; i < activeRows.length; i++) {
        const row = activeRows[i];
        totalAmount += parseFloat(row.cells[3].innerText) || 0;
        totalDebit += parseFloat(row.cells[4].innerText) || 0;
        totalCredit += parseFloat(row.cells[6].innerText) || 0;
    }

    const totalRow = document.createElement('tr');
    totalRow.id = 'total-row';
    totalRow.classList.add('bg-gray-200', 'font-bold');
    totalRow.innerHTML = `
        <td colspan="3" class="p-2 border border-gray-400 text-right">Total</td>
        <td class="p-2 border border-gray-400 text-center">${totalAmount > 0 ? Math.round(totalAmount) : ''}</td>
        <td class="p-2 border border-gray-400 text-center">${totalDebit > 0 ? Math.round(totalDebit) : ''}</td>
        <td class="p-2 border border-gray-400 text-center"></td>
        <td class="p-2 border border-gray-400 text-center">${totalCredit > 0 ? Math.round(totalCredit) : ''}</td>
        <td class="p-2 border border-gray-400 text-center"></td>
        <td colspan="3" class="p-2 border border-gray-400"></td>
    `;
    tableBody.appendChild(totalRow);

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
            document.getElementById('newProductCap').value = 'Monthly';
            document.getElementById('newProductExcelFile').value = '';
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
    const cap = document.getElementById('newProductCap').value;

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
            
            customProducts[code] = { name: name, category: cat, capitalization: cap };
            ipc.sendSync('db-set-kv', 'custom_loan_products', customProducts);
            
            // Update in-memory maps
            loanTypeMap[code] = name;
            loanCategoryMap[name] = cat;
            capitalizationMap[name] = cap.toLowerCase();
            
            // If rates were imported via Excel (or migrated from edit), save them too!
            let ratesSavedMsg = '';
            if (currentRateManagerState.length > 0) {
                if (window.InterestRateManager && typeof InterestRateManager.overwriteCustomRates === 'function') {
                    InterestRateManager.overwriteCustomRates(name, currentRateManagerState);
                    interestRateHistory[name] = currentRateManagerState.map(r => ({ date: new Date(r.dateStr), rate: parseFloat(r.rate) }));
                    interestRateHistory[name].sort((a, b) => a.date - b.date);
                    interestRateHistory[code] = interestRateHistory[name];
                    ratesSavedMsg = ` and ${currentRateManagerState.length} rates`;
                }
            }

            InterestCalcLogic.showMessageBox(`Loan Product "${name}"${ratesSavedMsg} saved successfully!`);
            
            // Re-populate dropdown and select it
            populateProductDropdown();
            document.getElementById('rateManagerLoanSelector').value = name;
            
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
        InterestCalcLogic.showMessageBox('Please select a Loan Product to delete.', true);
        return;
    }

    if (confirm(`Are you sure you want to completely delete the product '${productName}' and its rate history? This cannot be undone.`)) {
        try {
            const ipc = (window.require && window.require('electron')) ? window.require('electron').ipcRenderer : null;
            if (ipc) {
                // Delete from custom products DB
                let customProductsRaw = ipc.sendSync('db-get-kv', 'custom_loan_products');
                let customProducts = {};
                if (typeof customProductsRaw === 'string') {
                    try { customProducts = JSON.parse(customProductsRaw); } catch(e) {}
                } else if (customProductsRaw && typeof customProductsRaw === 'object') {
                    customProducts = customProductsRaw;
                }
                
                let foundCode = Object.keys(customProducts).find(code => customProducts[code].name === productName);
                if (foundCode) {
                    delete customProducts[foundCode];
                    ipc.sendSync('db-set-kv', 'custom_loan_products', customProducts);
                }
                
                // Remove from in-memory maps
                let mapCode = Object.keys(loanTypeMap).find(code => loanTypeMap[code] === productName);
                if (mapCode) delete loanTypeMap[mapCode];
                if (loanCategoryMap[productName]) delete loanCategoryMap[productName];
                if (capitalizationMap[productName]) delete capitalizationMap[productName];

                // Delete its rate history
                if (window.InterestRateManager && typeof InterestRateManager.overwriteCustomRates === 'function') {
                    InterestRateManager.overwriteCustomRates(productName, []); // clear it out from DB
                    delete interestRateHistory[productName];
                    if (mapCode) delete interestRateHistory[mapCode];
                }

                InterestCalcLogic.showMessageBox(`Loan Product "${productName}" has been deleted.`);
                populateProductDropdown();
                document.getElementById('rateManagerLoanSelector').value = '';
                refreshRateManagerTable();
            } else {
                InterestCalcLogic.showMessageBox('Database connection unavailable.', true);
            }
        } catch (e) {
            InterestCalcLogic.showMessageBox('Error deleting product.', true);
            console.error(e);
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
}

function showRateChangeModal() {
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
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    refreshRateManagerTable();
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
    if (input.id === 'penaltyRate') { // Keep default penalty rate
      input.value = '1.50 %';
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

function downloadExcel() {
    const wb = XLSX.utils.book_new();
    const ws_name = "Loan Calculation";
    let data = [];

    // --- 1. Header ---
    data.push(["Bangladesh Krishi Bank"]);
    data.push(["Default Loan Calculator"]);
    data.push([]); // Spacer

    // --- 2. Form Data (two-column layout) ---
    const formDetailsContainer = document.getElementById('loanDetailsForm');
    const formDivs = Array.from(formDetailsContainer.children).filter(child => !child.classList.contains('hidden'));
    
    const allFormItems = formDivs.map(div => {
        const label = div.querySelector('label');
        const input = div.querySelector('input, select');
        if (label && input) {
            return { label: label.innerText.trim(), value: input.value };
        }
        return null;
    }).filter(Boolean);

    const half = Math.ceil(allFormItems.length / 2);

    for (let i = 0; i < half; i++) {
        const leftItem = allFormItems[i];
        const rightItem = allFormItems[i + half];
        const row = [];

        row.push(leftItem ? leftItem.label : '', leftItem ? leftItem.value : '');
        row.push(''); // Spacer column
        row.push(rightItem ? rightItem.label : '', rightItem ? rightItem.value : '');
        
        data.push(row);
    }
    
    data.push([]); // Spacer

    const ws = XLSX.utils.aoa_to_sheet(data);

    // --- 3. Table Data ---
    const table = document.getElementById('loanTable');
    if (table) {
        XLSX.utils.sheet_add_dom(ws, table, { origin: -1 });
    }

    // --- 4. Page Setup & Styling ---
    ws['!pageSetup'] = {
        paperSize: 5, // Legal
        orientation: "portrait",
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        fitToWidth: 1
    };

    ws['!cols'] = [ {wch:25}, {wch:20}, {wch:5}, {wch:25}, {wch:20} ];

    XLSX.utils.book_append_sheet(wb, ws, ws_name);
    XLSX.writeFile(wb, 'Interest_Calculator_Report.xlsx');
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
            case 'clear': InterestCalcLogic.clearAllData(); break;
            case 'updateRates': InterestCalcLogic.showRateChangeModal(); break;
            case 'showLoans': InterestCalcLogic.showAvailableLoansModal(); break;
            case 'addLoan': InterestCalcLogic.showAddLoanTypeModal(); break;
        }
    }
});

// Expose functions to the global scope for event listeners and external calls
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
    deleteSelectedProduct: deleteSelectedProduct,
    importRatesFromExcel: importRatesFromExcel,
    updateRateState: updateRateState,
    deleteRateRow: deleteRateRow,
    addRateRow: addRateRow,
    saveRateManager: saveRateManager,
    refreshRateManagerTable: refreshRateManagerTable,
    savePrintReport: savePrintReport,
    updateHeaderMeta: updateHeaderMeta,
    showCalculationMethodModal: showCalculationMethodModal,
    clearAllData: clearAllData,
    rebuildTable: rebuildTable,
    showMessageBox: showMessageBox,
    hideMessageBox: hideMessageBox,
    populate: populate,
    downloadExcel: downloadExcel,
    log: console.log // Expose console.log for internal debugging if needed
};
})();

// Event listeners (outside the IIFE to attach to DOM elements)
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar buttons are removed; shell now triggers logic via postMessage
    // The message listener is now outside the IIFE, so it should be fine.
    // The DOMContentLoaded listener in the HTML file is removed, so this is the only one.
    // This ensures InterestCalcLogic is fully defined before being called.
    InterestCalcLogic.showCalculationMethodModal();
    // Auto-recalculation on table edit
    let debounceTimer;
    function handleTableEdit(event) {
        if (!InterestCalcLogic.isAutoRecalcActive) return;
        let target = event.target;

        // Traverse up to find the TD if the target is a text node or inner element
        while (target && target.tagName !== 'TD' && target.id !== 'loanTableBody') {
            target = target.parentNode;
        }
        // Ensure we're editing a TD cell and it's one of the financial columns
        if (target && target.tagName === 'TD' && target.isContentEditable) {
            const cellIndex = target.cellIndex;
            // Trigger columns: Amount(3), Debit(4), Penalty(5), Credit(6), Balance(7)
            if ([3, 4, 5, 6, 7].includes(cellIndex)) { // Financial columns
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => InterestCalcLogic.calculateAndCapitalizeInterest(true), 750); // Recalculate after 750ms of inactivity
            } else if (cellIndex === 1) { // Date column
                clearTimeout(debounceTimer);
                // Update rates after a brief pause, then recalculate everything
                debounceTimer = setTimeout(() => { InterestCalcLogic.updateRatesForManualEntry(); InterestCalcLogic.calculateAndCapitalizeInterest(true); }, 750);
            }
        }
    }
    document.getElementById('loanTableBody').addEventListener('input', handleTableEdit);

    const gracePeriodInput=document.getElementById('gracePeriod');
    gracePeriodInput.addEventListener('blur',()=>{
      const v=(gracePeriodInput.value||'').trim();
      if(v && !/months?$/i.test(v)) gracePeriodInput.value=v+' Months';
    });
    const penaltyRateInput = document.getElementById('penaltyRate');
    penaltyRateInput.addEventListener('blur', () => {
        let val = parseFloat(String(penaltyRateInput.value).replace(/[^\d.]/g, '')) || 0;
        penaltyRateInput.value = InterestCalcLogic.formatRate(val);
    });
    const calcEndDateInputForClass = document.getElementById('calcEndDate');
    calcEndDateInputForClass.addEventListener('change', () => {
        // Parse as UTC to match other date logic
        const dateParts = calcEndDateInputForClass.value.split('-');
        const calcEndDateForClass = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        const loanDueDateForClass = InterestCalcLogic.parseDateFromDisplay(document.getElementById('loanDueDate').value);
        document.getElementById('classification').value = InterestCalcLogic.determineClassification(calcEndDateForClass, loanDueDateForClass);
    });
});