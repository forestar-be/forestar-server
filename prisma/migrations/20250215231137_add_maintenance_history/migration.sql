/*
  Warnings:

  - You are about to drop the column `last_maintenance_date` on the `MachineRented` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRented" DROP COLUMN "last_maintenance_date";

-- CreateTable
CREATE TABLE "MaintenanceHistory" (
    "id" SERIAL NOT NULL,
    "machineRentedId" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MaintenanceHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaintenanceHistory" ADD CONSTRAINT "MaintenanceHistory_machineRentedId_fkey" FOREIGN KEY ("machineRentedId") REFERENCES "MachineRented"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
