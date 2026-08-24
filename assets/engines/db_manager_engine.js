let currentTable = null;
let currentPkColumn = null;
let tableData = [];

// Determine primary key column based on table name (fallback to 'id' or 'rowid')
function getPrimaryKeyColumn(tableName) {
    if (tableName === 'customers') return 'applicant_nid';
    if (tableName === 'app_storage') return 'key';
    return 'id'; // Most other tables use 'id'
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadTables();
});

async function loadTables() {
    try {
        const tables = await window.parent.ipcRenderer.invoke('db-get-all-tables');
        const container = document.getElementById('table-list-container');
        container.innerHTML = '';
        
        tables.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'table-btn';
            // Prettify table name a bit
            btn.textContent = t.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            btn.onclick = () => selectTable(t.name, btn);
            container.appendChild(btn);
        });
    } catch (error) {
        document.getElementById('table-list-container').innerHTML = '<div class="loading">Failed to load tables: ' + error.message + '</div>';
    }
}

async function selectTable(tableName, btnElement) {
    // Update UI active state
    document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    
    currentTable = tableName;
    currentPkColumn = getPrimaryKeyColumn(tableName);
    document.getElementById('current-table-name').textContent = tableName.replace(/_/g, ' ').toUpperCase();
    document.getElementById('data-table-container').innerHTML = '<div class="loading">Loading data...</div>';
    
    try {
        tableData = await window.parent.ipcRenderer.invoke('db-get-all-records', tableName);
        document.getElementById('record-count').textContent = `Total Records: ${tableData.length}`;
        renderTable(tableData);
    } catch (error) {
        document.getElementById('data-table-container').innerHTML = '<div class="loading">Failed to load data: ' + error.message + '</div>';
        document.getElementById('record-count').textContent = '';
    }
}

function renderTable(data) {
    const container = document.getElementById('data-table-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="loading">No records found in this table.</div>';
        return;
    }
    
    // Extract columns from the first object
    const columns = Object.keys(data[0]);
    
    let html = '<table><thead><tr>';
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '<th>Actions</th></tr></thead><tbody>';
    
    data.forEach((row, index) => {
        // Fallback for rowid if the primary key isn't explicitly defined in the object
        const pkValue = row[currentPkColumn] !== undefined ? row[currentPkColumn] : row['rowid'];
        
        html += '<tr>';
        columns.forEach(col => {
            let val = row[col];
            if (val === null || val === undefined) val = '';
            // Truncate long strings for viewability
            if (typeof val === 'string' && val.length > 50) {
                val = val.substring(0, 47) + '...';
            }
            
            // Reformat YYYY-MM-DD dates to DD/MM/YYYY (UK standard)
            if (typeof val === 'string' && val.match(/^\d{4}[-/]\d{2}[-/]\d{2}/)) {
                // If it contains a time part, preserve it
                const parts = val.split(' ');
                const datePart = parts[0];
                const timePart = parts[1] ? ' ' + parts[1] : '';
                
                // Determine separator
                const sep = datePart.includes('/') ? '/' : '-';
                const [y, m, d] = datePart.split(sep);
                val = `${d}/${m}/${y}${timePart}`;
            }
            html += `<td>${val}</td>`;
        });
        
        // Ensure we encode the pkValue safely
        const safePk = typeof pkValue === 'string' ? `'${pkValue.replace(/'/g, "\\'")}'` : pkValue;
        html += `<td style="text-align: center;"><button class="btn-delete" onclick="promptDelete(${safePk}, ${index})">Delete</button></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

let recordToDelete = null;

function promptDelete(pkValue, rowIndex) {
    if (!currentTable) return;
    
    recordToDelete = { pkValue, rowIndex };
    const row = tableData[rowIndex];
    let displayInfo = `Primary Key (${currentPkColumn}): ${pkValue}`;
    
    document.getElementById('delete-record-info').textContent = displayInfo;
    document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    recordToDelete = null;
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (!recordToDelete || !currentTable) return;
    
    const { pkValue } = recordToDelete;
    
    try {
        const result = await window.parent.ipcRenderer.invoke('db-delete-record', currentTable, currentPkColumn, pkValue);
        if (result.success) {
            // Refresh table data
            await selectTable(currentTable, document.querySelector('.table-btn.active'));
        } else {
            alert('Failed to delete record: ' + result.error);
        }
    } catch (error) {
        alert('An error occurred during deletion.');
    }
    
    closeDeleteModal();
});
