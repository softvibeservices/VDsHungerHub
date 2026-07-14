// scripts/seed-first-admin.ts
// Run locally / on the server, once, with direct DATABASE_URL access.
// Usage: npx tsx scripts/seed-first-admin.ts "Admin Name" "9825012345"

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];
  const mobile = args[1];

  if (!name || !mobile) {
    console.error("Error: Please provide name and 10-digit mobile number.");
    console.error("Example: npx tsx scripts/seed-first-admin.ts \"Nikulsinh\" \"9825012345\"");
    process.exit(1);
  }

  const cleanMobile = mobile.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    console.error("Error: Mobile number must be a valid 10-digit Indian number.");
    process.exit(1);
  }

  try {
    const admin = await prisma.staffUser.create({
      data: {
        name,
        mobile: cleanMobile,
        role: "ADMIN",
        status: "ACTIVE",
        permissions: [],
      },
    });
    console.log(`Successfully seeded first admin: ${admin.name} (${admin.mobile})`);
  } catch (error: any) {
    if (error.code === "P2002") {
      console.error(`Error: A staff user with mobile ${cleanMobile} already exists.`);
    } else {
      console.error("Failed to seed admin:", error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
