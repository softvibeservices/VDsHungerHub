import { formatCurrency, formatDate } from "@/lib/utils";

export function buildWhatsAppBillText(row: {
  name: string;
  balance: number;
  totalDebit: number;
  totalPaid: number;
  lastOrderAt: string | null;
}): string {
  const lines = [
    `🍱 *VD's Hunger Hub — Bill Summary*`,
    ``,
    `Name: *${row.name}*`,
    `Total Billed: ${formatCurrency(row.totalDebit)}`,
    `Total Paid: ${formatCurrency(row.totalPaid)}`,
    `*Balance Due: ${formatCurrency(row.balance)}*`,
    row.lastOrderAt ? `Last Order: ${formatDate(row.lastOrderAt)}` : null,
    ``,
    row.balance > 0
      ? `Please clear your pending balance at your earliest convenience. 🙏`
      : `You're all settled up — thank you! 🙏`,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

export function buildWhatsAppShareLink(
  phoneNumber10Digit: string,
  message: string
): string {
  const clean = phoneNumber10Digit.replace(/\D/g, "").slice(-10);
  return `https://wa.me/91${clean}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppDigestText(
  rows: Array<{ name: string; balance: number; company?: { name: string } | null }>
): string {
  const owingRows = rows.filter((r) => r.balance > 0);
  if (owingRows.length === 0) {
    return "🍱 *VD's Hunger Hub — Outstanding Balance Summary*\n\nAll accounts are cleared! 🎉";
  }

  const grandTotal = owingRows.reduce((sum, r) => sum + r.balance, 0);

  const lines = [
    `🍱 *VD's Hunger Hub — Outstanding Balance Summary*`,
    `Date: ${formatDate(new Date())}`,
    `Total Outstanding: *${formatCurrency(grandTotal)}* across ${owingRows.length} customers`,
    ``,
    ...owingRows.map(
      (r, i) =>
        `${i + 1}. *${r.name}*${r.company?.name ? ` (${r.company.name})` : ""}: ${formatCurrency(r.balance)}`
    ),
    ``,
    `Please clear pending balances at your earliest convenience. Thank you! 🙏`,
  ];

  return lines.join("\n");
}
