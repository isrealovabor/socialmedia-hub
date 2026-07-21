import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts. Please try again soon." },
});

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
