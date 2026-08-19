// src\app\api\users\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAuth } from "@/lib/staff-auth";

export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth(req, { permission: "users:moderate" });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const companyId = searchParams.get("companyId") ?? "";
    const isVerifiedParam = searchParams.get("isVerified");
    const statusFilter = searchParams.get("status") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sortBy") ?? ""; // "due_asc" | "due_desc" | ""

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (isVerifiedParam !== null) where.isVerified = isVerifiedParam === "true";
    if (statusFilter) where.status = statusFilter;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { number: { contains: search } },
      ];
    }

    const total = await prisma.user.count({ where });

    if (total === 0) {
      return NextResponse.json({ users: [], total: 0, page, limit });
    }

    // ── If sorting by pending due (due_asc or due_desc) ──────────────────────
    if (sortBy === "due_asc" || sortBy === "due_desc") {
      // 1. Fetch all matching user IDs
      const allMatchingUsers = await prisma.user.findMany({
        where,
        select: { id: true },
      });
      const allUserIds = allMatchingUsers.map((u: { id: string }) => u.id);

      // 2. Compute due for all matching users
      const [debitSums, paidSums] = await Promise.all([
        prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: allUserIds }, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true },
        }),
        prisma.payment.groupBy({
          by: ["userId"],
          where: { userId: { in: allUserIds } },
          _sum: { amount: true },
        }),
      ]);

      const paidMap = new Map<string, number>(
        paidSums.map((p: { userId: string; _sum: { amount: number | null } }) => [
          p.userId,
          p._sum.amount ?? 0,
        ])
      );

      const dueMap = new Map<string, number>();
      allUserIds.forEach((id: string) => dueMap.set(id, 0));

      debitSums.forEach((d: { userId: string; _sum: { totalAmount: number | null } }) => {
        const debit = d._sum.totalAmount ?? 0;
        const paid = paidMap.get(d.userId) ?? 0;
        const due = Math.round((debit - paid) * 100) / 100;
        dueMap.set(d.userId, due > 0 ? due : 0);
      });

      // 3. Sort all user IDs by due amount
      const sortedIds = [...allUserIds].sort((a, b) => {
        const dueA = dueMap.get(a) ?? 0;
        const dueB = dueMap.get(b) ?? 0;
        return sortBy === "due_asc" ? dueA - dueB : dueB - dueA;
      });

      // 4. Paginate sorted IDs
      const pageIds = sortedIds.slice(skip, skip + limit);

      if (pageIds.length === 0) {
        return NextResponse.json({ users: [], total, page, limit });
      }

      // 5. Fetch full User data for page IDs
      const rawPageUsers = await prisma.user.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          name: true,
          number: true,
          isActive: true,
          isVerified: true,
          verifiedAt: true,
          workAddress: true,
          homeAddress: true,
          latitude: true,
          longitude: true,
          companyId: true,
          createdAt: true,
          status: true,
          statusReason: true,
          statusChangedAt: true,
          company: { select: { id: true, name: true } },
          _count: { select: { deviceFingerprints: true, addresses: true } },
        },
      });

      // Preserve exact sorted order of pageIds
      const userMap = new Map<string, (typeof rawPageUsers)[number]>(
        rawPageUsers.map((u: (typeof rawPageUsers)[number]) => [u.id, u])
      );
      const usersWithDue = pageIds
        .map((id) => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map((u) => ({
          ...u,
          pendingDue: dueMap.get(u.id) ?? 0,
        }));

      return NextResponse.json({ users: usersWithDue, total, page, limit });
    }

    // ── Default sort (createdAt: desc) ─────────────────────────────────────────
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        number: true,
        isActive: true,
        isVerified: true,
        verifiedAt: true,
        workAddress: true,
        homeAddress: true,
        latitude: true,
        longitude: true,
        companyId: true,
        createdAt: true,
        status: true,
        statusReason: true,
        statusChangedAt: true,
        company: { select: { id: true, name: true } },
        _count: { select: { deviceFingerprints: true, addresses: true } },
      },
    });

    const userIds = users.map((u: { id: string }) => u.id);
    const dueMap = new Map<string, number>();

    if (userIds.length > 0) {
      const [debitSums, paidSums] = await Promise.all([
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
      ]);

      const paidMap = new Map<string, number>(
        paidSums.map((p: { userId: string; _sum: { amount: number | null } }) => [
          p.userId,
          p._sum.amount ?? 0,
        ])
      );

      debitSums.forEach((d: { userId: string; _sum: { totalAmount: number | null } }) => {
        const debit = d._sum.totalAmount ?? 0;
        const paid = paidMap.get(d.userId) ?? 0;
        const due = Math.round((debit - paid) * 100) / 100;
        dueMap.set(d.userId, due > 0 ? due : 0);
      });
    }

    const usersWithDue = users.map((u: (typeof users)[number]) => ({
      ...u,
      pendingDue: dueMap.get(u.id) ?? 0,
    }));

    return NextResponse.json({ users: usersWithDue, total, page, limit });
  } catch (error) {
    console.error("[USERS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffAuth(req, { roles: ["ADMIN"] });
  if (auth.error) return auth.error;

  try {
    const { name, number, companyId, workAddress, homeAddress } = await req.json();
    const cleanNumber = number?.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!cleanNumber || !/^\d{10}$/.test(cleanNumber))
      return NextResponse.json({ error: "Valid 10-digit mobile number is required" }, { status: 400 });
    if (!companyId) return NextResponse.json({ error: "Company is required" }, { status: 400 });

    let finalWorkAddress = workAddress?.trim() || null;
    if (!finalWorkAddress && companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { address: true },
      });
      if (company?.address) {
        finalWorkAddress = company.address.trim();
      }
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        number: cleanNumber,
        companyId,
        workAddress: finalWorkAddress,
        homeAddress: homeAddress?.trim() || null,
        isVerified: true,
        verifiedAt: new Date(),
      },
      include: { company: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A user with this mobile number already exists" }, { status: 409 });
    }
    console.error("[USERS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
