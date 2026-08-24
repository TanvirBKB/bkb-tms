/**
 * InterestRateManager - Shared, central interest rate database.
 * Consumed by: Interest Calculator + CMSME Loan Form.
 * User-added custom rates are permanently saved in the app DB (db-set-kv)
 * and merged at runtime, so every form always sees the latest rate.
 */
window.InterestRateManager = (function () {

    /* ---- Base rate histories ---- */

    var ccH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1991-07-01'),rate:15},
        {date:new Date('1991-12-01'),rate:14},{date:new Date('1992-07-01'),rate:15},
        {date:new Date('1993-02-01'),rate:14.5},{date:new Date('1993-07-01'),rate:14},
        {date:new Date('1994-01-01'),rate:13},{date:new Date('1994-07-01'),rate:12.5},
        {date:new Date('1995-01-01'),rate:12.5},{date:new Date('1995-07-01'),rate:12.5},
        {date:new Date('1996-01-01'),rate:13},{date:new Date('1996-02-01'),rate:15},
        {date:new Date('1996-07-01'),rate:15},{date:new Date('2003-07-01'),rate:16},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:10},
        {date:new Date('2004-07-01'),rate:9},{date:new Date('2006-01-01'),rate:10},
        {date:new Date('2006-08-06'),rate:12},{date:new Date('2007-07-01'),rate:13},
        {date:new Date('2011-10-01'),rate:15},{date:new Date('2013-01-01'),rate:15.5},
        {date:new Date('2016-07-01'),rate:13},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2023-07-01'),rate:10.10},{date:new Date('2023-10-05'),rate:10.70},
        {date:new Date('2023-10-10'),rate:11.10},{date:new Date('2023-11-27'),rate:11.18},
        {date:new Date('2023-12-01'),rate:11.47},{date:new Date('2024-01-01'),rate:11.89},
        {date:new Date('2024-02-01'),rate:12.43},{date:new Date('2024-03-03'),rate:13.11},
        {date:new Date('2024-04-01'),rate:13.55},{date:new Date('2024-05-20'),rate:13.00},
        {date:new Date('2025-04-01'),rate:13.75}
    ];

    var mfgH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1991-07-01'),rate:15},
        {date:new Date('1991-12-01'),rate:14},{date:new Date('1992-07-01'),rate:15},
        {date:new Date('1993-02-01'),rate:14.5},{date:new Date('1993-07-01'),rate:14},
        {date:new Date('1994-01-01'),rate:13},{date:new Date('1994-07-01'),rate:12.5},
        {date:new Date('1995-01-01'),rate:12.5},{date:new Date('1995-07-01'),rate:12.5},
        {date:new Date('1996-01-01'),rate:13},{date:new Date('1996-02-01'),rate:15},
        {date:new Date('1996-07-01'),rate:15},{date:new Date('2003-07-01'),rate:16},
        {date:new Date('2003-10-01'),rate:10},{date:new Date('2004-05-01'),rate:10},
        {date:new Date('2004-07-01'),rate:9},{date:new Date('2006-01-01'),rate:10},
        {date:new Date('2006-08-06'),rate:12},{date:new Date('2007-07-01'),rate:13},
        {date:new Date('2011-10-01'),rate:15},{date:new Date('2013-01-01'),rate:15.5},
        {date:new Date('2016-07-01'),rate:13},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2023-07-01'),rate:10.10},{date:new Date('2023-10-05'),rate:10.70},
        {date:new Date('2023-10-10'),rate:11.10},{date:new Date('2023-11-27'),rate:11.18},
        {date:new Date('2023-12-01'),rate:11.47},{date:new Date('2024-01-01'),rate:11.89},
        {date:new Date('2024-02-01'),rate:12.43},{date:new Date('2024-03-03'),rate:13.11},
        {date:new Date('2024-04-01'),rate:13.55},{date:new Date('2024-05-20'),rate:13.00},
        {date:new Date('2025-04-01'),rate:13.00}
    ];

    var agriH = [
        {date:new Date('1991-07-01'),rate:16},{date:new Date('1992-04-01'),rate:15},
        {date:new Date('1994-07-01'),rate:11},{date:new Date('1995-07-01'),rate:12},
        {date:new Date('1996-07-01'),rate:14},{date:new Date('2003-07-01'),rate:13},
        {date:new Date('2004-07-01'),rate:8},{date:new Date('2007-07-01'),rate:11},
        {date:new Date('2011-07-01'),rate:10},{date:new Date('2013-07-01'),rate:12},
        {date:new Date('2016-07-01'),rate:10},{date:new Date('2018-08-09'),rate:9},
        {date:new Date('2021-04-01'),rate:8},{date:new Date('2023-07-01'),rate:9.10},
        {date:new Date('2023-10-05'),rate:9.70},{date:new Date('2023-10-10'),rate:10.10},
        {date:new Date('2023-11-27'),rate:10.18},{date:new Date('2023-12-01'),rate:10.47},
        {date:new Date('2024-01-01'),rate:10.89},{date:new Date('2024-02-01'),rate:11.43},
        {date:new Date('2024-03-03'),rate:12.11},{date:new Date('2024-04-01'),rate:12.55},
        {date:new Date('2024-05-20'),rate:12.00},{date:new Date('2025-04-01'),rate:12.50}
    ];

    var prjH = [
        {date:new Date('1990-01-01'),rate:14},{date:new Date('1993-07-01'),rate:11},
        {date:new Date('1994-01-01'),rate:10},{date:new Date('1996-01-01'),rate:9.5},
        {date:new Date('1996-02-01'),rate:12},{date:new Date('2003-10-01'),rate:10},
        {date:new Date('2004-07-01'),rate:8},{date:new Date('2006-01-01'),rate:9},
        {date:new Date('2006-08-01'),rate:11.5},{date:new Date('2007-07-01'),rate:12.5},
        {date:new Date('2011-10-01'),rate:13},{date:new Date('2012-03-01'),rate:15},
        {date:new Date('2013-07-01'),rate:14.5},{date:new Date('2016-07-01'),rate:13},
        {date:new Date('2018-08-09'),rate:9},{date:new Date('2023-07-01'),rate:10.10},
        {date:new Date('2024-05-20'),rate:13.00},{date:new Date('2025-04-01'),rate:13.75}
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

    var live = null;
    var DB_KEY = 'custom_interest_rates';

    function _ipc() {
        try { return (window.parent && window.parent.ipcRenderer) ? window.parent.ipcRenderer : null; } catch(e) { return null; }
    }
    function _loadDB() {
        var ipc = _ipc();
        if (!ipc) return {};
        try { 
            var r = ipc.sendSync('db-get-kv', DB_KEY); 
            if (typeof r === 'string') {
                try { r = JSON.parse(r); } catch(e) {}
            }
            return (r && typeof r === 'object') ? r : {}; 
        } catch(e) { return {}; }
    }
    function _saveDB(data) {
        var ipc = _ipc();
        if (!ipc) return;
        try { ipc.sendSync('db-set-kv', DB_KEY, data); } catch(e) {}
    }

    function init() {
        live = {};
        Object.keys(baseHistory).forEach(function(k) {
            live[k] = baseHistory[k].map(function(e) { return { date: new Date(e.date), rate: e.rate }; });
        });
        var custom = _loadDB();
        Object.keys(custom).forEach(function(loanName) {
            // Complete override to allow deletions of built-in rates
            live[loanName] = [];
            custom[loanName].forEach(function(e) {
                live[loanName].push({ date: new Date(e.date), rate: parseFloat(e.rate) });
            });
            live[loanName].sort(function(a, b) { return a.date - b.date; });
        });
    }

    function saveCustomRate(codeName, dateStr, rate) {
        if (!live) init();
        var d = new Date(dateStr);
        if (isNaN(d) || isNaN(rate)) return false;
        
        var custom = _loadDB();
        // If this is the first custom modification for this loan, copy the existing live history
        if (!custom[codeName]) {
            custom[codeName] = (live[codeName] || []).map(function(r) {
                return { date: r.date.toISOString().split('T')[0], rate: r.rate };
            });
        }
        
        // Remove any rate on the same date to overwrite it, or just push if new
        custom[codeName] = custom[codeName].filter(function(r) {
            return new Date(r.date).getTime() !== d.getTime();
        });
        custom[codeName].push({ date: dateStr, rate: parseFloat(rate) });
        
        _saveDB(custom);
        init(); // Refresh live rates
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

    /* ---- CMSME form helper ---- */
    function getLatestRateForCmsme(sector, loanType) {
        if (!live) init();
        var s = (sector || '').toLowerCase();
        var t = (loanType || '').toLowerCase();
        var isTerm = t.indexOf('meyad') >= 0 || t.indexOf('term') >= 0;
        var codeName = null;
        // Bengali: ট্রেডিং, ম্যানুফেকচারিং, সার্ভিস
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
        var custom = _loadDB();
        // Overwrite the entire custom history for this loan type
        custom[codeName] = ratesArray.map(function(r) {
            return { date: r.dateStr, rate: parseFloat(r.rate) };
        });
        _saveDB(custom);
        init(); // Refresh live rates
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
        fixedRates: fixedRates
    };
})();