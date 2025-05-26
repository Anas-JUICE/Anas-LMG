// Global variables
let loanData = [];
let editingIndex = -1;
let sortColumn = '';
let sortDirection = 'asc';

// Database key for localStorage
const DB_KEY = 'loan_tracker_database';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setTodayDate();
    loadDatabase();
    updateTable();
    updateStatistics();
    updateCustomerSuggestions();
});

// Set today's date as default
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Database Management Functions
function saveDatabase() {
    try {
        const dbData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: loanData
        };
        localStorage.setItem(DB_KEY, JSON.stringify(dbData));
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        showNotification('Failed to save data to local storage', 'error');
        return false;
    }
}

function loadDatabase() {
    try {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            const dbData = JSON.parse(stored);
            loanData = dbData.data || [];
            showNotification('Database loaded successfully', 'success');
        }
    } catch (error) {
        console.error('Error loading database:', error);
        showNotification('Failed to load database', 'error');
        loanData = [];
    }
}

function exportDatabase() {
    const dbData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: loanData,
        metadata: {
            totalEntries: loanData.length,
            exportedBy: 'Professional Loan Tracker',
            exportDate: new Date().toLocaleDateString()
        }
    };
    
    const dataStr = JSON.stringify(dbData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `loan_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Database exported successfully', 'success');
}

function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dbData = JSON.parse(e.target.result);
            
            if (dbData.data && Array.isArray(dbData.data)) {
                if (confirm('This will replace all existing data. Are you sure?')) {
                    loanData = dbData.data;
                    saveDatabase();
                    updateTable();
                    updateStatistics();
                    updateCustomerSuggestions();
                    showNotification('Database imported successfully', 'success');
                }
            } else {
                throw new Error('Invalid database format');
            }
        } catch (error) {
            console.error('Error importing database:', error);
            showNotification('Invalid database file format', 'error');
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function clearAllData() {
    if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
        if (confirm('This will permanently delete all loan and payment records. Continue?')) {
            loanData = [];
            localStorage.removeItem(DB_KEY);
            updateTable();
            updateStatistics();
            updateCustomerSuggestions();
            clearBalanceResults();
            showNotification('All data cleared successfully', 'warning');
        }
    }
}

// Entry Management Functions
function addEntry() {
    const customer = document.getElementById('customer').value.trim();
    const type = document.getElementById('type').value;
    const item = document.getElementById('item').value.trim();
    const date = document.getElementById('date').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const notes = document.getElementById('notes').value.trim();
    
    // Validation
    if (!customer || !item || !date || isNaN(amount) || amount <= 0) {
        showNotification('Please fill in all required fields with valid data', 'error');
        return;
    }
    
    const entry = {
        id: editingIndex >= 0 ? loanData[editingIndex].id : Date.now(),
        customer: customer,
        type: type,
        item: item,
        date: date,
        amount: amount,
        notes: notes,
        timestamp: new Date().toISOString()
    };
    
    if (editingIndex >= 0) {
        // Update existing entry
        loanData[editingIndex] = entry;
        editingIndex = -1;
        document.getElementById('addButtonText').textContent = 'Add Entry';
        document.getElementById('cancelEditBtn').style.display = 'none';
        showNotification('Entry updated successfully', 'success');
    } else {
        // Add new entry
        loanData.push(entry);
        showNotification('Entry added successfully', 'success');
    }
    
    // Save to database and update UI
    saveDatabase();
    clearForm();
    updateTable();
    updateStatistics();
    updateCustomerSuggestions();
    
    // Refresh balance results if currently displayed
    const balanceResults = document.getElementById('balanceResults');
    if (balanceResults.style.display !== 'none') {
        calculateCustomerBalance();
    }
}

function editEntry(index) {
    const entry = loanData[index];
    
    document.getElementById('customer').value = entry.customer;
    document.getElementById('type').value = entry.type;
    document.getElementById('item').value = entry.item;
    document.getElementById('date').value = entry.date;
    document.getElementById('amount').value = entry.amount;
    document.getElementById('notes').value = entry.notes;
    
    editingIndex = index;
    document.getElementById('addButtonText').textContent = 'Update Entry';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    
    // Scroll to form
    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
    showNotification('Entry loaded for editing', 'info');
}

function cancelEdit() {
    editingIndex = -1;
    document.getElementById('addButtonText').textContent = 'Add Entry';
    document.getElementById('cancelEditBtn').style.display = 'none';
    clearForm();
    showNotification('Edit cancelled', 'info');
}

function deleteEntry(index) {
    const entry = loanData[index];
    if (confirm(`Are you sure you want to delete this ${entry.type.toLowerCase()} entry for ${entry.customer}?`)) {
        loanData.splice(index, 1);
        saveDatabase();
        updateTable();
        updateStatistics();
        updateCustomerSuggestions();
        showNotification('Entry deleted successfully', 'warning');
        
        // Refresh balance results if currently displayed
        const balanceResults = document.getElementById('balanceResults');
        if (balanceResults.style.display !== 'none') {
            calculateCustomerBalance();
        }
    }
}

function clearForm() {
    document.getElementById('customer').value = '';
    document.getElementById('type').value = 'Loan';
    document.getElementById('item').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('notes').value = '';
    setTodayDate();
}

// Customer Balance Calculator
function calculateCustomerBalance() {
    const customerName = document.getElementById('customerSearchInput').value.trim();
    
    if (!customerName) {
        showNotification('Please enter a customer name', 'error');
        return;
    }
    
    // Filter entries for this customer (case-insensitive)
    const customerEntries = loanData.filter(entry => 
        entry.customer.toLowerCase() === customerName.toLowerCase()
    );
    
    if (customerEntries.length === 0) {
        showNotification('No entries found for this customer', 'warning');
        clearBalanceResults();
        return;
    }
    
    // Sort entries by date
    customerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate totals
    let totalLoans = 0;
    let totalPayments = 0;
    let runningBalance = 0;
    
    const transactionsWithBalance = customerEntries.map(entry => {
        if (entry.type === 'Loan') {
            totalLoans += entry.amount;
            runningBalance += entry.amount;
        } else {
            totalPayments += entry.amount;
            runningBalance -= entry.amount;
        }
        
        return {
            ...entry,
            runningBalance: runningBalance
        };
    });
    
    const remainingBalance = totalLoans - totalPayments;
    
    // Update UI
    document.getElementById('customerBalanceName').textContent = `${customerName}'s Account Summary`;
    document.getElementById('customerTotalLoans').textContent = `$${totalLoans.toFixed(2)}`;
    document.getElementById('customerTotalPayments').textContent = `$${totalPayments.toFixed(2)}`;
    
    const remainingElement = document.getElementById('customerRemainingBalance');
    remainingElement.textContent = `$${Math.abs(remainingBalance).toFixed(2)}`;
    
    // Update styling based on balance
    remainingElement.className = remainingBalance >= 0 ? 'balance-value remaining-positive' : 'balance-value remaining-negative';
    
    // Populate transactions table
    populateCustomerTransactionsTable(transactionsWithBalance);
    
    // Show results
    document.getElementById('balanceResults').style.display = 'block';
    document.getElementById('balanceResults').scrollIntoView({ behavior: 'smooth' });
    
    showNotification(`Balance calculated for ${customerName}`, 'success');
}

function populateCustomerTransactionsTable(transactions) {
    const tbody = document.querySelector('#customerTransactionsTable tbody');
    tbody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const row = tbody.insertRow();
        row.className = transaction.type === 'Loan' ? 'loan-row' : 'payment-row';
        
        row.innerHTML = `
            <td><span class="transaction-type ${transaction.type.toLowerCase()}">${transaction.type}</span></td>
            <td>${transaction.item}</td>
            <td>${formatDate(transaction.date)}</td>
            <td>$${transaction.amount.toFixed(2)}</td>
            <td class="${transaction.runningBalance >= 0 ? 'remaining-positive' : 'remaining-negative'}">
                $${Math.abs(transaction.runningBalance).toFixed(2)}
            </td>
        `;
    });
}

function clearBalanceResults() {
    document.getElementById('balanceResults').style.display = 'none';
    document.getElementById('customerSearchInput').value = '';
}

// Table Management Functions
function updateTable() {
    const tbody = document.querySelector('#dataTable tbody');
    const emptyState = document.getElementById('emptyState');
    
    if (loanData.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    loanData.forEach((entry, index) => {
        const row = tbody.insertRow();
        row.className = entry.type === 'Loan' ? 'loan-row' : 'payment-row';
        
        row.innerHTML = `
            <td>${entry.customer}</td>
            <td><span class="transaction-type ${entry.type.toLowerCase()}">${entry.type}</span></td>
            <td>${entry.item}</td>
            <td>${formatDate(entry.date)}</td>
            <td>$${entry.amount.toFixed(2)}</td>
            <td>${entry.notes || '-'}</td>
            <td>
                <button class="btn btn-info" onclick="editEntry(${index})" title="Edit Entry">
                    <span class="btn-icon">✏️</span>
                </button>
                <button class="btn btn-danger" onclick="deleteEntry(${index})" title="Delete Entry">
                    <span class="btn-icon">🗑️</span>
                </button>
            </td>
        `;
    });
}

function filterTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const rows = document.querySelectorAll('#dataTable tbody tr');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const customer = row.cells[0].textContent.toLowerCase();
        const item = row.cells[2].textContent.toLowerCase();
        const type = row.cells[1].textContent.trim();
        
        const matchesSearch = customer.includes(searchTerm) || item.includes(searchTerm);
        const matchesType = !typeFilter || type === typeFilter;
        
        if (matchesSearch && matchesType) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show/hide empty state based on filtered results
    const emptyState = document.getElementById('emptyState');
    if (visibleCount === 0 && loanData.length > 0) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="empty-icon">🔍</div>
            <h3>No matching results</h3>
            <p>Try adjusting your search or filter criteria</p>
        `;
    } else if (loanData.length === 0) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="empty-icon">📋</div>
            <h3>No transactions recorded</h3>
            <p>Begin by adding your first loan or payment entry above</p>
        `;
    } else {
        emptyState.style.display = 'none';
    }
}

function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    loanData.sort((a, b) => {
        let aValue = a[column];
        let bValue = b[column];
        
        // Handle different data types
        if (column === 'amount') {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        } else if (column === 'date') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateTable();
    updateSortArrows();
}

function updateSortArrows() {
    // Reset all arrows
    document.querySelectorAll('.sort-arrow').forEach(arrow => {
        arrow.textContent = '↕';
    });
    
    // Set active arrow
    const activeHeader = document.querySelector(`th[onclick="sortTable('${sortColumn}')"] .sort-arrow`);
    if (activeHeader) {
        activeHeader.textContent = sortDirection === 'asc' ? '↑' : '↓';
    }
}

// Statistics Management
function updateStatistics() {
    const totalEntries = loanData.length;
    const totalLoans = loanData.filter(entry => entry.type === 'Loan').length;
    const totalPayments = loanData.filter(entry => entry.type === 'Payment').length;
    
    const totalLoanAmount = loanData
        .filter(entry => entry.type === 'Loan')
        .reduce((sum, entry) => sum + entry.amount, 0);
    
    const totalPaymentAmount = loanData
        .filter(entry => entry.type === 'Payment')
        .reduce((sum, entry) => sum + entry.amount, 0);
    
    const outstandingBalance = totalLoanAmount - totalPaymentAmount;
    
    document.getElementById('totalEntries').textContent = totalEntries;
    document.getElementById('totalLoans').textContent = totalLoans;
    document.getElementById('totalPayments').textContent = totalPayments;
    document.getElementById('totalBalance').textContent = `${outstandingBalance.toFixed(2)}`;
    
    // Update balance color
    const balanceElement = document.getElementById('totalBalance');
    balanceElement.style.color = outstandingBalance >= 0 ? '#4CAF50' : '#f44336';
}

// Customer Suggestions
function updateCustomerSuggestions() {
    const customers = [...new Set(loanData.map(entry => entry.customer))].sort();
    
    // Update form datalist
    const existingCustomers = document.getElementById('existingCustomers');
    existingCustomers.innerHTML = '';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer;
        existingCustomers.appendChild(option);
    });
    
    // Update search datalist
    const customerSuggestions = document.getElementById('customerSuggestions');
    customerSuggestions.innerHTML = '';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer;
        customerSuggestions.appendChild(option);
    });
}

// Export Functions
function exportToPDF() {
    if (loanData.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Professional Loan Tracker Report', 20, 30);
    
    // Add generation date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Add statistics
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('Summary Statistics', 20, 60);
    
    const totalLoans = loanData.filter(entry => entry.type === 'Loan').length;
    const totalPayments = loanData.filter(entry => entry.type === 'Payment').length;
    const totalLoanAmount = loanData
        .filter(entry => entry.type === 'Loan')
        .reduce((sum, entry) => sum + entry.amount, 0);
    const totalPaymentAmount = loanData
        .filter(entry => entry.type === 'Payment')
        .reduce((sum, entry) => sum + entry.amount, 0);
    const outstandingBalance = totalLoanAmount - totalPaymentAmount;
    
    doc.setFontSize(10);
    doc.text(`Total Entries: ${loanData.length}`, 20, 75);
    doc.text(`Active Loans: ${totalLoans}`, 20, 85);
    doc.text(`Payments Made: ${totalPayments}`, 20, 95);
    doc.text(`Outstanding Balance: ${outstandingBalance.toFixed(2)}`, 20, 105);
    
    // Prepare table data
    const tableData = loanData.map(entry => [
        entry.customer,
        entry.type,
        entry.item,
        formatDate(entry.date),
        `${entry.amount.toFixed(2)}`,
        entry.notes || '-'
    ]);
    
    // Add table
    doc.autoTable({
        head: [['Customer', 'Type', 'Item', 'Date', 'Amount', 'Notes']],
        body: tableData,
        startY: 120,
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        columnStyles: {
            4: { halign: 'right' }
        }
    });
    
    // Save the PDF
    doc.save(`loan_tracker_report_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('PDF report generated successfully', 'success');
}

function exportToExcel() {
    if (loanData.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    // Prepare data for Excel
    const excelData = loanData.map(entry => ({
        'Customer': entry.customer,
        'Type': entry.type,
        'Item Name': entry.item,
        'Date': entry.date,
        'Amount': entry.amount,
        'Notes': entry.notes || '',
        'Entry Date': new Date(entry.timestamp).toLocaleDateString()
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const colWidths = [
        { wch: 20 }, // Customer
        { wch: 10 }, // Type
        { wch: 25 }, // Item Name
        { wch: 12 }, // Date
        { wch: 12 }, // Amount
        { wch: 30 }, // Notes
        { wch: 15 }  // Entry Date
    ];
    ws['!cols'] = colWidths;
    
    // Add summary sheet
    const summaryData = [
        ['Metric', 'Value'],
        ['Total Entries', loanData.length],
        ['Total Loans', loanData.filter(entry => entry.type === 'Loan').length],
        ['Total Payments', loanData.filter(entry => entry.type === 'Payment').length],
        ['Total Loan Amount', loanData.filter(entry => entry.type === 'Loan').reduce((sum, entry) => sum + entry.amount, 0)],
        ['Total Payment Amount', loanData.filter(entry => entry.type === 'Payment').reduce((sum, entry) => sum + entry.amount, 0)],
        ['Outstanding Balance', loanData.filter(entry => entry.type === 'Loan').reduce((sum, entry) => sum + entry.amount, 0) - loanData.filter(entry => entry.type === 'Payment').reduce((sum, entry) => sum + entry.amount, 0)]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 15 }];
    
    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    // Generate and download file
    XLSX.writeFile(wb, `loan_tracker_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Excel file generated successfully', 'success');
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter to add entry
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        addEntry();
    }
    
    // Escape to cancel edit
    if (e.key === 'Escape' && editingIndex >= 0) {
        cancelEdit();
    }
    
    // Ctrl + S to export database
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportDatabase();
    }
});

// Auto-save functionality
let autoSaveTimeout;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveDatabase();
    }, 1000); // Auto-save after 1 second of inactivity
}

// Add event listeners to form inputs for auto-save
document.addEventListener('DOMContentLoaded', function() {
    const formInputs = document.querySelectorAll('#customer, #type, #item, #date, #amount, #notes');
    formInputs.forEach(input => {
        input.addEventListener('input', scheduleAutoSave);
    });
});

// Prevent data loss on page unload
window.addEventListener('beforeunload', function(e) {
    if (editingIndex >= 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// Enhanced search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    // Add debounce to search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
        filterTable();
    }, 300);
});

// Customer search auto-complete
document.getElementById('customerSearchInput').addEventListener('input', function(e) {
    const value = e.target.value.toLowerCase();
    const suggestions = document.getElementById('customerSuggestions');
    
    // Clear existing suggestions
    suggestions.innerHTML = '';
    
    if (value.length > 0) {
        const customers = [...new Set(loanData.map(entry => entry.customer))]
            .filter(customer => customer.toLowerCase().includes(value))
            .sort();
        
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer;
            suggestions.appendChild(option);
        });
    }
});

// Initialize tooltips and help text
function initializeHelp() {
    const helpElements = [
        {
            selector: '[data-help]',
            handler: function(element) {
                element.addEventListener('mouseenter', function() {
                    showTooltip(this, this.dataset.help);
                });
                element.addEventListener('mouseleave', hideTooltip);
            }
        }
    ];
    
    helpElements.forEach(({ selector, handler }) => {
        document.querySelectorAll(selector).forEach(handler);
    });
}

function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.9rem;
        z-index: 1000;
        pointer-events: none;
        max-width: 200px;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
    
    element._tooltip = tooltip;
}

function hideTooltip(e) {
    if (e.target._tooltip) {
        document.body.removeChild(e.target._tooltip);
        delete e.target._tooltip;
    }
}

// Performance monitoring
let performanceData = {
    loadTime: 0,
    lastAction: null,
    actionCount: 0
};

window.addEventListener('load', function() {
    performanceData.loadTime = performance.now();
    console.log(`Loan Tracker loaded in ${performanceData.loadTime.toFixed(2)}ms`);
});

// Track user actions for analytics
function trackAction(action) {
    performanceData.lastAction = action;
    performanceData.actionCount++;
    
    // Log performance metrics periodically
    if (performanceData.actionCount % 10 === 0) {
        console.log('Performance metrics:', performanceData);
    }
}

// Initialize help system when DOM is ready
document.addEventListener('DOMContentLoaded', initializeHelp);