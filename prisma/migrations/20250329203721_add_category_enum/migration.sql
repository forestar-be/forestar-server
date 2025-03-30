/*
  Warnings:

  - The `category` column on the `RobotInventory` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('ROBOT', 'ANTENNA', 'PLUGIN');

-- AlterTable
ALTER TABLE "RobotInventory" DROP COLUMN "category",
ADD COLUMN     "category" "InventoryCategory" NOT NULL DEFAULT 'ROBOT';
