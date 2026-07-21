import { z } from "zod";

const strongPassword = z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .regex(/[a-z]/, "Password must contain a lowercase letter.")
    .regex(/[A-Z]/, "Password must contain an uppercase letter.")
    .regex(/[0-9]/, "Password must contain a number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character.");

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  password: strongPassword,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
});

const verificationCode = z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code.");

export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  code: verificationCode,
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
});

export const verifyResetCodeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  code: verificationCode,
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(20, "Reset session is invalid."),
  password: strongPassword,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});
