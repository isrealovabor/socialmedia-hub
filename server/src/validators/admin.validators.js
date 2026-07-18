import { z } from "zod";

const formBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens."),
  icon: z.string().trim().min(1).max(8),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const productCreateSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  price: z.coerce.number().min(1),
  stock: z.coerce.number().int().min(0),
  platform: z.string().trim().min(2),
  deliveryTime: z.string().trim().min(2),
  deliveryType: z.string().trim().min(2).default("SERVICE"),
  deliveryInstructions: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  imageName: z.string().optional().nullable(),
  status: z.string().trim().default("ACTIVE"),
  rating: z.coerce.number().min(0).max(5).default(4.8),
  orderCount: z.coerce.number().int().min(0).default(0),
  isActive: formBoolean.optional().default(true),
});

export const productUpdateSchema = productCreateSchema.partial();
