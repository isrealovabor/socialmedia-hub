import { prisma } from "../prisma.js";

export async function createNotification({ userId, title, message, type = "INFO" }, client = prisma) {
  return client.notification.create({
    data: { userId, title, message, type },
  });
}
