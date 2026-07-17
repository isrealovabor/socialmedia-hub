ALTER TABLE "User" ADD COLUMN "totalSpent" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "deliveryType" TEXT NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageName" TEXT;
ALTER TABLE "Product" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Deposit" ADD COLUMN "proofFileUrl" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "transactionHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryFileUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryFileName" TEXT;
ALTER TABLE "Order" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Order" ADD COLUMN "completedAt" DATETIME;

UPDATE "Order"
SET "orderNumber" = 'SHM-2026' || substr('000000' || rowid, -6, 6)
WHERE "orderNumber" IS NULL;

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
