// script.js

// === NEW DATA STRUCTURE ===
// Try to load the new tabbed data object
let deliveryData = JSON.parse(localStorage.getItem('deliveryData'));
let activeTab = ""; // This will hold the name of the currently selected tab

// === NEW MIGRATION SCRIPT ===
// If new data doesn't exist, check for old 'deliveryEntries' array to migrate
if (!deliveryData) {
    let oldEntries = JSON.parse(localStorage.getItem('deliveryEntries'));
    
    if (Array.isArray(oldEntries) && oldEntries.length > 0) {
        console.log('Migrating old array data to new tab-based structure...');
        deliveryData = {}; // Initialize new data object
        
        oldEntries.forEach(entry => {
            // Use the 'businessYear' we added as the new tab name
            const tabName = '24-25'; 
            if (!deliveryData[tabName]) {
                deliveryData[tabName] = []; // Create an array for this tab
            }
            delete entry.businessYear; // No longer needed on the entry itself
            deliveryData[tabName].push(entry);
        });
        
        localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
        localStorage.removeItem('deliveryEntries'); // Clean up old key
        console.log('Migration complete!');
    } else if (!deliveryData) {
        // This is a fresh install or the app is empty
        deliveryData = {};
    }
}
// === END OF MIGRATION SCRIPT ===


// Cache DOM elements
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('deliveryDate');
// businessYearInput is removed
const placeInput = document.getElementById('place');
const partyInput = document.getElementById('party');
const areaInput = document.getElementById('area');
const purchaseInput = document.getElementById('purchase');
const transporterInput = document.getElementById('transporter');
const quantityInput = document.getElementById('quantity')
const submitbutton = document.getElementById('submitbutton');
const addTabButton = document.getElementById('addTabButton');
const tableBody = document.getElementById('entryTableBody');

// Cache all filter inputs
const filterstartDate = document.getElementById('startDate');
const filterendDate = document.getElementById('endDate');
const filterPlace = document.getElementById('filterPlace');
const filterParty = document.getElementById('filterParty');
const filterArea = document.getElementById('filterArea');
const filterTransporter = document.getElementById('filterTransporter');
const filterPurchase = document.getElementById('filterPurchase');
const filterQuantity = document.getElementById('filterQuantity');

// Current edit index (-1 means no edit in progress)
let editIndex = -1;

// Initialize: render table on page load
document.addEventListener('DOMContentLoaded', () => {
    const tabs = getSortedTabs();
    if (tabs.length > 0) {
        // Set default to the LATEST year (last item in ascending array)
        activeTab = tabs[tabs.length - 1]; 
    } else {
        // No tabs exist, let's prompt to create one
        addNewTab();
    }
    
    renderTabs();
    renderTable();
});

// === NEW "ADD TAB" BUTTON LISTENER ===
addTabButton.addEventListener('click', addNewTab);

// Form submission handler
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Check if there is an active tab to add to
    if (!activeTab || !deliveryData[activeTab]) {
        alert('Please create a tab first before adding entries.');
        return;
    }

    // Validation
    if (!dateInput.value || !placeInput.value || !partyInput.value || !areaInput.value ||
        !purchaseInput.value || !transporterInput.value || !quantityInput.value) {
        alert('Please fill in all fields.');
        return;
    }
    
    // Collect entry data (no businessYear)
    const entry = {
        date: dateInput.value,
        place: placeInput.value.trim(),
        party: partyInput.value.trim(),
        area: areaInput.value.trim(),
        purchase: purchaseInput.value.trim(),
        transporter: transporterInput.value.trim(),
        quantity: quantityInput.value.trim()
    };

    if (editIndex === -1) {
        // Add new entry to the *active tab's array*
        deliveryData[activeTab].push(entry);
    } else {
        // Update existing entry in the *active tab's array*
        deliveryData[activeTab][editIndex] = entry;
        editIndex = -1;
        submitbutton.textContent = 'Add Delivery';
    }
    
    // Save the entire data object to localStorage
    saveData();
    renderTable(); 
    form.reset();
});

// Render the entries table
function renderTable() {
    // Clear existing rows
    tableBody.innerHTML = '';

    // Get the entries for the *active tab only*
    const tabEntries = deliveryData[activeTab] || [];

    let indexno = 1;

    // Loop over the active tab's entries
    tabEntries.forEach((entry, index) => { // 'index' is now the correct index in the tab array
        const row = tableBody.insertRow();
        row.insertCell().textContent = indexno;
        indexno++;
        row.insertCell().textContent = formatDateToDDMMYYYY(entry.date);
        row.insertCell().textContent = entry.place;
        row.insertCell().textContent = entry.party;
        row.insertCell().textContent = entry.area;
        row.insertCell().textContent = entry.purchase;
        row.insertCell().textContent = entry.transporter;
        row.insertCell().textContent = entry.quantity;

        //Actions cell
        const actionsCell = row.insertCell();
        actionsCell.classList.add('text-center');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'btn btn-sm btn-primary me-2';
        
        // The 'index' from forEach is the correct one to use
        editBtn.addEventListener('click', () => editEntry(index));

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.className = 'btn btn-sm btn-danger';
        
        delBtn.addEventListener('click', () => deleteEntry(index));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
    applyFilters(); // Reapply any active filters after rendering
}

// Edit entry: fill form with data
function editEntry(index) {
    // Get the entry from the active tab's array
    const entry = deliveryData[activeTab][index];
    
    dateInput.value = entry.date;
    placeInput.value = entry.place;
    partyInput.value = entry.party;
    areaInput.value = entry.area;
    purchaseInput.value = entry.purchase; 
    transporterInput.value = entry.transporter;
    quantityInput.value = entry.quantity;
    
    editIndex = index; // This is the index in the tab's array
    submitbutton.textContent = 'Update Delivery';

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

// Delete entry: remove from array and update storage/table
function deleteEntry(index) {
    if (confirm('Delete this entry?')) {
        // Remove the entry from the active tab's array
        deliveryData[activeTab].splice(index, 1);
        saveData();
        renderTable();
        // We don't need to re-render tabs, but if you want to
        // delete a tab when it's empty, this is where you'd add that logic.
    }
}

// === NEW "ADD TAB" FUNCTION ===
function addNewTab() {
    const newTabName = prompt("Enter a name for the new tab (e.g., 'Diwali 2081'):");
    if (newTabName) {
        if (deliveryData[newTabName]) {
            alert('A tab with this name already exists.');
        } else {
            // Create a new empty array for this tab
            deliveryData[newTabName] = [];
            activeTab = newTabName; // Make the new tab active
            saveData();
            renderTabs(); // Redraw the tabs list
            renderTable(); // Redraw the table (will be empty)
        }
    }
}

// === NEW "RENDER TABS" FUNCTION ===
function renderTabs() {
    const tabsContainer = document.getElementById('yearTabs');
    tabsContainer.innerHTML = ''; // Clear old tabs
    
    const tabs = getSortedTabs();

    tabs.forEach(tabName => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link';
        if (tabName === activeTab) {
            a.classList.add('active'); // Highlight the selected tab
        }
        a.href = '#';
        a.textContent = tabName;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            activeTab = tabName; // Update the active tab
            renderTabs(); // Re-render tabs to show new active one
            renderTable(); // Re-render the table for this tab
        });
        
        li.appendChild(a);
        tabsContainer.appendChild(li);
    });
}

// === NEW "GET TABS" HELPER ===
function getSortedTabs() {
    // Get all the keys (tab names) from our data object
    return Object.keys(deliveryData).sort((a, b) => a.localeCompare(b));
}

// === NEW "SAVE DATA" HELPER ===
function saveData() {
    localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
}

// --- All functions from filter.js (like formatDateToDDMMYYYY) are still needed ---
// (These are in filter.js, but script.js needs them too)
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year}`;
}
