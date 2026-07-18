-- Registration no longer asks for or requires a display name.
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;

-- Treat every delivery file as one individual stock record.
ALTER TABLE "ProductDeliveryFile"
  ADD COLUMN "orderItemId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "reservedAt" TIMESTAMP(3),
  ADD COLUMN "soldAt" TIMESTAMP(3);

ALTER TABLE "ProductDeliveryFile"
  ADD CONSTRAINT "ProductDeliveryFile_status_check"
  CHECK ("status" IN ('AVAILABLE', 'RESERVED', 'SOLD'));

ALTER TABLE "ProductDeliveryFile"
  ADD CONSTRAINT "ProductDeliveryFile_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProductDeliveryFile_productId_status_idx"
  ON "ProductDeliveryFile"("productId", "status");

CREATE INDEX "ProductDeliveryFile_orderItemId_idx"
  ON "ProductDeliveryFile"("orderItemId");

-- Conservatively assign existing inventory to historical completed purchases
-- before calculating what can still be sold.
WITH sold_units AS (
  SELECT
    item."id" AS "orderItemId",
    item."productId",
    COALESCE("order"."completedAt", "order"."updatedAt") AS "soldAt",
    ROW_NUMBER() OVER (
      PARTITION BY item."productId"
      ORDER BY COALESCE("order"."completedAt", "order"."updatedAt"), item."id", unit."number"
    ) AS "position"
  FROM "OrderItem" AS item
  JOIN "Order" AS "order" ON "order"."id" = item."orderId"
  CROSS JOIN LATERAL generate_series(1, item."quantity") AS unit("number")
  WHERE "order"."status" = 'COMPLETED'
),
inventory_units AS (
  SELECT
    inventory."id",
    inventory."productId",
    ROW_NUMBER() OVER (
      PARTITION BY inventory."productId"
      ORDER BY inventory."createdAt", inventory."id"
    ) AS "position"
  FROM "ProductDeliveryFile" AS inventory
),
assignments AS (
  SELECT inventory."id", sold."orderItemId", sold."soldAt"
  FROM inventory_units AS inventory
  JOIN sold_units AS sold
    ON sold."productId" = inventory."productId"
   AND sold."position" = inventory."position"
)
UPDATE "ProductDeliveryFile" AS inventory
SET "status" = 'SOLD',
    "orderItemId" = assignments."orderItemId",
    "reservedAt" = assignments."soldAt",
    "soldAt" = assignments."soldAt"
FROM assignments
WHERE inventory."id" = assignments."id";

-- Product.stock is a cached public count derived only from AVAILABLE records.
UPDATE "Product" AS product
SET "stock" = (
  SELECT COUNT(*)::INTEGER
  FROM "ProductDeliveryFile" AS inventory
  WHERE inventory."productId" = product."id"
    AND inventory."status" = 'AVAILABLE'
);
