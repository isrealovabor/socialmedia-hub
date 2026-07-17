CREATE TABLE "ProductDeliveryFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDeliveryFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ProductDeliveryFile" ("id", "productId", "fileUrl", "fileName", "createdAt")
SELECT
  'pdf_' || "id",
  "id",
  "deliveryFileUrl",
  COALESCE("deliveryFileName", 'delivery-file'),
  CURRENT_TIMESTAMP
FROM "Product"
WHERE "deliveryFileUrl" IS NOT NULL AND "deliveryFileUrl" != '';
