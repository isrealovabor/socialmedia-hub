import crypto from "node:crypto";
import { ApiError } from "./errors.js";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

function codeSecret() {
  const secret = process.env.AUTH_CODE_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, "Authentication code security is not configured.");
  }
  return secret;
}

export function generateSixDigitCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashAuthCode({ email, purpose, code }) {
  return crypto
    .createHmac("sha256", codeSecret())
    .update(`${purpose}:${String(email).toLowerCase()}:${code}`)
    .digest("hex");
}

export function authCodeMatches({ storedHash, email, purpose, code }) {
  if (!storedHash || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const candidate = hashAuthCode({ email, purpose, code });
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(storedHash, "hex"));
}

export function codeExpiresAt(now = Date.now()) {
  return new Date(now + CODE_TTL_MS);
}

export function resendIsCoolingDown(lastSentAt, now = Date.now()) {
  return Boolean(lastSentAt && now - new Date(lastSentAt).getTime() < CODE_RESEND_COOLDOWN_MS);
}
