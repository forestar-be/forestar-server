-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- DropForeignKey
ALTER TABLE "MachineRepairReplacedParts" DROP CONSTRAINT "MachineRepairReplacedParts_machineRepairId_fkey";

-- DropForeignKey
ALTER TABLE "MachineRepairReplacedParts" DROP CONSTRAINT "MachineRepairReplacedParts_replacedPartName_fkey";

-- AddForeignKey
ALTER TABLE "MachineRepairReplacedParts" ADD CONSTRAINT "MachineRepairReplacedParts_machineRepairId_fkey" FOREIGN KEY ("machineRepairId") REFERENCES "MachineRepair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRepairReplacedParts" ADD CONSTRAINT "MachineRepairReplacedParts_replacedPartName_fkey" FOREIGN KEY ("replacedPartName") REFERENCES "ReplacedParts"("name") ON DELETE CASCADE ON UPDATE CASCADE;
