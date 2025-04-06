/*
  Warnings:

  - You are about to drop the `InventoryPlan_backup` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "fuelLevel" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "lastMeasurementUpdate" TIMESTAMP(3),
ADD COLUMN     "operatingHours" DOUBLE PRECISION;

-- DropTable
DROP TABLE "InventoryPlan_backup";
