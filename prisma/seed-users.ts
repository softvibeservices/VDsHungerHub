import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const usersToSeed = [
    { number: "7984373620", name: "Mihir Patel", companyName: "Valence Datalabs" },
    { number: "9898440886", name: "Param", companyName: "Communication Crafts" },
    { number: "6359334422", name: "Drumil Gusai", companyName: "eSparkBiz" },
    { number: "8980402689", name: "Vansh Jadav", companyName: "HDFC Bank" },
    { number: "8128756698", name: "Wasim", companyName: "Veloxcore Private Limited" },
    { number: "9023576088", name: "Sakshi Soni", companyName: "Veloxcore Private Limited" },
    { number: "9925832329", name: "Amar Tiwari", companyName: "Communication Crafts" },
  ];

  for (const u of usersToSeed) {
    let company = await prisma.company.findUnique({
      where: { name: u.companyName },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { name: u.companyName },
      });
      console.log(`Created company: ${company.name}`);
    }

    const existingUser = await prisma.user.findUnique({
      where: { number: u.number },
    });

    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          name: u.name,
          number: u.number,
          companyId: company.id,
        },
      });
      console.log(`Created user: ${user.name} (${user.number})`);
    } else {
      console.log(`User already exists: ${existingUser.name} (${existingUser.number})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
