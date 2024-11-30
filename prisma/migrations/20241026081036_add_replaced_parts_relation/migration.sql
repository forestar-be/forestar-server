/*
  Warnings:

  - You are about to drop the column `replaced_part_list` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "replaced_part_list";

-- CreateTable
CREATE TABLE "_MachineRepairReplacedParts" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_MachineRepairReplacedParts_AB_unique" ON "_MachineRepairReplacedParts"("A", "B");

-- CreateIndex
CREATE INDEX "_MachineRepairReplacedParts_B_index" ON "_MachineRepairReplacedParts"("B");

-- AddForeignKey
ALTER TABLE "_MachineRepairReplacedParts" ADD CONSTRAINT "_MachineRepairReplacedParts_A_fkey" FOREIGN KEY ("A") REFERENCES "MachineRepair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MachineRepairReplacedParts" ADD CONSTRAINT "_MachineRepairReplacedParts_B_fkey" FOREIGN KEY ("B") REFERENCES "ReplacedParts"("name") ON DELETE CASCADE ON UPDATE CASCADE;
