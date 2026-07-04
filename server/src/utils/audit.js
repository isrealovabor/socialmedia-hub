import { prisma } from "../prisma.js";

export async function auditLog({ userId, action, entityType, entityId, metadata }, client = prisma) {
  return client.auditLog.create({
    data: {
      userId: userId || null,
      action,
      entityType,
      entityId: entityId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}
