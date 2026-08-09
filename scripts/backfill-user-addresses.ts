import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting user address backfill...");

  const users = await prisma.user.findMany({
    where: {
      isVerified: true,
      addresses: { none: {} },
      OR: [{ workAddress: { not: null } }, { homeAddress: { not: null } }],
    },
    select: { id: true, workAddress: true, homeAddress: true },
  });

  console.log(`Found ${users.length} users with zero Address rows and non-empty legacy addresses.`);

  let created = 0;
  for (const u of users) {
    const rows: { userId: string; type: "WORK" | "HOME"; line1: string; isDefault: boolean }[] = [];
    if (u.workAddress?.trim()) {
      rows.push({ userId: u.id, type: "WORK", line1: u.workAddress.trim(), isDefault: true });
    }
    if (u.homeAddress?.trim()) {
      rows.push({ userId: u.id, type: "HOME", line1: u.homeAddress.trim(), isDefault: rows.length === 0 });
    }
    if (rows.length) {
      await prisma.address.createMany({ data: rows });
      created += rows.length;
    }
  }

  console.log(`Successfully backfilled ${created} address rows for ${users.length} users.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Backfill failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
