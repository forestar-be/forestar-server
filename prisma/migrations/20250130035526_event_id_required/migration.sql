/*
  Warnings:

  - Made the column `eventId` on table `MachineRental` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MachineRental" ALTER COLUMN "eventId" SET NOT NULL;
