import { prisma } from "@/lib/prisma";

async function main() {
  const companies = await prisma.company.findMany({
    where: { location: null, addedByUserId: { not: null } },
    include: { addedByUser: { select: { workAddress: true } } },
  });

  let backfilledCount = 0;
  for (const c of companies) {
    if (c.addedByUser?.workAddress) {
      await prisma.company.update({
        where: { id: c.id },
        data: { location: c.addedByUser.workAddress.trim() },
      });
      backfilledCount++;
    }
  }
  console.log(`Backfilled ${backfilledCount} companies out of ${companies.length} candidates.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
