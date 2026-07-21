import { Prisma } from "../generated/marketplace_step5/index.js";
import { prisma } from "../prisma.js";
import { ApiError } from "../utils/errors.js";
import { auditLog } from "../utils/audit.js";

const orderInclude = {
  items: {
    include: {
      product: true,
      deliveries: true,
    },
  },
};

export async function checkoutOrder({ userId, items, idempotencyKey, client = prisma }) {
  if (!idempotencyKey) {
    throw new ApiError(400, "An idempotency key is required for checkout.");
  }

  const orderNumber = String(idempotencyKey);
  const existing = await client.order.findFirst({
    where: { userId, orderNumber },
    include: orderInclude,
  });
  if (existing) return { order: existing, replayed: true };

  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const requestedItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));

  try {
    const order = await client.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: requestedItems.map((item) => item.productId) },
          isActive: true,
          status: "ACTIVE",
        },
      });
      if (products.length !== requestedItems.length) {
        throw new ApiError(400, "One or more products are unavailable.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      let total = new Prisma.Decimal(0);
      for (const item of requestedItems) {
        const product = productById.get(item.productId);
        total = total.plus(product.price.mul(item.quantity));
      }

      const debited = await tx.user.updateMany({
        where: { id: userId, walletBalance: { gte: total } },
        data: {
          walletBalance: { decrement: total },
          totalSpent: { increment: total },
        },
      });
      if (debited.count !== 1) {
        throw new ApiError(400, "Insufficient balance. Please deposit funds.");
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          totalAmount: total,
          discountAmount: 0,
          status: "PROCESSING",
        },
      });

      for (const item of requestedItems) {
        const product = productById.get(item.productId);
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: product.id,
            quantity: item.quantity,
            unitPrice: product.price,
          },
        });

        const claimed = await claimAvailableInventory(tx, product.id, orderItem.id, item.quantity);
        if (claimed.length !== item.quantity) {
          throw new ApiError(409, `${product.title} does not have enough available inventory.`);
        }

        const stockUpdate = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: item.quantity } },
          data: {
            stock: { decrement: item.quantity },
            orderCount: { increment: item.quantity },
          },
        });
        if (stockUpdate.count !== 1) {
          throw new ApiError(409, `${product.title} is out of stock.`);
        }

      }

      const completed = await tx.order.update({
        where: { id: createdOrder.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: orderInclude,
      });
      await auditLog(
        { userId, action: "USER_CHECKOUT", entityType: "Order", entityId: completed.id },
        tx
      );
      return completed;
    });

    return { order, replayed: false };
  } catch (error) {
    if (error?.code === "P2002") {
      const replayed = await client.order.findFirst({
        where: { userId, orderNumber },
        include: orderInclude,
      });
      if (replayed) return { order: replayed, replayed: true };
    }
    throw error;
  }
}

async function claimAvailableInventory(tx, productId, orderItemId, quantity) {
  return tx.$queryRaw(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "ProductDeliveryFile"
      WHERE "productId" = ${productId}
        AND "status" = 'AVAILABLE'
        AND "orderItemId" IS NULL
      ORDER BY "createdAt", "id"
      LIMIT ${quantity}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "ProductDeliveryFile" AS inventory
    SET "status" = 'SOLD',
        "orderItemId" = ${orderItemId},
        "reservedAt" = COALESCE(inventory."reservedAt", CURRENT_TIMESTAMP),
        "soldAt" = CURRENT_TIMESTAMP
    FROM candidates
    WHERE inventory."id" = candidates."id"
      AND inventory."status" = 'AVAILABLE'
    RETURNING inventory."id"
  `);
}
