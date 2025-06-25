// script.js

// Retrieve entries from localStorage or initialize empty array
let entries = JSON.parse(localStorage.getItem('deliveryEntries')) || [];

// Cache DOM elements
const form = document.getElementById('entryForm');
const dateInput = document.getElementById('deliveryDate');
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

// Initialize: render table on page load
document.addEventListener('DOMContentLoaded', renderTable);

// Form submission handler
form.addEventListener('submit', function(e) {
    e.preventDefault();
    // Basic validation
    if (!partyInput || !dateInput.value || !areaInput.value || !placeInput.value || !transporterInput.value
         || !quantityInput.value || !purchaseInput.value) {
        alert('Please fill in all fields.');
        return;
    }
    // Collect entry data
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
        // Add new entry
        entries.push(entry);
    } else {
        // Update existing entry
        entries[editIndex] = entry;
        editIndex = -1;
        submitbutton.textContent = 'Add Delivery';
    }
    // Save to localStorage and refresh table
    localStorage.setItem('deliveryEntries', JSON.stringify(entries));
    renderTable();

    form.reset();
});

// Render the entries table
function renderTable() {
    // Clear existing rows
    tableBody.innerHTML = '';
    let indexno = 1;
    // Populate table rows from entries array
    entries.forEach((entry, index) => {
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

        //Actions cell with Edit and Delete buttons
        const actionsCell = row.insertCell();
        actionsCell.classList.add('text-center');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'btn btn-sm btn-primary me-2';
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
    const entry = entries[index];
    dateInput.value = entry.date;
    placeInput.value = entry.place;
    partyInput.value = entry.party;
    areaInput.value = entry.area;
    purchaseInput.value = entry.purchase; 
    transporterInput.value = entry.transporter;
    quantityInput.value = entry.quantity;
    editIndex = index;
    submitbutton.textContent = 'Update Delivery';
    localStorage.setItem('deliveryEntries', JSON.stringify(entries));
}

// Delete entry: remove from array and update storage/table
function deleteEntry(index) {
    if (confirm('Delete this entry?')) {
        entries.splice(index, 1);
        localStorage.setItem('deliveryEntries', JSON.stringify(entries));
        renderTable();
    }
}

// Apply filters based on input fields
function applyFilters() {
    const startdateVal = filterstartDate.value ? new Date((filterstartDate.value)) : new Date('0001-01-01');
    const enddateVal = filterendDate.value ? new Date((filterendDate.value)) : new Date('9999-12-31');
    const placeVal = filterPlace.value.toLowerCase();
    const partyVal = filterParty.value.toLowerCase();
    const areaVal = filterArea.value.toLowerCase();
    const purchaseVal = filterPurchase.value.toLowerCase();
    const transporterVal = filterTransporter.value.toLowerCase();
    const quantityVal = filterQuantity.value.toLowerCase();

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


function exportTableToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Centered Firm Name
  const pageWidth = doc.internal.pageSize.getWidth();
  const titleText = "Shiv Bricks";
  const textWidth = doc.getTextWidth(titleText);
  const xOffset = (pageWidth - textWidth) / 2;
  doc.setFontSize(18);
  doc.text(titleText, xOffset, 20);
  doc.setFontSize(12);

  // Get only visible (filtered) rows from DOM
  const table = document.getElementById("entryTableBody");
  const rows = Array.from(table.querySelectorAll("tr")).filter(
    (row) => row.style.display !== "none"
  );

  const data = rows.map((row) =>
    Array.from(row.querySelectorAll("td"))
      .slice(0, 8) // only data cells, skip action buttons
      .map((cell) => cell.textContent.trim())
  );

  const headers = [["No." , "Date", "Place", "Party", "Area", "Purchase", "Transporter", "Quantity"]];

  doc.autoTable({
    startY: 35,
    head: headers,
    body: data,
    theme: "grid",
    styles: {
      font: "helvetica",
      textColor: 17,
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240],
    },
    margin: { top: 35 },
  });

  doc.save("ShivBricks.pdf");
}
