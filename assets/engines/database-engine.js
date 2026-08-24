/**
 * Database Engine
 * Centralizes all data access and IPC database communication.
 */
window.DB = {
    /**
     * Get Application Setting
     */
    getSetting: function(key) {
        if (!window.ipcRenderer) return null;
        try {
            const val = window.ipcRenderer.sendSync('db-get-kv', key);
            return val ? JSON.parse(val) : null;
        } catch(e) {
            return window.ipcRenderer.sendSync('db-get-kv', key);
        }
    },

    saveSetting: function(key, value) {
        if (!window.ipcRenderer) return false;
        return window.ipcRenderer.sendSync('db-set-kv', key, value);
    },

    /**
     * Save a customer profile to the database
     * @param {Object} customerData 
     * @returns {Promise<Object>} { success: true/false, error?: string }
     */
    saveCustomer: async function(customerData) {
        if (!window.ipcRenderer) return { success: false, error: 'IPC not available' };
        return await window.ipcRenderer.invoke('db-save-customer', customerData);
    },

    /**
     * Retrieve a customer by NID/lookup key
     * @param {string} nid 
     * @returns {Promise<Object|null>}
     */
    getCustomer: async function(nid) {
        if (!window.ipcRenderer) return null;
        return await window.ipcRenderer.invoke('db-get-customer', nid);
    },

    /**
     * Search customers by name, phone, or NID
     * @param {string} query 
     * @returns {Promise<Array>}
     */
    searchCustomers: async function(query) {
        if (!window.ipcRenderer) return [];
        return await window.ipcRenderer.invoke('db-search-customers', query);
    },

    /**
     * Get relationships associated with a NID
     * @param {string} nid 
     * @returns {Promise<Array>}
     */
    getRelationships: async function(nid) {
        if (!window.ipcRenderer) return [];
        return await window.ipcRenderer.invoke('db-get-relationships', nid);
    },

    /**
     * Save a two-way relationship link
     * @param {string} mainNid 
     * @param {string} relatedNid 
     * @param {string} typeEn 
     * @param {string} typeBn 
     * @returns {Promise<any>}
     */
    saveRelationship: async function(mainNid, relatedNid, typeEn, typeBn) {
        if (!window.ipcRenderer) return null;
        return await window.ipcRenderer.invoke('db-save-relationship', mainNid, relatedNid, typeEn, typeBn);
    },

    /**
     * Save an EFTN or RTGS transaction
     * @param {string} type 
     * @param {Object} transaction 
     * @returns {Promise<any>}
     */
    saveTransaction: async function(type, transaction) {
        if (!window.ipcRenderer) return null;
        return await window.ipcRenderer.invoke('db-save-transaction', type, transaction);
    },

    /**
     * Fetch transactions by date and type for CBS automation
     * @param {string} dateStr 
     * @param {string} type 
     * @returns {Promise<Array>}
     */
    getTransactionsByDate: async function(dateStr, type) {
        if (!window.ipcRenderer) return [];
        return await window.ipcRenderer.invoke('db-get-transactions-by-date', dateStr, type);
    },

    /**
     * Mark a transaction as injected into CBS
     * @param {string} type 
     * @param {string|number} txId 
     * @returns {Promise<any>}
     */
    markTransactionInjected: async function(type, txId) {
        if (!window.ipcRenderer) return null;
        return await window.ipcRenderer.invoke('db-mark-transaction-injected', type, txId);
    }
};
