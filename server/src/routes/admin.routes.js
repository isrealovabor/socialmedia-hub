import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { deliveryUpload, productAssetUpload, productImageUpload, publicUploadPath } from "../middleware/upload.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { createNotification } from "../utils/notifications.js";
import { sendEmail } from "../utils/email.js";
import { auditLog } from "../utils/audit.js";
import { depositDto, orderDto, productDto, publicUser, reviewDto } from "../utils/format.js";
import { validate } from "../utils/validation.js";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
} from "../validators/admin.validators.js";

const router = Router();
const deliveryRoot = path.resolve("uploads", "deliveries");
fs.mkdirSync(deliveryRoot, { recursive: true });

router.use(requireAuth, requireAdmin);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ users: users.map(publicUser) });
  })
);

router.get(
  "/deposits",
  asyncHandler(async (req, res) => {
    const deposits = await prisma.deposit.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ deposits: deposits.map(depositDto) });
  })
);

router.get(
  "/deposits/:id/proof",
  asyncHandler(async (req, res) => {
    const deposit = await prisma.deposit.findUnique({ where: { id: req.params.id } });
    if (!deposit?.proofFileUrl) throw new ApiError(404, "Proof file not found.");
    const filePath = path.resolve(deposit.proofFileUrl.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) throw new ApiError(404, "Proof file is missing.");
    res.download(filePath, deposit.proofFileName || path.basename(filePath));
  })
);

router.patch(
  "/deposits/:id/approve",
  asyncHandler(async (req, res) => {
    const deposit = await prisma.$transaction(async (tx) => {
      const current = await tx.deposit.findUnique({ where: { id: req.params.id } });
      if (!current) throw new ApiError(404, "Deposit not found.");
      if (current.status !== "PENDING") {
        throw new ApiError(400, "Only pending deposits can be approved.");
      }

      await tx.user.update({
        where: { id: current.userId },
        data: { walletBalance: { increment: current.amount } },
      });

      const approved = await tx.deposit.update({
        where: { id: current.id },
        data: { status: "APPROVED" },
        include: { user: true },
      });
      await createNotification(
        {
          userId: current.userId,
          title: "Deposit approved",
          message: "Your deposit has been approved and added to your wallet.",
          type: "DEPOSIT_APPROVED",
        },
        tx
      );
      await auditLog({ userId: req.user.id, action: "DEPOSIT_APPROVED", entityType: "Deposit", entityId: current.id }, tx);
      return approved;
    });
    await sendEmail(deposit.user?.email, "depositApproved", { amount: deposit.amount });
    res.json({ deposit: depositDto(deposit) });
  })
);

router.patch(
  "/deposits/:id/reject",
  asyncHandler(async (req, res) => {
    const deposit = await prisma.deposit.findUnique({ where: { id: req.params.id } });
    if (!deposit) throw new ApiError(404, "Deposit not found.");
    if (deposit.status !== "PENDING") {
      throw new ApiError(400, "Only pending deposits can be rejected.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.deposit.update({
        where: { id: req.params.id },
        data: { status: "REJECTED" },
        include: { user: true },
      });
      await createNotification(
        {
          userId: rejected.userId,
          title: "Deposit rejected",
          message: "Your deposit was rejected. Please check your payment proof and submit again.",
          type: "DEPOSIT_REJECTED",
        },
        tx
      );
      await auditLog({ userId: req.user.id, action: "DEPOSIT_REJECTED", entityType: "Deposit", entityId: rejected.id }, tx);
      return rejected;
    });
    await sendEmail(updated.user?.email, "depositRejected", {});
    res.json({ deposit: depositDto(updated) });
  })
);

router.post(
  "/categories",
  validate(categoryCreateSchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ category });
  })
);

router.patch(
  "/categories/:id",
  validate(categoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ category });
  })
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: "Category deleted." });
  })
);

router.post(
  "/products",
  productAssetUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "deliveryFile", maxCount: 1 },
    { name: "deliveryFiles", maxCount: 10 },
  ]),
  asyncHandler(async (req, res, next) => {
    const image = req.files?.image?.[0];
    const deliveryFile = req.files?.deliveryFile?.[0];
    const deliveryFiles = [...(req.files?.deliveryFiles || []), ...(deliveryFile ? [deliveryFile] : [])];
    const generatedFile = createWrittenDeliveryFile(req.body.deliveryText, req.body.deliveryTextFormat, req.body.title);
    if (generatedFile) deliveryFiles.push(generatedFile);
    if (image) {
      req.body.imageUrl = publicUploadPath(image);
      req.body.imageName = image.originalname;
    }
    if (deliveryFiles.length) {
      req.deliveryFiles = deliveryFiles;
      req.body.deliveryFileUrl = publicUploadPath(deliveryFiles[0]);
      req.body.deliveryFileName = deliveryFiles[0].originalname;
    }
    await normalizeProductPlatform(req.body);
    next();
  }),
  validate(productCreateSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({
      data: {
        ...req.body,
        deliveryFiles: req.deliveryFiles?.length
          ? {
              create: req.deliveryFiles.map((file) => ({
                fileUrl: publicUploadPath(file),
                fileName: file.originalname,
              })),
            }
          : undefined,
      },
      include: { category: true, deliveryFiles: true },
    });
    res.status(201).json({ product: productDto(product) });
  })
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      include: { category: true, deliveryFiles: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ products: products.map(productDto) });
  })
);

router.post(
  "/sanity-listings",
  productImageUpload.single("image"),
  asyncHandler(async (req, res) => {
    const listing = await createSanityListing(req.body, req.file);
    await auditLog({
      userId: req.user.id,
      action: "SANITY_LISTING_CREATED",
      entityType: "SanityListing",
      entityId: listing?._id,
      metadata: { category: req.body.category, stock: Number(req.body.stock || 0) },
    });
    res.status(201).json({ listing });
  })
);

router.patch(
  "/products/:id",
  productAssetUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "deliveryFile", maxCount: 1 },
    { name: "deliveryFiles", maxCount: 10 },
  ]),
  asyncHandler(async (req, res, next) => {
    const image = req.files?.image?.[0];
    const deliveryFile = req.files?.deliveryFile?.[0];
    const deliveryFiles = [...(req.files?.deliveryFiles || []), ...(deliveryFile ? [deliveryFile] : [])];
    const generatedFile = createWrittenDeliveryFile(req.body.deliveryText, req.body.deliveryTextFormat, req.body.title);
    if (generatedFile) deliveryFiles.push(generatedFile);
    if (image) {
      req.body.imageUrl = publicUploadPath(image);
      req.body.imageName = image.originalname;
    }
    if (deliveryFiles.length) {
      req.deliveryFiles = deliveryFiles;
      req.body.deliveryFileUrl = publicUploadPath(deliveryFiles[0]);
      req.body.deliveryFileName = deliveryFiles[0].originalname;
    }
    await normalizeProductPlatform(req.body);
    next();
  }),
  validate(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const newDeliveryCount = req.deliveryFiles?.length || 0;
    const data = { ...req.body };
    if (newDeliveryCount) {
      data.stock =
        data.stock !== undefined
          ? Number(data.stock) + newDeliveryCount
          : { increment: newDeliveryCount };
    }
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...data,
        deliveryFiles: req.deliveryFiles?.length
          ? {
              create: req.deliveryFiles.map((file) => ({
                fileUrl: publicUploadPath(file),
                fileName: file.originalname,
              })),
            }
          : undefined,
      },
      include: { category: true, deliveryFiles: true },
    });
    await auditLog({ userId: req.user.id, action: "PRODUCT_EDITED", entityType: "Product", entityId: product.id });
    res.json({ product: productDto(product) });
  })
);

router.post(
  "/products/:id/delivery-files",
  deliveryUpload.array("files", 10),
  asyncHandler(async (req, res) => {
    const generatedFile = createWrittenDeliveryFile(req.body.deliveryText, req.body.deliveryTextFormat, req.body.fileName || "delivery-content");
    const files = [...(req.files || []), ...(generatedFile ? [generatedFile] : [])];
    if (!files.length) throw new ApiError(400, "Choose a delivery file or write delivery text.");
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        deliveryFileUrl: publicUploadPath(files[0]),
        deliveryFileName: files[0].originalname,
        stock: { increment: files.length },
        deliveryFiles: {
          create: files.map((file) => ({
            fileUrl: publicUploadPath(file),
            fileName: file.originalname,
          })),
        },
      },
      include: { category: true, deliveryFiles: true },
    });
    await auditLog({
      userId: req.user.id,
      action: "PRODUCT_DELIVERY_FILES_ADDED",
      entityType: "Product",
      entityId: product.id,
      metadata: { count: files.length },
    });
    res.status(201).json({ product: productDto(product) });
  })
);

router.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    await auditLog({ userId: req.user.id, action: "PRODUCT_DELETED", entityType: "Product", entityId: product.id });
    res.json({ message: "Product disabled." });
  })
);

router.patch(
  "/products/:id/enable",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: true, status: "ACTIVE" },
      include: { category: true, deliveryFiles: true },
    });
    res.json({ product: productDto(product) });
  })
);

router.patch(
  "/products/:id/disable",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false, status: "DISABLED" },
      include: { category: true, deliveryFiles: true },
    });
    res.json({ product: productDto(product) });
  })
);

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      include: { user: true, items: { include: { product: { include: { deliveryFiles: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders: orders.map(orderDto) });
  })
);

router.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const allowed = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"];
    const status = String(req.body.status || "").toUpperCase();
    if (!allowed.includes(status)) throw new ApiError(400, "Invalid order status.");

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: req.params.id },
        data: {
          status,
          completedAt: status === "COMPLETED" ? new Date() : undefined,
        },
        include: { user: true, items: { include: { product: { include: { deliveryFiles: true } } } } },
      });
      if (status === "COMPLETED" || status === "CANCELLED") {
        await createNotification(
          {
            userId: updated.userId,
            title: status === "COMPLETED" ? "Order completed" : "Order cancelled",
            message:
              status === "COMPLETED"
                ? "Your order has been completed."
                : "Your order has been cancelled.",
            type: `ORDER_${status}`,
          },
          tx
        );
      }
      return updated;
    });
    res.json({ order: orderDto(order) });
  })
);

router.post(
  "/orders/:id/delivery",
  deliveryUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Delivery file is required.");
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: req.params.id },
        data: {
          deliveryFileUrl: publicUploadPath(req.file),
          deliveryFileName: req.file.originalname,
          status: "COMPLETED",
          completedAt: new Date(),
        },
        include: { user: true, items: { include: { product: { include: { deliveryFiles: true } } } } },
      });
      await createNotification(
        {
          userId: updated.userId,
          title: "Order completed",
          message: "Your order is complete and your delivery file is ready to download.",
          type: "ORDER_COMPLETED",
        },
        tx
      );
      await auditLog({ userId: req.user.id, action: "ADMIN_DELIVERY_UPLOADED", entityType: "Order", entityId: updated.id }, tx);
      return updated;
    });
    await sendEmail(order.user?.email, "orderCompleted", { orderNumber: order.orderNumber });
    res.json({ order: orderDto(order) });
  })
);

router.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      include: { user: true, product: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reviews: reviews.map(reviewDto) });
  })
);

router.delete(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    await prisma.review.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: "Review removed." });
  })
);

async function normalizeProductPlatform(body) {
  if (!body.categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!category) return;
  if (!body.platform || body.platform === "Other" || body.platform === "undefined") {
    body.platform = category.name;
  }
}

function requireSanityEnv() {
  const config = {
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET || "production",
    token: process.env.SANITY_WRITE_TOKEN,
    apiVersion: process.env.SANITY_API_VERSION || "2025-02-19",
    documentType: process.env.SANITY_ACCOUNT_TYPE || "socialAccount",
  };
  if (!config.projectId || !config.dataset || !config.token) {
    throw new ApiError(500, "Sanity is not configured. Set SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_WRITE_TOKEN on the server.");
  }
  return config;
}

function validateListingPayload(body) {
  const accountName = String(body.accountName || "").trim();
  const category = String(body.category || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const blocked = /\b(hacked|stolen|fake|cracked|logs?|credentials?|passwords?|compromised)\b/i;

  if (!accountName) throw new ApiError(400, "Listing name is required.");
  if (!category) throw new ApiError(400, "Category is required.");
  if (!description) throw new ApiError(400, "Description is required.");
  if (!Number.isFinite(price) || price < 0) throw new ApiError(400, "Price must be a valid amount.");
  if (!Number.isInteger(stock) || stock < 0) throw new ApiError(400, "Available quantity must be a whole number.");
  if (blocked.test(`${accountName} ${category} ${description}`)) {
    throw new ApiError(400, "Listings must use legal service, content pack, consulting, or transfer-assistance wording.");
  }

  return { accountName, category, description, price, stock };
}

function createWrittenDeliveryFile(text, requestedFormat = "txt", title = "delivery-content") {
  const content = String(text || "").trim();
  if (!content) return null;
  if (content.length > 200000) throw new ApiError(400, "Written delivery text is too long.");

  const format = String(requestedFormat || "txt").toLowerCase() === "pdf" ? "pdf" : "txt";
  const baseName = safeFileName(title || "delivery-content");
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}.${format}`;
  const filePath = path.join(deliveryRoot, filename);

  if (format === "pdf") {
    fs.writeFileSync(filePath, createSimplePdf(content));
  } else {
    fs.writeFileSync(filePath, content, "utf8");
  }

  return {
    path: filePath,
    filename,
    originalname: `${baseName}.${format}`,
    mimetype: format === "pdf" ? "application/pdf" : "text/plain",
  };
}

function safeFileName(value) {
  const cleaned = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return cleaned || "delivery-content";
}

function createSimplePdf(text) {
  const lines = wrapPdfText(text);
  const body = lines
    .map((line, index) => `BT /F1 11 Tf 50 ${760 - index * 16} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(body, "utf8")} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function wrapPdfText(text) {
  return String(text)
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => {
      const chunks = [];
      let current = line.trim();
      while (current.length > 86) {
        chunks.push(current.slice(0, 86));
        current = current.slice(86);
      }
      chunks.push(current);
      return chunks;
    })
    .slice(0, 45);
}

function escapePdfText(text) {
  return String(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

async function createSanityListing(body, image) {
  if (!image) throw new ApiError(400, "Listing image is required.");

  const config = requireSanityEnv();
  const listing = validateListingPayload(body);
  const encodedFilename = encodeURIComponent(image.originalname || "listing-image");
  const uploadUrl = `https://${config.projectId}.api.sanity.io/v${config.apiVersion}/assets/images/${config.dataset}?filename=${encodedFilename}`;
  const imageBuffer = fs.readFileSync(image.path);

  const assetResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": image.mimetype,
    },
    body: imageBuffer,
  });
  const assetData = await assetResponse.json().catch(() => ({}));
  if (!assetResponse.ok) {
    throw new ApiError(assetResponse.status, assetData?.message || "Sanity image upload failed.");
  }

  const mutationUrl = `https://${config.projectId}.api.sanity.io/v${config.apiVersion}/data/mutate/${config.dataset}`;
  const createDocument = {
    _type: config.documentType,
    accountName: listing.accountName,
    title: listing.accountName,
    category: listing.category,
    price: listing.price,
    stock: listing.stock,
    quantity: listing.stock,
    description: listing.description,
    image: {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: assetData.document._id,
      },
    },
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const mutationResponse = await fetch(mutationUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mutations: [{ create: createDocument }] }),
  });
  const mutationData = await mutationResponse.json().catch(() => ({}));
  if (!mutationResponse.ok) {
    throw new ApiError(mutationResponse.status, mutationData?.message || "Sanity listing creation failed.");
  }

  return mutationData.results?.[0]?.document || mutationData.results?.[0] || createDocument;
}

export default router;
