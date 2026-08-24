# Antigravity 2.0 Pro Architecture: Smart Layout Caching & Zero-Loss Memory Core

## System Objective
This module implements a localized, two-pronged automation and disaster-recovery solution designed for high-disruption environments (power outages, network failures, or transaction session drops). It operates completely offline, processing structural fields and temporary application memory purely inside the computer's local system runtime.

---

## Part 1: Immutable Layout Caching (Template Testing Mode)
Instead of executing resource-heavy HTML parsing on every single transaction, the application utilizes a **Development Scan & Save** methodology.

### Implementation Workflow
1. **Development Probe Mode (One-Time Execution):** During development or testing, the administrator runs a baseline scan on target banking portals (CBS CIF Page, EFTN Screen, RTGS Module, Agri-Loan Setup, Loan Renewal Form).
2. **Structural Element Caching:** The application identifies input elements (`<input>`, `<select>`, `<textarea>`), extracts their exact structural attributes (`id`, `name`, `class`, data-attributes), and serializes them into a fast-access map.
3. **Hard-Cache Storage:**
   Because banking portal interfaces remain structurally fixed, these field maps are permanently written into a local JSON configuration file (`/data/portal_templates.json`). 
4. **Instant Zero-CPU Auto-Fill:** In production, when the employee triggers an auto-fill action, the app completely skips scanning the active page. It instantly references the static memory cache and injects local SQLite data directly into the fields via direct browser memory mappings in less than a millisecond.

---

## Part 2: Active Disaster-Recovery Core ("Smart Mode" Zero-Loss Memory)
To counteract unexpected electrical blackouts or local intranet disconnections, the application features an un-interruptible **Real-Time Input Mirroring System**.

### Operational Architecture
1. **Active Interception Switch ("Smart Mode"):**
   When the user toggles "Smart Mode" on the HTML face, the application initializes an active listener on all input components.
2. **Volatile to Non-Volatile State Mirroring:**
   As the employee types or updates fields (character by character or on blur events), the frontend sends the active state payload over the local process bridge to the Electron Main Engine.
3. **Crash-Proof Local Swap Buffer (`/data/recovery_swap.json`):**
   The Electron main process continuously dumps this active state into a persistent, uncompressed local temporary file. This write operation takes minimal system overhead and operates safely on low-tier dual-core processors.
4. **Automatic Recovery Execution:**
   - **Scenario:** The workstation completely loses power or windows forces an unexpected reboot mid-form filling.
   - **Resolution:** Upon system restart, the Electron application checks the `recovery_swap.json` buffer. If data is present, the HTML face alerts the user: *"Unsaved data from interrupted session detected. Restore?"*
   - **Re-Pasting Engine:** Upon approval, the application automatically mounts the cached fields, walks through the layout index, and restores every piece of lost transactional data to the exact inputs where the officer left off.

---

## Proposed Local File Directory Upgrades
```text
my-bkb-app/
└── data/
    ├── portal_templates.json   # Caching structural IDs for CBS, EFTN, RTGS, Agri-Loans
    └── recovery_swap.json      # Dynamic character-by-character real-time input memory buffer
```
