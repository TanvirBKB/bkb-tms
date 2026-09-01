/**
 * InterestRateManager - Shared, central interest rate & dynamic penalty database.
 * Consumed by: Interest Calculator + CMSME Loan Form.
 * User-added custom rates and penalty rules are permanently saved in the app DB (db-set-kv)
 * and merged at runtime, so every form always sees the latest rates & settings.
 */
window.InterestRateManager = (function () {

    /* ---- Base rate histories ---- */

    var ccH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1991-07-01'),rate:15},
        {date:new Date('1991-12-01'),rate:14},{date:new Date('1992-07-01'),rate:15},
        {date:new Date('1993-02-01'),rate:14.5},{date:new Date('1993-07-01'),rate:14},
        {date:new Date('1994-01-01'),rate:13},{date:new Date('1994-07-01'),rate:12.5},
        {date:new Date('1995-01-01'),rate:13},{date:new Date('1995-07-01'),rate:14},
        {date:new Date('1996-01-01'),rate:13},{date:new Date('1996-02-01'),rate:15},
        {date:new Date('1996-07-01'),rate:15},{date:new Date('2003-07-01'),rate:16},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:10},
        {date:new Date('2004-07-01'),rate:9},  {date:new Date('2006-01-01'),rate:10},
        {date:new Date('2006-08-06'),rate:12},{date:new Date('2007-07-01'),rate:13},
        {date:new Date('2018-08-09'),rate:9}, {date:new Date('2023-07-01'),rate:10.10},
        {date:new Date('2024-05-20'),rate:13.00},{date:new Date('2025-04-01'),rate:13.75}
    ];

    var mfgH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1991-07-01'),rate:15},
        {date:new Date('1991-12-01'),rate:14},{date:new Date('1992-07-01'),rate:15},
        {date:new Date('1993-02-01'),rate:14.5},{date:new Date('1993-07-01'),rate:14},
        {date:new Date('1994-01-01'),rate:13},{date:new Date('1994-07-01'),rate:12.5},
        {date:new Date('1995-01-01'),rate:13},{date:new Date('1995-07-01'),rate:14},
        {date:new Date('1996-01-01'),rate:13},{date:new Date('1996-02-01'),rate:15},
        {date:new Date('1996-07-01'),rate:15},{date:new Date('2003-07-01'),rate:16},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:10},
        {date:new Date('2004-07-01'),rate:9},  {date:new Date('2006-01-01'),rate:10},
        {date:new Date('2006-08-06'),rate:12},{date:new Date('2007-07-01'),rate:13},
        {date:new Date('2018-08-09'),rate:9}, {date:new Date('2023-07-01'),rate:10.10},
        {date:new Date('2024-05-20'),rate:13.00},{date:new Date('2025-04-01'),rate:13.25}
    ];

    var prjH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1991-07-01'),rate:15},
        {date:new Date('1991-12-01'),rate:14},{date:new Date('1992-07-01'),rate:15},
        {date:new Date('1993-02-01'),rate:14.5},{date:new Date('1993-07-01'),rate:14},
        {date:new Date('1994-01-01'),rate:13},{date:new Date('1994-07-01'),rate:12.5},
        {date:new Date('1995-01-01'),rate:13},{date:new Date('1995-07-01'),rate:14},
        {date:new Date('1996-01-01'),rate:13},{date:new Date('1996-02-01'),rate:15},
        {date:new Date('1996-07-01'),rate:15},{date:new Date('2003-07-01'),rate:16},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:10},
        {date:new Date('2004-07-01'),rate:9},  {date:new Date('2006-01-01'),rate:10},
        {date:new Date('2006-08-06'),rate:12},{date:new Date('2007-07-01'),rate:13},
        {date:new Date('2018-08-09'),rate:9}, {date:new Date('2023-07-01'),rate:10.10},
        {date:new Date('2024-05-20'),rate:13.00},{date:new Date('2025-04-01'),rate:13.75}
    ];

    var agriH = [
        {date:new Date('1990-01-01'),rate:16},{date:new Date('1991-07-01'),rate:13},
        {date:new Date('1991-12-01'),rate:12.5},{date:new Date('1992-07-01'),rate:11},
        {date:new Date('1993-02-01'),rate:10.5},{date:new Date('1993-07-01'),rate:11},
        {date:new Date('1994-01-01'),rate:10},{date:new Date('1994-07-01'),rate:10},
        {date:new Date('1995-01-01'),rate:10},{date:new Date('1995-07-01'),rate:10},
        {date:new Date('1996-01-01'),rate:10},{date:new Date('1996-02-01'),rate:10.5},
        {date:new Date('1996-07-01'),rate:11},{date:new Date('2003-07-01'),rate:11},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:9},
        {date:new Date('2004-07-01'),rate:8}, {date:new Date('2006-01-01'),rate:8},
        {date:new Date('2006-08-06'),rate:8}, {date:new Date('2007-07-01'),rate:8},
        {date:new Date('2018-08-09'),rate:9}, {date:new Date('2023-07-01'),rate:8.10},
        {date:new Date('2024-05-20'),rate:11.00},{date:new Date('2025-04-01'),rate:12.50}
    ];

    var plH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2023-07-01'),rate:10.10},{date:new Date('2024-05-20'),rate:13.00},
        {date:new Date('2025-04-01'),rate:13.75}
    ];

    var plSH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2023-07-01'),rate:10.10},{date:new Date('2024-05-20'),rate:13.00},
        {date:new Date('2025-04-01'),rate:10.00}
    ];

    var ccredH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2023-07-01'),rate:10.10},{date:new Date('2024-05-20'),rate:13.00},
        {date:new Date('2025-04-01'),rate:13.75}
    ];

    /* ---- Fixed-rate loans ---- */
    var fixedRates = {
        'CMSME TERM (PRONODONA)': 7,
        'SMEF REVOLVING FUND': 6,
        'FID LOAN': 7,
        'GHORE FERA, COVID-19': 6,
        'POVERTY ALLEVIATION(MUJIB YEAR)': 7,
        'AGRI SHORT (HILL TRACTS)': 5,
        'AGRI LOAN (COVID-19)': 4
    };

    /* ---- Master map ---- */
    var baseHistory = {
        'CASH CREDIT HYPOTHICATION': ccH,
        'PAST DUE CASH CREDIT HYPOTHICATION': ccH,
        'WORKING CAPITAL CMSME REFINANCE': ccH,
        'CASH CREDIT CMSME (MANUFACTURING)': mfgH,
        'CASH CREDIT CMSME (SERVICE)': ccH,
        'CASH CREDIT CMSME (TRADING)': ccH,
        'CMSME TERM (PRONODONA)': ccH,
        'SMEF REVOLVING FUND': ccH,
        'MID TERM CMSME (MANUFACTURING)': mfgH,
        'MID TERM CMSME (TRADING)': ccH,
        'PROJECT (MID TERM)': prjH,
        'PROJECT (LONG TERM)': prjH,
        'CONSUMER CREDIT': ccredH,
        'PERSONAL LOAN (OTHERS)': plH,
        'PERSONAL LOAN (BKB STAFF)': plSH,
        'FID LOAN': agriH,
        'GHORE FERA, COVID-19': agriH,
        'AGRI (SHORT TERM) GENERAL': agriH,
        'AGRI SHORT TERM (BEEF FATTING)': agriH,
        'AGRI (SHORT TERM) SHAWNIRVAR CREDIT': agriH,
        'POVERTY ALLEVIATION(MUJIB YEAR)': agriH,
        'PAST DUE (AGRI)- SHORT TERM': agriH,
        'PAST DUE SHAWNIRVAR': agriH,
        'PAST DUE (LAND LESS FARMER)': agriH,
        'COTTAGE INDUSTRIES LOANS': agriH,
        'AGRI SHORT (HILL TRACTS)': agriH,
        'AGRI LOAN (COVID-19)': agriH,
        'AGRI (MID TERM) GENERAL': agriH,
        'PAST DUE (AGRI)- LONG TERM': agriH,
        'PAST DUE (AGRI)- MID TERM': agriH
    };

    /* ---- Dynamic Penalty Rate Schedule & Exemptions ---- */
    var DEFAULT_PENALTY_SCHEDULE = [
        { date: new Date('2024-05-20'), rate: 1.50, dateStr: '2024-05-20' },
        { date: new Date('2018-08-09'), rate: 2.00, dateStr: '2018-08-09' }
    ];

    var DEFAULT_PENALTY_EXEMPT = [
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

    var DB_KEY = 'custom_interest_rates';
    var PENALTY_DB_KEY = 'custom_penalty_rates';
    var live = null;

    function _ipc() {
        try {
            if (window.ipcRenderer) return window.ipcRenderer;
            if (window.parent && window.parent.ipcRenderer) return window.parent.ipcRenderer;
            if (window.require) {
                var electron = window.require('electron');
                if (electron && electron.ipcRenderer) return electron.ipcRenderer;
            }
            return null;
        } catch(e) { return null; }
    }

    function _loadDB(key) {
        var k = key || DB_KEY;
        var ipc = _ipc();
        if (ipc) {
            try {
                var r = ipc.sendSync('db-get-kv', k);
                if (typeof r === 'string') {
                    try { r = JSON.parse(r); } catch(e) {}
                }
                if (r && typeof r === 'object') return r;
            } catch(e) {}
        }
        try {
            var local = localStorage.getItem(k);
            return local ? JSON.parse(local) : {};
        } catch(e) { return {}; }
    }

    function _saveDB(key, data) {
        var k = key || DB_KEY;
        try { localStorage.setItem(k, JSON.stringify(data)); } catch(e) {}
        var ipc = _ipc();
        if (ipc) {
            try { ipc.sendSync('db-set-kv', k, data); } catch(e) {}
        }
    }

    function init() {
        live = {};
        Object.keys(baseHistory).forEach(function(k) {
            live[k] = baseHistory[k].map(function(e) { return { date: new Date(e.date), rate: e.rate }; });
        });
        var custom = _loadDB(DB_KEY);
        Object.keys(custom).forEach(function(loanName) {
            live[loanName] = [];
            (custom[loanName] || []).forEach(function(e) {
                live[loanName].push({ date: new Date(e.date), rate: parseFloat(e.rate) });
            });
            live[loanName].sort(function(a, b) { return a.date - b.date; });
        });
    }

    function saveCustomRate(codeName, dateStr, rate) {
        if (!live) init();
        var d = new Date(dateStr);
        if (isNaN(d) || isNaN(rate)) return false;

        var custom = _loadDB(DB_KEY);
        if (!custom[codeName]) {
            custom[codeName] = (live[codeName] || []).map(function(r) {
                return { date: r.date.toISOString().split('T')[0], rate: r.rate };
            });
        }

        custom[codeName] = custom[codeName].filter(function(r) {
            return new Date(r.date).getTime() !== d.getTime();
        });
        custom[codeName].push({ date: dateStr, rate: parseFloat(rate) });

        _saveDB(DB_KEY, custom);
        init();
        return true;
    }

    function getLatestRate(codeName) {
        if (!live) init();
        if (fixedRates[codeName] !== undefined) return fixedRates[codeName];
        var h = live[codeName];
        if (!h || !h.length) return null;
        var now = new Date();
        var eff = null;
        for (var i = 0; i < h.length; i++) {
            if (h[i].date <= now) eff = h[i].rate;
            else break;
        }
        return eff;
    }

    function getRateHistory() { if (!live) init(); return live; }

    function getLatestRateForCmsme(sector, loanType) {
        if (!live) init();
        var s = (sector || '').toLowerCase();
        var t = (loanType || '').toLowerCase();
        var isTerm = t.indexOf('meyad') >= 0 || t.indexOf('term') >= 0;
        var codeName = null;
        if (s.indexOf('trading') >= 0 || s.indexOf('ট্রেড') >= 0) {
            codeName = isTerm ? 'MID TERM CMSME (TRADING)' : 'CASH CREDIT CMSME (TRADING)';
        } else if (s.indexOf('manufactur') >= 0 || s.indexOf('ম্যান') >= 0) {
            codeName = isTerm ? 'MID TERM CMSME (MANUFACTURING)' : 'CASH CREDIT CMSME (MANUFACTURING)';
        } else if (s.indexOf('service') >= 0 || s.indexOf('সার্ভ') >= 0) {
            codeName = 'CASH CREDIT CMSME (SERVICE)';
        }
        return codeName ? getLatestRate(codeName) : null;
    }

    function overwriteCustomRates(codeName, ratesArray) {
        var custom = _loadDB(DB_KEY);
        custom[codeName] = ratesArray.map(function(r) {
            return { date: r.dateStr, rate: parseFloat(r.rate) };
        });
        _saveDB(DB_KEY, custom);
        init();
        return true;
    }

    /* ---- Penalty Engine Functions ---- */

    function getPenaltySchedule(loanType) {
        var dbData = _loadDB(PENALTY_DB_KEY);
        var schedule = (dbData && dbData.schedule && dbData.schedule.length > 0)
            ? dbData.schedule.map(function(s) {
                return { date: new Date(s.dateStr || s.date), rate: parseFloat(s.rate), dateStr: s.dateStr || new Date(s.date).toISOString().split('T')[0] };
            })
            : DEFAULT_PENALTY_SCHEDULE.map(function(s) {
                return { date: new Date(s.date), rate: s.rate, dateStr: s.dateStr };
            });

        schedule.sort(function(a, b) { return b.date - a.date; });
        return schedule;
    }

    function getPenaltyRate(date, loanType) {
        if (isPenaltyExempt(loanType)) return 0;
        var schedule = getPenaltySchedule(loanType);
        if (!date || isNaN(new Date(date).getTime())) return schedule[0]?.rate || 1.50;
        var d = new Date(date);
        for (var i = 0; i < schedule.length; i++) {
            if (d >= schedule[i].date) {
                return schedule[i].rate;
            }
        }
        return schedule[schedule.length - 1]?.rate || 2.00;
    }

    function getPenaltyExemptTypes() {
        var dbData = _loadDB(PENALTY_DB_KEY);
        if (dbData && Array.isArray(dbData.exemptTypes)) {
            return dbData.exemptTypes;
        }
        return DEFAULT_PENALTY_EXEMPT.slice();
    }

    function isPenaltyExempt(loanType) {
        if (!loanType) return false;
        var nameUpper = String(loanType).toUpperCase().trim();
        var exempts = getPenaltyExemptTypes().map(function(t) { return t.toUpperCase().trim(); });
        return exempts.indexOf(nameUpper) >= 0;
    }

    function savePenaltySchedule(scheduleArray) {
        var dbData = _loadDB(PENALTY_DB_KEY) || {};
        dbData.schedule = scheduleArray.map(function(s) {
            return {
                dateStr: s.dateStr || new Date(s.date).toISOString().split('T')[0],
                rate: parseFloat(s.rate)
            };
        });
        _saveDB(PENALTY_DB_KEY, dbData);
        return true;
    }

    function savePenaltyExemptTypes(exemptArray) {
        var dbData = _loadDB(PENALTY_DB_KEY) || {};
        dbData.exemptTypes = exemptArray.map(function(s) { return String(s).trim(); });
        _saveDB(PENALTY_DB_KEY, dbData);
        return true;
    }

    function setLoanTypePenaltyExemption(loanTypeName, isExempt) {
        if (!loanTypeName) return;
        var list = getPenaltyExemptTypes();
        var nameUpper = loanTypeName.toUpperCase().trim();
        list = list.filter(function(t) { return t.toUpperCase().trim() !== nameUpper; });
        if (isExempt) {
            list.push(loanTypeName.trim().toUpperCase());
        }
        savePenaltyExemptTypes(list);
        return true;
    }

    init();

    return {
        init: init,
        getLatestRate: getLatestRate,
        saveCustomRate: saveCustomRate,
        overwriteCustomRates: overwriteCustomRates,
        getLatestRateForCmsme: getLatestRateForCmsme,
        getRateHistory: getRateHistory,
        baseHistory: baseHistory,
        fixedRates: fixedRates,
        getPenaltySchedule: getPenaltySchedule,
        getPenaltyRate: getPenaltyRate,
        isPenaltyExempt: isPenaltyExempt,
        getPenaltyExemptTypes: getPenaltyExemptTypes,
        savePenaltySchedule: savePenaltySchedule,
        savePenaltyExemptTypes: savePenaltyExemptTypes,
        setLoanTypePenaltyExemption: setLoanTypePenaltyExemption
    };
})();
