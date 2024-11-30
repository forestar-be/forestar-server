/*
  Warnings:

  - You are about to drop the `_MachineRepairReplacedParts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_MachineRepairReplacedParts" DROP CONSTRAINT "_MachineRepairReplacedParts_A_fkey";

-- DropForeignKey
ALTER TABLE "_MachineRepairReplacedParts" DROP CONSTRAINT "_MachineRepairReplacedParts_B_fkey";

-- DropTable
DROP TABLE "_MachineRepairReplacedParts";

-- CreateTable
CREATE TABLE "MachineRepairReplacedParts" (
    "machineRepairId" INTEGER NOT NULL,
    "replacedPartName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "MachineRepairReplacedParts_pkey" PRIMARY KEY ("machineRepairId","replacedPartName")
);

-- AddForeignKey
ALTER TABLE "MachineRepairReplacedParts" ADD CONSTRAINT "MachineRepairReplacedParts_machineRepairId_fkey" FOREIGN KEY ("machineRepairId") REFERENCES "MachineRepair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRepairReplacedParts" ADD CONSTRAINT "MachineRepairReplacedParts_replacedPartName_fkey" FOREIGN KEY ("replacedPartName") REFERENCES "ReplacedParts"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
