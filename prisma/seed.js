'use strict';

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
  const guestPassword = await bcrypt.hash(process.env.GUEST_PASSWORD || "guest123", 10);

  // 👤 admin
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPassword
    }
  });

  // 👤 guest
  const guest = await prisma.user.upsert({
    where: { username: "guest" },
    update: {},
    create: {
      username: "guest",
      passwordHash: guestPassword
    }
  });

  // 🃏 デッキ（複数）
  const deckA = await prisma.deck.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "アグロ",
      userId: guest.id
    }
  });

  const deckB = await prisma.deck.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "コントロール",
      userId: guest.id
    }
  });

  // ⚔️ 戦績（ダミー）
  await prisma.match.createMany({
    data: [
      {
        userId: guest.id,
        myDeckId: deckA.id,
        enemyDeckName: "ドラゴン",
        isWin: true,
        playOrder: "FIRST",
        memo: "先攻ブン回り"
      },
      {
        userId: guest.id,
        myDeckId: deckA.id,
        enemyDeckName: "ナイト",
        isWin: false,
        playOrder: "SECOND",
        memo: "事故った"
      },
      {
        userId: guest.id,
        myDeckId: deckB.id,
        enemyDeckName: "メイジ",
        isWin: true,
        playOrder: "SECOND",
        memo: "逆転勝ち"
      }
    ]
  });

  console.log("Seeding completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());