const ipcRenderer = window.parent.ipcRenderer;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Wire up Profile Modals
    document.getElementById('btn-open-branch-info').addEventListener('click', () => {
        if (window.parent && window.parent.document.getElementById('branchInfoModal')) {
            window.parent.document.getElementById('branchInfoModal').classList.add('visible');
        }
    });

    document.getElementById('btn-open-user-info').addEventListener('click', () => {
        if (window.parent && window.parent.document.getElementById('userInfoModal')) {
            window.parent.document.getElementById('userInfoModal').classList.add('visible');
        }
    });

    // 2. Load Location Data
    loadLocations();

    // 3. Download Excel Template
    document.getElementById('btn-download-template').addEventListener('click', () => {
        const headers = ["গ্রাম/মহল্লা", "ইউনিয়ন/ওয়ার্ড", "ডাকঘর", "পোস্ট কোড", "সিটি কর্পোরেশন", "ওয়ার্ড নং", "গ্রাম কোড"];
        
        // Create an empty worksheet with headers
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        
        // Example row for guidance
        const exampleRow = ["জাহাজমারা", "ওয়ার্ড-০১", "জাহাজমারা", "৩৮০০", "", "১", "V-101"];
        XLSX.utils.sheet_add_aoa(ws, [exampleRow], {origin: -1});

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Locations");
        
        XLSX.writeFile(wb, "Location_Database_Template.xlsx");
    });

    // 4. Upload Excel Data
    document.getElementById('file-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('upload-status').textContent = 'Reading...';
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                if (rows.length <= 1) {
                    alert('Excel file is empty or only contains headers.');
                    document.getElementById('upload-status').textContent = '';
                    return;
                }
                
                // Remove header
                rows.shift();
                
                // Format into objects
                const locations = rows.map(row => ({
                    village: row[0] || '',
                    union_ward: row[1] || '',
                    post_office: row[2] || '',
                    post_code: row[3] || '',
                    city_corporation: row[4] || '',
                    ward_no: row[5] || '',
                    village_code: row[6] || ''
                })).filter(loc => loc.village !== '' || loc.village_code !== ''); // filter empty rows

                document.getElementById('upload-status').textContent = 'Saving to Database...';
                
                const result = await ipcRenderer.invoke('db-upload-locations', locations);
                
                if (result.success) {
                    document.getElementById('upload-status').textContent = 'Upload Successful!';
                    setTimeout(() => { document.getElementById('upload-status').textContent = ''; }, 3000);
                    loadLocations();
                } else {
                    alert('Error saving locations: ' + result.error);
                    document.getElementById('upload-status').textContent = 'Error';
                }
            } catch (error) {
                console.error(error);
                alert('Error parsing Excel file.');
                document.getElementById('upload-status').textContent = 'Error';
            }
            // Reset file input
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    });
});

async function loadLocations() {
    try {
        const locations = await ipcRenderer.invoke('db-get-locations');
        renderTable(locations);
    } catch (error) {
        console.error('Error loading locations:', error);
    }
}

function renderTable(locations) {
    const tbody = document.getElementById('location-tbody');
    tbody.innerHTML = '';
    
    if (!locations || locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No locations found. Upload Excel to populate.</td></tr>';
        return;
    }

    locations.forEach(loc => {
        const tr = document.createElement('tr');
        
        const fields = ['village', 'union_ward', 'post_office', 'post_code', 'city_corporation', 'ward_no', 'village_code'];
        
        fields.forEach(field => {
            const td = document.createElement('td');
            td.textContent = loc[field] || '';
            td.contentEditable = "true";
            
            // Handle inline editing
            td.addEventListener('blur', async () => {
                const newValue = td.textContent.trim();
                if (newValue !== loc[field]) {
                    loc[field] = newValue;
                    const result = await ipcRenderer.invoke('db-update-location', loc);
                    if (!result.success) {
                        alert('Failed to save update.');
                        // Revert
                        td.textContent = loc[field];
                    }
                }
            });
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}
