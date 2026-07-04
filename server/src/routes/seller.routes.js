import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireSeller } from "../middleware/roles.js";
import { productAssetUpload, deliveryUpload, publicUploadPath } from "../middleware/upload.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { productDto, orderDto, toNumber } from "../utils/format.js";
import { auditLog } from "../utils/audit.js";
import { createNotification } from "../utils/notifications.js";

const router = Router();

router.post("/seller/apply", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { role: "SELLER", sellerStatus: "PENDING" } });
  res.json({ user: { id: user.id, role: user.role, sellerStatus: user.sellerStatus } });
}));

router.use("/seller", requireAuth, requireSeller);

router.get("/seller/analytics", asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ where: { sellerId: req.user.id }, select: { id: true, title: true } });
  const productIds = products.map((item) => item.id);
  const items = await prisma.orderItem.findMany({
    where: { productId: { in: productIds }, order: { status: { in: ["PROCESSING", "COMPLETED"] } } },
    include: { order: true, product: true },
  });
  const completed = items.filter((item) => item.order.status === "COMPLETED");
  res.json({
    totalSales: items.reduce((sum, item) => sum + item.quantity, 0),
    totalEarnings: toNumber(req.user.sellerEarnings),
    pendingOrders: items.filter((item) => item.order.status !== "COMPLETED").length,
    completedOrders: completed.length,
    bestSellingProducts: products.map((product) => ({
      ...product,
      sold: items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0),
    })).sort((a, b) => b.sold - a.sold).slice(0, 5),
  });
}));

router.get("/seller/products", asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({ where: { sellerId: req.user.id }, include: { category: true, deliveryFiles: true } });
  res.json({ products: products.map(productDto) });
}));

router.post("/seller/products", productAssetUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "deliveryFile", maxCount: 1 },
  { name: "deliveryFiles", maxCount: 10 },
]), asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.body.categoryId } });
  if (!category) throw new ApiError(400, "Category is required.");
  const image = req.files?.image?.[0];
  const deliveryFile = req.files?.deliveryFile?.[0];
  const deliveryFiles = [...(req.files?.deliveryFiles || []), ...(deliveryFile ? [deliveryFile] : [])];
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      platform: category.name,
      deliveryTime: req.body.deliveryTime || "48h",
      deliveryType: req.body.deliveryType || "MANUAL_SERVICE",
      deliveryInstructions: req.body.deliveryInstructions || null,
      deliveryFileUrl: deliveryFiles[0] ? publicUploadPath(deliveryFiles[0]) : null,
      deliveryFileName: deliveryFiles[0]?.originalname,
      deliveryFiles: deliveryFiles.length
        ? {
            create: deliveryFiles.map((file) => ({
              fileUrl: publicUploadPath(file),
              fileName: file.originalname,
            })),
          }
        : undefined,
      imageUrl: publicUploadPath(image),
      imageName: image?.originalname,
      sellerId: req.user.id,
      status: "ACTIVE",
      isActive: true,
    },
    include: { category: true, deliveryFiles: true },
  });
  res.status(201).json({ product: productDto(product) });
}));

router.patch("/seller/products/:id", productAssetUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "deliveryFile", maxCount: 1 },
  { name: "deliveryFiles", maxCount: 10 },
]), asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!product) throw new ApiError(404, "Product not found.");
  const image = req.files?.image?.[0];
  const deliveryFile = req.files?.deliveryFile?.[0];
  const deliveryFiles = [...(req.files?.deliveryFiles || []), ...(deliveryFile ? [deliveryFile] : [])];
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      title: req.body.title ?? undefined,
      description: req.body.description ?? undefined,
      price: req.body.price ? Number(req.body.price) : undefined,
      stock: req.body.stock ? Number(req.body.stock) : undefined,
      deliveryTime: req.body.deliveryTime ?? undefined,
      deliveryType: req.body.deliveryType ?? undefined,
      deliveryInstructions: req.body.deliveryInstructions ?? undefined,
      deliveryFileUrl: deliveryFiles[0] ? publicUploadPath(deliveryFiles[0]) : undefined,
      deliveryFileName: deliveryFiles[0]?.originalname,
      deliveryFiles: deliveryFiles.length
        ? {
            create: deliveryFiles.map((file) => ({
              fileUrl: publicUploadPath(file),
              fileName: file.originalname,
            })),
          }
        : undefined,
      imageUrl: image ? publicUploadPath(image) : undefined,
      imageName: image?.originalname,
    },
    include: { category: true, deliveryFiles: true },
  });
  res.json({ product: productDto(updated) });
}));

router.get("/seller/orders", asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { items: { some: { product: { sellerId: req.user.id } } } },
    include: { user: true, items: { include: { product: { include: { deliveryFiles: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(orderDto) });
}));

router.post("/seller/orders/:id/delivery", deliveryUpload.single("file"), asyncHandler(async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, items: { some: { product: { sellerId: req.user.id } } } },
  });
  if (!order) throw new ApiError(404, "Order not found.");
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { deliveryFileUrl: publicUploadPath(req.file), deliveryFileName: req.file?.originalname, status: "COMPLETED", completedAt: new Date() },
    include: { user: true, items: { include: { product: { include: { deliveryFiles: true } } } } },
  });
  await createNotification({ userId: updated.userId, title: "Order completed", message: "Your seller delivery is ready.", type: "ORDER_COMPLETED" });
  await auditLog({ userId: req.user.id, action: "SELLER_DELIVERY_UPLOADED", entityType: "Order", entityId: updated.id });
  res.json({ order: orderDto(updated) });
}));

router.post("/seller/withdrawals", asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) throw new ApiError(400, "Withdrawal amount is required.");
  if (req.user.sellerEarnings.lessThan(amount)) throw new ApiError(400, "Withdrawal amount exceeds seller earnings.");
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId: req.user.id,
      amount,
      bankName: req.body.bankName,
      accountName: req.body.accountName,
      accountNumber: req.body.accountNumber,
    },
  });
  res.status(201).json({ withdrawal });
}));

export default router;
