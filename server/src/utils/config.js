export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = [];
  for (const key of ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "AUTH_CODE_SECRET", "CLIENT_URL", "FRONTEND_URL"]) {
    if (!process.env[key]) missing.push(key);
  }
  if ((process.env.JWT_SECRET || "").length < 32) missing.push("JWT_SECRET (minimum 32 characters)");
  if ((process.env.AUTH_CODE_SECRET || "").length < 32) missing.push("AUTH_CODE_SECRET (minimum 32 characters)");
  if (process.env.EMAIL_PROVIDER === "resend" && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM_ADDRESS)) {
    missing.push("RESEND_API_KEY/EMAIL_FROM_ADDRESS");
  }
  for (const key of ["CLIENT_URL", "FRONTEND_URL", "API_PUBLIC_URL"]) {
    const value = process.env[key];
    if (value && !value.startsWith("https://")) missing.push(`${key} (must use HTTPS)`);
  }
  if (missing.length) throw new Error(`Production environment is not safely configured: ${[...new Set(missing)].join(", ")}`);
}
