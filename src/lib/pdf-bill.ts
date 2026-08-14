import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMobileNumber } from "@/lib/utils";
import type { UserLedgerDetail, UserLedgerRow } from "@/types";

// ── Brand Colors ──────────────────────────────────────────────────────────────
const NAVY: [number, number, number]   = [15, 30, 61];    // #0F1E3D
const GOLD: [number, number, number]   = [201, 168, 76];  // #C9A84C
const WHITE: [number, number, number]  = [255, 255, 255];
const GREEN: [number, number, number]  = [16, 122, 68];   // Dark Green
const RED: [number, number, number]    = [185, 28, 28];   // Dark Red
const GRAY: [number, number, number]   = [100, 116, 139]; // Slate Gray
const DARK: [number, number, number]   = [30, 41, 59];    // Slate Dark
const LGRAY: [number, number, number]  = [248, 250, 252];

/**
 * Format currency specifically for PDF standard fonts (Helvetica).
 * Uses "Rs." instead of Unicode "₹" to prevent font encoding corruption.
 */
function pdfCurrency(amount: number): string {
  const rounded = Math.round((amount || 0) * 100) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(rounded);
  return `Rs. ${formatted}`;
}

function drawHeader(doc: jsPDF, subtitle: string, periodText?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Navy banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 36, "F");

  // Gold accent bar below banner
  doc.setFillColor(...GOLD);
  doc.rect(0, 36, pageWidth, 2.5, "F");

  // Company Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("ViTa Cuisine", 14, 16);

  // Company Subtitle / Tagline
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("THINK FOOD, THINK US", 14, 23);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(210, 220, 240);
  doc.text("Restaurant & Tiffin Service · Thaltej, Ahmedabad · +91 635 635 0085", 14, 29);

  // Document Type / Date (Right aligned)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(subtitle, pageWidth - 14, 15, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(210, 220, 240);
  if (periodText) {
    doc.text(`Period: ${periodText}`, pageWidth - 14, 22, { align: "right" });
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - 14, 28, { align: "right" });
  } else {
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - 14, 23, { align: "right" });
  }

  return 48; // Y cursor position after header
}

function drawPageFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "ViTa Cuisine · 19, Ayana Complex, Nr. Zydus Cancer Hospital, Thaltej, Ahmedabad",
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );
  doc.text(
    "Contact: +91 635 635 0085 (Restaurant) · +91 635 635 0086 (Delivery)",
    pageWidth / 2,
    pageHeight - 7,
    { align: "center" }
  );
}

export function generateUserBillPdf(detail: UserLedgerDetail) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let periodText: string | undefined;
  if (detail.startDate && detail.endDate) {
    periodText = `${formatDate(detail.startDate)} to ${formatDate(detail.endDate)}`;
  } else if (detail.startDate) {
    periodText = `From ${formatDate(detail.startDate)}`;
  } else if (detail.endDate) {
    periodText = `Up to ${formatDate(detail.endDate)}`;
  }

  let y = drawHeader(doc, "ACCOUNT STATEMENT", periodText);

  // Customer Details Block
  const boxHeight = detail.user.company ? 28 : 22;
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, boxHeight, 3, 3, "FD");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(`Customer: ${detail.user.name}`, 20, y + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(`Mobile: ${formatMobileNumber(detail.user.number)}`, 20, y + 15);

  if (detail.user.company) {
    doc.text(`Company: ${detail.user.company.name}`, 20, y + 22);
  }

  y += boxHeight + 8;

  // Summary Metrics Row (Total Billed | Total Paid | Balance Due)
  const cardW = (pageWidth - 28 - 12) / 3;
  const metrics = [
    { title: "TOTAL BILLED", value: pdfCurrency(detail.totalDebit), color: NAVY, bg: [241, 245, 249] as [number, number, number] },
    { title: "TOTAL PAID", value: pdfCurrency(detail.totalPaid), color: GREEN, bg: [240, 253, 244] as [number, number, number] },
    { title: "BALANCE DUE", value: pdfCurrency(detail.balance), color: detail.balance > 0 ? RED : GREEN, bg: detail.balance > 0 ? [254, 242, 242] as [number, number, number] : [240, 253, 244] as [number, number, number] },
  ];

  metrics.forEach((m, i) => {
    const x = 14 + i * (cardW + 6);
    doc.setFillColor(...m.bg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 20, 3, 3, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(m.title, x + 8, y + 7);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...m.color);
    doc.text(m.value, x + 8, y + 15);
  });

  y += 28;

  // Transactions Table
  const chronoTimeline = [...detail.timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
      item.type === "DEBIT" ? pdfCurrency(item.amount) : "-",
      item.type === "CREDIT" ? pdfCurrency(item.amount) : "-",
      pdfCurrency(Math.round(currentBal * 100) / 100),
    ];
  }).reverse();

  autoTable(doc, {
    startY: y,
    margin: { bottom: 25 },
    head: [["Date", "Description", "Debit (+)", "Credit (-)", "Running Balance"]],
    body: tableRows,
    foot: [[
      { content: "NET OUTSTANDING BALANCE:", colSpan: 4, styles: { halign: "right", fontStyle: "bold", textColor: DARK, fontSize: 9 } },
      { content: pdfCurrency(detail.balance), styles: { halign: "right", fontStyle: "bold", textColor: detail.balance > 0 ? RED : GREEN, fontSize: 10 } }
    ]],
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 4,
    },
    footStyles: {
      fillColor: detail.balance > 0 ? [254, 242, 242] : [240, 253, 244],
      cellPadding: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto", overflow: "linebreak" },
      2: { cellWidth: 32, halign: "right", textColor: RED },
      3: { cellWidth: 32, halign: "right", textColor: GREEN },
      4: { cellWidth: 38, halign: "right", fontStyle: "bold" },
    },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: DARK },
    alternateRowStyles: { fillColor: LGRAY },
  });

  drawPageFooter(doc);

  const cleanName = detail.user.name.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanDate = formatDate(new Date()).replace(/\s+/g, "_");
  doc.save(`VDsHungerHub-Statement-${cleanName}-${cleanDate}.pdf`);
}

export function generateBulkOutstandingPdf(rows: UserLedgerRow[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawHeader(doc, "OUTSTANDING BALANCES REPORT");

  const totalOutstanding = rows.reduce((sum, r) => sum + (r.balance > 0 ? r.balance : 0), 0);
  const totalCollected = rows.reduce((sum, r) => sum + r.totalPaid, 0);

  // Summary Card with 3 clear boxes
  const cardW = (pageWidth - 28 - 12) / 3;
  const metrics = [
    { title: "TOTAL CUSTOMERS", value: `${rows.length} Accounts`, color: NAVY, bg: [241, 245, 249] as [number, number, number] },
    { title: "TOTAL COLLECTED", value: pdfCurrency(totalCollected), color: GREEN, bg: [240, 253, 244] as [number, number, number] },
    { title: "TOTAL OUTSTANDING", value: pdfCurrency(totalOutstanding), color: RED, bg: [254, 242, 242] as [number, number, number] },
  ];

  metrics.forEach((m, i) => {
    const x = 14 + i * (cardW + 6);
    doc.setFillColor(...m.bg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 18, 3, 3, "FD");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(m.title, x + 8, y + 6);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...m.color);
    doc.text(m.value, x + 8, y + 13.5);
  });

  y += 24;

  const tableData = rows.map((r, i) => [
    (i + 1).toString(),
    r.name,
    formatMobileNumber(r.number),
    r.company?.name ?? "-",
    pdfCurrency(r.totalDebit),
    pdfCurrency(r.totalPaid),
    pdfCurrency(r.balance),
    r.lastOrderAt ? formatDate(r.lastOrderAt) : "Never",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { bottom: 25 },
    head: [["#", "Name", "Mobile", "Company", "Total Billed", "Total Paid", "Balance Due", "Last Order"]],
    body: tableData,
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 34 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 24, halign: "right", fontStyle: "bold", textColor: RED },
      7: { cellWidth: 20 },
    },
    styles: { fontSize: 8, cellPadding: 3, textColor: DARK },
    alternateRowStyles: { fillColor: LGRAY },
  });

  drawPageFooter(doc);

  const cleanDate = formatDate(new Date()).replace(/\s+/g, "_");
  doc.save(`VDsHungerHub-Outstanding-Report-${cleanDate}.pdf`);
}

export function generateCompanyGroupedOutstandingPdf(
  groups: { companyName: string; items: UserLedgerRow[] }[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = drawHeader(doc, "COMPANY OUTSTANDING REPORT");

  for (const group of groups) {
    const groupTotal = group.items.reduce((s, i) => s + (i.balance > 0 ? i.balance : 0), 0);

    doc.setFillColor(...NAVY);
    doc.roundedRect(14, cursorY, pageWidth - 28, 9, 2, 2, "F");

    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${group.companyName} (${group.items.length} Customers · Total Due: ${pdfCurrency(groupTotal)})`,
      18,
      cursorY + 6
    );

    doc.setFillColor(...GOLD);
    doc.rect(14, cursorY, 3, 9, "F");

    cursorY += 11;

    const body = group.items.map((r, i) => [
      (i + 1).toString(),
      r.name,
      formatMobileNumber(r.number),
      pdfCurrency(r.totalDebit),
      pdfCurrency(r.totalPaid),
      pdfCurrency(r.balance),
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { bottom: 25 },
      head: [["#", "Name", "Mobile", "Total Billed", "Total Paid", "Balance Due"]],
      body,
      headStyles: { fillColor: [30, 41, 59], textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 34, halign: "right", fontStyle: "bold", textColor: RED },
      },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: DARK },
      alternateRowStyles: { fillColor: LGRAY },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;

    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = drawHeader(doc, "COMPANY OUTSTANDING REPORT (Cont.)");
    }
  }

  drawPageFooter(doc);

  const cleanDate = formatDate(new Date()).replace(/\s+/g, "_");
  doc.save(`VDsHungerHub-Company-Outstanding-${cleanDate}.pdf`);
}
