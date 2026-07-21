import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    "⚠️  Resetting test data — Catalog (Product/ThaliCategory/Thali) and StaffUser will be preserved."
  );
  console.log(
    "Everything else (Companies, Users, Orders, Payments, Daily Menus, sessions, OTPs, etc.) will be deleted.\n"
  );

  // 1–4: Order children
  const orderSabji = await prisma.orderSabji.deleteMany({});
  const orderAddon = await prisma.orderAddon.deleteMany({});
  const orderThaliItem = await prisma.orderThaliItem.deleteMany({});
  const orderAddonItem = await prisma.orderAddonItem.deleteMany({});
  console.log(
    `✅ Order line items cleared (sabji: ${orderSabji.count}, addon: ${orderAddon.count}, thaliItem: ${orderThaliItem.count}, addonItem: ${orderAddonItem.count})`
  );

  // 5: Orders themselves
  const orders = await prisma.order.deleteMany({});
  console.log(`✅ Orders cleared (${orders.count})`);

  // 6: Payments (Credit ledger)
  const payments = await prisma.payment.deleteMany({});
  console.log(`✅ Payments cleared (${payments.count})`);

  // 7: Addresses
  const addresses = await prisma.address.deleteMany({});
  console.log(`✅ Addresses cleared (${addresses.count})`);

  // 8–10: Daily menu + children
  const dmThali = await prisma.dailyMenuThali.deleteMany({});
  const dmSabji = await prisma.dailyMenuSabjiOption.deleteMany({});
  const dailyMenus = await prisma.dailyMenu.deleteMany({});
  console.log(
    `✅ Daily menus cleared (menus: ${dailyMenus.count}, thali links: ${dmThali.count}, sabji links: ${dmSabji.count})`
  );

  // 11: Menu templates ("previous menus" saved as templates)
  const templates = await prisma.menuTemplate.deleteMany({});
  console.log(`✅ Menu templates cleared (${templates.count})`);

  // 12–15: User-dependent auxiliary tables
  const banHistory = await prisma.banHistory.deleteMany({});
  const userDevices = await prisma.userDevice.deleteMany({});
  const deviceFingerprints = await prisma.deviceFingerprint.deleteMany({});
  const customerSessions = await prisma.customerSession.deleteMany({});
  console.log(
    `✅ User auxiliary records cleared (banHistory: ${banHistory.count}, devices: ${userDevices.count}, fingerprints: ${deviceFingerprints.count}, sessions: ${customerSessions.count})`
  );

  // 16–17: Independent auth/rate-limit tables
  const otps = await prisma.otpVerification.deleteMany({});
  const rateLimits = await prisma.rateLimitEvent.deleteMany({});
  console.log(
    `✅ OTP + rate-limit records cleared (otps: ${otps.count}, rateLimits: ${rateLimits.count})`
  );

  // 18: Users
  const users = await prisma.user.deleteMany({});
  console.log(`✅ Users cleared (${users.count})`);

  // 19: Companies
  const companies = await prisma.company.deleteMany({});
  console.log(`✅ Companies cleared (${companies.count})`);

  console.log(
    "\n🎉 Reset complete. Preserved: Products, ThaliCategories, Thalis, StaffUsers."
  );

  const remaining = {
    products: await prisma.product.count(),
    thaliCategories: await prisma.thaliCategory.count(),
    thalis: await prisma.thali.count(),
    staffUsers: await prisma.staffUser.count(),
  };
  console.log("📦 Remaining catalog/staff counts:", remaining);
}

main()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
