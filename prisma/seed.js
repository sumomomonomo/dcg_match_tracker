'use strict';
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const guestPassword = await bcrypt.hash("guest123", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPassword
    }
  });

  await prisma.user.upsert({
    where: { username: "guest" },
    update: {},
    create: {
      username: "guest",
      passwordHash: guestPassword
    }
  });

  console.log("Seeding completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());