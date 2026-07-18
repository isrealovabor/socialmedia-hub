-- Remove the retired referral feature while preserving users and orders.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referrerId_fkey";
DROP INDEX IF EXISTS "User_referralCode_key";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "referralCode",
  DROP COLUMN IF EXISTS "referrerId",
  DROP COLUMN IF EXISTS "referralEarnings";

ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "referralBonusPaid";

-- Remove Bitcoin deposit configuration and transaction-hash storage. Existing
-- deposit rows remain available as historical accounting records.
ALTER TABLE "AppSetting"
  DROP COLUMN IF EXISTS "btcWalletAddress",
  DROP COLUMN IF EXISTS "referralBonus",
  DROP COLUMN IF EXISTS "referralEnabled",
  DROP COLUMN IF EXISTS "bitcoinDepositEnabled";

ALTER TABLE "Deposit"
  DROP COLUMN IF EXISTS "transactionHash";
