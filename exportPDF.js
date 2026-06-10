function exportTableToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ---- palette (matches the app) ----
  const ink      = [42, 33, 28];    // espresso header + body text
  const white    = [255, 255, 255];
  const line     = [225, 217, 205]; // light grid lines
  const zebra    = [247, 242, 235]; // alternate-row tint
  const clay     = [162, 84, 47];   // brand accent (title rule)
  const clayTint = [244, 230, 220]; // totals band
  const grey     = [140, 128, 118]; // date + page number

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

  // Document date (dd-mm-yyyy), matching the app's date format
  const now = new Date();
  const dateStr =
    String(now.getDate()).padStart(2, "0") + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    now.getFullYear();
  const totalPagesExp = "{total_pages_count_string}";

  doc.autoTable({
    head: headers,
    body: body,
    foot: foot,
    showFoot: "lastPage",
    margin: { top: 27, right: 14, bottom: 16, left: 14 },
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 2.6,
      lineColor: line,
      lineWidth: 0.1,
      textColor: ink,
      valign: "middle",
      overflow: "linebreak"
    },
    headStyles: {
      fillColor: ink,
      textColor: white,
      fontStyle: "bold",
      lineColor: ink,
      lineWidth: 0.1
    },
    alternateRowStyles: { fillColor: zebra },
    footStyles: {
      fillColor: clayTint,
      textColor: ink,
      fontStyle: "bold",
      fontSize: 10,
      lineColor: line,
      lineWidth: 0.1
    },
    didParseCell: function (data) {
      // right-align the numeric columns (No. and Quantity)
      const src = selectedCols[data.column.index];
      if (src === 0 || src === 7) data.cell.styles.halign = "right";
    },
    didDrawPage: function (data) {
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text("Shiv Bricks", pw / 2, 15.5, { align: "center" });

      // Document date (top-right)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(grey[0], grey[1], grey[2]);
      doc.text(dateStr, pw - 14, 15.5, { align: "right" });

      // Clay accent rule under the title
      doc.setDrawColor(clay[0], clay[1], clay[2]);
      doc.setLineWidth(0.8);
      doc.line(14, 21, pw - 14, 21);

      // Page number (bottom-center)
      doc.setFontSize(9);
      doc.setTextColor(grey[0], grey[1], grey[2]);
      doc.text(data.pageNumber + " / " + totalPagesExp, pw / 2, ph - 9, { align: "center" });
    }
  });

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(totalPagesExp);

  doc.save("ShivBricks.pdf");
}
