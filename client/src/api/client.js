import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";
const ASSET_URL = API_URL.replace(/\/api\/?$/, "");
const TOKEN_KEY = "socialhub_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function assetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ASSET_URL}${path}`;
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function apiRequest(path, options = {}) {
  try {
    const isForm = options.data instanceof FormData;
    const response = await api.request({
      url: path,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : options.data,
      headers: isForm ? options.headers : options.headers,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Request failed.";
    throw new Error(message);
  }
}

export const authApi = {
  register: (payload) => apiRequest("/auth/register", { method: "POST", data: payload }),
  login: (payload) => apiRequest("/auth/login", { method: "POST", data: payload }),
  me: () => apiRequest("/auth/me"),
  forgotPassword: (payload) => apiRequest("/auth/forgot-password", { method: "POST", data: payload }),
  resetPassword: (payload) => apiRequest("/auth/reset-password", { method: "POST", data: payload }),
};

export const catalogApi = {
  categories: () => apiRequest("/categories"),
  products: (params = {}) => apiRequest(`/products${queryString(params)}`),
  product: (id) => apiRequest(`/products/${id}`),
  categoryProducts: (slug) => apiRequest(`/categories/${slug}/products`),
  reviews: (productId) => apiRequest(`/products/${productId}/reviews`),
  createReview: (productId, payload) =>
    apiRequest(`/products/${productId}/reviews`, { method: "POST", data: payload }),
};

export const walletApi = {
  wallet: () => apiRequest("/wallet"),
  deposits: () => apiRequest("/deposits/my"),
  withdrawals: () => apiRequest("/withdrawals/my"),
  depositOptions: () => apiRequest("/deposits/options"),
  createDeposit: (payload) => apiRequest("/deposits", { method: "POST", data: payload }),
  createBankDeposit: (formData) => apiRequest("/deposits/bank", { method: "POST", data: formData }),
  createBitcoinDeposit: (payload) =>
    apiRequest("/deposits/bitcoin", { method: "POST", data: payload }),
};

export const orderApi = {
  checkout: (items) =>
    apiRequest("/orders", {
      method: "POST",
      data: { items },
      headers: { "Idempotency-Key": `SHM-${Date.now()}-${Math.round(Math.random() * 10000)}` },
    }),
  myOrders: () => apiRequest("/orders/my"),
  downloadLink: (id, itemId, fileId) => {
    const query = new URLSearchParams();
    if (itemId) query.set("itemId", itemId);
    if (fileId) query.set("fileId", fileId);
    const text = query.toString();
    return apiRequest(`/orders/${id}/download-link${text ? `?${text}` : ""}`);
  },
  withAccessToken: (path) => `${ASSET_URL}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(getToken() || "")}`,
  downloadUrl: (id) => `${API_URL}/orders/${id}/download?access_token=${encodeURIComponent(getToken() || "")}`,
};

export const paymentApi = {
  initialize: (provider, amount, customerEmail) =>
    apiRequest(`/payments/${provider}/initialize`, { method: "POST", data: { amount, customerEmail } }),
  verify: (provider, reference) => apiRequest(`/payments/${provider}/verify/${reference}`),
};

export const notificationApi = {
  list: () => apiRequest("/notifications"),
  markRead: (id) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiRequest("/notifications/read-all", { method: "PATCH" }),
};

export const favoriteApi = {
  list: () => apiRequest("/favorites"),
  add: (productId) => apiRequest(`/favorites/${productId}`, { method: "POST" }),
  remove: (productId) => apiRequest(`/favorites/${productId}`, { method: "DELETE" }),
};

export const adminApi = {
  users: () => apiRequest("/admin/users"),
  deposits: () => apiRequest("/admin/deposits"),
  approveDeposit: (id) => apiRequest(`/admin/deposits/${id}/approve`, { method: "PATCH" }),
  rejectDeposit: (id) => apiRequest(`/admin/deposits/${id}/reject`, { method: "PATCH" }),
  createCategory: (payload) => apiRequest("/admin/categories", { method: "POST", data: payload }),
  updateCategory: (id, payload) =>
    apiRequest(`/admin/categories/${id}`, { method: "PATCH", data: payload }),
  deleteCategory: (id) => apiRequest(`/admin/categories/${id}`, { method: "DELETE" }),
  products: () => apiRequest("/admin/products"),
  createProduct: (payload) => apiRequest("/admin/products", { method: "POST", data: payload }),
  updateProduct: (id, payload) =>
    apiRequest(`/admin/products/${id}`, { method: "PATCH", data: payload }),
  uploadProductFiles: (id, formData) =>
    apiRequest(`/admin/products/${id}/delivery-files`, { method: "POST", data: formData }),
  deleteProduct: (id) => apiRequest(`/admin/products/${id}`, { method: "DELETE" }),
  enableProduct: (id) => apiRequest(`/admin/products/${id}/enable`, { method: "PATCH" }),
  disableProduct: (id) => apiRequest(`/admin/products/${id}/disable`, { method: "PATCH" }),
  orders: () => apiRequest("/admin/orders"),
  updateOrderStatus: (id, status) =>
    apiRequest(`/admin/orders/${id}/status`, { method: "PATCH", data: { status } }),
  uploadDelivery: (id, formData) =>
    apiRequest(`/admin/orders/${id}/delivery`, { method: "POST", data: formData }),
  proofUrl: (id) => `${API_URL}/admin/deposits/${id}/proof?access_token=${encodeURIComponent(getToken() || "")}`,
  reviews: () => apiRequest("/admin/reviews"),
  deleteReview: (id) => apiRequest(`/admin/reviews/${id}`, { method: "DELETE" }),
  analytics: () => apiRequest("/analytics/admin"),
  settings: () => apiRequest("/admin/settings"),
  updateSettings: (payload) => apiRequest("/admin/settings", { method: "PATCH", data: payload }),
  auditLogs: () => apiRequest("/admin/audit-logs"),
  sellers: () => apiRequest("/admin/sellers"),
  updateSellerStatus: (id, status) => apiRequest(`/admin/sellers/${id}/status`, { method: "PATCH", data: { status } }),
  withdrawals: () => apiRequest("/admin/withdrawals"),
  updateWithdrawal: (id, action) => apiRequest(`/admin/withdrawals/${id}/${action}`, { method: "PATCH" }),
  createSanityListing: (formData) =>
    apiRequest("/admin/sanity-listings", { method: "POST", data: formData }),
};

export const sellerApi = {
  apply: () => apiRequest("/seller/apply", { method: "POST" }),
  analytics: () => apiRequest("/seller/analytics"),
  products: () => apiRequest("/seller/products"),
  createProduct: (formData) => apiRequest("/seller/products", { method: "POST", data: formData }),
  orders: () => apiRequest("/seller/orders"),
  uploadDelivery: (id, formData) => apiRequest(`/seller/orders/${id}/delivery`, { method: "POST", data: formData }),
  requestWithdrawal: (payload) => apiRequest("/seller/withdrawals", { method: "POST", data: payload }),
};

export const ticketApi = {
  list: () => apiRequest("/tickets"),
  create: (payload) => apiRequest("/tickets", { method: "POST", data: payload }),
  message: (id, payload) => apiRequest(`/tickets/${id}/messages`, { method: "POST", data: payload }),
  status: (id, status) => apiRequest(`/tickets/${id}/status`, { method: "PATCH", data: { status } }),
};

function queryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}
