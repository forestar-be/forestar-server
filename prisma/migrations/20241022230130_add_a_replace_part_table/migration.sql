/*
  Warnings:

  - You are about to drop the column `replaced_part_list` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "replaced_part_list";

-- CreateTable
CREATE TABLE "ReplacedPart" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "machineRepairId" INTEGER NOT NULL,

    CONSTRAINT "ReplacedPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplacedPart_name_key" ON "ReplacedPart"("name");

-- AddForeignKey
ALTER TABLE "ReplacedPart" ADD CONSTRAINT "ReplacedPart_machineRepairId_fkey" FOREIGN KEY ("machineRepairId") REFERENCES "MachineRepair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
