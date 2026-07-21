import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { proofUpload, publicUploadPath } from "../middleware/upload.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/errors.js";
import { depositDto, publicUser, toNumber } from "../utils/format.js";
import { bankDetails } from "../../marketplace-config.js";
import { sendEmail } from "../utils/email.js";

const router = Router();

router.get(
  "/wallet",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pendingDeposits = await prisma.deposit.aggregate({
      where: { userId: req.user.id, status: "PENDING" },
      _sum: { amount: true },
    });

    res.json({
      user: publicUser(req.user),
      availableBalance: toNumber(req.user.walletBalance),
      balance: toNumber(req.user.walletBalance),
      pendingDeposits: toNumber(pendingDeposits._sum.amount || 0),
      totalSpent: toNumber(req.user.totalSpent || 0),
      bankDetails,
    });
  })
);

router.post(
  "/deposits",
  requireAuth,
  proofUpload.single("proof"),
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const method = "BANK_TRANSFER";
    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, message: "Deposit amount must be at least NGN 1,000." });
      return;
    }

    const providedReference = String(req.body.reference || "").trim();
    const reference =
      providedReference || `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const existing = await prisma.deposit.findUnique({ where: { reference } }).catch(() => null);
    if (existing) {
      res.status(409).json({ success: false, message: "A deposit with this reference already exists." });
      return;
    }

    const deposit = await prisma.deposit.create({
      data: {
        userId: req.user.id,
        amount,
        method,
        reference,
        proofText: req.body.proofText || "",
        proofFileUrl: publicUploadPath(req.file),
        proofFileName: req.file?.originalname,
      },
    });

    await sendEmail(req.user.email, "depositPending", { amount });
    res.status(201).json({ success: true, deposit: depositDto(deposit) });
  })
);

router.post(
  "/deposits/bank",
  requireAuth,
  proofUpload.single("proof"),
  asyncHandler(async (req, res) => {
    req.body.method = "BANK_TRANSFER";
    const amount = Number(req.body.amount);
    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, message: "Deposit amount must be at least NGN 1,000." });
      return;
    }
    const reference = String(req.body.reference || `BANK-${Date.now()}`).trim();
    const duplicate = await prisma.deposit.findUnique({ where: { reference } }).catch(() => null);
    if (duplicate) {
      res.status(409).json({ success: false, message: "A deposit with this reference already exists." });
      return;
    }
    const deposit = await prisma.deposit.create({
      data: {
        userId: req.user.id,
        amount,
        method: "BANK_TRANSFER",
        reference,
        proofText: req.body.proofText || "Bank payment submitted.",
        proofFileUrl: publicUploadPath(req.file),
        proofFileName: req.file?.originalname,
      },
    });
    await sendEmail(req.user.email, "depositPending", { amount });
    res.status(201).json({ success: true, deposit: depositDto(deposit), bankDetails });
  })
);

router.get(
  "/deposits/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const deposits = await prisma.deposit.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, deposits: deposits.map(depositDto) });
  })
);

export default router;
