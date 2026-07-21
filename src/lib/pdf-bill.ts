import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate, formatMobileNumber } from "@/lib/utils";
import type { UserLedgerDetail, UserLedgerRow } from "@/types";

export function generateUserBillPdf(detail: UserLedgerDetail) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(234, 88, 12); // Orange #ea580c
  doc.text("VD's Hunger Hub", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Customer Credit / Debit Statement", 14, 26);
  doc.text(`Generated on: ${formatDate(new Date())}`, pageWidth - 14, 26, { align: "right" });

  doc.setLineWidth(0.5);
  doc.setDrawColor(220);
  doc.line(14, 30, pageWidth - 14, 30);

  // Customer Details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`Customer: ${detail.user.name}`, 14, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Mobile: ${formatMobileNumber(detail.user.number)}`, 14, 46);
  if (detail.user.company) {
    doc.text(`Company: ${detail.user.company.name}`, 14, 52);
  }

  // Summary Box
  const summaryBoxY = detail.user.company ? 58 : 52;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, summaryBoxY, pageWidth - 28, 22, 3, 3, "F");

  const colWidth = (pageWidth - 28) / 3;
  
  // Total Billed
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Total Billed", 14 + 10, summaryBoxY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(detail.totalDebit), 14 + 10, summaryBoxY + 16);

  // Total Paid
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Total Paid", 14 + colWidth + 10, summaryBoxY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 101, 52); // Green
  doc.text(formatCurrency(detail.totalPaid), 14 + colWidth + 10, summaryBoxY + 16);

  // Balance Due
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Balance Due", 14 + colWidth * 2 + 10, summaryBoxY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(detail.balance > 0 ? 185 : 22, detail.balance > 0 ? 28 : 101, detail.balance > 0 ? 28 : 52);
  doc.text(formatCurrency(detail.balance), 14 + colWidth * 2 + 10, summaryBoxY + 16);

  // Table of Timeline
  let runningBalance = detail.balance;
  // Compute timeline with running balance (timeline is newest first, so we compute from bottom or forward)
  // Let's compute chronologically (oldest first) to get accurate running balance
  const chronoTimeline = [...detail.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let currentBal = 0;
  const tableRows = chronoTimeline.map((item) => {
    if (item.type === "DEBIT") {
      currentBal += item.amount;
    } else {
      currentBal -= item.amount;
    }
    return [
      formatDate(item.date),
      item.label,
      item.type === "DEBIT" ? formatCurrency(item.amount) : "—",
      item.type === "CREDIT" ? formatCurrency(item.amount) : "—",
      formatCurrency(Math.round(currentBal * 100) / 100),
    ];
  }).reverse(); // Reverse back to newest first for display

  autoTable(doc, {
    startY: summaryBoxY + 28,
    head: [["Date", "Description", "Debit (+)", "Credit (-)", "Running Balance"]],
    body: tableRows,
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 32, halign: "right", textColor: [185, 28, 28] },
      3: { cellWidth: 32, halign: "right", textColor: [22, 101, 52] },
      4: { cellWidth: 38, halign: "right", fontStyle: "bold" },
    },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`Bill-${detail.user.name.replace(/[^a-zA-Z0-9]/g, "_")}-${formatDate(new Date()).replace(/\s+/g, "_")}.pdf`);
}

export function generateBulkOutstandingPdf(rows: UserLedgerRow[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(234, 88, 12);
  doc.text("VD's Hunger Hub", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Outstanding Balances Summary Report", 14, 26);
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - 14, 26, { align: "right" });

  doc.setLineWidth(0.5);
  doc.setDrawColor(220);
  doc.line(14, 30, pageWidth - 14, 30);

  const totalOutstanding = rows.reduce((sum, r) => sum + (r.balance > 0 ? r.balance : 0), 0);
  const totalCollected = rows.reduce((sum, r) => sum + r.totalPaid, 0);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Customers: ${rows.length}  |  Total Outstanding: ${formatCurrency(totalOutstanding)}  |  Total Collected: ${formatCurrency(totalCollected)}`, 14, 37);

  const tableData = rows.map((r, i) => [
    (i + 1).toString(),
    r.name,
    formatMobileNumber(r.number),
    r.company?.name ?? "—",
    formatCurrency(r.totalDebit),
    formatCurrency(r.totalPaid),
    formatCurrency(r.balance),
    r.lastOrderAt ? formatDate(r.lastOrderAt) : "Never",
  ]);

  autoTable(doc, {
    startY: 42,
    head: [["#", "Name", "Mobile", "Company", "Total Billed", "Total Paid", "Balance", "Last Order"]],
    body: tableData,
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 26 },
    },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`Outstanding-Report-${formatDate(new Date()).replace(/\s+/g, "_")}.pdf`);
}
