// script.js

// Retrieve entries from localStorage or initialize empty array
let entries = JSON.parse(localStorage.getItem('deliveryEntries')) || [];

// === MIGRATION SCRIPT START ===
// This runs one time to fix old data
let dataWasMigrated = false;
entries.forEach(entry => {
    // Check if the businessYear property does NOT exist
    if (entry.businessYear === undefined) { 
        console.log('Found old entry, migrating...');
        // Create it by guessing from the calendar year
        if (entry.date) {
            entry.businessYear = new Date(entry.date).getFullYear().toString();
        } else {
            // As a last resort, use a default (e.g., current year)
            entry.businessYear = new Date().getFullYear().toString(); 
        }
        dataWasMigrated = true;
    }
});

// If we made any changes, save them back to localStorage immediately
if (dataWasMigrated) {
    console.log('Migration complete. Saving updated entries...');
    localStorage.setItem('deliveryEntries', JSON.stringify(entries));
}
// === MIGRATION SCRIPT END ===


// Cache DOM elements
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('deliveryDate');
const businessYearInput = document.getElementById('businessYear');
const placeInput = document.getElementById('place');
const partyInput = document.getElementById('party');
const areaInput = document.getElementById('area');
const purchaseInput = document.getElementById('purchase');
const transporterInput = document.getElementById('transporter');
const quantityInput = document.getElementById('quantity')
const submitbutton = document.getElementById('submitbutton');

const tableBody = document.getElementById('entryTableBody');
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
// This will hold the selected Business Year (e.g., "2081")
let selectedYear = ""; 

// Initialize: render table on page load
document.addEventListener('DOMContentLoaded', () => {
    const years = getUniqueBusinessYears();
    if (years.length > 0) {
        // Set default to the LATEST year (last item in ascending array)
        selectedYear = years[years.length - 1]; 
    } else {
        // Provide a default if no data exists yet
        selectedYear = new Date().getFullYear().toString(); 
    }
    
    renderYearTabs();
    renderTable();
});

// Form submission handler
form.addEventListener('submit', function(e) {
    e.preventDefault();
    // Validation
    if (!partyInput || !dateInput.value || !areaInput.value || !placeInput.value || !transporterInput.value
         || !quantityInput.value || !purchaseInput.value || !businessYearInput.value) {
        alert('Please fill in all fields.');
        return;
    }
    
    // Collect entry data
    const entry = {
        date: dateInput.value,
        businessYear: businessYearInput.value.trim(),
        place: placeInput.value.trim(),
        party: partyInput.value.trim(),
        area: areaInput.value.trim(),
        purchase: purchaseInput.value.trim(),
        transporter: transporterInput.value.trim(),
        quantity: quantityInput.value.trim()
    };

    if (editIndex === -1) {
        // Add new entry
        entries.push(entry);
    } else {
        // Update existing entry
        entries[editIndex] = entry;
        editIndex = -1;
        submitbutton.textContent = 'Add Delivery';
    }
    // Save to localStorage
    localStorage.setItem('deliveryEntries', JSON.stringify(entries));

    // Automatically switch the view to the year of the entry you just added/edited
    selectedYear = entry.businessYear;
    renderYearTabs(); // Re-render tabs in case a new year was added
    
    renderTable(); 
    form.reset();
});

// Render the entries table
function renderTable() {
    // Clear existing rows
    tableBody.innerHTML = '';

    // Filter the entries by the globally selected Business Year
    const yearEntries = entries.filter(entry => {
        return entry.businessYear === selectedYear;
    });

    let indexno = 1;

    // Now, loop over the new 'yearEntries' array
    yearEntries.forEach((entry) => {
        
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
        
        // Find the entry's *original* index for editing and deleting
        const originalIndex = findOriginalIndex(entry);
        editBtn.addEventListener('click', () => editEntry(originalIndex));

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.className = 'btn btn-sm btn-danger';
        
        delBtn.addEventListener('click', () => deleteEntry(originalIndex));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
    applyFilters(); // Reapply any active filters after rendering
}

// Edit entry: fill form with data
function editEntry(index) {
    const entry = entries[index];
    dateInput.value = entry.date;
    businessYearInput.value = entry.businessYear;
    placeInput.value = entry.place;
    partyInput.value = entry.party;
    areaInput.value = entry.area;
    purchaseInput.value = entry.purchase; 
    transporterInput.value = entry.transporter;
    quantityInput.value = entry.quantity;
    editIndex = index;
    submitbutton.textContent = 'Update Delivery';

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

// Delete entry: remove from array and update storage/table
function deleteEntry(index) {
    if (confirm('Delete this entry?')) {
        entries.splice(index, 1);
        localStorage.setItem('deliveryEntries', JSON.stringify(entries));
        
        renderYearTabs(); // Re-render tabs in case a year is now empty
        renderTable();
    }
}

/**
 * Gets a sorted list of unique *business years* from the entries.
 */
function getUniqueBusinessYears() {
    const years = new Set(
        entries
            .map(entry => entry.businessYear)
            .filter(year => year) // Filter out any null/undefined entries
    );
    // Sort in ascending order (e.g., "2080", "2081")
    return Array.from(years).sort((a, b) => a.localeCompare(b));
}

/**
 * Renders the year selection tabs
 */
function renderYearTabs() {
    const years = getUniqueBusinessYears(); 
    
    // If the currently selected year isn't in the list
    // (e.g., it's the default "2025" but no entries exist),
    // add it to the list just for the tab.
    if (years.length === 0 || !years.includes(selectedYear)) {
        if (selectedYear) {
             years.push(selectedYear); // Add it
             years.sort((a, b) => a.localeCompare(b)); // Re-sort
        }
    }

    const tabsContainer = document.getElementById('yearTabs');
    tabsContainer.innerHTML = ''; // Clear old tabs

    years.forEach(year => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link';
        if (year === selectedYear) {
            a.classList.add('active'); // Highlight the selected year
        }
        a.href = '#';
        a.textContent = year;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            selectedYear = year; // Update the selected year
            renderYearTabs(); // Re-render tabs to show new active one
            renderTable(); // Re-render the table for the new year
        });
        
        li.appendChild(a);
        tabsContainer.appendChild(li);
    });
}

/**
 * Finds the original index of an entry in the main 'entries' array.
 */
function findOriginalIndex(entry) {
    return entries.findIndex(e => 
        e.date === entry.date &&
        e.party === entry.party &&
        e.place === entry.place &&
        e.businessYear === entry.businessYear &&
        e.quantity === entry.quantity
    );
}
