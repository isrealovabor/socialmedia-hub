import { prisma } from "../prisma.js";

export async function getSettings(client = prisma) {
  return client.appSetting.upsert({
    where: { id: "site" },
    update: {},
    create: { id: "site" },
  });
}
