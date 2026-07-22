import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { depositDto } from "../utils/format.js";
import { sendEmail } from "../utils/email.js";
import { auditLog } from "../utils/audit.js";
import { paymentLimiter } from "../middleware/rateLimit.js";
import { validateOpaqueParam } from "../middleware/params.js";

const router = Router();
router.param("reference", validateOpaqueParam);

const supportedProviders = ["PAYSTACK", "FLUTTERWAVE", "KORAPAY"];

export const paystackWebhookHandler = asyncHandler(async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new ApiError(500, "Paystack secret key is not configured.");
  if (!signature) throw new ApiError(401, "Missing Paystack signature.");

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const providedSignature = Buffer.from(String(signature));
  const expectedSignature = Buffer.from(expected);
  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new ApiError(401, "Invalid Paystack signature.");
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  if (event.event !== "charge.success") {
    res.json({ received: true, ignored: true });
    return;
  }

  const reference = event.data?.reference;
  if (!reference) throw new ApiError(400, "Invalid Paystack webhook payload.");
  const result = await approveVerifiedPayment("PAYSTACK", reference);
  res.json({ received: true, duplicate: result.replayed, deposit: depositDto(result.deposit) });
});

export const flutterwaveWebhookHandler = asyncHandler(async (req, res) => {
  const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (!secretHash) throw new ApiError(500, "Flutterwave webhook secret hash is not configured.");
  if (!safeSecretEqual(req.headers["verif-hash"], secretHash)) throw new ApiError(401, "Invalid Flutterwave webhook signature.");

  const event = parseRawJson(req.body);
  if (!["charge.completed", "charge.successful"].includes(String(event.event))) {
    res.json({ received: true, ignored: true });
    return;
  }

  const payment = event.data || {};
  const reference = payment.tx_ref || payment.reference;
  if (!reference || String(payment.status).toLowerCase() !== "successful") {
    throw new ApiError(400, "Invalid Flutterwave webhook payload.");
  }
  const result = await approveVerifiedPayment("FLUTTERWAVE", reference);
  res.json({ received: true, duplicate: result.replayed, deposit: depositDto(result.deposit) });
});

export const korapayWebhookHandler = asyncHandler(async (req, res) => {
  const secret = process.env.KORAPAY_WEBHOOK_SECRET || process.env.KORAPAY_SECRET_KEY;
  if (!secret) throw new ApiError(500, "Korapay webhook secret is not configured.");

  const event = parseRawJson(req.body);
  const signature = req.headers["x-korapay-signature"];
  if (!signature) throw new ApiError(401, "Missing Korapay signature.");
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(event.data || {})).digest("hex");
  if (!safeSecretEqual(signature, expected)) throw new ApiError(401, "Invalid Korapay webhook signature.");
  const eventName = String(event.event || event.name || "").toLowerCase();
  if (eventName && !eventName.includes("charge")) {
    res.json({ received: true, ignored: true });
    return;
  }

  const payment = event.data || {};
  const reference = payment.payment_reference || payment.reference || payment.transaction_reference;
  const status = String(payment.status || "").toLowerCase();
  if (!reference || !["success", "successful"].includes(status)) {
    throw new ApiError(400, "Invalid Korapay webhook payload.");
  }
  const result = await approveVerifiedPayment("KORAPAY", reference);
  res.json({ received: true, duplicate: result.replayed, deposit: depositDto(result.deposit) });
});

router.post(
  "/payments/:provider/initialize",
  requireAuth,
  paymentLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toUpperCase();
    if (!supportedProviders.includes(provider)) throw new ApiError(400, "Unsupported payment provider.");
    if (!providerSecretKey(provider)) throw new ApiError(503, `${provider} payments are not configured.`);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1000 || amount > 10_000_000) throw new ApiError(400, "Amount must be between NGN 1,000 and NGN 10,000,000.");
    const customerEmail = req.user.email;

    const reference = `${provider.slice(0, 3)}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    await prisma.paymentTransaction.create({
      data: { userId: req.user.id, provider, reference, amount, metadata: JSON.stringify({ email: customerEmail, currency: "NGN" }) },
    });

    const checkout = await initializeProviderPayment(provider, {
      amount,
      reference,
      email: customerEmail,
      name: req.user.name || req.user.email.split("@")[0],
    });
    const key = providerPublicKey(provider);
    res.status(201).json({
      success: true,
      provider,
      reference,
      publicKey: key || "",
      authorizationUrl: checkout.authorizationUrl,
      devMode: checkout.devMode,
      message: checkout.message,
    });
  })
);

router.get(
  "/payments/:provider/verify/:reference",
  requireAuth,
  paymentLimiter,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toUpperCase();
    const tx = await prisma.paymentTransaction.findUnique({ where: { reference: req.params.reference } });
    if (!tx || tx.userId !== req.user.id || tx.provider !== provider) throw new ApiError(404, "Payment not found.");
    if (tx.status === "SUCCESS") {
      const deposit = await prisma.deposit.findUnique({ where: { providerReference: tx.reference } });
      res.json({ success: true, deposit: deposit ? depositDto(deposit) : null });
      return;
    }

    const result = await approveVerifiedPayment(provider, tx.reference);
    res.json({ success: true, deposit: depositDto(result.deposit), replayed: result.replayed });
  })
);

export async function approvePaymentTransaction(id) {
  return prisma.$transaction(async (db) => {
    const claimed = await db.paymentTransaction.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    const current = await db.paymentTransaction.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, "Payment not found.");
    if (claimed.count === 0) {
      const existing = await db.deposit.findUnique({ where: { providerReference: current.reference } });
      if (current.status === "SUCCESS" && existing) return { deposit: existing, replayed: true };
      throw new ApiError(409, "Payment verification is already being processed.");
    }

    const created = await db.deposit.create({
      data: {
        userId: current.userId,
        amount: current.amount,
        method: current.provider,
        status: "APPROVED",
        reference: current.reference,
        provider: current.provider,
        providerReference: current.reference,
        proofText: `${current.provider} verified payment`,
      },
    });
    await db.user.update({ where: { id: current.userId }, data: { walletBalance: { increment: current.amount } } });
    await db.paymentTransaction.update({ where: { id: current.id }, data: { status: "SUCCESS" } });
    await auditLog({ userId: current.userId, action: "PAYMENT_VERIFIED", entityType: "PaymentTransaction", entityId: current.id, metadata: { provider: current.provider, reference: current.reference } }, db);
    return { deposit: created, replayed: false };
  });
}

async function approveVerifiedPayment(provider, reference) {
  const tx = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!tx || tx.provider !== provider) throw new ApiError(404, "Payment transaction not found.");
  const verified = await verifyProviderPayment(provider, reference);
  validateVerifiedPayment(tx, verified);
  const result = await approvePaymentTransaction(tx.id);
  if (!result.replayed) {
    const user = await prisma.user.findUnique({ where: { id: tx.userId } });
    await sendEmail(user?.email, "depositApproved", { amount: Number(tx.amount) });
  }
  return result;
}

async function initializeProviderPayment(provider, { amount, reference, email, name }) {
  const secret = providerSecretKey(provider);
  if (!secret) {
    throw new ApiError(503, `${provider} payments are not configured.`);
  }

  const redirectUrl = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || "https://socialhubmarket.com"}/deposit?provider=${provider.toLowerCase()}&reference=${encodeURIComponent(reference)}`;
  const request = providerInitializeRequest(provider, { amount, reference, email, name, redirectUrl });
  const response = await fetch(request.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.body),
  }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  if (!response?.ok) {
    const providerMessage = data?.message || data?.error || `${provider} checkout initialization failed.`;
    const emailHint = provider === "PAYSTACK" ? ` Email sent to Paystack: ${email}.` : "";
    throw new ApiError(response?.status || 502, `${providerMessage}${emailHint}`);
  }

  return {
    authorizationUrl: providerCheckoutUrl(provider, data),
    devMode: false,
    message: `${provider} checkout initialized.`,
  };
}

function providerInitializeRequest(provider, { amount, reference, email, name, redirectUrl }) {
  if (provider === "PAYSTACK") {
    return {
      url: "https://api.paystack.co/transaction/initialize",
      body: {
        email,
        amount: Math.round(amount * 100),
        reference,
        callback_url: redirectUrl,
        metadata: { name },
      },
    };
  }

  if (provider === "FLUTTERWAVE") {
    return {
      url: "https://api.flutterwave.com/v3/payments",
      body: {
        tx_ref: reference,
        amount,
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: { email, name },
        customizations: {
          title: "SocialHub Market Deposit",
          description: "Wallet deposit",
        },
      },
    };
  }

  return {
    url: "https://api.korapay.com/merchant/api/v1/charges/initialize",
    body: {
      reference,
      amount,
      currency: "NGN",
      redirect_url: redirectUrl,
      customer: { name, email },
    },
  };
}

function providerCheckoutUrl(provider, data) {
  if (provider === "PAYSTACK") return data?.data?.authorization_url || null;
  if (provider === "FLUTTERWAVE") return data?.data?.link || null;
  return data?.data?.checkout_url || data?.data?.payment_link || data?.data?.url || null;
}

async function verifyProviderPayment(provider, reference) {
  const secret = providerSecretKey(provider);
  if (!secret) throw new ApiError(503, `${provider} payments are not configured.`);
  const url = providerVerifyUrl(provider, reference);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } }).catch(() => null);
  if (!response?.ok) throw new ApiError(400, "Payment could not be verified with the provider.");
  const data = await response.json();
  const payment = data?.data || {};
  if (provider === "PAYSTACK") {
    return { status: payment.status, reference: payment.reference, amount: Number(payment.amount || 0) / 100, currency: payment.currency, email: payment.customer?.email };
  }
  if (provider === "FLUTTERWAVE") {
    return { status: payment.status, reference: payment.tx_ref, amount: Number(payment.amount || 0), currency: payment.currency, email: payment.customer?.email };
  }
  const kora = payment.data || payment;
  return { status: kora.status || kora.transaction_status, reference: kora.payment_reference || kora.reference, amount: Number(kora.amount_paid || kora.amount || 0), currency: kora.currency, email: kora.customer?.email };
}

function validateVerifiedPayment(tx, verified) {
  const metadata = safeMetadata(tx.metadata);
  const validStatus = ["success", "successful"].includes(String(verified.status || "").toLowerCase());
  const amountMatches = Math.abs(Number(verified.amount) - Number(tx.amount)) < 0.01;
  const currencyMatches = String(verified.currency || "").toUpperCase() === String(metadata.currency || "NGN").toUpperCase();
  const referenceMatches = verified.reference === tx.reference;
  const emailMatches = !verified.email || String(verified.email).toLowerCase() === String(metadata.email || "").toLowerCase();
  if (!validStatus || !amountMatches || !currencyMatches || !referenceMatches || !emailMatches) {
    throw new ApiError(400, "Verified payment details do not match the pending transaction.");
  }
}

function safeMetadata(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function safeSecretEqual(provided, expected) {
  if (!provided || !expected) return false;
  const left = Buffer.from(String(provided));
  const right = Buffer.from(String(expected));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function providerVerifyUrl(provider, reference) {
  if (provider === "PAYSTACK") return `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  if (provider === "FLUTTERWAVE") return `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  return `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`;
}

function providerSecretKey(provider) {
  if (provider === "PAYSTACK") return process.env.PAYSTACK_SECRET_KEY;
  if (provider === "FLUTTERWAVE") return process.env.FLW_SECRET_KEY;
  return process.env.KORAPAY_SECRET_KEY;
}

function providerPublicKey(provider) {
  if (provider === "PAYSTACK") return process.env.PAYSTACK_PUBLIC_KEY;
  if (provider === "FLUTTERWAVE") return process.env.FLW_PUBLIC_KEY;
  return process.env.KORAPAY_PUBLIC_KEY;
}

function parseRawJson(body) {
  return Buffer.isBuffer(body) ? JSON.parse(body.toString("utf8")) : body || {};
}

export default router;
