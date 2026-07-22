import rateLimit from "express-rate-limit";

function sensitiveLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });
}

export const registrationLimiter = sensitiveLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: "Too many registration requests. Please try again later.",
});

export const verificationLimiter = sensitiveLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  message: "Too many verification attempts. Please try again later.",
});

export const resendLimiter = sensitiveLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  message: "Too many code requests. Please try again later.",
});

export const passwordResetLimiter = sensitiveLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: "Too many password reset requests. Please try again later.",
});

export const loginLimiter = sensitiveLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Please try again later.",
});

export const checkoutLimiter = sensitiveLimiter({
  windowMs: 60 * 1000,
  limit: 12,
  message: "Too many checkout attempts. Please wait before trying again.",
});

export const paymentLimiter = sensitiveLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: "Too many payment requests. Please try again later.",
});
