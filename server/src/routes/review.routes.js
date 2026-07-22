import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { reviewDto } from "../utils/format.js";
import { validate } from "../utils/validation.js";
import { validateOpaqueParam } from "../middleware/params.js";

const router = Router();
router.param("productId", validateOpaqueParam);

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(1000),
});

router.get(
  "/products/:productId/reviews",
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId, isActive: true },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, reviews: reviews.map(reviewDto) });
  })
);

router.post(
  "/products/:productId/reviews",
  requireAuth,
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const verifiedOrder = await prisma.order.findFirst({
      where: {
        userId: req.user.id,
        status: "COMPLETED",
        items: { some: { productId: req.params.productId } },
      },
    });
    if (!verifiedOrder) {
      throw new ApiError(403, "Only verified buyers can review this product.");
    }

    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: req.user.id, productId: req.params.productId } },
      update: { rating: req.body.rating, comment: req.body.comment, isActive: true },
      create: {
        userId: req.user.id,
        productId: req.params.productId,
        rating: req.body.rating,
        comment: req.body.comment,
      },
      include: { user: true },
    });
    res.status(201).json({ success: true, review: reviewDto(review) });
  })
);

export default router;
