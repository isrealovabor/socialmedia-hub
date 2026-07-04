import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { proofUpload, publicUploadPath } from "../middleware/upload.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/errors.js";
import { depositDto, publicUser, toNumber } from "../utils/format.js";
import { bankDetails, bitcoinDetails } from "../../marketplace-config.js";
import { sendEmail } from "../utils/email.js";

const router = Router();

router.get(
  "/wallet",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [pendingDeposits, withdrawals] = await Promise.all([
      prisma.deposit.aggregate({
        where: { userId: req.user.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.withdrawal.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      user: publicUser(req.user),
      availableBalance: toNumber(req.user.walletBalance),
      balance: toNumber(req.user.walletBalance),
      pendingDeposits: toNumber(pendingDeposits._sum.amount || 0),
      totalSpent: toNumber(req.user.totalSpent || 0),
      withdrawals,
      bankDetails,
      bitcoinDetails,
    });
  })
);

router.get("/deposits/options", (req, res) => {
  res.json({ bankDetails, bitcoinDetails });
});

router.post(
  "/deposits",
  requireAuth,
  proofUpload.single("proof"),
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const method = req.body.method || "BANK_TRANSFER";
    if (!amount || amount < 1000) {
      res.status(400).json({ success: false, message: "Deposit amount must be at least NGN 1,000." });
      return;
    }

    const providedReference = String(req.body.reference || req.body.transactionHash || "").trim();
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
        transactionHash: req.body.transactionHash || null,
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

router.post(
  "/deposits/bitcoin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    const transactionHash = String(req.body.transactionHash || "").trim();
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: "BTC amount is required." });
      return;
    }
    if (!transactionHash) {
      res.status(400).json({ success: false, message: "Transaction hash is required." });
      return;
    }
    const duplicate = await prisma.deposit.findFirst({ where: { transactionHash } });
    if (duplicate) {
      res.status(409).json({ success: false, message: "A Bitcoin deposit with this transaction hash already exists." });
      return;
    }
    const deposit = await prisma.deposit.create({
      data: {
        userId: req.user.id,
        amount,
        method: "BITCOIN",
        reference: transactionHash,
        transactionHash,
        proofText: "Bitcoin deposit submitted.",
      },
    });
    await sendEmail(req.user.email, "depositPending", { amount });
    res.status(201).json({ success: true, deposit: depositDto(deposit), bitcoinDetails });
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

router.get(
  "/withdrawals/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, withdrawals, enabled: false });
  })
);

export default router;
