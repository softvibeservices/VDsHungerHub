import { formatCurrency, formatDate } from "@/lib/utils";

export function buildWhatsAppBillText(row: {
  name: string;
  balance: number;
  totalDebit: number;
  totalPaid: number;
  lastOrderAt: string | null;
}): string {
  const lines = [
    `🍽️ *VD's Hunger Hub — Bill Summary*`,
    `_Fresh & Tasty Meals Everyday_`,
    ``,
    `👤 Customer: *${row.name}*`,
    `📊 Total Billed: ${formatCurrency(row.totalDebit)}`,
    `✅ Total Paid: ${formatCurrency(row.totalPaid)}`,
    `💰 *Balance Due: ${formatCurrency(row.balance)}*`,
    row.lastOrderAt ? `🕐 Last Order: ${formatDate(row.lastOrderAt)}` : null,
    ``,
    row.balance > 0
      ? `Kindly clear your pending balance at your earliest convenience. 🙏`
      : `You're all settled up — thank you for your trust! 🎉`,
    ``,
    `📞 +91 635 635 0085 (Restaurant)`,
    `📞 +91 635 635 0086 (Delivery)`,
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
    return "🍽️ *VD's Hunger Hub — Outstanding Balance Summary*\n\n✅ All accounts are cleared! 🎉\n\n_Fresh & Tasty Meals Everyday_";
  }

  const grandTotal = owingRows.reduce((sum, r) => sum + r.balance, 0);

  const lines = [
    `🍽️ *VD's Hunger Hub — Outstanding Balance Summary*`,
    `_Fresh & Tasty Meals Everyday_`,
    `📅 Date: ${formatDate(new Date())}`,
    `💰 Total Outstanding: *${formatCurrency(grandTotal)}* across ${owingRows.length} customers`,
    ``,
    ...owingRows.map(
      (r, i) =>
        `${i + 1}. *${r.name}*${r.company?.name ? ` (${r.company.name})` : ""}: ${formatCurrency(r.balance)}`
    ),
    ``,
    `Please clear pending balances at your earliest convenience. 🙏`,
    ``,
    `📞 +91 635 635 0085 · 📞 +91 635 635 0086`,
  ];

  return lines.join("\n");
}

export function buildWhatsAppCompanyDigestText(
  groups: { companyName: string; items: Array<{ name: string; balance: number }> }[]
): string {
  const nonEmptyGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((r) => r.balance > 0) }))
    .filter((g) => g.items.length > 0);

  if (nonEmptyGroups.length === 0) {
    return "🍽️ *VD's Hunger Hub — Outstanding Balance Summary*\n\n✅ All accounts are cleared! 🎉";
  }

  const grandTotal = nonEmptyGroups.reduce(
    (sum, g) => sum + g.items.reduce((s, r) => s + r.balance, 0),
    0
  );

  const lines = [
    `🍽️ *VD's Hunger Hub — Outstanding Balance Summary*`,
    `_Fresh & Tasty Meals Everyday_`,
    `📅 ${formatDate(new Date())}`,
    `💰 Total Outstanding: *${formatCurrency(grandTotal)}*`,
    ``,
  ];

  for (const group of nonEmptyGroups) {
    const groupTotal = group.items.reduce((s, r) => s + r.balance, 0);
    lines.push(`🏢 *${group.companyName}* — ${formatCurrency(groupTotal)}`);
    group.items.forEach((r, i) => {
      lines.push(`   ${i + 1}. ${r.name}: ${formatCurrency(r.balance)}`);
    });
    lines.push(``);
  }

  lines.push(`Please clear pending balances at your earliest convenience. 🙏`);
  lines.push(`📞 +91 635 635 0085 · 📞 +91 635 635 0086`);
  return lines.join("\n");
}
