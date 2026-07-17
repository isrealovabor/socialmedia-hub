ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "deliveryFileName" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryFileUrl" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryInstructions" TEXT;

CREATE TABLE IF NOT EXISTS "ProductDeliveryFile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDeliveryFile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductDeliveryFile_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "Product"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);