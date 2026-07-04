import { prisma } from "../src/prisma.js";

const counts = await prisma.$transaction(async (tx) => {
  const orderItems = await tx.orderItem.deleteMany({});
  const favorites = await tx.favorite.deleteMany({});
  const reviews = await tx.review.deleteMany({});
  const products = await tx.product.deleteMany({});

  return {
    orderItems: orderItems.count,
    favorites: favorites.count,
    reviews: reviews.count,
    services: products.count,
  };
});

console.log(
  JSON.stringify(
    {
      message: "Marketplace services cleared.",
      table: "Product",
      counts,
    },
    null,
    2
  )
);

await prisma.$disconnect();
