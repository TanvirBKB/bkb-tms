# BKB Customer Master Schema

This document defines the master customer record schema and segments for the BKB TMS app. Fields are named to match the standardized placeholders (see Placeholders.md) and to include NID-provided fields.

Top-level record
- id: string (UUID)
- createdAt: ISO datetime
- updatedAt: ISO datetime
- source: string (e.g., 'nid', 'manual', 'import')

Segments

1) Personal Info (EN)
- applicant_name_en
- applicant_father_name_en
- applicant_mother_name_en
- applicant_nid
- applicant_nid_10
- applicant_nid_17
- applicant_dob (YYYY-MM-DD)
- applicant_mobile
- applicant_email
- applicant_present_division
- applicant_present_district
- applicant_present_upozila
- applicant_perm_division
- applicant_perm_district
- applicant_perm_upozila
- photo (base64)
- education_level

2) Personal Info (BN)
- applicant_name_bn
- applicant_father_name_bn
- applicant_mother_name_bn
- applicant_present_address_bn
- applicant_permanent_address_bn

3) Occupation
- occupation_type (e.g., 'salaried', 'business', 'farmer', 'other')
- occupation_en (free text)
- occupation_bn
- employer_name
- monthly_income
- income_source_notes

4) Relation with Bank (Accounts)
- accounts: [
    { id, account_no, account_type (savings|fixed|term|loan), account_title, branch_name, opened_at }
  ]
- loans: [ { id, product, outstanding_amount, sanctioned_amount, status } ]

5) Transaction Info (RTGS / EFTN usage)
- transactions_summary: {
    rtgs: { total_amount: number, frequency: number, last_date: ISO, by_bank: { [bankName]: { amount, frequency, last_date } } },
    eftn: { total_amount: number, frequency: number, last_date: ISO, by_bank: { ... } }
  }
- transactions: [ { id, type: 'RTGS'|'EFTN'|'OTHER', amount, date, to_bank, to_branch, reference } ]

6) Complaints / Compliance
- named_in_ctr: boolean
- named_in_str: boolean
- ctr_details: { date, reference, notes }
- str_details: { date, reference, notes }

7) Meta / Admin
- tags: [string]
- notes: string

Mapping notes
- Field names aim to follow keys used in `Placeholders.md` (e.g., `applicant_name_en`, `applicant_nid`, `applicant_mobile`, `account_title`, `deposit_account_no`).
- NID server fields (exact raw payload) should be stored in `sourceData.nidPayload` to keep original values.

Storage
- Implementation: a central SQLite database (`bkb_tms.db`) storing JSON records within the `app_storage` table (using key `bkb_customers`). Accessed synchronously via IPC and `window.AppStorage`.
- Export/import: JSON backup and restore supported.

Usage
- The app shell or forms can call `BKBCustomerDB.get(id)` and `BKBCustomerDB.populateToForm(iframeWindow, id)` to push standardized data into any form that implements the `populate()` API (RTGS/EFTN have `populate`).

Security
- This storage is local and unencrypted. For production, migrate to an encrypted DB or server-side storage.
