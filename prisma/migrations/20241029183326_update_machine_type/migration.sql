/*
  Warnings:

  - You are about to drop the column `machine_type` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "machine_type",
ADD COLUMN     "machine_type_name" TEXT;

-- CreateTable
CREATE TABLE "MachineType" (
    "name" TEXT NOT NULL,

    CONSTRAINT "MachineType_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineType_name_key" ON "MachineType"("name");

-- AddForeignKey
ALTER TABLE "MachineRepair" ADD CONSTRAINT "MachineRepair_machine_type_name_fkey" FOREIGN KEY ("machine_type_name") REFERENCES "MachineType"("name") ON DELETE SET NULL ON UPDATE CASCADE;
