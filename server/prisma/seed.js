import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/marketplace_step5/index.js";
import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from "../src/utils/passwordPolicy.js";

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
  if (!passwordMeetsPolicy(password)) throw new Error(PASSWORD_POLICY_MESSAGE);
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, walletBalance, emailVerified: true, emailVerifiedAt: new Date() },
    create: { name, email, passwordHash, role, walletBalance, emailVerified: true, emailVerifiedAt: new Date() },
  });
}

async function main() {
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    await upsertUser({
      name: "SocialHub Admin",
      email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD,
      role: "ADMIN",
      walletBalance: 0,
    });
  }

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
