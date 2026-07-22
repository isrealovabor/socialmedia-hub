import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../utils/errors.js";

const uploadRoot = path.resolve("uploads");
for (const folder of ["proofs", "products", "deliveries", "branding"]) {
  fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
}

const allowedDeliveryExtensions = new Set([".jpg", ".jpeg", ".png", ".pdf", ".zip", ".txt"]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png"]);
const allowedBrandingExtensions = new Set([".jpg", ".jpeg", ".png", ".ico"]);

function extensionOf(file) {
  return path.extname(file.originalname || "").toLowerCase();
}

function isAllowedDeliveryFile(file) {
  const extension = extensionOf(file);
  const mimeTypes = {
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".pdf": ["application/pdf"],
    ".zip": ["application/zip", "application/x-zip-compressed"],
    ".txt": ["text/plain"],
  };
  return allowedDeliveryExtensions.has(extension) && mimeTypes[extension]?.includes(file.mimetype);
}

function isAllowedImageFile(file) {
  const extension = extensionOf(file);
  return allowedImageExtensions.has(extension) && (extension === ".png" ? file.mimetype === "image/png" : file.mimetype === "image/jpeg");
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
    const extension = extensionOf(file);
    const validMime = extension === ".png"
      ? file.mimetype === "image/png"
      : [".jpg", ".jpeg"].includes(extension)
        ? file.mimetype === "image/jpeg"
        : extension === ".ico" && ["image/x-icon", "image/vnd.microsoft.icon", "application/octet-stream"].includes(file.mimetype);
    if (!validMime || !allowedBrandingExtensions.has(extension)) {
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

export function verifyUploadedFiles(req, res, next) {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
  ];
  try {
    for (const file of files) verifyFileSignature(file);
    next();
  } catch (error) {
    for (const file of files) {
      if (file?.path) fs.rmSync(file.path, { force: true });
    }
    next(error);
  }
}

function verifyFileSignature(file) {
  const extension = extensionOf(file);
  const bytes = fs.readFileSync(file.path);
  const hex = bytes.subarray(0, 12).toString("hex");
  const valid =
    ([".jpg", ".jpeg"].includes(extension) && hex.startsWith("ffd8ff")) ||
    (extension === ".png" && hex.startsWith("89504e470d0a1a0a")) ||
    (extension === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") ||
    (extension === ".zip" && ["504b0304", "504b0506", "504b0708"].some((signature) => hex.startsWith(signature))) ||
    (extension === ".ico" && hex.startsWith("00000100")) ||
    (extension === ".txt" && !bytes.includes(0) && Buffer.from(bytes.toString("utf8"), "utf8").equals(bytes));
  if (!valid) throw new ApiError(400, "The uploaded file content does not match its extension and MIME type.");
}
