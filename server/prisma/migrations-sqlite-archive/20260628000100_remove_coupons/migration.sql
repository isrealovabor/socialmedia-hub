PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "totalAmount" DECIMAL NOT NULL,
  "discountAmount" DECIMAL NOT NULL DEFAULT 0,
  "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "deliveryFileUrl" TEXT,
  "deliveryFileName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Order" (
  "id",
  "orderNumber",
  "userId",
  "totalAmount",
  "discountAmount",
  "referralBonusPaid",
  "status",
  "deliveryFileUrl",
  "deliveryFileName",
  "createdAt",
  "updatedAt",
  "completedAt"
)
SELECT
  "id",
  "orderNumber",
  "userId",
  "totalAmount",
  "discountAmount",
  "referralBonusPaid",
  "status",
  "deliveryFileUrl",
  "deliveryFileName",
  "createdAt",
  "updatedAt",
  "completedAt"
FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

DROP TABLE IF EXISTS "CouponUsage";
DROP TABLE IF EXISTS "Coupon";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
