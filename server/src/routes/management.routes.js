import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { getSettings } from "../utils/settings.js";
import { toNumber } from "../utils/format.js";
import { brandingUpload, publicUploadPath, verifyUploadedFiles } from "../middleware/upload.js";
import { z } from "zod";
import { validate } from "../utils/validation.js";
import { validateOpaqueParam } from "../middleware/params.js";
import { auditLog } from "../utils/audit.js";

const router = Router();
router.param("id", validateOpaqueParam);
const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(100).optional(),
  supportEmail: z.string().trim().email().max(254).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  automaticDeliveryEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  paystackEnabled: z.boolean().optional(),
  flutterwaveEnabled: z.boolean().optional(),
  manualBankTransferEnabled: z.boolean().optional(),
}).strict();
const ticketCreateSchema = z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(1).max(5000) });
const ticketMessageSchema = z.object({ message: z.string().trim().min(1).max(5000) });
const ticketStatusSchema = z.object({ status: z.enum(["OPEN", "PENDING", "CLOSED"]) });

router.get("/analytics/admin", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const [totalUsers, totalProducts, totalOrders, deposits, pendingDeposits, completedOrders, bestSelling] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.product.count(),
    prisma.order.count(),
    prisma.deposit.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.product.findMany({ where: { orderCount: { gt: 0 } }, orderBy: { orderCount: "desc" }, take: 5, include: { category: true } }),
  ]);
  const revenue = await prisma.order.aggregate({ where: { status: { in: ["PROCESSING", "COMPLETED"] } }, _sum: { totalAmount: true } });
  res.json({
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenue: toNumber(revenue._sum.totalAmount || 0),
    totalDeposits: toNumber(deposits._sum.amount || 0),
    pendingDeposits,
    completedOrders,
    bestSellingProducts: bestSelling,
    revenueByDay: [],
    revenueByCategory: [],
  });
}));

router.get("/admin/settings", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  res.json({
    settings: await getSettings(),
    configuration: {
      jwtConfigured: Boolean(process.env.JWT_SECRET),
      emailProvider: String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "not configured")).toLowerCase(),
      resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM_ADDRESS),
      paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      flutterwaveConfigured: Boolean(process.env.FLW_SECRET_KEY),
      korapayConfigured: Boolean(process.env.KORAPAY_SECRET_KEY),
    },
  });
}));
router.patch("/admin/settings", requireAuth, requireAdmin, validate(settingsSchema), asyncHandler(async (req, res) => {
  const allowed = [
    "siteName",
    "supportEmail",
    "currency",
    "automaticDeliveryEnabled",
    "maintenanceMode",
    "paystackEnabled",
    "flutterwaveEnabled",
    "manualBankTransferEnabled",
  ];
  const data = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
  const settings = await prisma.appSetting.update({ where: { id: "site" }, data });
  await auditLog({
    userId: req.user.id,
    action: "SETTINGS_UPDATED",
    entityType: "AppSetting",
    entityId: settings.id,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ settings });
}));
router.post(
  "/admin/settings/branding",
  requireAuth,
  requireAdmin,
  brandingUpload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]),
  verifyUploadedFiles,
  asyncHandler(async (req, res) => {
    const logo = req.files?.logo?.[0];
    const favicon = req.files?.favicon?.[0];
    if (!logo && !favicon) throw new ApiError(400, "Choose a logo or favicon to upload.");
    const data = {};
    if (logo) data.logoUrl = publicUploadPath(logo);
    if (favicon) data.faviconUrl = publicUploadPath(favicon);
    const settings = await prisma.appSetting.update({ where: { id: "site" }, data });
    await auditLog({
      userId: req.user.id,
      action: "BRANDING_UPDATED",
      entityType: "AppSetting",
      entityId: settings.id,
      metadata: { logo: Boolean(logo), favicon: Boolean(favicon) },
    });
    res.json({ settings });
  })
);

router.get("/admin/audit-logs", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ logs });
}));

router.get("/tickets", requireAuth, asyncHandler(async (req, res) => {
  const where = req.user.role === "ADMIN" ? {} : { userId: req.user.id };
  const tickets = await prisma.supportTicket.findMany({ where, include: { messages: { include: { user: true } }, user: true }, orderBy: { createdAt: "desc" } });
  res.json({ tickets });
}));
router.post("/tickets", requireAuth, validate(ticketCreateSchema), asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.create({
    data: { userId: req.user.id, subject: req.body.subject, messages: { create: { userId: req.user.id, message: req.body.message } } },
    include: { messages: true },
  });
  res.status(201).json({ ticket });
}));
router.post("/tickets/:id/messages", requireAuth, validate(ticketMessageSchema), asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) throw new ApiError(404, "Ticket not found.");
  const message = await prisma.supportMessage.create({ data: { ticketId: ticket.id, userId: req.user.id, message: req.body.message } });
  res.status(201).json({ message });
}));
router.patch("/tickets/:id/status", requireAuth, validate(ticketStatusSchema), asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) throw new ApiError(404, "Ticket not found.");
  const status = String(req.body.status || "").toUpperCase();
  if (!["OPEN", "PENDING", "CLOSED"].includes(status)) throw new ApiError(400, "Invalid ticket status.");
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status } });
  res.json({ ticket: updated });
}));

export default router;
