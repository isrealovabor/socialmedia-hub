import assert from "node:assert/strict";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must point to an isolated migrated PostgreSQL test database.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL || testDatabaseUrl;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "inventory-test-secret-with-at-least-32-characters";
process.env.AUTH_CODE_SECRET ||= "inventory-test-code-secret-with-at-least-32-characters";
process.env.CLIENT_URL ||= "http://127.0.0.1:5173";
process.env.SMTP_HOST = "";
process.env.PAYSTACK_SECRET_KEY = "";

const { default: app } = await import("../index.js");
const { prisma } = await import("../src/prisma.js");
const { checkoutOrder } = await import("../src/services/checkout.js");
const { setEmailSenderForTests } = await import("../src/utils/email.js");

const marker = `inventory-test-${Date.now()}`;
const categoryId = `${marker}-category`;
const mainProductId = `${marker}-main`;
const raceProductId = `${marker}-race`;
const failedProductId = `${marker}-failed`;
const secondUserId = `${marker}-user-2`;
const thirdUserId = `${marker}-user-3`;
let server;
let verificationCode;

setEmailSenderForTests(async ({ templateName, params }) => {
  if (templateName === "verifyEmail") verificationCode = params.code;
  return { sent: true };
});

try {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const email = `${marker}@example.com`;
  const password = "Inventory123!";

  const registration = await jsonRequest(`${baseUrl}/auth/register`, {
    method: "POST",
    body: { email, password },
  });
  assert.equal(registration.status, 202);
  assert.match(verificationCode, /^\d{6}$/);
  const verification = await jsonRequest(`${baseUrl}/auth/verify-email`, {
    method: "POST",
    body: { email, code: verificationCode },
  });
  assert.equal(verification.status, 201);
  assert.equal(verification.data.user.email, email);
  assert.equal(verification.data.user.name, null);
  const userId = verification.data.user.id;
  const token = verification.data.token;

  await prisma.user.update({ where: { id: userId }, data: { walletBalance: 10000 } });
  await prisma.user.createMany({
    data: [
      { id: secondUserId, name: null, email: `${marker}-2@example.com`, passwordHash: "test", walletBalance: 10000 },
      { id: thirdUserId, name: null, email: `${marker}-3@example.com`, passwordHash: "test", walletBalance: 10000 },
    ],
  });
  await prisma.category.create({ data: { id: categoryId, name: "Inventory Test", slug: marker, icon: "IT" } });

  await createProductWithInventory(mainProductId, categoryId, 2);
  const first = await checkoutOrder({
    userId,
    items: [{ productId: mainProductId, quantity: 1 }],
    idempotencyKey: `${marker}-first`,
  });
  assert.equal(first.replayed, false);
  assert.equal(first.order.items[0].deliveries.length, 1);
  await assertInventory(mainProductId, { available: 1, sold: 1, stock: 1 });

  const deliveredId = first.order.items[0].deliveries[0].id;
  const delivered = await prisma.productDeliveryFile.findUnique({ where: { id: deliveredId } });
  assert.equal(delivered.status, "SOLD");
  assert.equal(delivered.orderItemId, first.order.items[0].id);

  await checkoutOrder({
    userId,
    items: [{ productId: mainProductId, quantity: 1 }],
    idempotencyKey: `${marker}-final`,
  });
  await assertInventory(mainProductId, { available: 0, sold: 2, stock: 0 });
  const unavailable = await jsonRequest(`${baseUrl}/products/${mainProductId}`);
  assert.equal(unavailable.status, 404);

  const replay = await checkoutOrder({
    userId,
    items: [{ productId: mainProductId, quantity: 1 }],
    idempotencyKey: `${marker}-first`,
  });
  assert.equal(replay.replayed, true);
  await assertInventory(mainProductId, { available: 0, sold: 2, stock: 0 });

  await createProductWithInventory(failedProductId, categoryId, 1);
  const failedPaymentReference = `${marker}-unverified`;
  await prisma.paymentTransaction.create({
    data: { userId, provider: "PAYSTACK", reference: failedPaymentReference, amount: 1000 },
  });
  const unverified = await jsonRequest(
    `${baseUrl}/payments/paystack/verify/${failedPaymentReference}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(unverified.status, 400);
  await assertInventory(failedProductId, { available: 1, sold: 0, stock: 1 });

  const webhookReference = `${marker}-webhook`;
  const walletBeforeWebhook = await walletBalance(userId);
  await prisma.paymentTransaction.create({
    data: { userId, provider: "PAYSTACK", reference: webhookReference, amount: 500 },
  });
  process.env.PAYSTACK_SECRET_KEY = "inventory-webhook-secret";
  const webhookBody = JSON.stringify({
    event: "charge.success",
    data: { reference: webhookReference, amount: 50000 },
  });
  const { createHmac } = await import("node:crypto");
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(webhookBody).digest("hex");
  const webhookOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
    rawBody: webhookBody,
  };
  assert.equal((await jsonRequest(`${baseUrl}/payments/paystack/webhook`, webhookOptions)).status, 200);
  assert.equal((await jsonRequest(`${baseUrl}/payments/paystack/webhook`, webhookOptions)).status, 200);
  assert.equal((await walletBalance(userId)) - walletBeforeWebhook, 500);
  assert.equal(await prisma.deposit.count({ where: { providerReference: webhookReference } }), 1);
  await assertInventory(failedProductId, { available: 1, sold: 0, stock: 1 });

  await createProductWithInventory(raceProductId, categoryId, 1);
  const raceResults = await Promise.allSettled([
    checkoutOrder({
      userId: secondUserId,
      items: [{ productId: raceProductId, quantity: 1 }],
      idempotencyKey: `${marker}-race-1`,
    }),
    checkoutOrder({
      userId: thirdUserId,
      items: [{ productId: raceProductId, quantity: 1 }],
      idempotencyKey: `${marker}-race-2`,
    }),
  ]);
  assert.equal(raceResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(raceResults.filter((result) => result.status === "rejected").length, 1);
  await assertInventory(raceProductId, { available: 0, sold: 1, stock: 0 });
  assert.equal(
    await prisma.orderItem.count({ where: { productId: raceProductId } }),
    1
  );

  console.log("Inventory flow verification passed.");
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.productDeliveryFile.deleteMany({ where: { productId: { in: [mainProductId, raceProductId, failedProductId] } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: marker } } }).catch(() => {});
  await prisma.paymentTransaction.deleteMany({ where: { reference: { startsWith: marker } } }).catch(() => {});
  await prisma.deposit.deleteMany({ where: { reference: { startsWith: marker } } }).catch(() => {});
  await prisma.product.deleteMany({ where: { id: { in: [mainProductId, raceProductId, failedProductId] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { OR: [{ id: { in: [secondUserId, thirdUserId] } }, { email: { startsWith: marker } }] } }).catch(() => {});
  await prisma.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
  const testSchema = new URL(testDatabaseUrl).searchParams.get("schema");
  if (process.env.TEST_DROP_SCHEMA === "true") {
    if (!testSchema?.startsWith("codex_inventory_test_")) {
      throw new Error("Refusing to drop a test schema without the codex_inventory_test_ prefix.");
    }
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  }
  await prisma.$disconnect();
}

async function createProductWithInventory(id, categoryId, count) {
  return prisma.product.create({
    data: {
      id,
      categoryId,
      title: `Inventory product ${id}`,
      description: "Isolated inventory verification product.",
      price: 100,
      stock: count,
      platform: "Inventory Test",
      deliveryTime: "Instant",
      deliveryType: "INSTANT_DOWNLOAD",
      deliveryFiles: {
        create: Array.from({ length: count }, (_, index) => ({
          fileUrl: `/test/${id}-${index}.txt`,
          fileName: `${id}-${index}.txt`,
        })),
      },
    },
  });
}

async function assertInventory(productId, expected) {
  const [available, sold, product] = await Promise.all([
    prisma.productDeliveryFile.count({ where: { productId, status: "AVAILABLE" } }),
    prisma.productDeliveryFile.count({ where: { productId, status: "SOLD" } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  assert.deepEqual({ available, sold, stock: product.stock }, expected);
}

async function walletBalance(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return Number(user.walletBalance);
}

async function jsonRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(url, { method: options.method || "GET", headers, body });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
