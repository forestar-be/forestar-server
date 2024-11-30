/*
  Warnings:

  - Added the required column `machine_brand` to the `MachineRepair` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MachineRepair" ADD COLUMN     "machine_brand" TEXT NOT NULL,
ADD COLUMN     "repairer_name" TEXT,
ADD COLUMN     "warranty" BOOLEAN;

-- CreateTable
CREATE TABLE "Repairer" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Repairer_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repairer_name_key" ON "Repairer"("name");
