import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { orderDto } from "../utils/format.js";
import { auditLog } from "../utils/audit.js";
import { sendEmail } from "../utils/email.js";
import { validate } from "../utils/validation.js";
import { checkoutSchema } from "../validators/order.validators.js";
import { checkoutOrder } from "../services/checkout.js";

const router = Router();

router.post(
  "/orders",
  requireAuth,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const checkoutKey = req.headers["idempotency-key"];
    const { order, replayed } = await checkoutOrder({
      userId: req.user.id,
      items: req.body.items,
      idempotencyKey: checkoutKey,
    });

    const downloadUrl = order.deliveryFileUrl
      ? `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard`
      : null;
    await sendEmail(req.user.email, "orderConfirmation", { orderNumber: order.orderNumber, downloadUrl });
    res.status(replayed ? 200 : 201).json({ success: true, order: orderDto(order), replayed });
  })
);

router.get(
  "/orders/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: true, deliveries: true } } },
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
      where: {
        id: req.params.id,
        status: "COMPLETED",
        ...(req.user.role === "ADMIN" ? {} : { userId: req.user.id }),
      },
      include: { items: { include: { product: true, deliveries: true } } },
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
      where: {
        id: req.params.id,
        status: "COMPLETED",
        ...(req.user.role === "ADMIN" ? {} : { userId: req.user.id }),
      },
      include: { items: { include: { product: true, deliveries: true } } },
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
      include: { items: { include: { product: true, deliveries: true } } },
    });
    if (!order) {
      throw new ApiError(404, "Order not found.");
    }
    res.json({ success: true, order: orderDto(order) });
  })
);

function resolveOrderDownload(order, itemId, fileId) {
  if (!order) return null;
  if (itemId) {
    const item = order.items?.find((entry) => entry.id === itemId);
    if (!item) return null;
    if (fileId) {
      const file = item.deliveries?.find((entry) => entry.id === fileId);
      return file ? { url: file.fileUrl, name: file.fileName } : null;
    }
    const file = item.deliveries?.[0];
    return file ? { url: file.fileUrl, name: file.fileName } : null;
  }
  if (fileId) {
    const file = order.items
      ?.flatMap((entry) => entry.deliveries || [])
      .find((entry) => entry.id === fileId);
    return file ? { url: file.fileUrl, name: file.fileName } : null;
  }
  if (order.deliveryFileUrl) return { url: order.deliveryFileUrl, name: order.deliveryFileName };
  const file = order.items?.flatMap((entry) => entry.deliveries || [])[0];
  return file ? { url: file.fileUrl, name: file.fileName } : null;
}

function signDownloadToken({ orderId, userId, itemId, fileId, expires }) {
  if (!process.env.JWT_SECRET) throw new ApiError(500, "JWT secret is not configured.");
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${orderId}:${userId}:${itemId || ""}:${fileId || ""}:${expires}`)
    .digest("hex");
}

export default router;
