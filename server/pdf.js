/**
 * pdf.js — Monthly report generator using PDFKit
 */

const PDFDocument = require("pdfkit");

function generateMonthlyReport(res, data) {
  const { month, year, stations, complaints, fillStats } = data;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });

  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="RCC-WMS-Report-${monthName}-${year}.pdf"`,
  );
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 100).fill("#0d2b0f");
  doc
    .fillColor("#b8e6bc")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("Rajshahi City Corporation", 50, 28);
  doc
    .fillColor("#4caf5a")
    .fontSize(11)
    .font("Helvetica")
    .text("Waste Management System — Monthly Report", 50, 56);
  doc
    .fillColor("#c9a84c")
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(`${monthName} ${year}`, 50, 74);

  doc.fillColor("#333").fontSize(10).font("Helvetica");
  let y = 120;

  // ── Summary Cards ────────────────────────────────────────
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#0d2b0f")
    .text("Monthly Overview", 50, y);
  y += 22;

  const totalComplaints = complaints.length;
  const resolved = complaints.filter((c) => c.status === "resolved").length;
  const avgFill = fillStats.length
    ? Math.round(
        fillStats.reduce((a, b) => a + b.avg_fill, 0) / fillStats.length,
      )
    : 0;

  const cards = [
    { label: "Total Complaints", value: totalComplaints },
    { label: "Resolved", value: resolved },
    { label: "Pending", value: totalComplaints - resolved },
    { label: "Avg Fill Level", value: avgFill + "%" },
  ];

  const cardW = 110,
    cardH = 56,
    cardGap = 10;
  cards.forEach((c, i) => {
    const x = 50 + i * (cardW + cardGap);
    doc.rect(x, y, cardW, cardH).fill("#f0f7f0").stroke("#2d7a35");
    doc
      .fillColor("#0d2b0f")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(String(c.value), x + 8, y + 8, {
        width: cardW - 16,
        align: "center",
      });
    doc
      .fillColor("#555")
      .fontSize(8)
      .font("Helvetica")
      .text(c.label, x + 4, y + 36, { width: cardW - 8, align: "center" });
  });
  y += cardH + 22;

  // ── Stations Table ───────────────────────────────────────
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#0d2b0f")
    .text("Station Summary", 50, y);
  y += 18;

  const cols = [120, 80, 80, 80, 80];
  const headers = [
    "Station",
    "Capacity",
    "Avg Fill",
    "Complaints",
    "Clearance",
  ];
  let x = 50;

  doc
    .rect(
      50,
      y,
      cols.reduce((a, b) => a + b, 0),
      20,
    )
    .fill("#0d2b0f");
  headers.forEach((h, i) => {
    doc
      .fillColor("#b8e6bc")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(h, x + 4, y + 5, { width: cols[i] - 8 });
    x += cols[i];
  });
  y += 20;

  stations.forEach((st, row) => {
    const stComplaints = complaints.filter(
      (c) => c.station_id === st.id,
    ).length;
    const stFill = fillStats.find((f) => f.station_id === st.id);
    const avgF = stFill ? Math.round(stFill.avg_fill) + "%" : "–";
    const rowBg = row % 2 === 0 ? "#f8fdf8" : "#ffffff";

    doc
      .rect(
        50,
        y,
        cols.reduce((a, b) => a + b, 0),
        22,
      )
      .fill(rowBg);
    const vals = [
      st.name.replace(" Secondary Transfer Station", " STS"),
      (st.capacity_tons || "–") + " t/day",
      avgF,
      stComplaints,
      st.clearance_time,
    ];
    x = 50;
    vals.forEach((v, i) => {
      doc
        .fillColor("#222")
        .fontSize(8.5)
        .font("Helvetica")
        .text(String(v), x + 4, y + 6, { width: cols[i] - 8 });
      x += cols[i];
    });
    y += 22;
  });
  y += 20;

  // ── Complaints Breakdown ─────────────────────────────────
  if (y > 650) {
    doc.addPage();
    y = 50;
  }

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#0d2b0f")
    .text("Complaint Breakdown by Type", 50, y);
  y += 18;

  const typeCounts = {};
  complaints.forEach((c) => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });

  const typeLabels = {
    overflow: "Bin Overflow / Not Cleared",
    odor: "Bad Odor / Sanitation",
    damage: "Damaged Infrastructure",
    illegal: "Illegal Dumping",
    staff: "Staff Conduct",
    other: "Other",
  };

  const barMaxW = 300;
  const maxCount = Math.max(...Object.values(typeCounts), 1);

  Object.entries(typeCounts).forEach(([type, count]) => {
    const barW = Math.round((count / maxCount) * barMaxW);
    doc.rect(50, y, barW || 2, 14).fill("#2d7a35");
    doc
      .fillColor("#222")
      .fontSize(8.5)
      .font("Helvetica")
      .text(`${typeLabels[type] || type} (${count})`, 50 + barW + 6, y + 2);
    y += 20;
  });

  if (Object.keys(typeCounts).length === 0) {
    doc.fillColor("#888").fontSize(9).text("No complaints this month.", 50, y);
    y += 20;
  }

  y += 10;

  // ── Recent Complaints List ───────────────────────────────
  if (complaints.length > 0) {
    if (y > 600) {
      doc.addPage();
      y = 50;
    }

    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .fillColor("#0d2b0f")
      .text("Recent Complaints", 50, y);
    y += 18;

    const listCols = [160, 90, 80, 70, 70];
    const listHeaders = ["Station", "Type", "Submitted By", "Status", "Date"];
    x = 50;
    doc
      .rect(
        50,
        y,
        listCols.reduce((a, b) => a + b, 0),
        18,
      )
      .fill("#0d2b0f");
    listHeaders.forEach((h, i) => {
      doc
        .fillColor("#b8e6bc")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(h, x + 3, y + 4, { width: listCols[i] - 6 });
      x += listCols[i];
    });
    y += 18;

    complaints.slice(0, 20).forEach((c, row) => {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      const rowBg = row % 2 === 0 ? "#f8fdf8" : "#ffffff";
      doc
        .rect(
          50,
          y,
          listCols.reduce((a, b) => a + b, 0),
          20,
        )
        .fill(rowBg);
      const dateStr = c.created_at ? c.created_at.slice(0, 10) : "–";
      const vals = [
        c.station_name.replace(" Secondary Transfer Station", " STS"),
        typeLabels[c.type] || c.type,
        c.user_name,
        c.status.charAt(0).toUpperCase() + c.status.slice(1),
        dateStr,
      ];
      x = 50;
      vals.forEach((v, i) => {
        doc
          .fillColor("#222")
          .fontSize(8)
          .font("Helvetica")
          .text(String(v), x + 3, y + 5, { width: listCols[i] - 6 });
        x += listCols[i];
      });
      y += 20;
    });
  }

  // ── Footer ───────────────────────────────────────────────
  const pages = doc.bufferedPageRange ? doc.bufferedPageRange() : null;
  doc
    .fontSize(8)
    .fillColor("#aaa")
    .text(
      `Generated on ${new Date().toLocaleString("en-US")} — RCC Waste Management System`,
      50,
      doc.page.height - 36,
      { align: "center", width: doc.page.width - 100 },
    );

  doc.end();
}

module.exports = { generateMonthlyReport };
