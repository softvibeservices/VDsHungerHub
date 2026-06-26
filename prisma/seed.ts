import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin ──────────────────────────────────
  const hashedPassword = await bcrypt.hash("VDAdmin@2024", 12);
  const admin = await prisma.admin.upsert({
    where: { number: "6356350086" },
    update: {},
    create: {
      name: "VD Admin",
      number: "6356350086",
      password: hashedPassword,
    },
  });
  console.log("✅ Admin seeded");

  // ── AppUser for Admin ────────────────────────
  await prisma.appUser.upsert({
    where: { number: "6356350086" },
    update: { name: admin.name, role: "ADMIN" },
    create: {
      name: admin.name,
      number: admin.number,
      password: admin.password, // already bcrypt hashed
      role: "ADMIN",
    },
  });
  console.log("✅ Admin AppUser seeded");

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
  const seededProducts = await Promise.all([
    prisma.product.upsert({
      where: { name: "Corn Capsicum" },
      update: {},
      create: { name: "Corn Capsicum", nameGu: "કોર્ન કેપ્સિકમ", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Rajma (Kathol)" },
      update: {},
      create: { name: "Rajma (Kathol)", nameGu: "રાજમા (કઠોળ)", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Sev Tameta" },
      update: {},
      create: { name: "Sev Tameta", nameGu: "સેવ ટામેટા", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Palak Paneer" },
      update: {},
      create: { name: "Palak Paneer", nameGu: "પાલક પનીર", quantity: "1 bowl", price: 50 },
    }),
    prisma.product.upsert({
      where: { name: "Mix Veg" },
      update: {},
      create: { name: "Mix Veg", nameGu: "મિક્સ વેજ", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Aloo Gobi" },
      update: {},
      create: { name: "Aloo Gobi", nameGu: "આલુ ગોબી", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Paneer Butter Masala" },
      update: {},
      create: { name: "Paneer Butter Masala", nameGu: "પનીર બટર મસાલા", quantity: "1 bowl", price: 60 },
    }),
    prisma.product.upsert({
      where: { name: "Dal Fry" },
      update: {},
      create: { name: "Dal Fry", nameGu: "દાળ ફ્રાય", quantity: "1 bowl", price: 20 },
    }),
  ]);
  console.log("✅ Products seeded");

  // ── Sample Add-Ons (for Palak Paneer) ──────────────────────────
  const palakPaneer = seededProducts.find((p) => p.name === "Palak Paneer");
  if (palakPaneer) {
    // Mark it as add-on available
    await prisma.product.update({
      where: { id: palakPaneer.id },
      data: { isAddOnAvailable: true },
    });

    // Create sample add-ons
    const addOnDefs = [
      { name: "Extra Roti", price: 5, sortOrder: 0 },
      { name: "Buttermilk", price: 0, sortOrder: 1 },
      { name: "Shreekhnd", price: 15, sortOrder: 2 },
      { name: "Jaggery", price: 0, sortOrder: 3 },
    ];

    for (const ao of addOnDefs) {
      await prisma.productAddon.upsert({
        where: { productId_name: { productId: palakPaneer.id, name: ao.name } },
        update: { price: ao.price },
        create: { productId: palakPaneer.id, ...ao },
      });
    }
    console.log("✅ Sample add-ons seeded");
  }

  // ── Thali Categories ──────────────────────
  const categoryDefs = [
    { name: "Gujarati Thali", nameGu: "ગુજરાતી થાળી" },
    { name: "Full Gujarati Thali", nameGu: "આખી ગુજરાતી થાળી" },
    { name: "Punjabi Thali", nameGu: "પંજાબી થાળી" },
    { name: "Full Punjabi Thali", nameGu: "આખી પંજાબી થાળી" },
    { name: "Specials", nameGu: "સ્પેશિયલ" },
  ];

  const categoriesMap = new Map<string, string>(); // name -> id
  for (const cat of categoryDefs) {
    const c = await prisma.thaliCategory.upsert({
      where: { name: cat.name },
      update: { nameGu: cat.nameGu },
      create: { name: cat.name, nameGu: cat.nameGu },
    });
    categoriesMap.set(c.name, c.id);
  }
  console.log("✅ Thali Categories seeded");

  // ── Thalis ────────────────────────────────
  const thaliDefs = [
    {
      name: "Small Gujarati Thali",
      nameGu: "નાની ગુજરાતી થાળી",
      price: 80,
      sabjiCount: 1,
      categoryName: "Gujarati Thali",
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Gujarati Thali",
      nameGu: "મીડિયમ ગુજરાતી થાળી",
      price: 100,
      sabjiCount: 1,
      categoryName: "Gujarati Thali",
      description: "4 Roti, 1 Subji, Dal, Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal", "Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Gujarati Thali",
      nameGu: "આખી ગુજરાતી થાળી",
      price: 120,
      sabjiCount: 2,
      categoryName: "Full Gujarati Thali",
      description: "5 Roti, 2 Subji, Dal, Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal", "Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Small Punjabi Thali",
      nameGu: "નાની પંજાબી થાળી",
      price: 100,
      sabjiCount: 1,
      categoryName: "Punjabi Thali",
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Punjabi Thali",
      nameGu: "મીડિયમ પંજાબી થાળી",
      price: 120,
      sabjiCount: 1,
      categoryName: "Punjabi Thali",
      description: "4 Roti, 1 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Punjabi Thali",
      nameGu: "આખી પંજાબી થાળી",
      price: 140,
      sabjiCount: 2,
      categoryName: "Full Punjabi Thali",
      description:
        "5 Roti, 2 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Dal Fry Special",
      nameGu: "દાળ ફ્રાય સ્પેશિયલ",
      price: 80,
      sabjiCount: 0,
      categoryName: "Specials",
      description: "Dal Fry + Jeera Rice + Curd",
      items: ["Dal Fry", "Jeera Rice", "Curd"],
    },
    {
      name: "Rajma Special",
      nameGu: "રાજમા સ્પેશિયલ",
      price: 100,
      sabjiCount: 0,
      categoryName: "Specials",
      description: "Rajma + Jeera Rice + Curd",
      items: ["Rajma", "Jeera Rice", "Curd"],
    },
  ];

  for (const t of thaliDefs) {
    const existing = await prisma.thali.findUnique({ where: { name: t.name } });
    const categoryId = t.categoryName ? categoriesMap.get(t.categoryName) : null;
    if (!existing) {
      await prisma.thali.create({
        data: {
          name: t.name,
          nameGu: t.nameGu,
          price: t.price,
          sabjiCount: t.sabjiCount,
          categoryId: categoryId || null,
          description: t.description,
          items: {
            create: t.items.map((itemName, idx) => ({
              itemName,
              sortOrder: idx,
            })),
          },
        },
      });
    } else {
      await prisma.thali.update({
        where: { id: existing.id },
        data: {
          sabjiCount: t.sabjiCount,
          categoryId: categoryId || null,
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
  const defaultStaffPassword = await bcrypt.hash("VDStaff@2024", 12);

  const staffMembers = [
    { name: "Ramesh (Delivery)", number: "9000000001" },
    { name: "Suresh (Kitchen)", number: "9000000002" },
  ];

  for (const s of staffMembers) {
    await prisma.staff.upsert({
      where: { number: s.number },
      update: {},
      create: { name: s.name, number: s.number },
    });

    // Also create AppUser for staff login
    await prisma.appUser.upsert({
      where: { number: s.number },
      update: {},
      create: {
        name: s.name,
        number: s.number,
        password: defaultStaffPassword,
        role: "STAFF",
      },
    });
  }
  console.log("✅ Staff seeded");

  console.log("🎉 Seeding complete!");
  console.log("🔑 Admin login: 6356350086 / VDAdmin@2024");
  console.log("👤 Staff login: 9000000001 or 9000000002 / VDStaff@2024");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
