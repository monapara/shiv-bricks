function exportTableToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Title
  const pageWidth = doc.internal.pageSize.getWidth();
  const title = "Shiv Bricks";
  doc.setFontSize(18);
  doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, 20);

  // Get selected column indexes
  const selectedCols = Array.from(
    document.querySelectorAll(".pdf-col:checked")
  ).map(cb => parseInt(cb.value));

  if (selectedCols.length === 0) {
    alert("Please select at least one column to export.");
    return;
  }

  // Headers (from table head)
  const headerCells = document.querySelectorAll("thead th");
  const headers = [
    selectedCols.map(i => headerCells[i].textContent.trim())
  ];

  // Visible rows only
  const rows = Array.from(
    document.querySelectorAll("#entryTableBody tr")
  ).filter(row => row.style.display !== "none");

  const body = rows.map(row => {
    const cells = row.querySelectorAll("td");
    return selectedCols.map(i => cells[i].textContent.trim());
  });

  // Footer (only if Quantity is selected)
  const totalCount = document.getElementById("totalCount").textContent;
  const totalQty = document.getElementById("totalQuantity").textContent;

  let foot = [];
  if (selectedCols.includes(7)) {
    foot = [
      selectedCols.map(i =>
        i === 0 ? totalCount :
        i === 7 ? totalQty : ""
      )
    ];
  }

  doc.autoTable({
    startY: 35,
    head: headers,
    body: body,
    foot: foot,
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: 255,
      fontStyle: "bold"
    }
  });

  doc.save("ShivBricks.pdf");
}
