import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/errors.js";
import { notificationDto } from "../utils/format.js";

const router = Router();

router.get(
  "/notifications",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    res.json({ success: true, unreadCount, notifications: notifications.map(notificationDto) });
  })
);

router.patch(
  "/notifications/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    if (!result.count) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, notification: notificationDto(notification) });
  })
);

router.patch(
  "/notifications/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: "Notifications marked as read." });
  })
);

export default router;
