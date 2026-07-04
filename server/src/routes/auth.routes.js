import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { sendEmail } from "../utils/email.js";
import { makeReferralCode } from "../utils/referrals.js";
import { validate } from "../utils/validation.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validators.js";

const router = Router();

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT secret is not configured.");
  }
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sellerStatus: user.sellerStatus,
    walletBalance: Number(user.walletBalance || 0),
    sellerEarnings: Number(user.sellerEarnings || 0),
    referralCode: user.referralCode,
    referralEarnings: Number(user.referralEarnings || 0),
  };
}

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const referrer = req.body.referralCode
      ? await prisma.user.findUnique({ where: { referralCode: req.body.referralCode.toUpperCase() } })
      : null;
    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        referralCode: makeReferralCode(req.body.name),
        referrerId: referrer?.id,
      },
    });

    await sendEmail(user.email, "welcome", { name: user.name });
    res.status(201).json({ success: true, token: signToken(user), user: authUser(user) });
  })
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const valid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password.");
    }

    res.json({ success: true, token: signToken(user), user: authUser(user) });
  })
);

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, user: req.publicUser });
});

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash,
          resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${token}`;
      await sendEmail(user.email, "passwordReset", { resetUrl });
    }
    res.json({ success: true, message: "If that email exists, a reset link has been sent." });
  })
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const resetTokenHash = crypto.createHash("sha256").update(req.body.token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { resetTokenHash, resetTokenExpires: { gt: new Date() } },
    });
    if (!user) throw new ApiError(400, "Reset link is invalid or expired.");
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpires: null },
    });
    res.json({ success: true, message: "Password reset successfully." });
  })
);

export default router;
