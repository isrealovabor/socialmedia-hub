import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { Prisma } from "../generated/marketplace_step5/index.js";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { orderDto } from "../utils/format.js";
import { createNotification } from "../utils/notifications.js";
import { auditLog } from "../utils/audit.js";
import { sendEmail } from "../utils/email.js";
import { getSettings } from "../utils/settings.js";
import { validate } from "../utils/validation.js";
import { checkoutSchema } from "../validators/order.validators.js";

const router = Router();

async function nextOrderNumber(tx) {
  const year = new Date().getFullYear();
  const count = await tx.order.count();
  return `SHM-${year}${String(count + 1).padStart(6, "0")}`;
}

router.post(
  "/orders",
  requireAuth,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const checkoutKey = req.headers["idempotency-key"];
    if (checkoutKey) {
      const existing = await prisma.order.findFirst({
        where: { userId: req.user.id, orderNumber: String(checkoutKey) },
        include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
      });
      if (existing) {
        res.json({ success: true, order: orderDto(existing) });
        return;
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.user.id } });
      const ids = req.body.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: ids }, isActive: true, status: "ACTIVE" },
        include: { deliveryFiles: true },
      });

      if (products.length !== ids.length) {
        throw new ApiError(400, "One or more products are unavailable.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      let total = new Prisma.Decimal(0);

      for (const item of req.body.items) {
        const product = productById.get(item.productId);
        if (product.stock < item.quantity) {
          throw new ApiError(400, `${product.title} does not have enough stock.`);
        }
        if (isInstantDownload(product) && !hasDeliveryFiles(product)) {
          throw new ApiError(400, `${product.title} is missing its digital delivery file.`);
        }
        total = total.plus(product.price.mul(item.quantity));
      }
      const firstDownload = req.body.items
        .map((item) => productById.get(item.productId))
        .find((product) => isInstantDownload(product) && hasDeliveryFiles(product));
      const payable = total;

      if (user.walletBalance.lessThan(payable)) {
        await createNotification(
          {
            userId: req.user.id,
            title: "Low wallet balance",
            message: "Your wallet balance is too low for this checkout.",
            type: "LOW_BALANCE",
          },
          tx
        );
        throw new ApiError(400, "Insufficient balance. Please deposit funds.");
      }

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          walletBalance: { decrement: payable },
          totalSpent: { increment: payable },
        },
      });

      for (const item of req.body.items) {
        const product = productById.get(item.productId);
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
            orderCount: { increment: item.quantity },
          },
        });
        if (product.sellerId) {
          await tx.user.update({
            where: { id: product.sellerId },
            data: { sellerEarnings: { increment: product.price.mul(item.quantity) } },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber: checkoutKey ? String(checkoutKey) : await nextOrderNumber(tx),
          userId: req.user.id,
          totalAmount: payable,
          discountAmount: 0,
          status: "COMPLETED",
          deliveryFileUrl: primaryDeliveryFile(firstDownload)?.url,
          deliveryFileName: primaryDeliveryFile(firstDownload)?.name,
          completedAt: new Date(),
          items: {
            create: req.body.items.map((item) => {
              const product = productById.get(item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
              };
            }),
          },
        },
        include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
      });

      if (user.referrerId && !order.referralBonusPaid) {
        const settings = await getSettings(tx);
        if (settings.referralEnabled) {
          await tx.user.update({
            where: { id: user.referrerId },
            data: {
              walletBalance: { increment: settings.referralBonus },
              referralEarnings: { increment: settings.referralBonus },
            },
          });
          await tx.order.update({ where: { id: order.id }, data: { referralBonusPaid: true } });
        }
      }

      await auditLog({ userId: req.user.id, action: "USER_CHECKOUT", entityType: "Order", entityId: order.id }, tx);
      return order;
    });

    const downloadUrl = order.deliveryFileUrl
      ? `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard`
      : null;
    await sendEmail(req.user.email, "orderConfirmation", { orderNumber: order.orderNumber, downloadUrl });
    res.status(201).json({ success: true, order: orderDto(order) });
  })
);

router.get(
  "/orders/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, orders: orders.map(orderDto) });
  })
);

router.get(
  "/orders/:id/download-link",
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: "COMPLETED" },
      include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
    });
    const itemId = req.query.itemId ? String(req.query.itemId) : null;
    const fileId = req.query.fileId ? String(req.query.fileId) : null;
    const file = resolveOrderDownload(order, itemId, fileId);
    if (!file) {
      throw new ApiError(404, "Download is not available for this order.");
    }
    const expires = Date.now() + 10 * 60 * 1000;
    const token = signDownloadToken({ orderId: order.id, userId: req.user.id, itemId, fileId, expires });
    res.json({
      success: true,
      expiresAt: new Date(expires),
      url: `/api/orders/${order.id}/download?itemId=${encodeURIComponent(itemId || "")}&fileId=${encodeURIComponent(fileId || "")}&expires=${expires}&token=${token}`,
    });
  })
);

router.get(
  "/orders/:id/download",
  requireAuth,
  asyncHandler(async (req, res) => {
    const itemId = req.query.itemId ? String(req.query.itemId) : null;
    const fileId = req.query.fileId ? String(req.query.fileId) : null;
    const expires = Number(req.query.expires);
    const token = String(req.query.token || "");
    if (!expires || expires < Date.now()) throw new ApiError(403, "Download link has expired.");
    const expected = signDownloadToken({ orderId: req.params.id, userId: req.user.id, itemId, fileId, expires });
    if (token.length !== expected.length) throw new ApiError(403, "Download link is invalid.");
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new ApiError(403, "Download link is invalid.");
    }
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: "COMPLETED" },
      include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
    });
    const file = resolveOrderDownload(order, itemId, fileId);
    if (!file) throw new ApiError(404, "Download is not available for this order.");

    const filePath = path.resolve(file.url.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) throw new ApiError(404, "Delivery file is missing.");
    await auditLog({
      userId: req.user.id,
      action: "ORDER_DOWNLOAD",
      entityType: "Order",
      entityId: order.id,
      metadata: { itemId, fileId, fileName: file.name },
    });
    res.download(filePath, file.name || path.basename(filePath));
  })
);

router.get(
  "/orders/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: { include: { product: { include: { deliveryFiles: true } } } } },
    });
    if (!order) {
      throw new ApiError(404, "Order not found.");
    }
    res.json({ success: true, order: orderDto(order) });
  })
);

function isInstantDownload(product) {
  return ["INSTANT_DOWNLOAD", "Instant Download", "FILE"].includes(product.deliveryType);
}

function hasDeliveryFiles(product) {
  return Boolean(product?.deliveryFileUrl || product?.deliveryFiles?.length);
}

function primaryDeliveryFile(product) {
  if (!product) return null;
  const file = product.deliveryFiles?.[0];
  if (file) return { id: file.id, url: file.fileUrl, name: file.fileName };
  if (product.deliveryFileUrl) return { url: product.deliveryFileUrl, name: product.deliveryFileName };
  return null;
}

function resolveOrderDownload(order, itemId, fileId) {
  if (!order) return null;
  if (itemId) {
    const item = order.items?.find((entry) => entry.id === itemId);
    if (!item || !isInstantDownload(item.product)) return null;
    if (fileId) {
      const file = item.product.deliveryFiles?.find((entry) => entry.id === fileId);
      return file ? { url: file.fileUrl, name: file.fileName } : null;
    }
    return primaryDeliveryFile(item.product);
  }
  if (fileId) {
    const file = order.items
      ?.filter((entry) => isInstantDownload(entry.product))
      .flatMap((entry) => entry.product.deliveryFiles || [])
      .find((entry) => entry.id === fileId);
    return file ? { url: file.fileUrl, name: file.fileName } : null;
  }
  if (order.deliveryFileUrl) return { url: order.deliveryFileUrl, name: order.deliveryFileName };
  const item = order.items?.find((entry) => isInstantDownload(entry.product) && hasDeliveryFiles(entry.product));
  return item ? primaryDeliveryFile(item.product) : null;
}

function signDownloadToken({ orderId, userId, itemId, fileId, expires }) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(`${orderId}:${userId}:${itemId || ""}:${fileId || ""}:${expires}`)
    .digest("hex");
}

export default router;
