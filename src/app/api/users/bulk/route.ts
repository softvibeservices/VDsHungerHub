import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BulkUserRow {
  name: string;
  number: string;
  company_name: string;
}

export async function POST(req: NextRequest) {
  try {
    const { users }: { users: BulkUserRow[] } = await req.json();

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: "No users provided" }, { status: 400 });
    }

    // Fetch all companies for lookup
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });
    const companyMap = new Map(
      companies.map((c) => [c.name.toLowerCase().trim(), c.id])
    );

    // Fetch existing numbers to detect duplicates
    const existingNumbers = new Set(
      (await prisma.user.findMany({ select: { number: true } })).map((u) => u.number)
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of users) {
      const cleanNumber = row.number
        ?.toString()
        .replace(/\s+/g, "")
        .replace(/^\+91/, "")
        .replace(/^0/, "");

      if (!row.name?.trim()) {
        errors.push(`Row skipped: name is empty`);
        skipped++;
        continue;
      }
      if (!cleanNumber || !/^\d{10}$/.test(cleanNumber)) {
        errors.push(`${row.name}: invalid number "${row.number}"`);
        skipped++;
        continue;
      }
      if (existingNumbers.has(cleanNumber)) {
        errors.push(`${row.name}: number ${cleanNumber} already exists`);
        skipped++;
        continue;
      }

      const companyId = companyMap.get(row.company_name?.toLowerCase().trim() ?? "");
      if (!companyId) {
        errors.push(`${row.name}: company "${row.company_name}" not found`);
        skipped++;
        continue;
      }

      try {
        await prisma.user.create({
          data: { name: row.name.trim(), number: cleanNumber, companyId },
        });
        existingNumbers.add(cleanNumber);
        created++;
      } catch {
        errors.push(`${row.name}: failed to insert`);
        skipped++;
      }
    }

    return NextResponse.json({ created, skipped, errors });
  } catch (error) {
    console.error("[USERS BULK]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
