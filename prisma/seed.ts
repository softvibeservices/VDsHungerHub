import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin ──────────────────────────────────
  const hashedPassword = await bcrypt.hash("VDAdmin@2024", 12);
  await prisma.admin.upsert({
    where: { number: "6356350086" },
    update: {},
    create: {
      name: "VD Admin",
      number: "6356350086",
      password: hashedPassword,
    },
  });
  console.log("✅ Admin seeded");

  // ── Sample Companies ───────────────────────
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { name: "TechCorp Pvt Ltd" },
      update: {},
      create: { name: "TechCorp Pvt Ltd", location: "Satellite, Ahmedabad" },
    }),
    prisma.company.upsert({
      where: { name: "Infosys BPO" },
      update: {},
      create: { name: "Infosys BPO", location: "SG Highway, Ahmedabad" },
    }),
    prisma.company.upsert({
      where: { name: "HDFC Bank Branch" },
      update: {},
      create: { name: "HDFC Bank Branch", location: "CG Road, Ahmedabad" },
    }),
  ]);
  console.log("✅ Companies seeded");

  // ── Sample Products (Sabji items) ─────────
  await Promise.all([
    prisma.product.upsert({
      where: { name: "Corn Capsicum" },
      update: {},
      create: { name: "Corn Capsicum", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Rajma (Kathol)" },
      update: {},
      create: { name: "Rajma (Kathol)", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Sev Tameta" },
      update: {},
      create: { name: "Sev Tameta", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Palak Paneer" },
      update: {},
      create: { name: "Palak Paneer", quantity: "1 bowl", price: 50 },
    }),
    prisma.product.upsert({
      where: { name: "Mix Veg" },
      update: {},
      create: { name: "Mix Veg", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Aloo Gobi" },
      update: {},
      create: { name: "Aloo Gobi", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Paneer Butter Masala" },
      update: {},
      create: { name: "Paneer Butter Masala", quantity: "1 bowl", price: 60 },
    }),
    prisma.product.upsert({
      where: { name: "Dal Fry" },
      update: {},
      create: { name: "Dal Fry", quantity: "1 bowl", price: 20 },
    }),
  ]);
  console.log("✅ Products seeded");

  // ── Thalis ────────────────────────────────
  const thaliDefs = [
    {
      name: "Small Gujarati Thali",
      price: 80,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Gujarati Thali",
      price: 100,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Dal, Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal", "Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Gujarati Thali",
      price: 120,
      maxSabjiCount: 2,
      description: "5 Roti, 2 Subji, Dal, Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal", "Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Small Punjabi Thali",
      price: 100,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Punjabi Thali",
      price: 120,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Punjabi Thali",
      price: 140,
      maxSabjiCount: 2,
      description:
        "5 Roti, 2 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Dal Fry Special",
      price: 80,
      maxSabjiCount: 0,
      description: "Dal Fry + Jeera Rice + Curd",
      items: ["Dal Fry", "Jeera Rice", "Curd"],
    },
    {
      name: "Rajma Special",
      price: 100,
      maxSabjiCount: 0,
      description: "Rajma + Jeera Rice + Curd",
      items: ["Rajma", "Jeera Rice", "Curd"],
    },
  ];

  for (const t of thaliDefs) {
    const existing = await prisma.thali.findUnique({ where: { name: t.name } });
    if (!existing) {
      await prisma.thali.create({
        data: {
          name: t.name,
          price: t.price,
          maxSabjiCount: t.maxSabjiCount,
          description: t.description,
          items: {
            create: t.items.map((itemName, idx) => ({
              itemName,
              sortOrder: idx,
            })),
          },
        },
      });
    }
  }
  console.log("✅ Thalis seeded");

  // ── Sample Users ──────────────────────────
  await prisma.user.upsert({
    where: { number: "9876543210" },
    update: {},
    create: {
      name: "Rahul Patel",
      number: "9876543210",
      companyId: companies[0].id,
    },
  });
  await prisma.user.upsert({
    where: { number: "9988776655" },
    update: {},
    create: {
      name: "Priya Shah",
      number: "9988776655",
      companyId: companies[0].id,
    },
  });
  console.log("✅ Sample users seeded");

  // ── Sample Staff ──────────────────────────
  await prisma.staff.upsert({
    where: { number: "9000000001" },
    update: {},
    create: { name: "Ramesh (Delivery)", number: "9000000001" },
  });
  await prisma.staff.upsert({
    where: { number: "9000000002" },
    update: {},
    create: { name: "Suresh (Kitchen)", number: "9000000002" },
  });
  console.log("✅ Staff seeded");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
