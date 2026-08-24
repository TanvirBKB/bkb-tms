## Dotted Line Input Styling
When styling dotted line inputs (contenteditable or data-input spans), follow these constraints:
1. They should shrink to wrap exactly the content. Do NOT hardcode min-width inline styles on them. 
2. Use CSS: `[contenteditable] { min-width: 1px; }` and `[contenteditable]:empty { min-width: 0.5in; }` (use 0.5 inch when empty).
3. Do NOT show placeholder texts or suggestions on print. 
Exception: Signature blocks should retain their fixed width/structure.

## BKB Standard Header (A4 forms)
Whenever requested to "make a header" for a standard BKB A4 form:
- Use the exact header HTML layout saved in `.agents/resources/bkb_a4_header.html`.
- It includes a 0.7in black logo positioned absolutely on the left, a perfectly page-centered bank title (16.5pt) and branch location info (14pt), and absolutely right-positioned contact info (mobile, email).

## Linking Branch Info (Rewiring / Regular Task)
Whenever requested to "rewire" or perform the "regular task" of linking branch info with the central database:
- Forms receive a `postMessage` with a `FILL` command containing branch details.
- Ensure the standard script block (saved in `.agents/resources/bkb_form_script.html`) is present at the end of the form's `<body>`.
- This script listens for the `FILL` message, maps `data-db-field` values, and automatically converts English digits to Bangla numerals for any elements with the `bangla-numbers` class.

## Dynamic Page Generation for Arrays
Whenever multiple entities (like multiple co-borrowers, guarantors, or partners) are present in the provided JSON data:
1. Populate the first entry (Index 0) into the primary form blocks on the designated pages.
2. For subsequent entries (Index 1+), dynamically generate entirely new pages using the `div.page` class to house the cloned elements.
3. Append these newly generated pages at the very end of the document (after all primary pages) and label them as **Annexure (সংযোজনী)** pages to ensure the core page formatting/numbering is never broken.

## Standard A4 Print & MS Word Style Layout Guidelines
To ensure forms print, preview, and generate PDFs identically across different monitors, resolutions, and host operating systems, always follow these constraints:
1. **Absolute Units over Pixels**:
   - Never use pixel (`px`) units for page dimensions, margins, paddings, or font sizes.
   - Use inches (`in`), millimeters (`mm`), or centimeters (`cm`) for layout heights, widths, and paddings.
   - Use points (`pt`) for all font sizes to guarantee identical typography rendering on screen and print.
2. **Page Dimensions**:
   - An A4 page container must be defined with:
     ```css
     .page, .a4-page {
         width: 8.27in;      /* Standard A4 Width */
         height: 11.69in;    /* Standard A4 Height */
         box-sizing: border-box;
         position: relative;
         background: #ffffff;
         page-break-after: always;
     }
     ```
   - For print rules, define:
     ```css
     @page {
         size: A4;
         margin: 0.5in;     /* Standard Microsoft Word margin */
     }
     ```
3. **Typography Standards**:
   - Titles/Headers: `14pt` to `16.5pt` (Bold)
   - Body/Standard text: `11pt` to `12pt`
   - Secondary labels/Tables: `10pt`
   - Page footers/Numbers/Small footnotes: `9pt`
4. **Print Media Controls (`@media print`)**:
   - Hide interactive elements (buttons, modals, dialog close buttons) on print by adding a `.no-print { display: none !important; }` class.
   - Set body background to transparent/white.
   - Enable exact background color rendering: `-webkit-print-color-adjust: exact; print-color-adjust: exact;`.
   - Prevent breaking inside rows or blocks by applying `page-break-inside: avoid;` to tables, signatures, and sections.

## Vanishing Toasts over Native Alerts
To prevent Electron apps from freezing or losing focus context during popup dialogs:
- **Never** use `alert()` for success, warning, or informational messages.
- **Always** use the non-blocking vanishing toast UI (e.g., `window.showAppToast('Message', isError)`).
- The native browser `confirm()` dialog is the ONLY native popup permitted, and should exclusively be used for true Yes/No user decisions (e.g., "Are you sure you want to delete this data?").
