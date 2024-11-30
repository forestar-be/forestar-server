-- AddForeignKey
ALTER TABLE "MachineRepair" ADD CONSTRAINT "MachineRepair_repairer_name_fkey" FOREIGN KEY ("repairer_name") REFERENCES "Repairer"("name") ON DELETE SET NULL ON UPDATE CASCADE;
