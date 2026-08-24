# BKB TMS - Implementation Status & Roadmap

## Current Project State (As of Last Session)

### 1. Forms Completed and Integrated
- **Savings Account Form (`sb_ac_form.html`)**: Integrated & complete.
- **DPS/MSS Form (`dps_mss_form.html`)**: Integrated & complete.
- **Deposit Loan (`deposit_loan.html`)**: Integrated & complete.
- **CMSME Loan Module (`cmsme_loan.html`)**: Layout architecture complete, heavily customized for dense data entry.

### 2. CMSME Layout & UI Innovations
Significant work has been done on `cmsme_loan.html` to optimize it for small screens (19.5" monitors) using ultra-dense CSS grids:
- **Ultra-Dense CSS Grid**: The main form utilizes a 12-column underlying structure to pack data tightly. For instance, the *Loan Information (ঋণ সংক্রান্ত তথ্য)* section was compressed into a custom 6-column, 2-row grid.
- **Hybrid Tables**: The land valuation tables now feature dynamic row additions (Bata Dag logic) and automated area/value summation, ported over from the Agri Loan module design.
- **Font-Size Standardization**: Standard table headers are set at `12.5pt`, and dense property labels are set to `13px` or inherit the global `12pt` (`প্রাক নির্ধারণী তথ্য`), ensuring high visibility without compromising the compact footprint.
- **Automated Fields**: 
  - *Expiry Date (মেয়াদোত্তীর্ণের তারিখ)* auto-calculates based on Sanction Date and Tenure inputs.
  - *Case No (ঋণ নথি নম্বর)* is built via a real-time JS string concatenation derived from input subsets (e.g., `[Num]([Sector])([BizType])/[Year]`).

### 3. Database & Customer Schema
- Customer data is actively governed by `data/customer_schema.md`.
- Inputs must follow structured `id` conventions (e.g., `input_applicant_name_bn`, `input_branch_name`). 
- When an input's ID matches the global schema, `app-logic.js` automatically populates it if data exists in `bkb_tms.db`.

## Pending Roadmap & Next Steps

1. **Interest Calculator (`forms/calculators/interest_calculator.html`)**
   - Requires bringing the UI up to standard with the BKB TMS theme.
   - Implement bridging logic so that calculation results can be pushed to loan forms.

2. **Salary & Bills / Transactions Integration**
   - Need to wire up the UI for `lunch_bill.html`, `eftn.html`, and `rtgs.html` into the main App Shell's routing.
   - Establish specialized SQLite tables for transaction logging if needed, mirroring the customer profile architecture.

3. **Global Script Optimization**
   - Temporary injection scripts (like `fix_*.js`, `inject_*.js`) have been cleared from the root `/scratch` and main directories.
   - Future JS logic specific to a single form should ideally be embedded within the form's `<script>` tags, while cross-form logic should sit in `/assets/app-logic.js`.

## Moving Machines Context
To successfully continue work on the new machine:
1. Ensure Node.js and Electron dependencies are freshly installed via `npm install`.
2. Review this document and `ARCHITECTURE.md` before prompting the AI to modify `app-logic.js` or `main.js`.
3. When creating new forms, strictly adhere to the folder hierarchy defined in the root `readme.md`.