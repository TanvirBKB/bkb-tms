// Since contextIsolation is set to false in main.js, contextBridge cannot be used.
// With your current settings, you can attach APIs directly to the window object.
const { ipcRenderer } = require('electron');

window.ipcRenderer = ipcRenderer;
window.electronAPI = {};

window.AppStorage = {
    getItem: function(key) {
        return window.ipcRenderer.sendSync('db-get-kv', key);
    },
    setItem: function(key, value) {
        window.ipcRenderer.sendSync('db-set-kv', key, value);
    },
    removeItem: function(key) {
        window.ipcRenderer.sendSync('db-delete-kv', key);
    },
    clear: function() {
        window.ipcRenderer.sendSync('db-clear-kv');
    },
    getAll: function() {
        return window.ipcRenderer.sendSync('db-get-all-kv');
    }
};
