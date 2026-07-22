import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { productDto } from "../utils/format.js";
import { validateOpaqueParam, validateSlugParam } from "../middleware/params.js";

const router = Router();
router.param("id", validateOpaqueParam);
router.param("slug", validateSlugParam);

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
    } = req.query;
    const queryTerm = optionalQueryText(q, "q", 100);
    const platformName = optionalQueryText(platform, "platform", 100);
    const minimumPrice = optionalPrice(minPrice, "minPrice");
    const maximumPrice = optionalPrice(maxPrice, "maxPrice");
    if (!['newest', 'price', 'popularity', 'stock'].includes(String(sort))) {
      throw new ApiError(400, "Invalid product sort option.");
    }
    if (minimumPrice !== undefined && maximumPrice !== undefined && minimumPrice > maximumPrice) {
      throw new ApiError(400, "minPrice cannot exceed maxPrice.");
    }
    const where = {
      isActive: true,
      status: "ACTIVE",
      stock: { gt: 0 },
      ...(platformName ? { platform: { contains: platformName } } : {}),
      ...(minimumPrice !== undefined || maximumPrice !== undefined
        ? {
            price: {
              ...(minimumPrice !== undefined ? { gte: minimumPrice } : {}),
              ...(maximumPrice !== undefined ? { lte: maximumPrice } : {}),
            },
          }
        : {}),
    };

    if (queryTerm) {
      const term = queryTerm;
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

function optionalQueryText(value, field, maxLength) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) throw new ApiError(400, `Invalid ${field}.`);
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength) throw new ApiError(400, `Invalid ${field}.`);
  return normalized;
}

function optionalPrice(value, field) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) throw new ApiError(400, `Invalid ${field}.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100_000_000) {
    throw new ApiError(400, `Invalid ${field}.`);
  }
  return number;
}

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
