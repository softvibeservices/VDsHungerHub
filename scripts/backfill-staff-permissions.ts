// scripts/backfill-staff-permissions.ts
//
// One-time backfill: run BEFORE deploying the Phase 3 RBAC enforcement
// changes. Grants all four defined permissions to every existing STAFF user
// so nobody is unexpectedly locked out of the menu/orders/customer-moderation
// features they were previously able to use unconditionally.
//
// Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-staff-permissions.ts

import { prisma } from "../src/lib/prisma";

const ALL_PERMISSIONS = [
  "users:moderate",
  "menu:manage",
  "orders:update-status",
  "companies:moderate",
];

async function main() {
  const result = await prisma.staffUser.updateMany({
    where: { role: "STAFF" },
    data: { permissions: ALL_PERMISSIONS },
  });

  console.log(`Backfilled permissions for ${result.count} STAFF user(s).`);
  console.log(
    "Every STAFF account now has all 4 permissions — go to Manage Staff and " +
    "deliberately un-tick boxes for anyone who should have narrower access."
  );
}

main()
  .catch((err) => {
    console.error("[backfill-staff-permissions] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
