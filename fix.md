New Print Fix-
Objective:
Fix the issue where generating a PDF or print preview for Legal stamp paper templates (stamps.html) creates an unwanted blank trailing page.

Key Issues & Fixes Required Across Files:
1. In app-logic.js (DOM Synchronization & Extraction)
Preserve Body Attributes: Update getSynchronizedHTML() so that instead of rebuilding <body> with ${doc.body.innerHTML} (which strips classes and ID attributes from the <body> tag), it uses cloneDoc.outerHTML. This ensures that print styles targeting body or specific body classes continue to match during PDF generation in the hidden worker window.

2. In stamps.html (Stylesheet Link)
Isolate Screen CSS: Add media="screen" to the <link rel="stylesheet" href="../../assets/css/common.css"> tag. This prevents common.css UI rules and viewport height calculations from interfering with Chromium's @media print compiler.

3. In stamps.html (Internal <style> Block)
Update the internal CSS rules in @media print according to the following rules:

Fix Invalid Properties: Replace overflow: none with overflow: hidden on .stamp-page.

Fix Sub-Pixel Height Spill: Change the .stamp-page height in @media print from 14in to 13.8in (or 13.85in). This provides a small safety margin to absorb Chromium's sub-pixel rounding during printToPDF compilation without pushing content onto a new page.

Fix Pseudo-Class Trailing Break Bug: Replace :last-child page-break logic with :last-of-type (i.e., .stamp-page:not(:last-of-type) gets page-break-after: always !important, and .stamp-page:last-of-type gets page-break-after: avoid !important). This prevents trailing <script> tags or hidden DOM nodes from triggering a page break after the last stamp page.

Hide Non-Stamp Elements During Print: Add a rule inside @media print setting body > *:not(.stamp-page) { display: none !important; } to hide any scripts, modals, or wrappers outside the stamp containers.

Collapse Whitespace: Set font-size: 0; line-height: 0; on html, body inside @media print (restoring font-size: 11pt; line-height: 1.4; inside .stamp-page), so HTML indentation and line breaks between stamp cards collapse to zero height.

Allow Multi-Page Auto Height: Ensure html, body in @media print use height: auto !important; and overflow: visible !important; so documents with multiple legitimate stamp pages can expand naturally without clipping subsequent sheets.

Execution Goal:
Refactor app-logic.js and stamps.html following these precise rules so single-page and multi-page stamp forms compile cleanly to PDF with zero extra blank pages.