/*
  Warnings:

  - You are about to drop the column `shelterPrice` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `shelterType` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "InstallationTextType" AS ENUM ('TITLE', 'SUBTITLE', 'SUBTITLE2', 'PARAGRAPH');

-- AlterEnum
ALTER TYPE "InventoryCategory" ADD VALUE 'SHELTER';

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "shelterPrice",
DROP COLUMN "shelterType",
ADD COLUMN     "hasPlacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shelterInventoryId" INTEGER;

-- CreateTable
CREATE TABLE "InstallationPreparationText" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "type" "InstallationTextType" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationPreparationText_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_shelterInventoryId_fkey" FOREIGN KEY ("shelterInventoryId") REFERENCES "RobotInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
