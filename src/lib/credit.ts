import { prisma } from "@/lib/prisma";

export interface LedgerFilters {
  search?: string; // name or mobile
  companyId?: string;
  balanceFilter?: "owing" | "clear" | "all"; // owing = balance > 0
  sortBy?: "balance_desc" | "balance_asc" | "name_asc" | "name_desc" | "lastOrder_desc";
  startDate?: string;
  endDate?: string;
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
  creditLimit: number;
  hasCreditLimitOverride: boolean;
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
      creditLimitOverride: true,
    },
  });

  const userIds = users.map((u: { id: string }) => u.id);

  if (userIds.length === 0) {
    return [];
  }

  const orderWhere: Record<string, unknown> = { userId: { in: userIds }, status: { not: "CANCELLED" } };
  const paymentWhere: Record<string, unknown> = { userId: { in: userIds } };

  const isDateFiltered = Boolean(filters.startDate || filters.endDate);

  if (isDateFiltered) {
    const orderDateRange: Record<string, Date> = {};
    const paymentDateRange: Record<string, Date> = {};
    if (filters.startDate) {
      const s = new Date(filters.startDate);
      s.setHours(0, 0, 0, 0);
      orderDateRange.gte = s;
      paymentDateRange.gte = s;
    }
    if (filters.endDate) {
      const e = new Date(filters.endDate);
      e.setHours(23, 59, 59, 999);
      orderDateRange.lte = e;
      paymentDateRange.lte = e;
    }
    orderWhere.createdAt = orderDateRange;
    paymentWhere.paidAtUtc = paymentDateRange;
  }

  const [debitSums, paidSums, lastOrders, lastPayments] = await Promise.all([
    prisma.order.groupBy({
      by: ["userId"],
      where: orderWhere,
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["userId"],
      where: paymentWhere,
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

  const globalDefaultLimit = await getGlobalCreditLimit();

  let rows: UserLedgerRow[] = users.map(
    (u: {
      id: string;
      name: string;
      number: string;
      company: { id: string; name: string } | null;
      creditLimitOverride: number | null;
    }) => {
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
        creditLimit: u.creditLimitOverride ?? globalDefaultLimit,
        hasCreditLimitOverride: u.creditLimitOverride !== null,
      };
    }
  );

  if (filters.balanceFilter === "owing") {
    rows = isDateFiltered
      ? rows.filter((r) => r.balance > 0 || r.totalDebit > 0)
      : rows.filter((r) => r.balance > 0);
  } else if (filters.balanceFilter === "clear") {
    rows = rows.filter((r) => r.balance <= 0);
  }

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

export async function getUserLedgerDetail(
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const orderWhere: Record<string, unknown> = { userId, status: { not: "CANCELLED" } };
  const paymentWhere: Record<string, unknown> = { userId };

  if (startDate || endDate) {
    const orderDateRange: Record<string, Date> = {};
    const paymentDateRange: Record<string, Date> = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      orderDateRange.gte = s;
      paymentDateRange.gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      orderDateRange.lte = e;
      paymentDateRange.lte = e;
    }
    orderWhere.createdAt = orderDateRange;
    paymentWhere.paidAtUtc = paymentDateRange;
  }

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
      where: orderWhere,
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
      where: paymentWhere,
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
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    timeline,
    payments: payments.map((p: { id: string; userId: string; amount: number; method: string; note: string | null; recordedByStaffId: string; paidAtUtc: Date; createdAt: Date; updatedAt: Date }) => ({
      ...p,
      paidAtUtc: p.paidAtUtc.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit Limit Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CREDIT_LIMIT_SETTING_KEY = "CREDIT_LIMIT_GLOBAL_DEFAULT";
const DEFAULT_CREDIT_LIMIT = 4000;

export { DEFAULT_CREDIT_LIMIT, CREDIT_LIMIT_SETTING_KEY };

export async function getGlobalCreditLimit(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CREDIT_LIMIT_SETTING_KEY } });
  const parsed = row ? parseFloat(row.value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CREDIT_LIMIT;
}

export async function setGlobalCreditLimit(value: number): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: CREDIT_LIMIT_SETTING_KEY },
    update: { value: String(value) },
    create: { key: CREDIT_LIMIT_SETTING_KEY, value: String(value) },
  });
}

export interface EffectiveCreditLimit {
  limit: number;
  isOverride: boolean;
  globalDefault: number;
}

export async function getEffectiveCreditLimit(userId: string): Promise<EffectiveCreditLimit> {
  const [user, globalDefault] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { creditLimitOverride: true } }),
    getGlobalCreditLimit(),
  ]);

  if (user?.creditLimitOverride !== null && user?.creditLimitOverride !== undefined) {
    return { limit: user.creditLimitOverride, isOverride: true, globalDefault };
  }
  return { limit: globalDefault, isOverride: false, globalDefault };
}

export async function setUserCreditLimitOverride(
  userId: string,
  value: number | null
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { creditLimitOverride: value },
  });
}

/** Fast current balance for a single user (no full timeline load — for the order-time check). */
export async function getUserBalance(userId: string): Promise<number> {
  const [debitAgg, paidAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { userId, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);
  const totalDebit = debitAgg._sum.totalAmount ?? 0;
  const totalPaid = paidAgg._sum.amount ?? 0;
  return Math.round((totalDebit - totalPaid) * 100) / 100;
}

export interface CreditLimitCheckResult {
  allowed: boolean;
  code?: "CREDIT_LIMIT_EXCEEDED";
  message?: string;
  currentBalance: number;
  limit: number;
  projectedBalance: number;
}

/**
 * Call this right before creating a new order, with the order's total amount.
 * Blocks the order if (currentBalance + newOrderAmount) would exceed the
 * customer's effective credit limit (their personal override, or the global
 * default if they have none).
 */
export async function checkCreditLimitForNewOrder(
  userId: string,
  newOrderAmount: number
): Promise<CreditLimitCheckResult> {
  const [{ limit }, currentBalance] = await Promise.all([
    getEffectiveCreditLimit(userId),
    getUserBalance(userId),
  ]);

  const projectedBalance = Math.round((currentBalance + newOrderAmount) * 100) / 100;

  if (projectedBalance > limit) {
    return {
      allowed: false,
      code: "CREDIT_LIMIT_EXCEEDED",
      message: `This order would take your outstanding due to ₹${projectedBalance.toFixed(
        2
      )}, which is above your credit limit of ₹${limit.toFixed(
        2
      )}. Please clear some of your due amount, or contact the admin to increase your limit before placing this order.`,
      currentBalance,
      limit,
      projectedBalance,
    };
  }

  return { allowed: true, currentBalance, limit, projectedBalance };
}
