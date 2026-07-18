import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { productDto } from "../utils/format.js";

const router = Router();

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json({ categories });
  })
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const {
      q,
      platform,
      minPrice,
      maxPrice,
      sort = "newest",
      stock,
    } = req.query;
    const where = {
      isActive: true,
      status: "ACTIVE",
      stock: { gt: 0 },
      ...(platform ? { platform: { contains: String(platform) } } : {}),
      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice ? { gte: Number(minPrice) } : {}),
              ...(maxPrice ? { lte: Number(maxPrice) } : {}),
            },
          }
        : {}),
    };

    if (q) {
      const term = String(q);
      where.OR = [
        { title: { contains: term } },
        { platform: { contains: term } },
        { category: { name: { contains: term } } },
      ];
    }

    const orderBy =
      sort === "price"
        ? { price: "asc" }
        : sort === "popularity"
          ? { orderCount: "desc" }
          : sort === "stock"
            ? { stock: "desc" }
            : { createdAt: "desc" };

    const products = await prisma.product.findMany({
      where,
      include: { category: true, reviews: { where: { isActive: true } } },
      orderBy,
    });
    res.json({ products: products.map(productDto) });
  })
);

router.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, isActive: true, status: "ACTIVE", stock: { gt: 0 } },
      include: { category: true, reviews: { where: { isActive: true }, include: { user: true } } },
    });
    if (!product) {
      throw new ApiError(404, "Product not found.");
    }
    res.json({ product: productDto(product) });
  })
);

router.get(
  "/categories/:slug/products",
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        products: {
          where: { isActive: true, status: "ACTIVE", stock: { gt: 0 } },
          include: { reviews: { where: { isActive: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }
    res.json({
      category,
      products: category.products.map((product) => productDto({ ...product, category })),
    });
  })
);

export default router;
