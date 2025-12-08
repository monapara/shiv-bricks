
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
