import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/marketplace_step5/index.js";

const prisma = new PrismaClient();

const categories = [
  ["Instagram", "instagram", "IG"],
  ["TikTok", "tiktok", "TK"],
  ["Snapchat", "snapchat", "SC"],
  ["Facebook", "facebook", "FB"],
  ["X/Twitter", "x-twitter", "X"],
  ["Telegram", "telegram", "TG"],
  ["Digital Services", "digital-services", "DS"],
  ["Marketing Packages", "marketing-packages", "MP"],
  ["Content Templates", "content-templates", "CT"],
];

async function upsertUser({ name, email, password, role, walletBalance = 0 }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, walletBalance },
    create: { name, email, passwordHash, role, walletBalance },
  });
}

async function main() {
  await upsertUser({
    name: "SocialHub Admin",
    email: "admin@socialhub.test",
    password: "Admin123!",
    role: "ADMIN",
    walletBalance: 0,
  });

  await upsertUser({
    name: "Demo User",
    email: "user@socialhub.test",
    password: "User123!",
    role: "USER",
    walletBalance: 18500,
  });

  for (const [name, slug, icon] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, icon },
      create: { name, slug, icon },
    });
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
