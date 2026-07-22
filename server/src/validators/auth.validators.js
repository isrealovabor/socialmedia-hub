import { z } from "zod";
import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from "../utils/passwordPolicy.js";

export const strongPassword = z.string().refine(passwordMeetsPolicy, {
  message: PASSWORD_POLICY_MESSAGE,
});

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
