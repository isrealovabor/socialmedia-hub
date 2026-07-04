ALTER TABLE "User" ADD COLUMN "sellerStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "sellerEarnings" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referrerId" TEXT;
ALTER TABLE "User" ADD COLUMN "referralEarnings" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpires" DATETIME;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

ALTER TABLE "Product" ADD COLUMN "sellerId" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "provider" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "providerReference" TEXT;
CREATE UNIQUE INDEX "Deposit_providerReference_key" ON "Deposit"("providerReference");

ALTER TABLE "Order" ADD COLUMN "discountAmount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "couponId" TEXT;
ALTER TABLE "Order" ADD COLUMN "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Withdrawal" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "accountName" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "discountValue" DECIMAL NOT NULL,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiryDate" DATETIME,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "minimumOrderAmount" DECIMAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "CouponUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "couponId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "discountAmount" DECIMAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CouponUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AppSetting" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'site',
  "siteName" TEXT NOT NULL DEFAULT 'SocialHub Market',
  "supportEmail" TEXT NOT NULL DEFAULT 'support@socialhub.test',
  "bankName" TEXT NOT NULL DEFAULT 'Moniepoint',
  "bankAccountName" TEXT NOT NULL DEFAULT 'SocialHub Market Ltd',
  "bankAccountNumber" TEXT NOT NULL DEFAULT 'XXXXXXXXXX',
  "btcWalletAddress" TEXT NOT NULL DEFAULT 'bc1qsocialhubmarketdevwallet0000000000',
  "referralBonus" DECIMAL NOT NULL DEFAULT 1000,
  "referralEnabled" BOOLEAN NOT NULL DEFAULT true,
  "minimumWithdrawalAmount" DECIMAL NOT NULL DEFAULT 5000,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "paystackEnabled" BOOLEAN NOT NULL DEFAULT false,
  "flutterwaveEnabled" BOOLEAN NOT NULL DEFAULT false,
  "bitcoinDepositEnabled" BOOLEAN NOT NULL DEFAULT true,
  "manualBankTransferEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupportMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");

INSERT OR IGNORE INTO "AppSetting" ("id") VALUES ('site');
