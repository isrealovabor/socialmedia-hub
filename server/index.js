import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { authLimiter } from "./src/middleware/rateLimit.js";
import { errorHandler, notFound } from "./src/middleware/error.js";
import authRoutes from "./src/routes/auth.routes.js";
import productRoutes from "./src/routes/product.routes.js";
import walletRoutes from "./src/routes/wallet.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import favoriteRoutes from "./src/routes/favorite.routes.js";
import reviewRoutes from "./src/routes/review.routes.js";
import paymentRoutes, {
  flutterwaveWebhookHandler,
  korapayWebhookHandler,
  paystackWebhookHandler,
} from "./src/routes/payment.routes.js";
import sellerRoutes from "./src/routes/seller.routes.js";
import managementRoutes from "./src/routes/management.routes.js";
import { pathToFileURL } from "node:url";

const helmetModule = await import("helmet").catch(() => null);

const app = express();
const port = process.env.PORT || 4000;
const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    process.env.CLIENT_URL,
  ].filter(Boolean)
);

function isAllowedOrigin(origin) {
  if (allowedOrigins.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin);
}

if (helmetModule?.default) {
  app.use(helmetModule.default());
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked request from ${origin}`));
    },
  })
);
app.post("/api/payments/paystack/webhook", express.raw({ type: "application/json" }), paystackWebhookHandler);
app.post("/api/payments/flutterwave/webhook", express.raw({ type: "application/json" }), flutterwaveWebhookHandler);
app.post("/api/payments/korapay/webhook", express.raw({ type: "application/json" }), korapayWebhookHandler);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads/products", express.static(path.resolve("uploads/products")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "SocialHub Market API" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", productRoutes);
app.use("/api", walletRoutes);
app.use("/api", orderRoutes);
app.use("/api", notificationRoutes);
app.use("/api", favoriteRoutes);
app.use("/api", reviewRoutes);
app.use("/api", paymentRoutes);
app.use("/api", sellerRoutes);
app.use("/api", managementRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = app.listen(port, () => {
    console.log(`SocialHub Market API listening on port ${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Close the other server or set PORT to another value in server/.env.`
      );
      process.exit(1);
    }
    throw error;
  });
}
