-- Add isAddOnAvailable column to Product
ALTER TABLE "Product" ADD COLUMN "isAddOnAvailable" BOOLEAN NOT NULL DEFAULT false;

-- Create ProductAddon table
CREATE TABLE "ProductAddon" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("id")
);

-- Unique index: no duplicate add-on name under same product
CREATE UNIQUE INDEX "ProductAddon_productId_name_key" ON "ProductAddon"("productId", "name");

-- Foreign key: cascade on product delete
ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
