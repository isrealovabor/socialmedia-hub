import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { publicUser } from "../utils/format.js";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.query.access_token || null;

  if (!token) {
    throw new ApiError(401, "Authentication is required.");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new ApiError(401, "User session is no longer valid.");
    }
    req.user = user;
    req.publicUser = publicUser(user);
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired session.");
  }
});

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    next(new ApiError(403, "Admin access is required."));
    return;
  }
  next();
}
