
window.SchedulerEngine = {
    renderStagedDates: function() {
        const container = document.getElementById('bulk-date-staging');
        if (!container) return;
        container.innerHTML = stagedDates.map((date, index) => {
            const [y, m, d] = date.split('-');
            const displayDate = `${d}/${m}/${y}`;
            
            const dayObj = new Date(date);
            const isWeekend = dayObj.getDay() === 5 || dayObj.getDay() === 6;
    
            return `
                <div class="date-chip ${isWeekend ? 'weekend' : ''}">
                    <span>${displayDate}${isWeekend ? ' (Weekend)' : ''}</span>
                    <span class="remove-chip" onclick="removeStagedDate(${index})">&times;</span>
                </div>
            `;
        }).join('');
    },

    renderBulkCalendarTable: function() {
        const tbody = document.getElementById('bulk-calendar-body');
        if(!tbody) return;
        tbody.innerHTML = bulkCalendarDates.map((date, index) => {
            const [y, m, d] = date.split('-');
            const displayDate = `${d}/${m}/${y}`;
            const dayObj = new Date(date);
            const isWeekend = dayObj.getDay() === 5 || dayObj.getDay() === 6;
    
            return `
                <tr data-date="${date}" style="${isWeekend ? 'background-color: #fff5f5;' : ''}">
                    <td style="${isWeekend ? 'color: #c62828; font-weight: bold;' : ''}">
                        <strong>${displayDate}</strong>
                    </td>
                    <td><input type="text" class="bulk-task-text bengali-font" placeholder="Task description..."></td>
                <td>
                    <select class="bulk-task-freq">
                        <option value="Day">Day (One-time)</option>
                        <option value="daily">Daily</option><option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
                    </select>
                </td>
                <td>
                    <select class="bulk-task-type">
                        <option value="Regular">Regular</option>
                        <option value="General Task">General Task</option><option value="Training">Training</option>
                        <option value="Meeting">Meeting</option><option value="Camp">Camp</option>
                        <option value="Conference">Conference</option>
                    </select>
                </td>
                <td>
                    <select class="bulk-task-flag">
                        <option value="Normal">Normal</option><option value="Important">Important</option>
                        <option value="Urgent">Urgent</option>
                    </select>
                </td>
                <td style="text-align:center;">
                    <button onclick="removeBulkDate(${index})" style="color:red; background:none; border:none; cursor:pointer; font-size:1.2rem;">&times;</button>
                </td>
            </tr>
        `; }).join('');
    },

    renderSchedulerTable: function() {
        const tbody = document.getElementById('scheduler-task-list-body');
        if (!tbody) return;
    
        const settings = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const currentRole = settings.userRole || "Guest";
        
        const customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
        
        const filtered = customTasks.filter(t => t.role === currentRole || currentRole === "Admin");
    
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#888;">No custom tasks added yet.</td></tr>';
            return;
        }
    
        const formatDate = (dStr) => {
            if (!dStr) return '-';
            const [y, m, d] = dStr.split('-');
            return `${d}/${m}/${y}`;
        };
    
        tbody.innerHTML = filtered.map(task => `
            <tr>
                <td style="padding:10px;">${task.text}</td>
                <td style="text-align:center;">${task.freq}</td>
                <td style="text-align:center;">${formatDate(task.startDate)}</td>
                <td style="text-align:center;">${formatDate(task.dueDate)}</td>
                <td style="text-align:center;">${task.type}</td>
                <td style="text-align:center;"><span style="color:${task.flag === 'Urgent' ? 'red' : task.flag === 'Important' ? 'orange' : 'inherit'}; font-weight:bold;">${task.flag}</span></td>
                <td style="text-align:center;">
                    <button onclick="editCustomTask('${task.id}')" style="background:none; border:none; color:#337ab7; cursor:pointer; font-size:1.1rem; margin-right:5px;">&#9998;</button>
                    <button onclick="deleteCustomTask('${task.id}')" style="background:none; border:none; color:#d9534f; cursor:pointer; font-size:1.2rem;">&times;</button>
                </td>
            </tr>
        `).join('');
    },

    isTaskDue: function(taskId, freq) {
        const lastDone = window.AppStorage.getItem(`task_done_${taskId}`);
        if (!lastDone) return true;
    
        const lastDate = new Date(parseInt(lastDone));
        const now = new Date();
    
        const getQuarter = (date) => Math.floor(date.getMonth() / 3);
    
        switch (freq) {
            case 'daily':
            case 'Term':
            case 'Event':
                return now.toDateString() !== lastDate.toDateString();
            case 'monthly':
                return now.getMonth() !== lastDate.getMonth() || now.getFullYear() !== lastDate.getFullYear();
            case 'quarterly':
                return getQuarter(now) !== getQuarter(lastDate) || now.getFullYear() !== lastDate.getFullYear();
            case 'yearly':
                return now.getFullYear() !== lastDate.getFullYear();
            default:
                return false;
        }
    },

    renderTaskList: function() {
        const container = document.getElementById('task-scroll-area');
        if (!container) return;
    
        const saved = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const currentRole = saved.userRole || "Guest";
        
        const customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
        const allTasks = [...(window.systemBankTasks || []), ...customTasks];
    
        const now = new Date();
        now.setHours(0, 0, 0, 0);
    
        const dueTasks = allTasks.filter(task => {
            if (task.role !== currentRole && currentRole !== "Admin") return false;
    
            if (task.startDate) {
                const start = new Date(task.startDate);
                start.setHours(0,0,0,0);
                if (now < start) return false;
            }
            if (task.dueDate) {
                const end = new Date(task.dueDate);
                end.setHours(0,0,0,0);
                if (now > end) return false;
            }
    
            return this.isTaskDue(task.id, task.freq);
        });
    
        if (dueTasks.length === 0) {
            container.innerHTML = '<div class="task-item"><span class="task-text">অভিনন্দন! আজকের সব কাজ সম্পন্ন হয়েছে। (All tasks completed for today!)</span></div>';
            return;
        }
    
        container.innerHTML = dueTasks.map(task => {
            let warningClass = "";
            let metaDisplay = task.freq;
            
            if (task.dueDate) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                
                const due = new Date(task.dueDate);
                due.setHours(0, 0, 0, 0);
    
                if (!isNaN(due.getTime())) {
                    const day = due.getDate().toString().padStart(2, '0');
                    const month = due.toLocaleString('en-US', { month: 'long' });
                    metaDisplay = `${day}${month}`;
    
                    const dayOfWeek = due.getDay();
                    const daysThreshold = (dayOfWeek === 5 || dayOfWeek === 6) ? 2 : 1;
                    
                    const thresholdDate = new Date(due);
                    thresholdDate.setDate(due.getDate() - daysThreshold);
    
                    if (now >= thresholdDate) {
                        warningClass = "task-warning-blink";
                    }
                }
            }
    
            const typeClasses = {
                'General Task': 'icon-orange',
                'Training': 'icon-green',
                'Meeting': 'icon-purple',
                'Camp': 'icon-red',
                'Conference': 'icon-cyan'
            };
            
            const colorClass = typeClasses[task.type] || '';
            const flagIcon = `<span class="task-icon ${colorClass}"></span>`;
    
            return `
                <div class="task-item ${warningClass}">
                    ${flagIcon}
                    <span class="task-text" style="${task.flag === 'Urgent' ? 'color:#ff4d4d; font-weight:bold;' : ''}">${task.text}</span>
                    <span class="task-meta">${metaDisplay}</span>
                    <button class="btn-task-done" style="margin-left:0;" onclick="markTaskDone('${task.id}')">Done</button>
                </div>
            `;
        }).join('');
    }
};

window.removeStagedDate = function(index) {
    if(typeof stagedDates !== 'undefined') {
        stagedDates.splice(index, 1);
        window.SchedulerEngine.renderStagedDates();
    }
};

window.removeBulkDate = (index) => {
    if(typeof bulkCalendarDates !== 'undefined') {
        bulkCalendarDates.splice(index, 1);
        window.SchedulerEngine.renderBulkCalendarTable();
    }
};

window.closeTaskSchedulerModal = function() {
    const el = document.getElementById('taskSchedulerModal');
    if(el) el.classList.remove('visible');
};

window.deleteCustomTask = async function(taskId) {
    if (!(await appConfirm("Remove this task from schedule?"))) return;
    let customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
    customTasks = customTasks.filter(t => t.id !== taskId);
    window.AppStorage.setItem('bkb_custom_tasks', JSON.stringify(customTasks));
    
    window.AppStorage.removeItem(`task_done_${taskId}`);
    
    window.SchedulerEngine.renderSchedulerTable();
    window.SchedulerEngine.renderTaskList();
    if(window.refreshSmartNoticeTracker) window.refreshSmartNoticeTracker();
};

window.markTaskDone = function(taskId) {
    window.AppStorage.setItem(`task_done_${taskId}`, Date.now().toString());
    window.SchedulerEngine.renderTaskList();
};

document.addEventListener('DOMContentLoaded', () => {
    const schedFreq = document.getElementById('sched_freq');
    const schedEndDateGroup = document.getElementById('sched_end_date_group');
    if(schedFreq && schedEndDateGroup) {
        schedFreq.addEventListener('change', (e) => {
            if(e.target.value === 'Day') {
                schedEndDateGroup.style.display = 'none';
            } else {
                schedEndDateGroup.style.display = 'block';
            }
        });
        // trigger initially
        if(schedFreq.value === 'Day') schedEndDateGroup.style.display = 'none';
    }

    document.getElementById('btn-add-bulk-date')?.addEventListener('click', () => {
        if (typeof stagedDates === 'undefined' || stagedDates.length === 0) return;
        stagedDates.forEach(date => {
            if (typeof bulkCalendarDates !== 'undefined' && !bulkCalendarDates.includes(date)) bulkCalendarDates.push(date);
        });
        
        stagedDates = [];
        window.SchedulerEngine.renderStagedDates();
        window.SchedulerEngine.renderBulkCalendarTable();
    });

    document.getElementById('btn-save-bulk-calendar')?.addEventListener('click', () => {
        const rows = document.querySelectorAll('#bulk-calendar-body tr');
        if (rows.length === 0) return;
    
        const settings = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const currentRole = settings.userRole || "Guest";
        const customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
    
        rows.forEach(row => {
            const textEl = row.querySelector('.bulk-task-text');
            if(!textEl) return;
            const text = textEl.value.trim();
            if (!text) return;
    
            customTasks.push({
                id: 'ct' + Date.now() + Math.random(),
                role: currentRole,
                text: text,
                freq: row.querySelector('.bulk-task-freq').value,
                type: row.querySelector('.bulk-task-type').value,
                flag: row.querySelector('.bulk-task-flag').value,
                dueDate: row.getAttribute('data-date'),
                isCustom: true
            });
        });
    
        window.AppStorage.setItem('bkb_custom_tasks', JSON.stringify(customTasks));
        const modal = document.getElementById('calendarEventsModal');
        if(modal) modal.classList.remove('visible');
        window.SchedulerEngine.renderSchedulerTable();
        window.SchedulerEngine.renderTaskList();
        alert("Calendar events booked successfully.");
    });

    document.getElementById('btn-save-custom-task')?.addEventListener('click', function(e) {
        const textEl = document.getElementById('sched_text');
        if(!textEl) return;
        const text = textEl.value.trim();
        const freq = document.getElementById('sched_freq').value;
        const type = document.getElementById('sched_type').value;
        const flag = document.getElementById('sched_flag').value;
        const startDate = document.getElementById('sched_start_date').value;
        let endDate = document.getElementById('sched_end_date').value;
        
        if (freq === 'Day') {
            endDate = startDate;
        }
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);
    
        if (!text) {
            alert("Please enter task details.");
            return;
        }
    
        if (endDate && new Date(endDate) < now) {
            alert("Due date cannot be in the past.");
            return;
        }
    
        const settings = JSON.parse(window.AppStorage.getItem('bkb_tms_settings') || '{}');
        const currentRole = settings.userRole || "Guest";
    
        const editId = this.dataset.editId;
        let customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
        
        if(editId) {
            const idx = customTasks.findIndex(t => t.id === editId);
            if(idx > -1) {
                customTasks[idx] = { ...customTasks[idx], text, freq, type, flag, startDate, dueDate: endDate };
            }
            this.innerText = 'Add Task';
            delete this.dataset.editId;
        } else {
            const newTask = {
                id: 'ct' + Date.now(),
                role: currentRole,
                text: text,
                freq: freq,
                type: type,
                flag: flag,
                startDate: startDate,
                dueDate: endDate,
                isCustom: true
            };
            customTasks.push(newTask);
        }
        
        window.AppStorage.setItem('bkb_custom_tasks', JSON.stringify(customTasks));
    
        document.getElementById('sched_text').value = '';
        
        window.SchedulerEngine.renderSchedulerTable();
        window.SchedulerEngine.renderTaskList();
        if(window.refreshSmartNoticeTracker) window.refreshSmartNoticeTracker();
    });
});

window.editCustomTask = function(taskId) {
    const customTasks = JSON.parse(window.AppStorage.getItem('bkb_custom_tasks') || '[]');
    const task = customTasks.find(t => t.id === taskId);
    if(!task) return;
    
    document.getElementById('sched_text').value = task.text;
    document.getElementById('sched_freq').value = task.freq;
    document.getElementById('sched_type').value = task.type;
    document.getElementById('sched_flag').value = task.flag;
    document.getElementById('sched_start_date').value = task.startDate || '';
    document.getElementById('sched_end_date').value = task.dueDate || '';
    
    // Trigger freq change
    const evt = new Event('change');
    document.getElementById('sched_freq').dispatchEvent(evt);
    
    // Override Save button momentarily
    const saveBtn = document.getElementById('btn-save-custom-task');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = 'Save Edit';
    saveBtn.dataset.editId = taskId;
};
