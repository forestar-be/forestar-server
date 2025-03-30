/*
  Warnings:

  - You are about to drop the column `antennaType` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `pluginType` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "antennaType",
DROP COLUMN "pluginType";
