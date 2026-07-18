import app from "../index.js";
import { PrismaClient } from "../src/generated/marketplace_step4/index.js";

const prisma = new PrismaClient();
const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const email = `israel-${Date.now()}@test.com`;
const password = "Password123!";

async function request(path, options = {}) {
  const headers = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };
  let body;
  if (options.form) {
    body = options.form;
  } else if (options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    method: options.method || "GET",
    body,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { raw: await response.text().catch(() => "") };
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${data.message || "No JSON error"}`);
  }
  return data;
}

try {
  const register = await request("/auth/register", {
    method: "POST",
    body: { name: "Israel", email, password },
  });
  if (!register.success || !register.token || register.user.email !== email) {
    throw new Error("Register did not return the expected success payload.");
  }

  const duplicate = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Israel", email, password }),
  });
  if (duplicate.status !== 409) {
    throw new Error("Duplicate email registration was not rejected.");
  }

  const login = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.success || !login.token || login.user.email !== email) {
    throw new Error("Login did not return the expected success payload.");
  }

  const me = await request("/auth/me", { token: login.token });
  if (!me.success || me.user.email !== email) {
    throw new Error("JWT /auth/me verification failed.");
  }

  const wallet = await request("/wallet", { token: login.token });
  if (typeof wallet.balance !== "number") {
    throw new Error("Wallet route did not return a numeric balance.");
  }

  const depositForm = new FormData();
  depositForm.append("amount", "100000");
  depositForm.append("reference", `BANK-${Date.now()}`);
  depositForm.append("proof", new Blob(["Proof PDF"], { type: "application/pdf" }), "proof.pdf");
  const deposit = await request("/deposits/bank", {
    method: "POST",
    token: login.token,
    form: depositForm,
  });
  if (deposit.deposit.status !== "PENDING") {
    throw new Error("Deposit was not created as pending.");
  }

  const admin = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@socialhub.test", password: "Admin123!" },
  });

  await request(`/admin/deposits/${deposit.deposit.id}/approve`, {
    method: "PATCH",
    token: admin.token,
  });

  const creditedWallet = await request("/wallet", { token: login.token });
  if (creditedWallet.availableBalance < 100000) {
    throw new Error("Approved deposit was not added to wallet.");
  }

  const categories = await request("/categories");
  const productForm = new FormData();
  productForm.append("categoryId", categories.categories[0].id);
  productForm.append("title", `Test Service Package ${Date.now()}`);
  productForm.append("description", "Legal digital marketing service package for automated test coverage.");
  productForm.append("price", "2500");
  productForm.append("stock", "5");
  productForm.append("platform", categories.categories[0].name);
  productForm.append("deliveryTime", "24h");
  productForm.append("deliveryType", "INSTANT_DOWNLOAD");
  productForm.append("status", "ACTIVE");
  productForm.append("image", new Blob(["png"], { type: "image/png" }), "product.png");
  productForm.append("deliveryFile", new Blob(["Instant delivery test file"], { type: "text/plain" }), "instant-delivery.txt");
  const createdProduct = await request("/admin/products", {
    method: "POST",
    token: admin.token,
    form: productForm,
  });
  if (!createdProduct.product.imageUrl || !createdProduct.product.deliveryFileUrl) {
    throw new Error("Product image or delivery upload did not set file URLs.");
  }

  await request(`/favorites/${createdProduct.product.id}`, {
    method: "POST",
    token: login.token,
  });
  const favorites = await request("/favorites", { token: login.token });
  if (!favorites.favorites.length) {
    throw new Error("Favorite product was not saved.");
  }

  const order = await request("/orders", {
    method: "POST",
    token: login.token,
    body: { items: [{ productId: createdProduct.product.id, quantity: 1 }] },
  });
  if (!order.order.orderNumber || order.order.status !== "COMPLETED" || !order.order.deliveryFileUrl) {
    throw new Error("Checkout did not instantly complete and unlock the order.");
  }

  const link = await request(`/orders/${order.order.id}/download-link`, { token: login.token });
  const download = await fetch(`${baseUrl.replace(/\/api$/, "")}${link.url}`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  if (!download.ok) {
    throw new Error("Protected delivery download failed.");
  }

  const review = await request(`/products/${createdProduct.product.id}/reviews`, {
    method: "POST",
    token: login.token,
    body: { rating: 5, comment: "Helpful service package." },
  });
  if (review.review.rating !== 5) {
    throw new Error("Verified buyer review was not created.");
  }

  const notifications = await request("/notifications", { token: login.token });
  if (!notifications.notifications.length) {
    throw new Error("Notifications were not created.");
  }

  console.log("Marketplace flow works: auth, wallet, deposits, admin approval, checkout, delivery, notifications, favorites, and reviews.");
} finally {
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
}
