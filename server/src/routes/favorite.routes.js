import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validateOpaqueParam } from "../middleware/params.js";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { productDto } from "../utils/format.js";

const router = Router();
router.param("productId", validateOpaqueParam);

router.get(
  "/favorites",
  requireAuth,
  asyncHandler(async (req, res) => {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      success: true,
      favorites: favorites.map((favorite) => ({
        ...favorite,
        product: productDto({ ...favorite.product, isFavorite: true }),
      })),
    });
  })
);

router.post(
  "/favorites/:productId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, isActive: true, status: "ACTIVE" },
    });
    if (!product) throw new ApiError(404, "Product not found.");

    const favorite = await prisma.favorite.upsert({
      where: { userId_productId: { userId: req.user.id, productId: req.params.productId } },
      update: {},
      create: { userId: req.user.id, productId: req.params.productId },
    });
    res.status(201).json({ success: true, favorite });
  })
);

router.delete(
  "/favorites/:productId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.favorite
      .delete({ where: { userId_productId: { userId: req.user.id, productId: req.params.productId } } })
      .catch(() => null);
    res.json({ success: true, message: "Product removed from wishlist." });
  })
);

export default router;
