import { z } from "zod";

export const depositSchema = z.object({
  amount: z.coerce.number().min(1000, "Deposit amount must be at least NGN 1,000.").max(10_000_000),
  method: z.literal("BANK_TRANSFER").optional().default("BANK_TRANSFER"),
  reference: z.string().trim().max(120).optional().default(""),
  proofText: z.string().trim().max(500).optional().default(""),
});
