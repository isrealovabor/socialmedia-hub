import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { depositDto } from "../utils/format.js";
import { sendEmail } from "../utils/email.js";

const router = Router();

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

  const payment = event.data || {};
  const reference = payment.reference;
  const amount = Number(payment.amount || 0) / 100;
  if (!reference || !amount) throw new ApiError(400, "Invalid Paystack webhook payload.");

  const tx = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!tx || tx.provider !== "PAYSTACK") {
    res.json({ received: true, ignored: true });
    return;
  }
  if (tx.status === "SUCCESS") {
    res.json({ received: true, duplicate: true });
    return;
  }
  if (amount < Number(tx.amount)) throw new ApiError(400, "Paystack amount does not match transaction.");

  const deposit = await approvePaymentTransaction(tx.id);
  const user = await prisma.user.findUnique({ where: { id: tx.userId } });
  await sendEmail(user?.email, "depositApproved", { amount: Number(tx.amount) });

  res.json({ received: true, deposit: depositDto(deposit) });
});

export const flutterwaveWebhookHandler = asyncHandler(async (req, res) => {
  const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (!secretHash) throw new ApiError(500, "Flutterwave webhook secret hash is not configured.");
  if (req.headers["verif-hash"] !== secretHash) throw new ApiError(401, "Invalid Flutterwave webhook signature.");

  const event = parseRawJson(req.body);
  if (!["charge.completed", "charge.successful"].includes(String(event.event))) {
    res.json({ received: true, ignored: true });
    return;
  }

  const payment = event.data || {};
  const reference = payment.tx_ref || payment.reference;
  const amount = Number(payment.amount || 0);
  if (!reference || !amount || String(payment.status).toLowerCase() !== "successful") {
    throw new ApiError(400, "Invalid Flutterwave webhook payload.");
  }

  const deposit = await approveVerifiedPayment("FLUTTERWAVE", reference, amount);
  res.json({ received: true, deposit: depositDto(deposit) });
});

export const korapayWebhookHandler = asyncHandler(async (req, res) => {
  const secret = process.env.KORAPAY_WEBHOOK_SECRET || process.env.KORAPAY_SECRET_KEY;
  if (!secret) throw new ApiError(500, "Korapay webhook secret is not configured.");

  const signature = req.headers["x-korapay-signature"] || req.headers["korapay-signature"];
  if (signature) {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const providedSignature = Buffer.from(String(signature));
    const expectedSignature = Buffer.from(expected);
    if (
      providedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(providedSignature, expectedSignature)
    ) {
      throw new ApiError(401, "Invalid Korapay webhook signature.");
    }
  }

  const event = parseRawJson(req.body);
  const eventName = String(event.event || event.name || "").toLowerCase();
  if (eventName && !eventName.includes("charge")) {
    res.json({ received: true, ignored: true });
    return;
  }

  const payment = event.data || {};
  const reference = payment.reference || payment.transaction_reference;
  const amount = Number(payment.amount || payment.amount_paid || 0);
  const status = String(payment.status || "").toLowerCase();
  if (!reference || !amount || !["success", "successful"].includes(status)) {
    throw new ApiError(400, "Invalid Korapay webhook payload.");
  }

  const deposit = await approveVerifiedPayment("KORAPAY", reference, amount);
  res.json({ received: true, deposit: depositDto(deposit) });
});

router.post(
  "/payments/:provider/initialize",
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toUpperCase();
    if (!supportedProviders.includes(provider)) throw new ApiError(400, "Unsupported payment provider.");
    if (!providerSecretKey(provider)) throw new ApiError(503, `${provider} payments are not configured.`);
    const amount = Number(req.body.amount);
    if (!amount || amount < 1000) throw new ApiError(400, "Amount must be at least NGN 1,000.");
    const customerEmail = paymentEmail(req.body.customerEmail);

    const reference = `${provider.slice(0, 3)}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    await prisma.paymentTransaction.create({
      data: { userId: req.user.id, provider, reference, amount, metadata: JSON.stringify({ email: customerEmail }) },
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
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toUpperCase();
    const tx = await prisma.paymentTransaction.findUnique({ where: { reference: req.params.reference } });
    if (!tx || tx.userId !== req.user.id || tx.provider !== provider) throw new ApiError(404, "Payment not found.");
    if (tx.status === "SUCCESS") {
      const deposit = await prisma.deposit.findUnique({ where: { providerReference: tx.reference } });
      res.json({ success: true, deposit: deposit ? depositDto(deposit) : null });
      return;
    }

    const verified = await verifyProviderPayment(provider, tx.reference, Number(tx.amount));
    if (!verified) throw new ApiError(400, "Payment could not be verified.");

    const deposit = await approvePaymentTransaction(tx.id);
    await sendEmail(req.user.email, "depositApproved", { amount: Number(tx.amount) });
    res.json({ success: true, deposit: depositDto(deposit) });
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
      if (current.status === "SUCCESS" && existing) return existing;
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
    return created;
  });
}

async function approveVerifiedPayment(provider, reference, amount) {
  const tx = await prisma.paymentTransaction.findUnique({ where: { reference } });
  if (!tx || tx.provider !== provider) throw new ApiError(404, "Payment transaction not found.");
  if (amount < Number(tx.amount)) throw new ApiError(400, `${provider} amount does not match transaction.`);
  const deposit = await approvePaymentTransaction(tx.id);
  const user = await prisma.user.findUnique({ where: { id: tx.userId } });
  await sendEmail(user?.email, "depositApproved", { amount: Number(tx.amount) });
  return deposit;
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

async function verifyProviderPayment(provider, reference, amount) {
  const secret = providerSecretKey(provider);
  if (!secret) return false;
  const url = providerVerifyUrl(provider, reference);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } }).catch(() => null);
  if (!response?.ok) return false;
  const data = await response.json();
  if (provider === "PAYSTACK") return data?.data?.status === "success" && Number(data.data.amount) >= amount * 100;
  if (provider === "FLUTTERWAVE") return data?.data?.status === "successful" && Number(data.data.amount) >= amount;
  return ["success", "successful"].includes(String(data?.data?.status).toLowerCase()) && Number(data?.data?.amount || 0) >= amount;
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

function paymentEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid || email.endsWith(".test")) {
    throw new ApiError(400, "Enter the real email address connected to your account for Paystack payments.");
  }
  return email;
}

function parseRawJson(body) {
  return Buffer.isBuffer(body) ? JSON.parse(body.toString("utf8")) : body || {};
}

export default router;
