import { z } from "zod";

export const depositSchema = z.object({
  amount: z.coerce.number().min(1000, "Deposit amount must be at least NGN 1,000."),
  method: z.enum(["BANK_TRANSFER", "BITCOIN"]),
  reference: z.string().trim().max(120).optional().default(""),
  transactionHash: z.string().trim().max(160).optional().default(""),
  proofText: z.string().trim().max(500).optional().default(""),
});
