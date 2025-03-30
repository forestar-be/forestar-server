-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "antennaInventoryId" INTEGER,
ADD COLUMN     "pluginInventoryId" INTEGER;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_pluginInventoryId_fkey" FOREIGN KEY ("pluginInventoryId") REFERENCES "RobotInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_antennaInventoryId_fkey" FOREIGN KEY ("antennaInventoryId") REFERENCES "RobotInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
