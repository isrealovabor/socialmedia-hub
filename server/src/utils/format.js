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
    referralCode: user.referralCode,
    referralEarnings: toNumber(user.referralEarnings),
    createdAt: user.createdAt,
  };
}

export function productDto(product) {
  return {
    ...product,
    price: toNumber(product.price),
    reviews: product.reviews,
    category: product.category,
    isFavorite: product.isFavorite,
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
