/*
  Warnings:

  - You are about to drop the column `fuelLevel` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `lastMeasurementUpdate` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `lastMeasurementUser` on the `MachineRental` table. All the data in the column will be lost.
  - You are about to drop the column `operatingHours` on the `MachineRental` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRental" DROP COLUMN "fuelLevel",
DROP COLUMN "lastMeasurementUpdate",
DROP COLUMN "lastMeasurementUser",
DROP COLUMN "operatingHours";

-- AlterTable
ALTER TABLE "MachineRented" ADD COLUMN     "fuelLevel" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "lastMeasurementUpdate" TIMESTAMP(3),
ADD COLUMN     "lastMeasurementUser" TEXT,
ADD COLUMN     "operatingHours" DOUBLE PRECISION;
