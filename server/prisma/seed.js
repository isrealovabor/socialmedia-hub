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

const productMap = {
  instagram: [
    ["Instagram Profile Setup Package", "Profile setup, bio review, highlight planning, and brand-ready presentation.", 2500, 16887, "48h", 4.8],
    ["Instagram Growth Strategy Consultation", "Consulting session with content pillars, campaign suggestions, and engagement guidance.", 5500, 620, "72h", 4.9],
    ["Instagram Content Optimization Pack", "Caption refinements, posting checklist, and visual content structure support.", 3200, 2900, "48h", 4.7],
  ],
  tiktok: [
    ["TikTok Content Starter Pack", "Short-form content ideas, hooks, captions, and weekly publishing structure.", 3200, 9420, "48h", 4.7],
    ["TikTok Creator Strategy Session", "Profile positioning, trend planning, and creator workflow consultation.", 6500, 410, "72h", 4.8],
  ],
  snapchat: [
    ["Snapchat Brand Setup Service", "Story structure, profile polish, and audience-friendly creative prompts.", 2100, 5208, "48h", 4.6],
    ["Snapchat Story Content Pack", "Reusable story ideas, posting rhythm, and simple campaign templates.", 2800, 1775, "48h", 4.6],
  ],
  facebook: [
    ["Facebook Page Optimization Package", "Page setup, content cleanup, verified transfer assistance where allowed, and launch support.", 2800, 12041, "48h", 4.8],
    ["Facebook Campaign Planning Service", "Post calendar, audience notes, and offer-focused campaign structure.", 4800, 1300, "72h", 4.7],
  ],
  "x-twitter": [
    ["X/Twitter Engagement Strategy", "Profile positioning, post templates, campaign calendar, and engagement consulting.", 2600, 7663, "48h", 4.5],
    ["X/Twitter Launch Content Pack", "Opening thread ideas, short posts, and tone guidance for brand launches.", 3400, 980, "48h", 4.6],
  ],
  telegram: [
    ["Telegram Community Setup", "Channel setup guidance, post templates, moderation checklist, and community launch support.", 2400, 8314, "48h", 4.7],
    ["Telegram Content Calendar Pack", "Announcement templates, community prompts, and weekly posting structure.", 3100, 1510, "48h", 4.7],
  ],
  "digital-services": [
    ["Digital Marketing Starter Package", "Basic marketing audit, channel recommendations, and launch checklist.", 7000, 450, "72h", 4.8],
    ["Brand Bio Writing Service", "Concise profile copy for social pages and campaign landing profiles.", 2200, 2400, "48h", 4.6],
  ],
  "marketing-packages": [
    ["Starter Campaign Package", "Offer positioning, content themes, and campaign launch plan.", 9000, 360, "72h", 4.9],
    ["Audience Research Mini Pack", "Audience notes, messaging angles, and content recommendations.", 6000, 540, "72h", 4.7],
  ],
  "content-templates": [
    ["Social Caption Template Pack", "Reusable caption structures for launches, promotions, updates, and community posts.", 1800, 4100, "24h", 4.8],
    ["Content Calendar Template Pack", "Editable monthly planning template with campaign prompts and posting slots.", 2600, 2800, "24h", 4.8],
  ],
};

async function upsertUser({ name, email, password, role, walletBalance = 0 }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, walletBalance, referralCode: `${name.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase()}123` },
    create: { name, email, passwordHash, role, walletBalance, referralCode: `${name.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase()}123` },
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
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, icon },
      create: { name, slug, icon },
    });

    for (const [title, description, price, stock, deliveryTime, rating] of productMap[slug] ?? []) {
      await prisma.product.upsert({
        where: { id: `${slug}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` },
        update: { categoryId: category.id, title, description, price, stock, platform: name, deliveryTime, rating, isActive: true },
        create: {
          id: `${slug}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
          categoryId: category.id,
          title,
          description,
          price,
          stock,
          platform: name,
          deliveryTime,
          rating,
          orderCount: Math.floor(stock / 12),
          isActive: true,
        },
      });
    }
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
