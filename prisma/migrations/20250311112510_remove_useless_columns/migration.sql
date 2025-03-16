/*
  Warnings:

  - You are about to drop the column `termsEmailSentAt` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `termsPdfId` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `termsSignedAt` on the `MachineRental` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRental" DROP COLUMN "termsEmailSentAt",
DROP COLUMN "termsPdfId",
DROP COLUMN "termsSignedAt";
