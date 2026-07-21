import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin (StaffUser) ────────────────────────
  const adminMobiles = [
    { name: "VD Admin", mobile: "6356350086" },
    { name: "Admin (7016625488)", mobile: "7016625488" },
    { name: "Admin (9925832329)", mobile: "9925832329" },
  ];

  for (const a of adminMobiles) {
    await prisma.staffUser.upsert({
      where: { mobile: a.mobile },
      update: { name: a.name, role: "ADMIN" } as any,
      create: {
        name: a.name,
        mobile: a.mobile,
        passwordHash: null,
        role: "ADMIN",
        status: "ACTIVE",
      } as any,
    });
  }
  console.log("✅ Admin StaffUsers seeded");

  // ── Sample Companies ───────────────────────
  const companyDefs = [
    { name: "TechCorp Pvt Ltd", location: "Satellite, Ahmedabad" },
    { name: "Infosys BPO", location: "SG Highway, Ahmedabad" },
    { name: "HDFC Bank Branch", location: "CG Road, Ahmedabad" },
    { name: "Valence Datalabs", location: "Ahmedabad" },
    { name: "Communication Crafts", location: "Ahmedabad" },
    { name: "eSparkBiz", location: "Ahmedabad" },
    { name: "HDFC Bank", location: "Ahmedabad" },
    { name: "Veloxcore Private Limited", location: "Ahmedabad" }
  ];

  const companiesMap = new Map<string, string>();
  for (const c of companyDefs) {
    const record = await prisma.company.upsert({
      where: { name: c.name },
      update: { location: c.location },
      create: { name: c.name, location: c.location },
    });
    companiesMap.set(record.name, record.id);
  }
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

    // Create sample add-ons as standalone Products
    const addOnDefs = [
      { name: "Extra Roti", price: 5, quantity: "1 piece", nameGu: "વધારાની રોટલી" },
      { name: "Buttermilk", price: 10, quantity: "1 glass", nameGu: "છાશ" },
      { name: "Shreekhnd", price: 15, quantity: "1 cup", nameGu: "શ્રીખંડ" },
      { name: "Jaggery", price: 5, quantity: "1 piece", nameGu: "ગોળ" },
    ];

    for (const ao of addOnDefs) {
      await prisma.product.upsert({
        where: { name: ao.name },
        update: { price: ao.price, isAddOnAvailable: true },
        create: { ...ao, isAddOnAvailable: true },
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
  const userDefs = [
    { name: "Rahul Patel", number: "9876543210", companyName: "TechCorp Pvt Ltd" },
    { name: "Priya Shah", number: "9988776655", companyName: "TechCorp Pvt Ltd" },
    { name: "Mihir Patel", number: "7984373620", companyName: "Valence Datalabs" },
    { name: "Param", number: "9898440886", companyName: "Communication Crafts" },
    { name: "Drumil Gusai", number: "6359334422", companyName: "eSparkBiz" },
    { name: "Vansh Jadav", number: "8980402689", companyName: "HDFC Bank" },
    { name: "Wasim", number: "8128756698", companyName: "Veloxcore Private Limited" },
    { name: "Sakshi Soni", number: "9023576088", companyName: "Veloxcore Private Limited" },
    { name: "Amar Tiwari", number: "9925832329", companyName: "Communication Crafts" }
  ];

  for (const u of userDefs) {
    const companyId = companiesMap.get(u.companyName);
    if (!companyId) {
      console.warn(`⚠️ Company not found for user: ${u.name}`);
      continue;
    }
    await prisma.user.upsert({
      where: { number: u.number },
      update: { name: u.name, companyId },
      create: { name: u.name, number: u.number, companyId },
    });
  }
  console.log("✅ Sample users seeded");

  // ── Sample Staff (StaffUser) ────────────────
  const defaultStaffPassword = await bcrypt.hash("VDStaff@2024", 12);

  const staffMembers = [
    { name: "Ramesh (Delivery)", mobile: "9000000001" },
    { name: "Suresh (Kitchen)", mobile: "9000000002" },
  ];

  for (const s of staffMembers) {
    await prisma.staffUser.upsert({
      where: { mobile: s.mobile },
      update: { name: s.name, passwordHash: defaultStaffPassword } as any,
      create: {
        name: s.name,
        mobile: s.mobile,
        passwordHash: defaultStaffPassword,
        role: "STAFF",
        status: "ACTIVE",
        passwordSetAt: new Date(),
      } as any,
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
