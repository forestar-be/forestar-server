/*
  Warnings:

  - You are about to drop the column `idCardBackId` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `idCardFrontId` on the `MachineRental` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRental" DROP COLUMN "idCardBackId",
DROP COLUMN "idCardFrontId";
