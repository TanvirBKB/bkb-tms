const { ipcMain, BrowserWindow, app, dialog } = require('electron');
const path = require('path');
const fse = require('fs-extra');
const { Roarr } = require('roarr');
const log = Roarr.child({ package: 'bkb_tms', namespace: 'printHandler' });

/**
 * Sets up IPC listeners for print preview functionality.
 */
function setupPrintHandlers() {
    ipcMain.handle('generate-print-preview', async (event, { html, options = {}, baseUrl }) => {
    const tempDir = app.getPath('temp');
    const pdfPath = path.join(tempDir, `bkb_preview_${Date.now()}.pdf`);
    const tempHtmlPath = path.join(tempDir, `bkb_render_${Date.now()}.html`);

    if (/(id="Stamps"[^>]*class="[^"]*\bactive\b[^"]*")/.test(html) || html.includes('stamp-wrapper-preview') || html.includes('stamp-page') || html.includes('8.5in 14in')) {
        options.pageSize = 'Legal';
    }

    // Create a hidden window to render the print content
    // Fixed width prevents "responsive" reflows that cause page breaks
    let workerWin = new BrowserWindow({
      show: false,
      width: 1200, 
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        javascript: false
      }
    });

    try {
      let modifiedHtml = html;
      if (modifiedHtml.includes('<head>')) {
          modifiedHtml = modifiedHtml.replace('<head>', `<head><base href="${baseUrl}">`);
      } else {
          modifiedHtml = `<head><base href="${baseUrl}"></head>` + modifiedHtml;
      }
      
      await fse.outputFile(tempHtmlPath, modifiedHtml);
      await workerWin.loadFile(tempHtmlPath);
      
      // Wait to ensure rendering (fonts, CSS rules)
      await new Promise(r => setTimeout(r, 800));

      const pdfData = await workerWin.webContents.printToPDF({
        printBackground: true,
        landscape: options.landscape || false,
        pageSize: options.pageSize || 'A4',
        pageRanges: options.pageRanges || '',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        scale: 1,                          // Force 1:1 scaling regardless of monitor DPI
        preferCSSPageSize: true            // Use @page size from style.css
      });

      await fse.outputFile(pdfPath, pdfData);

      const previewWin = new BrowserWindow({
        width: 1100,
        height: 850,
        title: 'Print Preview',
        autoHideMenuBar: true,
        webPreferences: {
          plugins: true // Required for the internal PDF viewer
        }
      });

      // Use the native PDF viewer
      previewWin.loadURL(`file://${pdfPath}`);

      previewWin.once('ready-to-show', () => {
        previewWin.show();
        // Clean up the file after the window is closed
        previewWin.on('closed', async () => {
          try {
            const exists = await fse.pathExists(pdfPath);
            if (exists) await fse.remove(pdfPath);
          } catch (err) {
            log.error({ err, path: pdfPath }, 'Cleanup failed');
          }
        });
      });

      workerWin.destroy();
      workerWin = null;
      fse.remove(tempHtmlPath).catch(() => {});
      return { success: true, path: pdfPath };
    } catch (error) {
      if (workerWin) workerWin.destroy();
      fse.remove(tempHtmlPath).catch(() => {});
      log.error({ error: error.message }, 'Failed to generate print preview');
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-as-pdf', async (event, { html, options = {}, baseUrl, defaultName }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    
    if (/(id="Stamps"[^>]*class="[^"]*\bactive\b[^"]*")/.test(html) || html.includes('stamp-wrapper-preview') || html.includes('stamp-page') || html.includes('8.5in 14in')) {
        options.pageSize = 'Legal';
    }

    // 1. Ask user where to save the file
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Save Form as PDF',
      defaultPath: path.join(app.getPath('downloads'), defaultName || 'BKB_Form.pdf'),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, reason: 'user_canceled' };

    // 2. Create a hidden worker window to render the PDF
    let workerWin = new BrowserWindow({
      show: false,
      width: 1200,
      webPreferences: { 
        nodeIntegration: false, 
        contextIsolation: true,
        javascript: false 
      }
    });
    
    const tempDir = app.getPath('temp');
    const tempHtmlPath = path.join(tempDir, `bkb_render_export_${Date.now()}.html`);

    try {
      let modifiedHtml = html;
      if (modifiedHtml.includes('<head>')) {
          modifiedHtml = modifiedHtml.replace('<head>', `<head><base href="${baseUrl}">`);
      } else {
          modifiedHtml = `<head><base href="${baseUrl}"></head>` + modifiedHtml;
      }
      
      await fse.outputFile(tempHtmlPath, modifiedHtml);
      await workerWin.loadFile(tempHtmlPath);
      
      await new Promise(r => setTimeout(r, 800));

      const pdfData = await workerWin.webContents.printToPDF({
        printBackground: true,
        landscape: options.landscape || false,
        pageSize: options.pageSize || 'A4',
        pageRanges: options.pageRanges || '',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        scale: 1,
        preferCSSPageSize: true
      });

      await fse.outputFile(filePath, pdfData);
      
      workerWin.destroy();
      workerWin = null;
      fse.remove(tempHtmlPath).catch(() => {});
      return { success: true, path: filePath };
    } catch (error) {
      if (workerWin) workerWin.destroy();
      fse.remove(tempHtmlPath).catch(() => {});
      log.error({ error: error.message }, 'Failed to save PDF');
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  setupPrintHandlers
};
