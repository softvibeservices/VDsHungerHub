import { prisma } from "@/lib/prisma";

export interface LedgerFilters {
  search?: string; // name or mobile
  companyId?: string;
  balanceFilter?: "owing" | "clear" | "all"; // owing = balance > 0
  sortBy?: "balance_desc" | "balance_asc" | "name_asc" | "name_desc" | "lastOrder_desc";
}

export interface UserLedgerRow {
  id: string;
  name: string;
  number: string;
  company: { id: string; name: string } | null;
  totalDebit: number;
  totalPaid: number;
  balance: number;
  lastOrderAt: string | null;
  lastPaymentAt: string | null;
}

export async function getAllUsersLedger(filters: LedgerFilters): Promise<UserLedgerRow[]> {
  const where: Record<string, unknown> = {};
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { number: { contains: filters.search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      number: true,
      company: { select: { id: true, name: true } },
    },
  });

  const userIds = users.map((u: { id: string }) => u.id);

  if (userIds.length === 0) {
    return [];
  }

  const [debitSums, paidSums, lastOrders, lastPayments] = await Promise.all([
    prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: { not: "CANCELLED" } },
      _max: { createdAt: true },
    }),
    prisma.payment.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { paidAtUtc: true },
    }),
  ]);

  const debitMap = new Map<string, number>(
    debitSums.map((d: { userId: string; _sum: { totalAmount: number | null } }) => [
      d.userId,
      d._sum.totalAmount ?? 0,
    ])
  );
  const paidMap = new Map<string, number>(
    paidSums.map((p: { userId: string; _sum: { amount: number | null } }) => [
      p.userId,
      p._sum.amount ?? 0,
    ])
  );
  const lastOrderMap = new Map<string, Date | null>(
    lastOrders.map((l: { userId: string; _max: { createdAt: Date | null } }) => [
      l.userId,
      l._max.createdAt,
    ])
  );
  const lastPaymentMap = new Map<string, Date | null>(
    lastPayments.map((l: { userId: string; _max: { paidAtUtc: Date | null } }) => [
      l.userId,
      l._max.paidAtUtc,
    ])
  );

  let rows: UserLedgerRow[] = users.map(
    (u: { id: string; name: string; number: string; company: { id: string; name: string } | null }) => {
      const totalDebit = debitMap.get(u.id) ?? 0;
      const totalPaid = paidMap.get(u.id) ?? 0;
      const lastOrder = lastOrderMap.get(u.id);
      const lastPayment = lastPaymentMap.get(u.id);

      return {
        id: u.id,
        name: u.name,
        number: u.number,
        company: u.company,
        totalDebit,
        totalPaid,
        balance: Math.round((totalDebit - totalPaid) * 100) / 100,
        lastOrderAt: lastOrder ? lastOrder.toISOString() : null,
        lastPaymentAt: lastPayment ? lastPayment.toISOString() : null,
      };
    }
  );

  if (filters.balanceFilter === "owing") rows = rows.filter((r) => r.balance > 0);
  if (filters.balanceFilter === "clear") rows = rows.filter((r) => r.balance <= 0);

  switch (filters.sortBy) {
    case "balance_asc":
      rows.sort((a, b) => a.balance - b.balance);
      break;
    case "name_asc":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      rows.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "lastOrder_desc":
      rows.sort((a, b) => {
        const timeA = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const timeB = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return timeB - timeA;
      });
      break;
    case "balance_desc":
    default:
      rows.sort((a, b) => b.balance - a.balance);
  }

  return rows;
}

export async function getUserLedgerDetail(userId: string) {
  const [user, orders, payments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        number: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.order.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        thali: { select: { name: true } },
        menu: { select: { date: true, mealType: true } },
        thaliItems: {
          select: {
            quantity: true,
            thali: { select: { name: true } },
            sabjiProduct: { select: { name: true } },
          },
        },
        addonItems: {
          select: {
            quantity: true,
            addonProduct: { select: { name: true } },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { paidAtUtc: "desc" },
      select: {
        id: true,
        userId: true,
        amount: true,
        method: true,
        note: true,
        recordedByStaffId: true,
        paidAtUtc: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!user) return null;

  const totalDebit = orders.reduce((s: number, o: { totalAmount: number }) => s + o.totalAmount, 0);
  const totalPaid = payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);

  function buildOrderLabel(o: (typeof orders)[number]): string {
    const mealTag = o.menu.mealType === "LUNCH" ? "Lunch" : "Dinner";
    if (o.thaliItems && o.thaliItems.length > 0) {
      const items = o.thaliItems
        .map((ti: { quantity: number; thali: { name: string }; sabjiProduct: { name: string } | null }) => `${ti.quantity}× ${ti.thali.name}${ti.sabjiProduct ? ` (${ti.sabjiProduct.name})` : ""}`)
        .join(", ");
      const addons = o.addonItems && o.addonItems.length > 0
        ? " + " + o.addonItems.map((a: { quantity: number; addonProduct: { name: string } }) => `${a.addonProduct.name}${a.quantity > 1 ? ` x${a.quantity}` : ""}`).join(", ")
        : "";
      return `${items}${addons} — ${mealTag}`;
    }
    return `${o.thali?.name ?? "Order"} — ${mealTag}`;
  }

  // Merge into one chronological timeline for the statement view (newest first)
  const timeline = [
    ...orders.map((o: (typeof orders)[number]) => ({
      type: "DEBIT" as const,
      id: o.id,
      date: o.createdAt.toISOString(),
      amount: o.totalAmount,
      label: buildOrderLabel(o),
      status: o.status,
    })),
    ...payments.map((p: { id: string; paidAtUtc: Date; amount: number; method: string; note: string | null }) => ({
      type: "CREDIT" as const,
      id: p.id,
      date: p.paidAtUtc.toISOString(),
      amount: p.amount,
      label: p.note ? `Payment (${p.method}) — ${p.note}` : `Payment (${p.method})`,
      status: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    user,
    totalDebit,
    totalPaid,
    balance: Math.round((totalDebit - totalPaid) * 100) / 100,
    timeline,
    payments: payments.map((p: { id: string; userId: string; amount: number; method: string; note: string | null; recordedByStaffId: string; paidAtUtc: Date; createdAt: Date; updatedAt: Date }) => ({
      ...p,
      paidAtUtc: p.paidAtUtc.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}
