# BKB TMS - System Architecture

## Overview
The BKB Office Automation Suite (BKB TMS) is a desktop application built using the Electron framework. It is designed to act as a centralized shell for managing banking tasks, customer data, and digital forms without relying on cloud infrastructure for secure, localized data persistence.

## Core Technologies
1. **Electron Shell**: Runs the main application window, handles filesystem/database access, and provides a secure bridge to the UI.
2. **SQLite3 (`bkb_tms.db`)**: Centralized local database for persistent storage of customer profiles, tasks, and system logs.
3. **Vanilla JavaScript/HTML/CSS**: Frontend technologies used to ensure lightweight, fast-loading interfaces that do not require complex build steps or external web servers.
4. **WebView / iframe DOM**: Forms are modularized as independent HTML files and injected into the main App Shell (`index.html`) using iframes.

## Component Architecture

### 1. The App Shell (`index.html`)
The main window of the application. It provides:
- A permanent sidebar for navigation.
- System-wide utilities (Canvas Zoom for high-res monitors, network status).
- A dynamic task ticker and news system.
- The hosting container (via iframe) for all localized forms.

### 2. Electron Process Model
- **Main Process (`main.js`)**: Handles window creation, native OS integrations, printing via `printHandler.js`, and direct SQLite database queries.
- **Preload Scripts (`preload.js` & `preload-webview.js`)**: Expose specific API functions via `contextBridge` (e.g., `window.AppStorage`) to allow the isolated frontend to securely request database reads/writes without exposing the Node environment.
- **Renderer Process**: The DOM running `index.html` and its injected forms.

### 3. Data Flow & Communication
- **Cross-Form Communication**: All data syncing is routed through the main App Shell. Forms do not talk to each other directly.
- **Form to Database**: Forms collect data and use `window.parent.postMessage({ command: 'SAVE_CUSTOMER_FROM_FORM', payload: data })` to pass structured data up to the App Shell. The App Shell then triggers an IPC call to the Main Process to persist it to SQLite.
- **Database to Form**: When a form is loaded, `app-logic.js` in the Shell uses known Placeholder IDs (e.g., `input_branch_name`) to inject stored customer data directly into the DOM elements of the active iframe.

### 4. NID Portal Scraper
- The application features a custom integration capable of extracting biographical data and Base64 images directly from the NID verification portal.
- Achieved via `executeJavaScript` injected into the NID portal's webview, scraping the resulting DOM, and triggering an automated "Upsert" into the local `bkb_tms.db`.

## File System Rules
- **`/forms/`**: Strictly categorized subdirectories (e.g., `/loan/cmsme`, `/deposit`, `/transactions`). No standalone or "general" dump folders are allowed.
- **`/assets/`**: Houses the global `style.css` which forces A4/Legal print compliance and standardizes the `SolaimanLipi` Bengali font globally.
- **Standalone Autonomy**: Every HTML form is designed to be fully self-contained visually so it can be opened independently of Electron for testing, even though DB persistence requires the Shell.
