-- DropForeignKey
ALTER TABLE "MachineRepairReplacedParts" DROP CONSTRAINT "MachineRepairReplacedParts_replacedPartName_fkey";

-- AddForeignKey
ALTER TABLE "MachineRepairReplacedParts" ADD CONSTRAINT "MachineRepairReplacedParts_replacedPartName_fkey" FOREIGN KEY ("replacedPartName") REFERENCES "ReplacedParts"("name") ON DELETE CASCADE ON UPDATE CASCADE;
