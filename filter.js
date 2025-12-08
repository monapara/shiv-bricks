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

        let visibleCount = 0;
        let visibleQuantitySum = 0;
        // Show row if all filter conditions match
        if (matchstartDate && matchendDate && matchPlace && matchParty && 
            matchArea && matchTransporter && matchPurchase && matchQuantity) {
            row.style.display = '';
            visibleCount++;
            const qty = parseFloat(cells[7].textContent) || 0;
            visibleQuantitySum += qty;
        } else {
            row.style.display = 'none';
        }
    });
    document.getElementById('totalCount').textContent = visibleCount;
    document.getElementById('totalQuantity').textContent = visibleQuantitySum;
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
