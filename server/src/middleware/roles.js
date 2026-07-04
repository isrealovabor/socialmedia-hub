import { ApiError } from "../utils/errors.js";

export function requireSeller(req, res, next) {
  if (req.user?.role !== "SELLER" && req.user?.role !== "ADMIN") {
    next(new ApiError(403, "Seller access is required."));
    return;
  }
  if (req.user?.role === "SELLER" && req.user?.sellerStatus !== "APPROVED") {
    next(new ApiError(403, "Seller account is not approved."));
    return;
  }
  next();
}
