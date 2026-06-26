-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- AlterTable
ALTER TABLE "DailyMenu" ADD COLUMN     "publicSlug" TEXT,
DROP COLUMN "cutoffTime",
ADD COLUMN     "cutoffTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DailyMenuThali" ADD COLUMN     "minSabjiRequired" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "nameGu" TEXT;

-- AlterTable
ALTER TABLE "Thali" ADD COLUMN     "nameGu" TEXT;

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThaliSabjiProduct" (
    "id" TEXT NOT NULL,
    "thaliId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThaliSabjiProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "cutoffTime" TEXT,
    "thaliIds" TEXT[],
    "sabjiConfig" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_number_key" ON "AppUser"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ThaliSabjiProduct_thaliId_productId_key" ON "ThaliSabjiProduct"("thaliId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuTemplate_name_key" ON "MenuTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_publicSlug_key" ON "DailyMenu"("publicSlug");

-- AddForeignKey
ALTER TABLE "ThaliSabjiProduct" ADD CONSTRAINT "ThaliSabjiProduct_thaliId_fkey" FOREIGN KEY ("thaliId") REFERENCES "Thali"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThaliSabjiProduct" ADD CONSTRAINT "ThaliSabjiProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
