-- Convert any legacy seller accounts back to ordinary customer accounts before
-- removing the multi-vendor fields.
UPDATE "User" SET "role" = 'USER' WHERE "role" = 'SELLER';

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sellerId_fkey";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "sellerId";

DROP TABLE IF EXISTS "Withdrawal";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "sellerStatus",
  DROP COLUMN IF EXISTS "sellerEarnings";

ALTER TABLE "AppSetting"
  DROP COLUMN IF EXISTS "bankName",
  DROP COLUMN IF EXISTS "bankAccountName",
  DROP COLUMN IF EXISTS "bankAccountNumber",
  DROP COLUMN IF EXISTS "minimumWithdrawalAmount",
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS "automaticDeliveryEnabled" BOOLEAN NOT NULL DEFAULT true;
