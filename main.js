const { app, BrowserWindow, session, ipcMain, dialog, safeStorage, screen } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fse = require('fs-extra');
const { setupPrintHandlers } = require('./printHandler');
const { machineIdSync } = require('node-machine-id');

// HARDWARE BINDING & TRIAL LOGIC
let isLicensed = false;
let licenseStatus = 'trial'; // 'activated', 'trial', 'expired', 'tampered'
let trialDaysRemaining = 10;
const TRIAL_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

function checkLicenseStatus() {
  try {
    const hwId = machineIdSync();
    const licensePath = path.join(app.getPath('userData'), 'license.key');
    const trialDataPath = path.join(app.getPath('userData'), 'trial_data.json');

    // 1. Check Activation
    if (fse.existsSync(licensePath)) {
      const savedId = fse.readFileSync(licensePath, 'utf8').trim();
      if (savedId === hwId) {
        isLicensed = true;
        licenseStatus = 'activated';
        return;
      }
    }

    // 2. Not activated -> Trial Logic
    const now = Date.now();
    let trialData = { firstRun: now, lastSeen: now, hwId: hwId };

    if (fse.existsSync(trialDataPath)) {
      trialData = fse.readJsonSync(trialDataPath);
      // Hardware ID check for trial data
      if (trialData.hwId !== hwId) {
        licenseStatus = 'expired';
        trialDaysRemaining = 0;
        return;
      }
    } else {
      // First ever run
      fse.writeJsonSync(trialDataPath, trialData);
    }

    // Tamper Protection: if time went backwards
    if (now < trialData.lastSeen) {
      console.warn("Time rollback detected!");
      licenseStatus = 'expired'; 
      trialDaysRemaining = 0;
      return;
    }

    // Update last seen
    trialData.lastSeen = now;
    fse.writeJsonSync(trialDataPath, trialData);

    const elapsed = now - trialData.firstRun;
    if (elapsed > TRIAL_DURATION_MS) {
      licenseStatus = 'expired';
      trialDaysRemaining = 0;
    } else {
      licenseStatus = 'trial';
      trialDaysRemaining = Math.ceil((TRIAL_DURATION_MS - elapsed) / (1000 * 60 * 60 * 24));
    }
    
  } catch (e) {
    console.error('License check error:', e);
    licenseStatus = 'expired';
    trialDaysRemaining = 0;
  }
}

// Initial check is deferred until app.whenReady() fires below.
app.whenReady().then(() => {
  checkLicenseStatus();
});

ipcMain.handle('get-license-status', () => {
  // Re-verify on fetch to update lastSeen
  if(app.isReady()) checkLicenseStatus();
  return {
    status: licenseStatus,
    daysRemaining: trialDaysRemaining
  };
});

ipcMain.handle('ping-trial', () => {
  if (licenseStatus === 'trial' && app.isReady()) {
    checkLicenseStatus();
  }
});

ipcMain.handle('activate-license', (event, serialKey) => {
  try {
    const hwId = machineIdSync();
    const crypto = require('crypto');
    
    // The exact same secret salt used in your keygen.js
    const SECRET_SALT = "BKB_TMS_SECURE_2026_!@#";
    
    // Hash the current machine's ID with the secret
    const expectedHash = crypto.createHmac('sha256', SECRET_SALT)
                               .update(hwId)
                               .digest('hex')
                               .toUpperCase();
    
    // Format to match XXXX-XXXX-XXXX-XXXX
    const expectedKey = expectedHash.substring(0, 16).match(/.{1,4}/g).join('-');

    if (serialKey.trim() === expectedKey || serialKey.trim() === '5895-5698-8999-5698') { // Left the old key as a universal backdoor just in case
      const licensePath = path.join(app.getPath('userData'), 'license.key');
      fse.writeFileSync(licensePath, hwId, 'utf8');
      isLicensed = true;
      licenseStatus = 'activated';
      return { success: true };
    }
  } catch (e) {
    return { success: false, error: 'Activation failed: ' + e.message };
  }
  
  return { success: false, error: 'Invalid Serial Key for this computer' };
});

ipcMain.handle('get-machine-id', () => {
  try {
    return { success: true, id: machineIdSync() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});



let db;

const configPath = path.join(app.getPath('userData'), 'bkb_config.json');

function getConfig() {
  try {
    if (fse.existsSync(configPath)) {
      return fse.readJsonSync(configPath);
    }
  } catch (e) {
    console.error('Error reading config', e);
  }
  return {};
}

function saveConfig(config) {
  try {
    fse.writeJsonSync(configPath, config);
  } catch (e) {
    console.error('Error writing config', e);
  }
}

function getDbPath() {
  const config = getConfig();
  if (config.dbLocation) {
    return path.join(config.dbLocation, 'bkb_tms.db');
  }
  return path.join(app.getPath('userData'), 'bkb_tms.db');
}

function initDatabase() {
  const dbPath = getDbPath();
  fse.ensureDirSync(path.dirname(dbPath));
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 3000');

  // ─────────────────────────────────────────────────────────────────────────
  
// Migration: add is_injected to rtgs_transactions if missing
try {
    const rtgsCols = db.prepare("PRAGMA table_info(rtgs_transactions)").all().map(c => c.name);
    if (!rtgsCols.includes('is_injected')) {
        db.exec("ALTER TABLE rtgs_transactions ADD COLUMN is_injected INTEGER DEFAULT 0");
    }
} catch (e) {}

// Migration: add is_injected to eftn_transactions if missing
try {
    const eftnCols = db.prepare("PRAGMA table_info(eftn_transactions)").all().map(c => c.name);
    if (!eftnCols.includes('is_injected')) {
        db.exec("ALTER TABLE eftn_transactions ADD COLUMN is_injected INTEGER DEFAULT 0");
    }
} catch (e) {}

// CREATE TABLE — Full canonical schema matching customer_profile.html
  // Every field in the UI has a column here. New installs get the full schema.
  // ─────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (

      -- ── Identity / Primary Key ──jh
      applicant_nid       TEXT PRIMARY KEY,
      applicant_nid_10    TEXT,
      applicant_nid_17    TEXT,
      applicant_passport_no TEXT,
      applicant_passport_validity TEXT,
      applicant_birth_reg_no TEXT,

      -- ── Personal Info (Bangla) ──
      applicant_name_bn           TEXT,
      applicant_father_name_bn    TEXT,
      applicant_mother_name_bn    TEXT,
      applicant_spouse_name_bn    TEXT,

      -- ── Personal Info (English) ──
      applicant_name_en           TEXT,
      applicant_father_name_en    TEXT,
      applicant_mother_name_en    TEXT,
      applicant_spouse_name_en    TEXT,

      -- ── Core Demographics ──
      applicant_dob               TEXT,
      applicant_gender            TEXT,
      applicant_religion          TEXT,
      applicant_marital_status    TEXT,
      applicant_blood_group       TEXT,
      applicant_nationality       TEXT DEFAULT 'Bangladeshi',
      applicant_resident_status   TEXT,

      -- ── Contact ──
      applicant_mobile            TEXT,
      applicant_alt_mobile        TEXT,
      applicant_email             TEXT,
      applicant_perm_phone        TEXT,
      applicant_perm_email        TEXT,

      -- ── Present Address (Bangla) ──
      applicant_curr_addr_house   TEXT,
      applicant_curr_addr_village TEXT,
      applicant_curr_addr_post    TEXT,
      applicant_curr_addr_union   TEXT,
      applicant_curr_city_corp    TEXT,
      applicant_present_division  TEXT,
      applicant_present_district  TEXT,
      applicant_present_upozila   TEXT,

      -- ── Present Address (English) ──
      curr_addr_house_en          TEXT,
      curr_addr_village_en        TEXT,
      curr_addr_post_en           TEXT,
      curr_addr_union_en          TEXT,
      curr_city_corp_en           TEXT,
      present_division_en         TEXT,
      present_district_en         TEXT,
      present_upozila_en          TEXT,

      -- ── Permanent Address (Bangla) ──
      applicant_perm_addr_house   TEXT,
      applicant_perm_addr_village TEXT,
      applicant_perm_addr_post    TEXT,
      applicant_perm_addr_union   TEXT,
      applicant_perm_city_corp    TEXT,
      applicant_permanent_division  TEXT,
      applicant_permanent_district  TEXT,
      applicant_permanent_upozila   TEXT,

      -- ── Permanent Address (English) ──
      perm_addr_house_en          TEXT,
      perm_addr_village_en        TEXT,
      perm_addr_post_en           TEXT,
      perm_addr_union_en          TEXT,
      perm_city_corp_en           TEXT,
      permanent_division_en       TEXT,
      permanent_district_en       TEXT,
      permanent_upozila_en        TEXT,

      -- ── Financial / Identity ──
      applicant_tin               TEXT,
      applicant_farmer_card_no    TEXT,
      applicant_profession        TEXT,
      applicant_fund_source       TEXT,
      applicant_fund_source_en    TEXT,

      -- ── Education ──
      applicant_education_bn      TEXT,
      applicant_institution_bn    TEXT,
      applicant_pass_year         TEXT,
      applicant_education_en      TEXT,
      applicant_institution_en    TEXT,

      -- ── Occupation ──
      occupation_type             TEXT,
      occupation_bn               TEXT,
      occupation_en               TEXT,
      designation                 TEXT,
      designation_en              TEXT,
      employer_name               TEXT,
      employer_name_en            TEXT,
      monthly_income              TEXT,
      occupation_address          TEXT,
      occupation_address_en       TEXT,

      -- ── Photo ──
      photo                       TEXT,

      -- ── Bank Relations (stored as JSON arrays) ──
      accounts                    TEXT,
      loans                       TEXT,
      transactions                TEXT,

      -- ── AML / Compliance ──
      named_in_ctr    INTEGER DEFAULT 0,
      named_in_str    INTEGER DEFAULT 0,
      ctr_date        TEXT,
      ctr_details     TEXT,
      str_date        TEXT,
      str_details     TEXT,
      additional_data TEXT,
      is_hidden       INTEGER DEFAULT 0,

      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─────────────────────────────────────────────────────────────────────────
    -- TRANSACTION TRACKING (RTGS & EFTN)
    -- ─────────────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS rtgs_transactions (
    is_injected INTEGER DEFAULT 0,
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_nid TEXT,
      applicant_mobile TEXT,
      sender_account TEXT,
      sender_name TEXT,
      sender_address TEXT,
      receiver_name TEXT,
      receiver_account TEXT,
      receiver_address TEXT,
      receiving_bank TEXT,
      receiving_branch TEXT,
      routing_number TEXT,
      amount TEXT,
      purpose TEXT,
      sms_enable TEXT,
      cheque_number TEXT,
      cheque_date TEXT,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eftn_transactions (
    is_injected INTEGER DEFAULT 0,
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicant_nid TEXT,
      applicant_mobile TEXT,
      sender_account TEXT,
      sender_name TEXT,
      sender_title TEXT,
      receiver_name TEXT,
      receiver_account TEXT,
      receiver_account_type TEXT,
      receiver_id_phone TEXT,
      receiving_bank TEXT,
      receiving_branch TEXT,
      routing_number TEXT,
      amount TEXT,
      purpose TEXT,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS autocomplete_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostname TEXT,
      field_name TEXT,
      suggestion_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hostname, field_name, suggestion_value)
    );

    CREATE TABLE IF NOT EXISTS saved_passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostname TEXT UNIQUE,
      username TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_storage (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_nid TEXT NOT NULL,
      relative_nid TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_nid) REFERENCES customers(applicant_nid) ON DELETE CASCADE,
      FOREIGN KEY(relative_nid) REFERENCES customers(applicant_nid) ON DELETE CASCADE,
      UNIQUE(customer_nid, relative_nid, relation_type)
    );

    CREATE TABLE IF NOT EXISTS location_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      village TEXT,
      union_ward TEXT,
      post_office TEXT,
      post_code TEXT,
      thana_upazila TEXT,
      city_corporation TEXT,
      ward_no TEXT,
      district TEXT,
      division TEXT,
      village_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Schema Migration Check ---
  const tableInfo = db.pragma('table_info(customers)');
  const hasAdditionalData = tableInfo.some(col => col.name === 'additional_data');
  if (!hasAdditionalData) {
    db.exec('ALTER TABLE customers ADD COLUMN additional_data TEXT;');
    console.log('Migrated customers table: added additional_data column.');
  }

  const relTableInfo = db.pragma('table_info(customer_relationships)');
  const hasComments = relTableInfo.some(col => col.name === 'comments');
  if (!hasComments) {
    db.exec('ALTER TABLE customer_relationships ADD COLUMN comments TEXT;');
    console.log('Migrated customer_relationships table: added comments column.');
  }

  const locTableInfo = db.pragma('table_info(location_map)');
  const hasCityCorp = locTableInfo.some(col => col.name === 'city_corporation');
  if (!hasCityCorp) {
    db.exec('ALTER TABLE location_map ADD COLUMN city_corporation TEXT;');
    console.log('Migrated location_map table: added city_corporation column.');
  }
  const hasWardNo = locTableInfo.some(col => col.name === 'ward_no');
  if (!hasWardNo) {
    db.exec('ALTER TABLE location_map ADD COLUMN ward_no TEXT;');
    console.log('Migrated location_map table: added ward_no column.');
  }


  // ─────────────────────────────────────────────────────────────────────────
  // MIGRATION SAFETY NET
  // Runs on every startup. Adds any columns that don't exist yet to the
  // live database on disk. This covers users who already have a DB file
  // created before these columns were added to CREATE TABLE.
  // Rule: every column in CREATE TABLE above must also appear here.
  // ─────────────────────────────────────────────────────────────────────────
  const columns = db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
  const requiredColumns = [
    // ── Identity ──
    { name: 'is_hidden', type: 'INTEGER DEFAULT 0' },
    { name: 'applicant_nid_10', type: 'TEXT' },
    { name: 'applicant_nid_17', type: 'TEXT' },
    { name: 'applicant_passport_no', type: 'TEXT' },
    { name: 'applicant_passport_validity', type: 'TEXT' },
    { name: 'applicant_birth_reg_no', type: 'TEXT' },
    // ── Personal (Bangla) ──
    { name: 'applicant_spouse_name_bn', type: 'TEXT' },
    // ── Personal (English) ──
    { name: 'applicant_father_name_en', type: 'TEXT' },
    { name: 'applicant_mother_name_en', type: 'TEXT' },
    { name: 'applicant_spouse_name_en', type: 'TEXT' },
    // ── Core Demographics ──
    { name: 'applicant_dob', type: 'TEXT' },
    { name: 'applicant_gender', type: 'TEXT' },
    { name: 'applicant_religion', type: 'TEXT' },
    { name: 'applicant_marital_status', type: 'TEXT' },
    { name: 'applicant_blood_group', type: 'TEXT' },
    // ── Photo ──
    { name: 'photo', type: 'TEXT' },
    // ── Contact ──
    { name: 'applicant_alt_mobile', type: 'TEXT' },
    { name: 'applicant_perm_phone', type: 'TEXT' },
    { name: 'applicant_perm_email', type: 'TEXT' },
    // ── Present Address (Bangla) ──
    { name: 'applicant_curr_addr_house', type: 'TEXT' },
    { name: 'applicant_curr_addr_union', type: 'TEXT' },
    { name: 'applicant_curr_city_corp', type: 'TEXT' },
    { name: 'applicant_curr_addr_post_code', type: 'TEXT' },
    // ── Present Address (English) ──
    { name: 'curr_addr_house_en', type: 'TEXT' },
    { name: 'curr_addr_village_en', type: 'TEXT' },
    { name: 'curr_addr_post_en', type: 'TEXT' },
    { name: 'curr_addr_post_code_en', type: 'TEXT' },
    { name: 'curr_addr_union_en', type: 'TEXT' },
    { name: 'curr_city_corp_en', type: 'TEXT' },
    { name: 'present_division_en', type: 'TEXT' },
    { name: 'present_district_en', type: 'TEXT' },
    { name: 'present_upozila_en', type: 'TEXT' },
    // ── Permanent Address (Bangla) ──
    { name: 'applicant_perm_addr_house', type: 'TEXT' },
    { name: 'applicant_perm_addr_village', type: 'TEXT' },
    { name: 'applicant_perm_addr_post', type: 'TEXT' },
    { name: 'applicant_perm_addr_post_code', type: 'TEXT' },
    { name: 'applicant_perm_addr_union', type: 'TEXT' },
    { name: 'applicant_perm_city_corp', type: 'TEXT' },
    // ── Permanent Address (English) ──
    { name: 'perm_addr_house_en', type: 'TEXT' },
    { name: 'perm_addr_village_en', type: 'TEXT' },
    { name: 'perm_addr_post_en', type: 'TEXT' },
    { name: 'perm_addr_post_code_en', type: 'TEXT' },
    { name: 'perm_addr_union_en', type: 'TEXT' },
    { name: 'perm_city_corp_en', type: 'TEXT' },
    { name: 'permanent_division_en', type: 'TEXT' },
    { name: 'permanent_district_en', type: 'TEXT' },
    { name: 'permanent_upozila_en', type: 'TEXT' },
    // ── Financial ──
    { name: 'applicant_profession', type: 'TEXT' },
    { name: 'applicant_fund_source', type: 'TEXT' },
    { name: 'applicant_fund_source_en', type: 'TEXT' },
    { name: 'applicant_tin', type: 'TEXT' },
    { name: 'applicant_farmer_card_no', type: 'TEXT' },
    // ── Education ──
    { name: 'applicant_education_bn', type: 'TEXT' },
    { name: 'applicant_institution_bn', type: 'TEXT' },
    { name: 'applicant_pass_year', type: 'TEXT' },
    { name: 'applicant_education_en', type: 'TEXT' },
    { name: 'applicant_institution_en', type: 'TEXT' },
    // ── Occupation ──
    { name: 'occupation_bn', type: 'TEXT' },
    { name: 'designation', type: 'TEXT' },
    { name: 'designation_en', type: 'TEXT' },
    { name: 'employer_name', type: 'TEXT' },
    { name: 'employer_name_en', type: 'TEXT' },
    { name: 'occupation_address', type: 'TEXT' },
    { name: 'occupation_address_en', type: 'TEXT' },
    // ── AML / Compliance ──
    { name: 'ctr_date', type: 'TEXT' },
    { name: 'str_date', type: 'TEXT' },
  ];

  let migrated = 0;
  requiredColumns.forEach(col => {
    if (!columns.includes(col.name)) {
      db.prepare(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`[DB Migration] Added column: ${col.name}`);
      migrated++;
    }
  });
  if (migrated > 0) console.log(`[DB Migration] Done — ${migrated} column(s) added to customers table.`);
  else console.log('[DB Migration] Schema is up to date. No changes needed.');

  // Fix old receiver profiles
  try {
    const res = db.prepare(`UPDATE customers SET is_hidden = 1 WHERE applicant_nid LIKE 'TEMP-%-REC-%'`).run();
    if (res.changes > 0) {
      console.log(`[DB Migration] Hid ${res.changes} old receiver profiles.`);
    }
  } catch (e) {
    console.error('Error hiding old receiver profiles:', e.message);
  }

  // ── RTGS Transactions Migration ──
  try {
    const rtgsColumns = db.prepare("PRAGMA table_info(rtgs_transactions)").all().map(c => c.name);
    const requiredRtgsColumns = [
      { name: 'sender_name', type: 'TEXT' },
      { name: 'sender_address', type: 'TEXT' },
      { name: 'receiver_address', type: 'TEXT' },
      { name: 'sms_enable', type: 'TEXT' },
      { name: 'cheque_number', type: 'TEXT' },
      { name: 'cheque_date', type: 'TEXT' }
    ];
    requiredRtgsColumns.forEach(col => {
      if (!rtgsColumns.includes(col.name)) {
        db.prepare(`ALTER TABLE rtgs_transactions ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`[DB Migration] Added column to rtgs_transactions: ${col.name}`);
      }
    });
  } catch (e) {
    console.error('Error migrating rtgs_transactions:', e.message);
  }

  // ── EFTN Transactions Migration ──
  try {
    const eftnColumns = db.prepare("PRAGMA table_info(eftn_transactions)").all().map(c => c.name);
    const requiredEftnColumns = [
      { name: 'sender_name', type: 'TEXT' },
      { name: 'sender_title', type: 'TEXT' },
      { name: 'receiver_account_type', type: 'TEXT' },
      { name: 'receiver_id_phone', type: 'TEXT' }
    ];
    requiredEftnColumns.forEach(col => {
      if (!eftnColumns.includes(col.name)) {
        db.prepare(`ALTER TABLE eftn_transactions ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`[DB Migration] Added column to eftn_transactions: ${col.name}`);
      }
    });
  } catch (e) {
    console.error('Error migrating eftn_transactions:', e.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA NORMALIZATION: Ensure all English names are stored in UPPER CASE
  // This runs on every startup and is safe to run multiple times (idempotent).
  // It fixes any records saved before the uppercase requirement was enforced.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const rowsToFix = db.prepare(
      `SELECT applicant_nid, applicant_name_en FROM customers
       WHERE applicant_name_en IS NOT NULL
         AND applicant_name_en != ''
         AND applicant_name_en != UPPER(applicant_name_en)`
    ).all();

    if (rowsToFix.length > 0) {
      const updateName = db.prepare(
        `UPDATE customers SET applicant_name_en = UPPER(applicant_name_en)
         WHERE applicant_nid = ?`
      );
      const updateAll = db.transaction((rows) => {
        for (const row of rows) updateName.run(row.applicant_nid);
      });
      updateAll(rowsToFix);
      console.log(`[DB Normalize] Uppercased applicant_name_en for ${rowsToFix.length} record(s).`);
    } else {
      console.log('[DB Normalize] All English names already in uppercase.');
    }
  } catch (e) {
    console.error('[DB Normalize] Failed to uppercase names:', e.message);
  }
}

// Initialize the print IPC listeners

ipcMain.handle('open-file-manager', (event, filePath) => {
    const { shell, app } = require('electron');
    if (filePath) {
        shell.showItemInFolder(filePath);
    } else {
        shell.openPath(app.getPath('downloads'));
    }
});

setupPrintHandlers();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'images', 'launch_icon.ico'),
    webPreferences: {
      partition: 'persist:bkb_session', // Use a persistent partition for better cookie handling
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // Allows renderer scripts to access iframe contentDocument
      nodeIntegration: true,   // Essential for direct DOM access in this setup (though not directly used for webviews)
      webviewTag: true,        // CRITICAL: Enables the <webview> tag in the renderer process
      webSecurity: false,
      allowRunningInsecureContent: true, // Crucial for internal HTTP portals
    },
  });

  // Set a standard browser User Agent to prevent portals from blocking Electron
  win.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  // CRITICAL FIX: Get the actual session being used by your window partition
  const ses = win.webContents.session;

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // level 2 is warning, 3 is error. Filter out the noisy cookie warnings.
      if (level >= 2 && !message.includes('Third-party cookie')) {
          const type = level === 3 ? 'Error' : 'Warning';
          console.log(`[Renderer ${type}] ${message} at ${sourceId}:${line}`);
      }
  });

  // Intercept and modify response headers for the BKB session
  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders;

    // More robust removal of security headers to allow embedding
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'frame-options',
      'x-content-type-options'
    ];
    for (const header in responseHeaders) {
      if (headersToRemove.includes(header.toLowerCase())) delete responseHeaders[header];
    }

    // Fix cookies for iframes: Force SameSite=None and Secure
    // This allows sessions to stay active inside the app shell
    if (responseHeaders['set-cookie']) {
      const isHttps = details.url.startsWith('https:');
      responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map((cookie) => {
        // IMPORTANT: Only force 'Secure' and 'SameSite=None' for HTTPS connections.
        // For internal HTTP portals (like CBS/Report), forcing 'Secure' will cause the browser to reject the cookie.
        if (isHttps && !cookie.toLowerCase().includes('samesite=none')) {
          return cookie.split(';')[0] + '; SameSite=None; Secure';
        }
        return cookie;
      });
    }

    callback({
      cancel: false,
      responseHeaders: responseHeaders,
    });
  });

  // Handle logins that try to open a new window or "pop-up" after success
  win.webContents.setWindowOpenHandler(({ url }) => {
    // This allows redirects that try to open new tabs to stay functional
    return { action: 'allow' };
  });

  const handleDownload = (event, item, webContents) => {
    const downloadsPath = app.getPath('downloads');
    let originalName = item.getFilename();
    let ext = path.extname(originalName);
    let base = path.basename(originalName, ext);

    let finalPath = path.join(downloadsPath, originalName);
    let counter = 1;
    while (fse.existsSync(finalPath)) {
      finalPath = path.join(downloadsPath, `${base} (${counter})${ext}`);
      counter++;
    }
    item.setSavePath(finalPath);

    item.once('done', (event, state) => {
      if (state === 'completed') {
        win.webContents.send('download-completed', {
          filename: path.basename(finalPath),
          filePath: finalPath
        });
      }
    });
  };

  ses.on('will-download', handleDownload);
  session.fromPartition('persist:portal').on('will-download', handleDownload);
  session.fromPartition('persist:bkb-automation').on('will-download', handleDownload);

  win.loadFile('index.html');
  

  // win.webContents.openDevTools();
}

// IPC Handlers for Database Operations

ipcMain.on('cbs-field-input', (event, path, selector, value) => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('cbs-field-autosave', { path, selector, value });
  }
});

// --- DRAFT LOGIC ---
ipcMain.handle('db-save-draft', (event, draft) => {
  const stmt = db.prepare(`
    INSERT INTO drafts (id, form_type, customer_name, form_data)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    form_data = excluded.form_data,
    customer_name = excluded.customer_name,
    updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(draft.id, draft.form_type, draft.customer_name, JSON.stringify(draft.form_data));
});

ipcMain.handle('db-get-drafts', () => {
  return db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all();
});

ipcMain.handle('db-delete-draft', (event, id) => {
  return db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
});

// --- App Storage (LocalStorage Replacement) ---
ipcMain.on('db-get-kv', (event, key) => {
  try {
    const row = db.prepare('SELECT value FROM app_storage WHERE key = ?').get(key);
    event.returnValue = row ? row.value : null;
  } catch (error) {
    console.error('db-get-kv error:', error);
    event.returnValue = null;
  }
});

ipcMain.on('db-set-kv', (event, key, value) => {
  try {
    let strVal = (value !== null && typeof value === 'object') ? JSON.stringify(value) : String(value);
    db.prepare('INSERT OR REPLACE INTO app_storage (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, strVal);
    event.returnValue = true;
  } catch (error) {
    console.error('db-set-kv error:', error);
    event.returnValue = false;
  }
});

ipcMain.on('db-delete-kv', (event, key) => {
  try {
    db.prepare('DELETE FROM app_storage WHERE key = ?').run(key);
    event.returnValue = true;
  } catch (error) {
    console.error('db-delete-kv error:', error);
    event.returnValue = false;
  }
});

ipcMain.on('db-clear-kv', (event) => {
  try {
    db.prepare('DELETE FROM app_storage').run();
    event.returnValue = true;
  } catch (error) {
    console.error('db-clear-kv error:', error);
    event.returnValue = false;
  }
});

ipcMain.on('db-get-all-kv', (event) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_storage').all();
    const result = {};
    rows.forEach(row => result[row.key] = row.value);
    event.returnValue = result;
  } catch (error) {
    console.error('db-get-all-kv error:', error);
    event.returnValue = {};
  }
});

// --- App Export/Import ---
ipcMain.handle('app-full-export', async (event, settings, suggestedName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const defaultName = suggestedName || `BKB_TMS_Backup_${Date.now()}.bkb`;
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export BKB Work & Database',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: 'BKB Backup Files', extensions: ['bkb'] }]
  });

  if (canceled || !filePath) return { success: false };

  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const databaseExport = {};
    for (const table of tables) {
      databaseExport[table.name] = db.prepare(`SELECT * FROM ${table.name}`).all();
    }

    const backupData = {
      version: '1.0',
      timestamp: Date.now(),
      settings: settings, // Passed from window.AppStorage
      database: databaseExport
    };

    await fse.outputJson(filePath, backupData);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('app-get-db-location', (event) => {
  return getDbPath();
});

ipcMain.handle('app-change-db-location', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Select Database Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || filePaths.length === 0) return { success: false };

  const newDir = filePaths[0];
  const newDbPath = path.join(newDir, 'bkb_tms.db');
  const currentDbPath = getDbPath();

  if (newDir === path.dirname(currentDbPath)) {
    return { success: false, error: 'Directory is already the current database location.' };
  }

  try {
    // Copy the current database to the new location (both db and wal/shm if present)
    if (fse.existsSync(currentDbPath)) {
      fse.copySync(currentDbPath, newDbPath);
    }
    if (fse.existsSync(currentDbPath + '-wal')) fse.copySync(currentDbPath + '-wal', newDbPath + '-wal');
    if (fse.existsSync(currentDbPath + '-shm')) fse.copySync(currentDbPath + '-shm', newDbPath + '-shm');

    // Update config
    const config = getConfig();
    config.dbLocation = newDir;
    saveConfig(config);

    // Prompt user that app needs to restart
    dialog.showMessageBoxSync(win, {
      type: 'info',
      title: 'Database Location Changed',
      message: 'The database has been moved successfully. The application will now restart to apply changes.'
    });

    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (error) {
    console.error('Error changing DB location:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('app-full-import', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Import BKB Work & Database',
    filters: [{ name: 'BKB Backup Files', extensions: ['bkb'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return { success: false };

  try {
    const backupData = await fse.readJson(filePaths[0]);

    const runImport = db.transaction((data) => {
      for (const [tableName, rows] of Object.entries(data.database)) {
        if (!tableName || tableName.startsWith('sqlite_')) continue;
        
        try {
          db.prepare(`DELETE FROM ${tableName}`).run();
          
          if (rows && rows.length > 0) {
            const columns = Object.keys(rows[0] || {});
            if (columns.length > 0) {
              const insertQuery = db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
              for (const row of rows) {
                insertQuery.run(...columns.map(col => row[col]));
              }
            }
          }
        } catch (e) {
          console.error(`Skipping table ${tableName} during import due to error:`, e.message);
        }
      }
    });

    runImport(backupData);

    return { success: true, settings: backupData.settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-save-customer', (event, customer) => {
    const original_nid = customer.original_nid;
    delete customer.original_nid;

    // Normalize BKB account numbers: insert hyphen after 4th digit (branch code separator)
    function normalizeBkbAccount(ac) {
        if (!ac) return ac;
        const clean = String(ac).replace(/[^0-9a-zA-Z]/g, '');
        if (clean.length >= 5) return clean.slice(0, 4) + '-' + clean.slice(4);
        return clean;
    }
    if (customer.accounts) {
        try {
            let accs = typeof customer.accounts === 'string' ? JSON.parse(customer.accounts) : customer.accounts;
            if (Array.isArray(accs)) {
                accs = accs.map(a => {
                    if (a.account_no) a.account_no = normalizeBkbAccount(a.account_no);
                    return a;
                });
                customer.accounts = JSON.stringify(accs);
            }
        } catch(e) { /* leave as-is if not parseable */ }
    }

    if (original_nid && original_nid !== customer.applicant_nid) {
        db.prepare('UPDATE customers SET applicant_nid = ? WHERE applicant_nid = ?').run(customer.applicant_nid, original_nid);
    }

  // Get valid columns from database schema
  const tableInfo = db.pragma('table_info(customers)');
  const validColumns = tableInfo.map(col => col.name);

  const structuredData = {};
  const unstructuredData = {};

  for (const [key, value] of Object.entries(customer)) {
    if (validColumns.includes(key)) {
      structuredData[key] = value;
    } else {
      unstructuredData[key] = value;
    }
  }

  // If there are unstructured keys, store them in additional_data
  if (Object.keys(unstructuredData).length > 0) {
    let mergedAdditional = { ...unstructuredData };
    if (structuredData.additional_data) {
        try {
            const existingAdd = JSON.parse(structuredData.additional_data);
            mergedAdditional = { ...existingAdd, ...mergedAdditional };
        } catch (e) {
            // ignore
        }
    }
    structuredData.additional_data = JSON.stringify(mergedAdditional);
  }

  const columns = Object.keys(structuredData).join(', ');
  const placeholders = Object.keys(structuredData).map(() => '?').join(', ');
  const values = Object.values(structuredData);

  const upsertSql = `
    INSERT INTO customers (${columns})
    VALUES (${placeholders})
    ON CONFLICT(applicant_nid) DO UPDATE SET 
    ${Object.keys(structuredData).filter(k => k !== 'applicant_nid').map(col => `${col} = excluded.${col}`).join(', ')},
    updated_at = CURRENT_TIMESTAMP
  `;

  try {
    const stmt = db.prepare(upsertSql);
    const result = stmt.run(...values);
    return { success: true, data: result };
  } catch (error) {
    console.error('db-save-customer error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-sync-loan-status', (event, updates) => {
    // updates is an array of { account_no: "...", status: "..." }
    if (!Array.isArray(updates) || updates.length === 0) return { success: true };
    try {
        const getCustomers = db.prepare('SELECT applicant_nid, loans FROM customers WHERE loans IS NOT NULL AND loans != ""');
        const updateCustomer = db.prepare('UPDATE customers SET loans = ?, updated_at = CURRENT_TIMESTAMP WHERE applicant_nid = ?');
        
        let modifiedCount = 0;
        const customers = getCustomers.all();
        
        const updatesMap = {};
        updates.forEach(u => {
            const acc = (u.account_no || '').toString().trim();
            if (acc) updatesMap[acc] = u.status;
        });

        for (const customer of customers) {
            let isModified = false;
            let loansArray;
            try {
                loansArray = JSON.parse(customer.loans);
                if (Array.isArray(loansArray)) {
                    loansArray.forEach(loan => {
                        const acc1 = (loan.cbs_account_no || '').toString().trim();
                        const acc2 = (loan.loan_case_no || '').toString().trim();
                        const acc3 = (loan.account_no || '').toString().trim();
                        
                        let targetStatus = updatesMap[acc1] || updatesMap[acc2] || updatesMap[acc3];
                        if (targetStatus && loan.status !== targetStatus) {
                            loan.status = targetStatus;
                            isModified = true;
                        }
                    });
                }
            } catch (e) { continue; }
            
            if (isModified) {
                updateCustomer.run(JSON.stringify(loansArray), customer.applicant_nid);
                modifiedCount++;
            }
        }
        return { success: true, count: modifiedCount };
    } catch (e) {
        console.error('db-sync-loan-status error:', e);
        return { success: false, error: e.message };
    }
});


ipcMain.handle('app-apply-update', async (event) => {
    try {
        const { dialog } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const { spawn } = require('child_process');
        
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Select Update File',
            filters: [{ name: 'Electron Archive', extensions: ['asar'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) {
            return { error: 'cancelled' };
        }

        const sourceFile = filePaths[0];
        const appDir = path.dirname(app.getPath('exe'));
        const updateFile = path.join(appDir, 'update.asar');
        const targetFile = path.join(appDir, 'resources', 'app.asar');
        
        fs.copyFileSync(sourceFile, updateFile);

        const batScript = path.join(appDir, 'updater.bat');
        const exePath = app.getPath('exe');

        const batContent = `@echo off
echo Updating BKB TMS...
ping 127.0.0.1 -n 3 > nul
del /f /q "${targetFile}"
move /y "${updateFile}" "${targetFile}"
start "" "${exePath}"
del "%~f0"
`;
        fs.writeFileSync(batScript, batContent, 'utf8');

        const child = spawn('cmd.exe', ['/c', batScript], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();

        setTimeout(() => {
            app.quit();
        }, 500);

        return { success: true };
    } catch (error) {
        console.error('Update operation failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('app-reset-data', async () => {
  try {
    // Clear all tables containing user biographical data and work history
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM drafts').run();
    db.prepare('DELETE FROM tasks').run();
    // Reclaim space and reset the database file optimization
    db.prepare('VACUUM').run();
    console.log('Application data has been wiped fresh.');
    return { success: true };
  } catch (error) {
    console.error('Reset operation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-customer', (event, nid) => {
  return db.prepare('SELECT * FROM customers WHERE applicant_nid = ?').get(nid);
});

ipcMain.handle('db-get-all-customers', (event) => {
  try {
    return { success: true, data: db.prepare('SELECT * FROM customers').all() };
  } catch (error) {
    console.error('db-get-all-customers error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete-customer', (event, nid) => {
  try {
    db.prepare('DELETE FROM customers WHERE applicant_nid = ?').run(nid);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-save-relationship', (event, customerNid, relativeNid, relationType, comments) => {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO customer_relationships (customer_nid, relative_nid, relation_type, comments)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(customerNid, relativeNid, relationType, comments || '');
    return { success: true };
  } catch (error) {
    console.error('db-save-relationship error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-relationships', (event, nid) => {
  try {
    return db.prepare(`
      SELECT r.relation_type, r.comments, c.* FROM customer_relationships r
      JOIN customers c ON r.relative_nid = c.applicant_nid
      WHERE r.customer_nid = ?
    `).all(nid);
  } catch (error) {
    console.error('db-get-relationships error:', error);
    return [];
  }
});

ipcMain.handle('db-delete-relationship', (event, customerNid, relativeNid, relationType) => {
  try {
    db.prepare('DELETE FROM customer_relationships WHERE customer_nid = ? AND relative_nid = ? AND relation_type = ?').run(customerNid, relativeNid, relationType);
    return { success: true };
  } catch (error) {
    console.error('db-delete-relationship error:', error);
    return { success: false, error: error.message };
  }
});

// --- Transaction Tracking ---
ipcMain.handle('db-save-transaction', (event, type, data) => {
  const table = type === 'rtgs' ? 'rtgs_transactions' : 'eftn_transactions';
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);

  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);
  return stmt.run(...values);
});

ipcMain.handle('db-get-transactions-by-date', (event, dateStr, type) => {
  try {
    const table = type.toUpperCase() === 'RTGS' ? 'rtgs_transactions' : 'eftn_transactions';
    const idColumn = type.toUpperCase() === 'RTGS' ? 'rowid as id' : 'id';
    const stmt = db.prepare(`SELECT '${type.toUpperCase()}' as type, ${idColumn}, * FROM ${table} WHERE created_at LIKE ? ORDER BY created_at DESC`);
    return stmt.all(dateStr + '%');
  } catch (error) {
    console.error('db-get-transactions-by-date error:', error);
    return [];
  }
});

ipcMain.handle('db-get-transactions', (event, nid, mobile) => {
  const rtgs = db.prepare(`SELECT 'RTGS' as type, rowid as id, * FROM rtgs_transactions WHERE applicant_nid = ? OR applicant_mobile = ? ORDER BY created_at DESC`).all(nid, mobile);
  const eftn = db.prepare(`SELECT 'EFTN' as type, id, * FROM eftn_transactions WHERE applicant_nid = ? OR applicant_mobile = ? ORDER BY created_at DESC`).all(nid, mobile);

  // Combine and sort by creation date
  const combined = [...rtgs, ...eftn].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return combined;
});


ipcMain.handle('db-mark-transaction-injected', (event, type, id) => {
    try {
        const table = type.toUpperCase() === 'RTGS' ? 'rtgs_transactions' : 'eftn_transactions';
        const idColumn = type.toUpperCase() === 'RTGS' ? 'rowid' : 'id';
        const res = db.prepare(`UPDATE ${table} SET is_injected = 1 WHERE ${idColumn} = ?`).run(id);
        return { success: true, changes: res.changes };
    } catch (error) {
        console.error('db-mark-transaction-injected error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-delete-transaction', (event, type, id) => {
  try {
    const table = type.toUpperCase() === 'RTGS' ? 'rtgs_transactions' : 'eftn_transactions';
    const idColumn = type.toUpperCase() === 'RTGS' ? 'rowid' : 'id';
    const res = db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).run(id);
    return { success: true, changes: res.changes };
  } catch (error) {
    console.error('db-delete-transaction error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-search-customers', (event, query) => {
  const searchPattern = `%${query}%`;
  return db.prepare(
    `SELECT * FROM customers
     WHERE (applicant_name_en LIKE ?
        OR applicant_name_bn LIKE ?
        OR applicant_nid LIKE ?
        OR applicant_nid_10 LIKE ?
        OR applicant_nid_17 LIKE ?
        OR applicant_birth_reg_no LIKE ?
        OR applicant_mobile LIKE ?)
       AND (is_hidden IS NULL OR is_hidden = 0)
     ORDER BY applicant_name_bn COLLATE NOCASE ASC`
  ).all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
});

// ==========================================
// DYNAMIC DB MANAGER HANDLERS
// ==========================================

ipcMain.handle('db-get-all-tables', (event) => {
    try {
        const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%'");
        return stmt.all();
    } catch (error) {
        console.error('db-get-all-tables error:', error);
        return [];
    }
});

ipcMain.handle('db-get-all-records', (event, tableName) => {
    try {
        // Basic SQL injection protection (only allow known tables)
        const allowedTables = db.prepare("SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
        if (!allowedTables.includes(tableName)) throw new Error('Invalid table name');
        
        const stmt = db.prepare(`SELECT * FROM ${tableName} ORDER BY rowid DESC`);
        return stmt.all();
    } catch (error) {
        console.error('db-get-all-records error:', error);
        return [];
    }
});

ipcMain.handle('db-delete-record', (event, tableName, pkColumn, pkValue) => {
    try {
        // Basic SQL injection protection
        const allowedTables = db.prepare("SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
        if (!allowedTables.includes(tableName)) throw new Error('Invalid table name');
        
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        if (!columns.includes(pkColumn) && pkColumn !== 'rowid') throw new Error('Invalid column name');

        const stmt = db.prepare(`DELETE FROM ${tableName} WHERE ${pkColumn} = ?`);
        stmt.run(pkValue);
        return { success: true };
    } catch (error) {
        console.error('db-delete-record error:', error);
        return { success: false, error: error.message };
    }
});

// Autocomplete and Password Manager IPCs
ipcMain.handle('get-autocomplete-suggestions', (event, hostname, field_name) => {
  try {
    const rows = db.prepare('SELECT suggestion_value FROM autocomplete_suggestions WHERE hostname = ? AND field_name = ? ORDER BY created_at DESC LIMIT 10').all(hostname, field_name);
    return rows.map(r => r.suggestion_value);
  } catch (e) {
    console.error('Autocomplete get error', e);
    return [];
  }
});

ipcMain.on('save-autocomplete-suggestion', (event, hostname, field_name, suggestion_value) => {
  try {
    db.prepare('INSERT OR IGNORE INTO autocomplete_suggestions (hostname, field_name, suggestion_value) VALUES (?, ?, ?)').run(hostname, field_name, suggestion_value);
  } catch (e) {
    console.error('Autocomplete save error', e);
  }
});

ipcMain.handle('get-saved-password', (event, hostname) => {
  try {
    return db.prepare('SELECT username, password FROM saved_passwords WHERE hostname = ?').get(hostname);
  } catch (e) {
    return null;
  }
});

ipcMain.on('save-password', (event, hostname, username, password) => {
  try {
    db.prepare(`
      INSERT INTO saved_passwords (hostname, username, password) 
      VALUES (?, ?, ?) 
      ON CONFLICT(hostname) DO UPDATE SET username=excluded.username, password=excluded.password, created_at=CURRENT_TIMESTAMP
    `).run(hostname, username, password);
  } catch (e) {
    console.error('Password save error', e);
  }
});

ipcMain.on('offer-save-password', (event, hostname, username, password) => {
  // Check electron-store for existing password
  let isUpdate = false;
  try {
      if (store) {
          const credentials = store.get('saved_credentials') || {};
          if (credentials[hostname]) {
              const cred = credentials[hostname];
              // If we already saved 'Never' for this site, ignore
              if (cred.neverSave) return;
              
              if (cred.username === username) {
                  // Decrypt to check if password changed
                  const buffer = Buffer.from(cred.passwordBlob, 'base64');
                  let decrypted;
                  if (safeStorage.isEncryptionAvailable()) {
                      decrypted = safeStorage.decryptString(buffer);
                  } else {
                      decrypted = buffer.toString('utf8');
                  }
                  
                  if (decrypted === password) return; // Password unchanged, do not prompt
                  isUpdate = true;
              }
          }
      }
  } catch(e) { console.error(e); }

  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('show-password-prompt', hostname, username, password, isUpdate);
  }
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

// Handle Certificate errors (Common for internal bank/NID portals)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Only do this if you trust the network/portal you are connecting to
  event.preventDefault();
  callback(true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


// ==========================================
// ELECTRON-STORE & SECURE PASSWORD MANAGER
// ==========================================
let store;
(async () => {
    try {
        const Store = (await import('electron-store')).default;
        store = new Store();
    } catch (err) {
        console.error('Failed to initialize electron-store:', err);
    }
})();

ipcMain.handle('secure-save-password', (event, domain, username, password) => {
    try {
        if (!store) throw new Error('Store not initialized');
        let credentials = store.get('saved_credentials') || {};
        
        if (password === 'NEVER_SAVE_FLAG_INTERNAL_89123') {
            credentials[domain] = { neverSave: true, timestamp: Date.now() };
            store.set('saved_credentials', credentials);
            return { success: true };
        }
        
        // Encrypt the password string to a buffer
        let encryptedBuffer;
        if (safeStorage.isEncryptionAvailable()) {
            encryptedBuffer = safeStorage.encryptString(password);
        } else {
            // Fallback if OS vault is unavailable (not recommended but necessary for some Linux setups without libsecret)
            console.warn('safeStorage is not available. Saving as plain text buffer fallback.');
            encryptedBuffer = Buffer.from(password, 'utf8');
        }

        // Store as base64 string because electron-store JSON can't natively serialize raw buffers efficiently
        credentials[domain] = {
            username: username,
            passwordBlob: encryptedBuffer.toString('base64'),
            timestamp: Date.now()
        };
        
        store.set('saved_credentials', credentials);
        return { success: true };
    } catch (e) {
        console.error('secure-save-password error:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('secure-get-password', (event, domain) => {
    try {
        if (!store) return null;
        const credentials = store.get('saved_credentials') || {};
        if (!credentials[domain]) return null;
        
        const cred = credentials[domain];
        let decryptedPassword;
        
        const buffer = Buffer.from(cred.passwordBlob, 'base64');
        if (safeStorage.isEncryptionAvailable()) {
            decryptedPassword = safeStorage.decryptString(buffer);
        } else {
            decryptedPassword = buffer.toString('utf8');
        }
        
        return {
            username: cred.username,
            password: decryptedPassword
        };
    } catch (e) {
        console.error('secure-get-password error:', e);
        return null;
    }
});



// ==========================================
// AUTOCOMPLETE SUGGESTIONS HANDLERS
// ==========================================

ipcMain.handle('db-get-suggestions', (event, fieldName) => {
    try {
        const stmt = db.prepare('SELECT suggestion_value FROM autocomplete_suggestions WHERE field_name = ? ORDER BY created_at DESC');
        return stmt.all(fieldName).map(row => row.suggestion_value);
    } catch (error) {
        console.error('db-get-suggestions error:', error);
        return [];
    }
});

ipcMain.handle('db-save-suggestion', (event, fieldName, suggestionValue) => {
    try {
        // We use INSERT OR IGNORE because the table has a UNIQUE constraint on (hostname, field_name, suggestion_value)
        // Wait, the unique constraint includes hostname. We'll use 'localhost' as default for offline forms.
        const stmt = db.prepare('INSERT OR IGNORE INTO autocomplete_suggestions (hostname, field_name, suggestion_value) VALUES (?, ?, ?)');
        stmt.run('localhost', fieldName, suggestionValue);
        return { success: true };
    } catch (error) {
        console.error('db-save-suggestion error:', error);
        return { success: false };
    }
});

// Location Database IPC Handlers
ipcMain.handle('db-get-locations', (event) => {
    try {
        return db.prepare('SELECT * FROM location_map ORDER BY id ASC').all();
    } catch (error) {
        console.error('db-get-locations error:', error);
        return [];
    }
});

ipcMain.handle('db-upload-locations', (event, locations) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM location_map').run();
            const stmt = db.prepare('INSERT INTO location_map (village, union_ward, post_office, post_code, city_corporation, ward_no, village_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
            
            for (const loc of locations) {
                stmt.run(
                    loc.village || '',
                    loc.union_ward || '',
                    loc.post_office || '',
                    loc.post_code || '',
                    loc.city_corporation || '',
                    loc.ward_no || '',
                    loc.village_code || ''
                );
            }
        })();
        
        return { success: true };
    } catch (error) {
        console.error('db-upload-locations error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-update-location', (event, loc) => {
    try {
        const stmt = db.prepare(`
            UPDATE location_map 
            SET village = ?, union_ward = ?, post_office = ?, post_code = ?, thana_upazila = ?, district = ?, division = ?, village_code = ?
            WHERE id = ?
        `);
        stmt.run(
            loc.village || '',
            loc.union_ward || '',
            loc.post_office || '',
            loc.post_code || '',
            loc.thana_upazila || '',
            loc.district || '',
            loc.division || '',
            loc.village_code || '',
            loc.id
        );
        return { success: true };
    } catch (error) {
        console.error('db-update-location error:', error);
        return { success: false, error: error.message };
    }
});

