
// Preset Schema definitions for Cheques vs FDR Forms
const FIELD_PRESETS = {
  cheque: {
    defaultWidth: 215,
    defaultHeight: 92,
    fields: [
      { id: 'm_date', label: 'Date [13-08-2026]', top: '12mm', left: '160mm', isFdr: false },
      { id: 'm_payee', label: 'Payee Name', top: '24mm', left: '35mm', isFdr: false },
      { id: 'm_words', label: 'Amount in Words', top: '34mm', left: '30mm', isFdr: false },
      { id: 'm_figures', label: 'Amount (Figures)', top: '48mm', left: '155mm', isFdr: false },
      { id: 'm_account', label: 'A/C Number', top: '58mm', left: '35mm', isFdr: false },
      { id: 'm_acpayee', label: 'A/C PAYEE ONLY', top: '10mm', left: '15mm', isFdr: false }
    ]
  },
  micr_cheque: {
    defaultWidth: 228,
    defaultHeight: 90,
    fields: [
      { id: 'm_date', label: 'Date [13-08-2026]', top: '12mm', left: '170mm', isFdr: false },
      { id: 'm_payee', label: 'Payee Name', top: '24mm', left: '35mm', isFdr: false },
      { id: 'm_words', label: 'Amount in Words', top: '34mm', left: '30mm', isFdr: false },
      { id: 'm_figures', label: 'Amount (Figures)', top: '48mm', left: '165mm', isFdr: false },
      { id: 'm_account', label: 'A/C Number', top: '58mm', left: '35mm', isFdr: false },
      { id: 'm_acpayee', label: 'A/C PAYEE ONLY', top: '10mm', left: '15mm', isFdr: false }
    ]
  },
  fdr: {
    defaultWidth: 165.56,
    defaultHeight: 92.17, // FDR Block forms are often taller
    fields: [
      { id: 'm_fdr_date', label: 'Issue / Value Date', top: '15mm', left: '150mm', isFdr: true, type: 'date' },
      { id: 'm_fdr_acc', label: 'FDR A/C No', top: '25mm', left: '40mm', isFdr: true },
      { id: 'm_fdr_title', label: 'Account Title / Name', top: '35mm', left: '40mm', isFdr: true },
      { id: 'm_fdr_amount', label: 'Principal Amount (Fig)', top: '45mm', left: '150mm', isFdr: true },
      { id: 'm_fdr_words', label: 'Principal (in Words)', top: '55mm', left: '40mm', isFdr: true },
      { id: 'm_fdr_roi', label: 'Rates', top: '68mm', left: '40mm', isFdr: true },
      { id: 'm_fdr_tenure', label: 'Duration', top: '68mm', left: '110mm', isFdr: true },
      { id: 'm_fdr_matdate', label: 'Maturity Date', top: '68mm', left: '160mm', isFdr: true, type: 'date' },
      { id: 'm_fdr_remarks', label: 'Scheme name', top: '82mm', left: '40mm', isFdr: true }
    ]
  }
};

let activeMarker = null;
let isPreviewMode = false;

const MOCK_DATA = {
  m_fdr_date: '15082026',
  m_fdr_acc: '4321-5678-9012',
  m_fdr_title: 'TANVIR AHMED',
  m_fdr_amount: '5,00,000/-',
  m_fdr_words: 'Five Lakh Taka Only',
  m_fdr_roi: '8.5%',
  m_fdr_tenure: '3 Years',
  m_fdr_matdate: '15-08-2029',
  m_fdr_remarks: 'BKB Double Benefit Scheme',
  m_date: '15082026',
  m_payee: 'TANVIR AHMED',
  m_words: 'Five Lakh Taka Only',
  m_figures: '5,00,000/-',
  m_account: '1234-5678-9012',
  m_acpayee: 'A/C PAYEE ONLY'
};

function toBnNum(str) {
    const bnObj = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return String(str).replace(/[0-9]/g, match => bnObj[match] || match);
}

function getLiveFormData() {
    let data = MOCK_DATA; // Fallback to demo data
    try {
        const passedDataStr = localStorage.getItem('fdr_live_preview_data');
        if (passedDataStr) {
            const passedData = JSON.parse(passedDataStr);
            if (passedData && (passedData.m_fdr_amount || passedData.m_fdr_title)) {
                data = passedData;
            }
        }
    } catch(e) {}
    return data;
}

function togglePreviewMode() {
  isPreviewMode = !isPreviewMode;
  const canvas = document.getElementById('cheque-canvas');
  const cat = document.getElementById('doc-category').value;
  const preset = FIELD_PRESETS[cat];
  const liveData = getLiveFormData();

  if (isPreviewMode) {
    canvas.classList.add('preview-active');
    preset.fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      if (f.type === 'date') {
          const cleanDateStr = (liveData[f.id] || '').replace(/[^\d০-৯]/g, '');
          const chars = cleanDateStr.split('');
          const divs = el.querySelectorAll('.date-container > div');
          divs.forEach((d, i) => d.innerText = toBnNum(chars[i] || ''));
      } else {
          el.innerText = liveData[f.id] || f.label;
      }
    });
  } else {
    canvas.classList.remove('preview-active');
    preset.fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      if (f.type === 'date') {
          const size = document.getElementById('cfg-date-size').value || 5;
          const gap = document.getElementById('cfg-date-gap').value || 1;
          el.innerHTML = `
            <div class="date-container" style="display: flex; gap: ${gap}mm; pointer-events: none; padding: 2px;">
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">D</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">D</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">M</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">M</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
              <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
            </div>
          `;
      } else {
          el.innerText = f.label;
      }
    });
  }
}

function switchCategory() {
  const cat = document.getElementById('doc-category').value;
  const preset = FIELD_PRESETS[cat];

  let savedLayout = null;
  let savedBg = null;
  if (typeof window.DB !== 'undefined') {
    savedLayout = window.DB.getSetting('cheque_layout_' + cat);
    savedBg = window.DB.getSetting('cheque_bg_' + cat);
    console.log("LOADED LAYOUT for " + cat, savedLayout);
    console.log("LOADED BG for " + cat, savedBg ? "YES" : "NO");
  }

  // Update dimensions
  if (savedLayout && savedLayout.width_mm) {
    document.getElementById('cfg-width').value = savedLayout.width_mm;
    document.getElementById('cfg-height').value = savedLayout.height_mm;
  } else {
    document.getElementById('cfg-width').value = preset.defaultWidth;
    document.getElementById('cfg-height').value = preset.defaultHeight;
  }

  // Clear or load background image on switch
  const canvas = document.getElementById('cheque-canvas');
  if (savedBg) {
    canvas.style.backgroundImage = savedBg;
  } else {
    canvas.style.backgroundImage = 'none';
  }
  document.getElementById('img-upload').value = '';

  if (savedLayout && savedLayout.date_config) {
    document.getElementById('cfg-date-size').value = savedLayout.date_config.size_mm || 5;
    document.getElementById('cfg-date-gap').value = savedLayout.date_config.gap_mm || 1;
  } else {
    document.getElementById('cfg-date-size').value = 5;
    document.getElementById('cfg-date-gap').value = 1;
  }

  // Render markers for selected category
  renderMarkers(preset.fields, savedLayout);
  updateCanvasSize();
}

function renderMarkers(fields, savedLayout) {
  const canvas = document.getElementById('cheque-canvas');
  canvas.innerHTML = ''; // Clear existing

  fields.forEach(f => {
    const div = document.createElement('div');
    div.id = f.id;
    div.className = `field-marker ${f.isFdr ? 'fdr-tag' : ''}`;

    let top = f.top;
    let left = f.left;
    if (savedLayout && savedLayout.fields) {
      const key = f.id.replace('m_', '');
      if (savedLayout.fields[key]) {
        top = savedLayout.fields[key].top;
        left = savedLayout.fields[key].left;
      }
    }

    div.style.top = top;
    div.style.left = left;

    if (f.type === 'date') {
      const size = document.getElementById('cfg-date-size').value || 5;
      const gap = document.getElementById('cfg-date-gap').value || 1;
      div.innerHTML = `
          <div class="date-container" style="display: flex; gap: ${gap}mm; pointer-events: none; padding: 2px;">
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">D</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">D</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">M</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">M</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
            <div style="width: ${size}mm; height: ${size}mm; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 9px;">Y</div>
          </div>
        `;
    } else {
      div.innerText = f.label;
    }

    // Attach drag listener
    div.addEventListener('mousedown', onMouseDown);
    canvas.appendChild(div);
  });
}

function updateCanvasSize() {
  const w = document.getElementById('cfg-width').value;
  const h = document.getElementById('cfg-height').value;
  const canvas = document.getElementById('cheque-canvas');

  canvas.style.width = `${w}mm`;
  canvas.style.height = `${h}mm`;
  generateOutputs();
  applyPrintStyles(w, h);
}

function applyPrintStyles(w, h) {
    let style = document.getElementById('dynamic-print-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-print-style';
        document.head.appendChild(style);
    }
    style.innerHTML = `
        @media print {
            body * { display: none !important; }
            #canvas-wrapper, #cheque-canvas, #cheque-canvas * { display: block !important; }
            #canvas-wrapper { padding: 0 !important; margin: 0 !important; background: white !important; overflow: visible !important; position: absolute; left: 0; top: 0; }
            #cheque-canvas { margin: 0 !important; box-shadow: none !important; border: none !important; background: white !important; }
            #cheque-canvas .field-marker { position: absolute !important; }
            .cheque-data-field, .cheque-date-field { font-family: 'SolaimanLipi', Arial, sans-serif !important; font-size: 11pt !important; font-weight: bold !important; color: #000 !important; }
            @page { size: ${w}mm ${h}mm; margin: 0; }
        }
    `;
}

function updateDateBoxes() {
  const size = document.getElementById('cfg-date-size').value || 5;
  const gap = document.getElementById('cfg-date-gap').value || 1;
  const dateContainers = document.querySelectorAll('.date-container');

  dateContainers.forEach(container => {
    container.style.gap = `${gap}mm`;
    const boxes = container.querySelectorAll('div');
    boxes.forEach(box => {
      box.style.width = `${size}mm`;
      box.style.height = `${size}mm`;
    });
  });
  generateOutputs();
}

function loadDocumentImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    document.getElementById('cheque-canvas').style.backgroundImage = `url('${evt.target.result}')`;
  };
  reader.readAsDataURL(file);
}

function onMouseDown(e) {
  activeMarker = e.currentTarget;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!activeMarker) return;
  const canvas = document.getElementById('cheque-canvas');
  const rect = canvas.getBoundingClientRect();

  let xPx = e.clientX - rect.left - (activeMarker.offsetWidth / 2);
  let yPx = e.clientY - rect.top - (activeMarker.offsetHeight / 2);

  let xMm = (xPx / rect.width) * document.getElementById('cfg-width').value;
  let yMm = (yPx / rect.height) * document.getElementById('cfg-height').value;

  activeMarker.style.left = `${Math.max(0, xMm.toFixed(1))}mm`;
  activeMarker.style.top = `${Math.max(0, yMm.toFixed(1))}mm`;
  generateOutputs();
}

function onMouseUp() {
  activeMarker = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

function generateOutputs() {
  const cat = document.getElementById('doc-category').value;
  const w = document.getElementById('cfg-width').value;
  const h = document.getElementById('cfg-height').value;
  const dateSize = document.getElementById('cfg-date-size').value;
  const dateGap = document.getElementById('cfg-date-gap').value;
  const markers = document.querySelectorAll('.field-marker');

  let cssRules = [];
  let jsonMap = {
    category: cat,
    width_mm: parseFloat(w),
    height_mm: parseFloat(h),
    date_config: {
      size_mm: parseFloat(dateSize),
      gap_mm: parseFloat(dateGap)
    },
    fields: {}
  };

  markers.forEach(m => {
    const top = m.style.top;
    const left = m.style.left;
    const key = m.id.replace('m_', '');

    cssRules.push(`  .${m.id.replace('m_', 'field-')} {position: absolute; top: ${top}; left: ${left}; }`);
    jsonMap.fields[key] = { top, left };
  });

  const css = `@media print {
        @page {
        size: ${w}mm ${h}mm landscape;
    margin: 0;
  }
    .document-leaf {
        width: ${w}mm;
    height: ${h}mm;
    position: relative;
  }
    ${cssRules.join('\n')}
}`;

  document.getElementById('css-code').innerText = css;
  document.getElementById('json-code').innerText = JSON.stringify(jsonMap, null, 2);
}

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('fdr_auto_preview') === 'true') {
        sessionStorage.removeItem('fdr_auto_preview');
        setTimeout(() => {
            const catSelect = document.getElementById('doc-category');
            if (catSelect) {
                catSelect.value = 'fdr';
                switchCategory();
            }
            if (!isPreviewMode) togglePreviewMode();
        }, 300);
    }
});

function showToast(msg) {
  if (window.parent && typeof window.parent.showAppToast === 'function') {
    window.parent.showAppToast(msg, false);
    return;
  }
  let toast = document.getElementById('cheque-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cheque-toast';
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:6px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;font-weight:bold;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  setTimeout(() => toast.style.opacity = '0', 3000);
}

function saveConfiguration() {
  const cat = document.getElementById('doc-category').value;
  const jsonStr = document.getElementById('json-code').innerText;
  try {
    const jsonMap = JSON.parse(jsonStr);
    if (typeof window.DB !== 'undefined') {
      window.DB.saveSetting('cheque_layout_' + cat, JSON.stringify(jsonMap));
      const canvas = document.getElementById('cheque-canvas');
      const bgImg = canvas.style.backgroundImage;
      if (bgImg && bgImg !== 'none') {
        window.DB.saveSetting('cheque_bg_' + cat, bgImg);
      }
      showToast('Configuration and Background saved to database!');
    } else {
      showToast('Database Engine not loaded!');
    }
  } catch (e) {
    showToast('Error saving: ' + e.message);
  }
}

// Initialize on page load
switchCategory();
