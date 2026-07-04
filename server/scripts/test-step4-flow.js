import crypto from "node:crypto";
import app from "../index.js";
import { prisma } from "../src/prisma.js";

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const email = `step4-${Date.now()}@test.com`;
const sellerEmail = `seller-${Date.now()}@test.com`;
const password = "Password123!";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${data.message || "No JSON error"}`);
  return data;
}

try {
  const admin = await request("/auth/login", { method: "POST", body: { email: "admin@socialhub.test", password: "Admin123!" } });

  const userReg = await request("/auth/register", { method: "POST", body: { name: "Step Four", email, password } });
  const userToken = userReg.token;
  await request("/auth/forgot-password", { method: "POST", body: { email } });
  const dbUser = await prisma.user.findUnique({ where: { email } });
  const resetToken = "manual-test-token-123456789";
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      resetTokenHash: crypto.createHash("sha256").update(resetToken).digest("hex"),
      resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await request("/auth/reset-password", { method: "POST", body: { token: resetToken, password: "Password456!" } });

  const payment = await request("/payments/paystack/initialize", { method: "POST", token: userToken, body: { amount: 25000 } });
  await request(`/payments/paystack/verify/${payment.reference}`, { token: userToken });
  const wallet = await request("/wallet", { token: userToken });
  if (wallet.availableBalance < 25000) throw new Error("Paystack dev verification did not credit wallet.");

  const products = await request("/products");
  await request("/orders", {
    method: "POST",
    token: userToken,
    body: { items: [{ productId: products.products[0].id, quantity: 1 }] },
  });

  const sellerReg = await request("/auth/register", { method: "POST", body: { name: "Seller Test", email: sellerEmail, password } });
  await request("/seller/apply", { method: "POST", token: sellerReg.token });
  const seller = await prisma.user.findUnique({ where: { email: sellerEmail } });
  await request(`/admin/sellers/${seller.id}/status`, { method: "PATCH", token: admin.token, body: { status: "APPROVED" } });
  const sellerLogin = await request("/auth/login", { method: "POST", body: { email: sellerEmail, password } });
  await request("/seller/analytics", { token: sellerLogin.token });
  await request("/seller/withdrawals", {
    method: "POST",
    token: sellerLogin.token,
    body: { amount: 1, bankName: "Test Bank", accountName: "Seller Test", accountNumber: "0000000000" },
  }).catch(async () => {
    await prisma.user.update({ where: { id: seller.id }, data: { sellerEarnings: 10000 } });
    await request("/seller/withdrawals", {
      method: "POST",
      token: sellerLogin.token,
      body: { amount: 1000, bankName: "Test Bank", accountName: "Seller Test", accountNumber: "0000000000" },
    });
  });
  const withdrawals = await request("/admin/withdrawals", { token: admin.token });
  await request(`/admin/withdrawals/${withdrawals.withdrawals[0].id}/approve`, { method: "PATCH", token: admin.token });

  const ticket = await request("/tickets", { method: "POST", token: userToken, body: { subject: "Help", message: "Need support" } });
  await request(`/tickets/${ticket.ticket.id}/messages`, { method: "POST", token: admin.token, body: { message: "We can help." } });
  await request(`/tickets/${ticket.ticket.id}/status`, { method: "PATCH", token: admin.token, body: { status: "CLOSED" } });
  await request("/analytics/admin", { token: admin.token });
  await request("/admin/settings", { token: admin.token });
  const logs = await request("/admin/audit-logs", { token: admin.token });
  if (!logs.logs.length) throw new Error("Audit logs were not created.");
  console.log("Step 4 flow works: reset, payments, seller, withdrawals, tickets, analytics, settings, and audit logs.");
} finally {
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
}
