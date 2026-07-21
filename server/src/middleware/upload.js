import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../utils/errors.js";

const uploadRoot = path.resolve("uploads");
for (const folder of ["proofs", "products", "deliveries", "branding"]) {
  fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
}

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "text/plain",
]);

const allowedDeliveryExtensions = new Set([".jpg", ".jpeg", ".png", ".pdf", ".zip", ".txt"]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png"]);
const allowedBrandingExtensions = new Set([".jpg", ".jpeg", ".png", ".ico"]);

function extensionOf(file) {
  return path.extname(file.originalname || "").toLowerCase();
}

function isAllowedDeliveryFile(file) {
  return allowed.has(file.mimetype) && allowedDeliveryExtensions.has(extensionOf(file));
}

function isAllowedImageFile(file) {
  return ["image/jpeg", "image/png", "application/octet-stream"].includes(file.mimetype) && allowedImageExtensions.has(extensionOf(file));
}

function storage(folder) {
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, path.join(uploadRoot, folder));
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

function fileFilter(req, file, cb) {
  if (!isAllowedDeliveryFile(file)) {
    cb(new ApiError(400, "Unsupported file type. Upload JPG, PNG, PDF, ZIP, or TXT files only."));
    return;
  }
  cb(null, true);
}

export const proofUpload = multer({
  storage: storage("proofs"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const productImageUpload = multer({
  storage: storage("products"),
  fileFilter(req, file, cb) {
    if (!isAllowedImageFile(file)) {
      cb(new ApiError(400, "Product images must be JPG or PNG."));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 3 * 1024 * 1024 },
});

export const productAssetUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, path.join(uploadRoot, file.fieldname === "image" ? "products" : "deliveries"));
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    if (file.fieldname === "image" && !isAllowedImageFile(file)) {
      cb(new ApiError(400, "Product images must be JPG or PNG."));
      return;
    }
    if ((file.fieldname === "deliveryFile" || file.fieldname === "deliveryFiles") && !isAllowedDeliveryFile(file)) {
      cb(new ApiError(400, "Delivery files must be JPG, PNG, PDF, ZIP, or TXT."));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const deliveryUpload = multer({
  storage: storage("deliveries"),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const brandingUpload = multer({
  storage: storage("branding"),
  fileFilter(req, file, cb) {
    const validMime = ["image/jpeg", "image/png", "image/x-icon", "image/vnd.microsoft.icon", "application/octet-stream"].includes(file.mimetype);
    if (!validMime || !allowedBrandingExtensions.has(extensionOf(file))) {
      cb(new ApiError(400, "Brand assets must be JPG, PNG, or ICO files."));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

export function publicUploadPath(file) {
  if (!file) return null;
  const normalized = file.path.replaceAll("\\", "/");
  const marker = "/uploads/";
  const index = normalized.lastIndexOf(marker);
  return index >= 0 ? normalized.slice(index) : `/uploads/${file.filename}`;
}
