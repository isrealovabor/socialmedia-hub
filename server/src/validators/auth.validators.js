import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset token is invalid."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});
