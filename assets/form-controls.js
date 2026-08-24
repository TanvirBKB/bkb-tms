/**
 * BKB TMS - Shared Form Controls System (form-controls.js)
 * =========================================================
 * Include this ONE script in any transaction form (RTGS, EFTN, CBS, etc.)
 * to get floating action buttons and shared utilities automatically.
 *
 * Usage in a form HTML file (inside <head> or before </body>):
 *   <script src="../../assets/form-controls.js"></script>
 *
 * The form must expose a window object with at least one of:
 *   window.RTGSFormLogic  - for RTGS forms
 *   window.EFTNFormLogic  - for EFTN forms
 *   window.FormLogic      - generic name for any other form
 *
 * Each logic object should optionally expose:
 *   openModal()     - opens the data input modal
 *   startNew()      - resets the form to blank
 *   populate(data)  - fills form from a customer data object
 *   getFormData()   - returns current form data as an object
 */

(function () {
    'use strict';

    // ── AppStorage polyfill for iframe context ─────────────────────────────────
    window.AppStorage = window.AppStorage || (window.parent && window.parent.AppStorage) || {
        getItem: function (k) { return localStorage.getItem(k); },
        setItem: function (k, v) { localStorage.setItem(k, v); },
        removeItem: function (k) { localStorage.removeItem(k); },
        clear: function () { localStorage.clear(); }
    };

    // ── BKB Account Number Normalizer ──────────────────────────────────────────
    // Inserts hyphen after 4th digit (branch code) for any BKB account number.
    // Works regardless of total length (13, 14, or 15 digits).
    window.normalizeBkbAccount = function (ac) {
        if (!ac) return ac;
        var clean = String(ac).replace(/[^0-9a-zA-Z]/g, '');
        if (clean.length >= 5) return clean.slice(0, 4) + '-' + clean.slice(4);
        return clean;
    };

    // ── Non-blocking Toast notification ────────────────────────────────────────
    window.appToast = window.appToast || function (msg, isError) {
        var color = isError ? '#dc3545' : '#28a745';
        var t = document.getElementById('_app_toast');
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
        t._tid = setTimeout(function () { t.style.opacity = '0'; }, 3200);
    };

    // ── Non-blocking Confirm dialog ─────────────────────────────────────────────
    window.appConfirm = window.appConfirm || function (msg, onYes, onNo) {
        var overlay = document.getElementById('_app_confirm_overlay');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = '_app_confirm_overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: '99998', fontFamily: "'SolaimanLipi', Arial, sans-serif"
        });
        overlay.innerHTML =
            '<div style="background:white;border-radius:10px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.25);text-align:center;">' +
            '<p style="margin:0 0 22px;font-size:1rem;color:#333;line-height:1.5;">' + msg + '</p>' +
            '<div style="display:flex;gap:12px;justify-content:center;">' +
            '<button id="_app_confirm_yes" style="background:#dc3545;color:white;border:none;padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;font-weight:bold;">হ্যাঁ / Yes</button>' +
            '<button id="_app_confirm_no" style="background:#6c757d;color:white;border:none;padding:9px 26px;border-radius:6px;cursor:pointer;font-size:0.95rem;">না / No</button>' +
            '</div></div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#_app_confirm_yes').addEventListener('click', function () { overlay.remove(); if (onYes) onYes(); });
        overlay.querySelector('#_app_confirm_no').addEventListener('click', function () { overlay.remove(); if (onNo) onNo(); });
    };

    // ── Get the active form logic object ───────────────────────────────────────
    function getFormLogic() {
        return window.FormLogic || window.RTGSFormLogic || window.EFTNFormLogic || null;
    }

    // ── Inject Floating Action Buttons ─────────────────────────────────────────
    function injectFloatingControls() {
        if (document.getElementById('_fc_container')) return;

        var container = document.createElement('div');
        container.id = '_fc_container';
        container.style.cssText = 'position:fixed;right:18px;top:18px;display:flex;flex-direction:column;gap:10px;z-index:9997;';

        var baseStyle = 'display:flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;color:#fff;cursor:pointer;border:none;font-family:Calibri,sans-serif;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.14);transition:transform 0.15s,box-shadow 0.15s;white-space:nowrap;';

        var defs = [
            {
                id: 'fc-data-input', label: '\uD83D\uDCCB Data Input',
                bg: 'linear-gradient(135deg,#10b981,#059669)',
                action: function () {
                    var logic = getFormLogic();
                    if (logic && logic.openModal) { logic.openModal(); }
                    else if (typeof window.openModal === 'function') { window.openModal(); }
                    else { window.appToast('Data Input is not supported by this form.', true); }
                }
            },
            {
                id: 'fc-start-new', label: '\uD83D\uDDD1\uFE0F Start New',
                bg: 'linear-gradient(135deg,#374151,#111827)',
                action: function () {
                    var logic = getFormLogic();
                    if (logic && logic.startNew) { logic.startNew(); }
                    else if (typeof window.startNew === 'function') { window.startNew(); }
                    else { window.appToast('Start New is not supported by this form.', true); }
                }
            },
            {
                id: 'fc-print', label: '\uD83D\uDDA8\uFE0F Print',
                bg: 'linear-gradient(135deg,#06b6d4,#0ea5a4)',
                action: function () { window.print(); }
            }
        ];

        defs.forEach(function (d) {
            var btn = document.createElement('button');
            btn.id = d.id;
            btn.innerText = d.label;
            btn.style.cssText = baseStyle + 'background:' + d.bg + ';';
            btn.addEventListener('mouseover', function () {
                btn.style.transform = 'translateY(-3px)';
                btn.style.boxShadow = '0 10px 30px rgba(0,0,0,.18)';
            });
            btn.addEventListener('mouseout', function () {
                btn.style.transform = '';
                btn.style.boxShadow = '0 6px 18px rgba(0,0,0,.14)';
            });
            btn.addEventListener('click', d.action);
            container.appendChild(btn);
        });

        document.body.appendChild(container);
    }

    // ── Auto-scale page to fit A4 (fixes modal stacking context) ───────────────
    // IMPORTANT: Modals are moved to document.body FIRST so they don't get
    // trapped in the CSS transform stacking context, which would make inputs
    // appear at offset positions (visually misaligned = "unclickable").
    function adjustPageScale() {
        var container = document.querySelector('.WordSection1');
        if (!container) return;

        // Move all fixed/modal elements out of WordSection1 to body
        var fixedEls = container.querySelectorAll('[id$="Modal"],[id$="modal"],#_app_toast,#_app_confirm_overlay,#_fc_container');
        fixedEls.forEach(function (el) {
            if (el.parentElement !== document.body) document.body.appendChild(el);
        });

        container.style.boxSizing = 'border-box';

        var content = container.querySelector('.page-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'page-content';
            Array.from(container.childNodes).forEach(function (n) { content.appendChild(n); });
            container.appendChild(content);
        }

        content.style.transform = 'none';
        content.style.margin = '0';

        var cs = window.getComputedStyle(container);
        var padL = parseFloat(cs.paddingLeft) || 0;
        var padR = parseFloat(cs.paddingRight) || 0;
        var padT = parseFloat(cs.paddingTop) || 0;
        var padB = parseFloat(cs.paddingBottom) || 0;

        var availW = container.clientWidth - padL - padR;
        var availH = container.clientHeight - padT - padB;

        content.style.width = 'auto';
        content.style.height = 'auto';
        content.style.display = 'block';

        var cW = content.scrollWidth || content.offsetWidth || availW;
        var cH = content.scrollHeight || content.offsetHeight || availH;

        var scale = 1;
        if (cW > 0 && cH > 0) scale = Math.min(availW / cW, availH / cH, 1);

        content.style.transformOrigin = 'top left';
        content.style.transform = 'scale(' + scale + ')';

        var xOff = (availW - cW * scale) / 2;
        var yOff = (availH - cH * scale) / 2;
        content.style.marginLeft = (xOff > 0 ? xOff : 0) + 'px';
        content.style.marginTop = (yOff > 0 ? yOff : 0) + 'px';
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() {
        // injectFloatingControls(); // Disabled: App Shell right panel buttons are used instead
        adjustPageScale();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('resize', adjustPageScale);
    setTimeout(adjustPageScale, 500);

    if (window.matchMedia) {
        var mq = window.matchMedia('print');
        if (mq.addListener) mq.addListener(function (m) { if (!m.matches) setTimeout(adjustPageScale, 200); });
    }

})();