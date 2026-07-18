export function toNumber(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sellerStatus: user.sellerStatus,
    walletBalance: toNumber(user.walletBalance),
    sellerEarnings: toNumber(user.sellerEarnings),
    createdAt: user.createdAt,
  };
}

export function productDto(product) {
  const {
    deliveryFiles,
    deliveryFileUrl,
    deliveryFileName,
    deliveryInstructions,
    ...publicProduct
  } = product;
  return {
    ...publicProduct,
    price: toNumber(product.price),
    reviews: product.reviews?.map(({ user, ...review }) => ({
      ...review,
      user: user ? { id: user.id, name: user.name } : undefined,
    })),
    category: product.category,
    isFavorite: product.isFavorite,
  };
}

export function managedProductDto(product) {
  return {
    ...productDto(product),
    deliveryInstructions: product.deliveryInstructions,
    deliveryFiles: product.deliveryFiles?.map(inventoryDto),
  };
}

export function inventoryDto(item) {
  return {
    id: item.id,
    fileName: item.fileName,
    status: item.status,
    orderItemId: item.orderItemId,
    reservedAt: item.reservedAt,
    soldAt: item.soldAt,
    createdAt: item.createdAt,
  };
}

export function depositDto(deposit) {
  return {
    ...deposit,
    amount: toNumber(deposit.amount),
    user: deposit.user ? publicUser(deposit.user) : undefined,
  };
}

export function orderDto(order) {
  return {
    ...order,
    totalAmount: toNumber(order.totalAmount),
    discountAmount: toNumber(order.discountAmount),
    user: order.user ? publicUser(order.user) : undefined,
    items: order.items?.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      product: item.product ? productDto(item.product) : undefined,
      deliveries: item.deliveries?.map(inventoryDto),
    })),
  };
}

export function notificationDto(notification) {
  return notification;
}

export function reviewDto(review) {
  return {
    ...review,
    user: review.user ? publicUser(review.user) : undefined,
  };
}
