/*
  Warnings:

  - You are about to drop the column `with_shipping` on the `MachineRented` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "with_shipping" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MachineRented" DROP COLUMN "with_shipping";
