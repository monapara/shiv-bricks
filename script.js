// script.js

// Retrieve entries from localStorage or initialize empty array
let entries = JSON.parse(localStorage.getItem('deliveryEntries')) || [];

// === ADD THIS MIGRATION BLOCK ===
let dataWasMigrated = false;
entries.forEach(entry => {
    // Check if the businessYear property does NOT exist
    if (entry.businessYear === undefined) { 
        console.log('Found old entry, migrating...');
    
            // As a last resort, use a default (e.g., current year)
            entry.businessYear = new Date().getFullYear().toString(); 
        dataWasMigrated = true;
    }
});

// Cache DOM elements
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('deliveryDate');
const businessYearInput = document.getElementById('businessYear'); // === ADDED ===
const placeInput = document.getElementById('place');
const partyInput = document.getElementById('party');
const areaInput = document.getElementById('area');
const purchaseInput = document.getElementById('purchase');
const transporterInput = document.getElementById('transporter');
const quantityInput = document.getElementById('quantity')
const submitbutton = document.getElementById('submitbutton');

const tableBody = document.getElementById('entryTableBody');
// ... (all filter input caches are the same)
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
// This will hold the selected *Business Year* (e.g., "2081")
let selectedYear = ""; // === MODIFIED ===

// Initialize: render table on page load
document.addEventListener('DOMContentLoaded', () => {
    // === MODIFIED THIS BLOCK ===
    // Set default year to the latest business year in data
    const years = getUniqueBusinessYears();
    if (years.length > 0) {
        selectedYear = years[0]; // Default to the most recent year
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
    // === MODIFIED VALIDATION ===
    if (!partyInput || !dateInput.value || !areaInput.value || !placeInput.value || !transporterInput.value
         || !quantityInput.value || !purchaseInput.value || !businessYearInput.value) { // === ADDED ===
        alert('Please fill in all fields.');
        return;
    }
    
    // === MODIFIED ENTRY OBJECT ===
    const entry = {
        date: dateInput.value,
        businessYear: businessYearInput.value.trim(), // === ADDED ===
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

    // === MODIFIED THIS BLOCK ===
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

    // === MODIFIED THIS FILTER LOGIC ===
    // Filter the entries by the globally selected *Business Year*
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
    businessYearInput.value = entry.businessYear; // === ADDED ===
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

// === NEW FUNCTIONS MODIFIED/RENAMED ===

/**
 * Gets a sorted list of unique *business years* from the entries.
 */
function getUniqueBusinessYears() { // === RENAMED & MODIFIED ===
    const years = new Set(
        entries
            .map(entry => entry.businessYear) // === Get businessYear field ===
            .filter(year => year) // Filter out any null/undefined entries
    );
    // Sort in descending order (e.g., "2081", "2080")
    return Array.from(years).sort((a, b) => b.localeCompare(a));
}

/**
 * Renders the year selection tabs
 */
function renderYearTabs() {
    const years = getUniqueBusinessYears(); // === Using new function ===
    
    // If the currently selected year isn't in the list
    // (e.g., it's the default "2025" but no entries exist),
    // add it to the list just for the tab.
    if (!years.includes(selectedYear)) {
        years.unshift(selectedYear); // Add it to the beginning
    }

    const tabsContainer = document.getElementById('yearTabs');
    tabsContainer.innerHTML = ''; // Clear old tabs

    years.forEach(year => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link';
        if (year === selectedYear) { // === Use string comparison ===
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
    // === Made this more robust to find the exact entry ===
    return entries.findIndex(e => 
        e.date === entry.date &&
        e.party === entry.party &&
        e.place === entry.place &&
        e.businessYear === entry.businessYear && // === ADDED ===
        e.quantity === entry.quantity
    );
}



// Apply filters based on input fields
function applyFilters() {
    const startdateVal = filterstartDate.value ? new Date((filterstartDate.value)) : new Date('0001-01-01');
    const enddateVal = filterendDate.value ? new Date((filterendDate.value)) : new Date('9999-12-31');
    const placeVal = filterPlace.value.toLowerCase().trim();
    const partyVal = filterParty.value.toLowerCase().trim();
    const areaVal = filterArea.value.toLowerCase().trim();
    const purchaseVal = filterPurchase.value.toLowerCase().trim();
    const transporterVal = filterTransporter.value.toLowerCase().trim();
    const quantityVal = filterQuantity.value.toLowerCase().trim();

    document.querySelectorAll('#entryTableBody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        const matchstartDate = !startdateVal || new Date(formatdatetoYYYYMMDD(cells[1].textContent)) >= startdateVal;
        const matchendDate = !enddateVal || new Date(formatdatetoYYYYMMDD(cells[1].textContent)) <= enddateVal;
        const matchPlace = !placeVal || cells[2].textContent.toLowerCase().includes(placeVal);
        const matchParty = !partyVal || cells[3].textContent.toLowerCase().includes(partyVal);
        const matchArea = !areaVal || cells[4].textContent.toLowerCase().includes(areaVal);
        const matchPurchase = !purchaseVal || cells[5].textContent.toLowerCase().includes(purchaseVal);
        const matchTransporter = !transporterVal || cells[6].textContent.toLowerCase().includes(transporterVal);
        const matchQuantity = !quantityVal || cells[7].textContent.toLowerCase().includes(quantityVal);
        
        // Show row if all filter conditions match
        if (matchstartDate && matchendDate && matchPlace && matchParty && 
            matchArea && matchTransporter && matchPurchase && matchQuantity) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split("-");
  return `${day}-${month}-${year}`;
}

function formatdatetoYYYYMMDD(datestring) {
    if (!datestring) return '';
    const [day, month, year] = datestring.split("-");
    return `${year}-${month}-${day}`;
}


// Filter inputs event listeners
filterstartDate.addEventListener('change', applyFilters);
filterendDate.addEventListener('change', applyFilters);
filterPlace.addEventListener('input', applyFilters);
filterParty.addEventListener('input', applyFilters);
filterArea.addEventListener('input', applyFilters);
filterPurchase.addEventListener('input', applyFilters);
filterTransporter.addEventListener('input', applyFilters);
filterQuantity.addEventListener('input', applyFilters);


