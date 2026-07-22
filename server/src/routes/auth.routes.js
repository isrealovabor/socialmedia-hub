import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  passwordResetLimiter,
  loginLimiter,
  registrationLimiter,
  resendLimiter,
  verificationLimiter,
} from "../middleware/rateLimit.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { emailDeliveryIsConfigured, sendEmail } from "../utils/email.js";
import {
  authCodeMatches,
  codeExpiresAt,
  generateSixDigitCode,
  hashAuthCode,
  MAX_CODE_ATTEMPTS,
  resendIsCoolingDown,
} from "../utils/authCodes.js";
import { validate } from "../utils/validation.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyResetCodeSchema,
} from "../validators/auth.validators.js";

const router = Router();
const GENERIC_REGISTRATION_MESSAGE = "If this email can be registered, a verification code has been sent.";
const GENERIC_RESET_MESSAGE = "If that email exists, a password reset code has been sent.";
const INVALID_CODE_MESSAGE = "The code is invalid or expired. Request a new code and try again.";

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new ApiError(500, "JWT secret is not configured.");
  return process.env.JWT_SECRET;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, sv: user.sessionVersion },
    jwtSecret(),
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

function signResetTicket(token) {
  return jwt.sign(
    { sub: token.userId, tid: token.id, purpose: "password-reset" },
    jwtSecret(),
    { expiresIn: "10m", algorithm: "HS256" }
  );
}

function authUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletBalance: Number(user.walletBalance || 0),
  };
}

function requireEmailDelivery() {
  if (!emailDeliveryIsConfigured()) {
    throw new ApiError(503, "Email delivery is temporarily unavailable.");
  }
}

async function cleanupExpiredAuthRecords() {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await Promise.all([
    prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lt: staleBefore } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: staleBefore } } }),
  ]);
}

async function preserveGenericResponseTiming(startedAt, minimumMs = 350) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

router.post(
  "/register",
  registrationLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    requireEmailDelivery();
    await cleanupExpiredAuthRecords();
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      await preserveGenericResponseTiming(startedAt);
      res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE, cooldownSeconds: 60 });
      return;
    }

    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
    if (resendIsCoolingDown(pending?.lastSentAt)) {
      await preserveGenericResponseTiming(startedAt);
      res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE, cooldownSeconds: 60 });
      return;
    }

    const code = generateSixDigitCode();
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        codeHash: hashAuthCode({ email, purpose: "verify-email", code }),
        expiresAt: codeExpiresAt(),
        lastSentAt: now,
      },
      update: {
        passwordHash,
        codeHash: hashAuthCode({ email, purpose: "verify-email", code }),
        expiresAt: codeExpiresAt(),
        attemptCount: 0,
        lastSentAt: now,
      },
    });

    try {
      await sendEmail(email, "verifyEmail", { code }, { required: true });
    } catch (error) {
      await prisma.pendingRegistration.deleteMany({ where: { email } });
      throw error;
    }

    res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE, cooldownSeconds: 60 });
  })
);

router.post(
  "/resend-verification",
  resendLimiter,
  validate(resendVerificationSchema),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    requireEmailDelivery();
    await cleanupExpiredAuthRecords();
    const { email } = req.body;
    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending || resendIsCoolingDown(pending.lastSentAt)) {
      await preserveGenericResponseTiming(startedAt);
      res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE, cooldownSeconds: 60 });
      return;
    }

    const code = generateSixDigitCode();
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        codeHash: hashAuthCode({ email, purpose: "verify-email", code }),
        expiresAt: codeExpiresAt(),
        attemptCount: 0,
        lastSentAt: new Date(),
      },
    });
    try {
      await sendEmail(email, "verifyEmail", { code }, { required: true });
    } catch (error) {
      await prisma.pendingRegistration.deleteMany({ where: { id: pending.id } });
      throw error;
    }
    res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE, cooldownSeconds: 60 });
  })
);

router.post(
  "/verify-email",
  verificationLimiter,
  validate(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
    const now = new Date();
    if (!pending || pending.expiresAt <= now || pending.attemptCount >= MAX_CODE_ATTEMPTS) {
      if (pending) await prisma.pendingRegistration.deleteMany({ where: { id: pending.id } });
      throw new ApiError(400, INVALID_CODE_MESSAGE);
    }

    if (!authCodeMatches({ storedHash: pending.codeHash, email, purpose: "verify-email", code })) {
      await prisma.pendingRegistration.updateMany({
        where: { id: pending.id, attemptCount: { lt: MAX_CODE_ATTEMPTS } },
        data: { attemptCount: { increment: 1 } },
      });
      throw new ApiError(400, INVALID_CODE_MESSAGE);
    }

    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.pendingRegistration.deleteMany({
        where: {
          id: pending.id,
          codeHash: pending.codeHash,
          expiresAt: { gt: now },
          attemptCount: { lt: MAX_CODE_ATTEMPTS },
        },
      });
      if (claimed.count !== 1) throw new ApiError(400, INVALID_CODE_MESSAGE);
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw new ApiError(400, INVALID_CODE_MESSAGE);
      return tx.user.create({
        data: {
          email,
          passwordHash: pending.passwordHash,
          emailVerified: true,
          emailVerifiedAt: now,
        },
      });
    });

    await sendEmail(user.email, "welcome", { name: user.email.split("@")[0] });
    res.status(201).json({ success: true, token: signToken(user), user: authUser(user) });
  })
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password.");
    }
    if (!user.emailVerified) throw new ApiError(403, "Email verification is required before login.");
    if (user.accountStatus !== "ACTIVE") throw new ApiError(403, "This account is not active.");
    res.json({ success: true, token: signToken(user), user: authUser(user) });
  })
);

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, user: req.publicUser });
});

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    requireEmailDelivery();
    await cleanupExpiredAuthRecords();
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await preserveGenericResponseTiming(startedAt);
      res.json({ success: true, message: GENERIC_RESET_MESSAGE, cooldownSeconds: 60 });
      return;
    }

    const latest = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (resendIsCoolingDown(latest?.lastSentAt)) {
      await preserveGenericResponseTiming(startedAt);
      res.json({ success: true, message: GENERIC_RESET_MESSAGE, cooldownSeconds: 60 });
      return;
    }

    const code = generateSixDigitCode();
    const token = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashAuthCode({ email, purpose: "password-reset", code }),
          expiresAt: codeExpiresAt(),
          lastSentAt: new Date(),
        },
      });
    });

    try {
      await sendEmail(email, "passwordResetCode", { code }, { required: true });
    } catch {
      await prisma.passwordResetToken.updateMany({ where: { id: token.id }, data: { usedAt: new Date() } });
    }
    res.json({ success: true, message: GENERIC_RESET_MESSAGE, cooldownSeconds: 60 });
  })
);

router.post(
  "/verify-reset-code",
  verificationLimiter,
  validate(verifyResetCodeSchema),
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new ApiError(400, INVALID_CODE_MESSAGE);
    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, verifiedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    if (!token || token.expiresAt <= now || token.attemptCount >= MAX_CODE_ATTEMPTS) {
      throw new ApiError(400, INVALID_CODE_MESSAGE);
    }
    if (!authCodeMatches({ storedHash: token.tokenHash, email, purpose: "password-reset", code })) {
      await prisma.passwordResetToken.updateMany({
        where: { id: token.id, attemptCount: { lt: MAX_CODE_ATTEMPTS }, usedAt: null },
        data: { attemptCount: { increment: 1 } },
      });
      throw new ApiError(400, INVALID_CODE_MESSAGE);
    }

    const claimed = await prisma.passwordResetToken.updateMany({
      where: {
        id: token.id,
        tokenHash: token.tokenHash,
        usedAt: null,
        verifiedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: MAX_CODE_ATTEMPTS },
      },
      data: { verifiedAt: now },
    });
    if (claimed.count !== 1) throw new ApiError(400, INVALID_CODE_MESSAGE);
    res.json({ success: true, resetToken: signResetTicket(token) });
  })
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = jwt.verify(req.body.resetToken, jwtSecret(), { algorithms: ["HS256"] });
    } catch {
      throw new ApiError(400, "Password reset session is invalid or expired.");
    }
    if (payload.purpose !== "password-reset" || !payload.tid || !payload.sub) {
      throw new ApiError(400, "Password reset session is invalid or expired.");
    }

    const currentUser = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!currentUser || (await bcrypt.compare(req.body.password, currentUser.passwordHash))) {
      throw new ApiError(400, "Choose a password you have not used recently.");
    }
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: payload.tid,
          userId: payload.sub,
          usedAt: null,
          verifiedAt: { not: null },
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ApiError(400, "Password reset session is invalid or expired.");
      await tx.user.update({
        where: { id: payload.sub },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: payload.sub, usedAt: null },
        data: { usedAt: new Date() },
      });
    });
    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  })
);

export default router;
