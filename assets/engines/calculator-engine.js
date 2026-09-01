/**
 * Calculator Engine
 * Handles logic bridging for calculators and reports.
 */
window.CalculatorEngine = {
    wireCalculatorButtons: function(calcIframe) {
        const actions = {
            'calc-import-data': 'importPrimary',
            'calc-import-secondary': 'importSecondary',
            'calc-data-input': 'manualInput',
            'calc-calculate-balance': 'calculate',
            'calc-download-excel': 'downloadExcel',
            'calc-clear-data': 'clear',
            'calc-show-loans': 'showLoans'
        };

        Object.keys(actions).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => {
                    calcIframe.contentWindow.postMessage({
                        command: 'EXECUTE_ACTION',
                        action: actions[id]
                    }, '*');
                };
            }
        });
    }
};
