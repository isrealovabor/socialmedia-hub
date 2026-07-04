import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { auditLog } from "../utils/audit.js";
import { getSettings } from "../utils/settings.js";
import { toNumber } from "../utils/format.js";

const router = Router();

router.get("/analytics/admin", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const [totalUsers, totalSellers, totalProducts, totalOrders, deposits, pendingDeposits, completedOrders, bestSelling] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "SELLER" } }),
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
    totalSellers,
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
  res.json({ settings: await getSettings() });
}));
router.patch("/admin/settings", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const settings = await prisma.appSetting.update({ where: { id: "site" }, data: req.body });
  res.json({ settings });
}));

router.get("/admin/audit-logs", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ logs });
}));

router.get("/admin/sellers", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const sellers = await prisma.user.findMany({ where: { role: "SELLER" }, orderBy: { createdAt: "desc" } });
  res.json({ sellers });
}));
router.patch("/admin/sellers/:id/status", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  if (!["APPROVED", "SUSPENDED", "PENDING"].includes(status)) throw new ApiError(400, "Invalid seller status.");
  const seller = await prisma.user.update({ where: { id: req.params.id }, data: { role: "SELLER", sellerStatus: status } });
  res.json({ seller });
}));

router.get("/admin/withdrawals", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({ include: { user: true }, orderBy: { createdAt: "desc" } });
  res.json({ withdrawals });
}));
router.patch("/admin/withdrawals/:id/:action", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const status = req.params.action === "approve" ? "APPROVED" : "REJECTED";
  const withdrawal = await prisma.withdrawal.update({ where: { id: req.params.id }, data: { status }, include: { user: true } });
  await auditLog({ userId: req.user.id, action: `WITHDRAWAL_${status}`, entityType: "Withdrawal", entityId: withdrawal.id });
  res.json({ withdrawal });
}));

router.get("/tickets", requireAuth, asyncHandler(async (req, res) => {
  const where = req.user.role === "ADMIN" ? {} : { userId: req.user.id };
  const tickets = await prisma.supportTicket.findMany({ where, include: { messages: { include: { user: true } }, user: true }, orderBy: { createdAt: "desc" } });
  res.json({ tickets });
}));
router.post("/tickets", requireAuth, asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.create({
    data: { userId: req.user.id, subject: req.body.subject, messages: { create: { userId: req.user.id, message: req.body.message } } },
    include: { messages: true },
  });
  res.status(201).json({ ticket });
}));
router.post("/tickets/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) throw new ApiError(404, "Ticket not found.");
  const message = await prisma.supportMessage.create({ data: { ticketId: ticket.id, userId: req.user.id, message: req.body.message } });
  res.status(201).json({ message });
}));
router.patch("/tickets/:id/status", requireAuth, asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket || (req.user.role !== "ADMIN" && ticket.userId !== req.user.id)) throw new ApiError(404, "Ticket not found.");
  const status = String(req.body.status || "").toUpperCase();
  if (!["OPEN", "PENDING", "CLOSED"].includes(status)) throw new ApiError(400, "Invalid ticket status.");
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status } });
  res.json({ ticket: updated });
}));

export default router;
