import { z } from "zod";

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product is required.").max(64),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(100),
      })
    )
    .min(1, "Cart must contain at least one item.")
    .max(50, "Cart contains too many items."),
});
