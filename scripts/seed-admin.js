const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ── EDIT THESE ─────────────────────────────────────────────────────────────────
const ADMIN_NAME   = "VD Admin";
const ADMIN_MOBILE = "7016625488"; // 10-digit, no country code
// ───────────────────────────────────────────────────────────────────────────────

async function main() {
  const existing = await p.staffUser.findUnique({ where: { mobile: ADMIN_MOBILE } });
  if (existing) {
    console.log("✅ StaffUser already exists:", existing);
    return;
  }
  const admin = await p.staffUser.create({
    data: {
      name:   ADMIN_NAME,
      mobile: ADMIN_MOBILE,
      role:   "ADMIN",
      status: "ACTIVE",
      permissions: [],
    },
  });
  console.log("✅ Admin created:", admin);
}

main().catch(console.error).finally(() => p.$disconnect());
