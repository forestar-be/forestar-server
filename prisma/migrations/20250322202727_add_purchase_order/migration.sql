-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientFirstName" TEXT NOT NULL,
    "clientLastName" TEXT NOT NULL,
    "clientAddress" TEXT NOT NULL,
    "clientCity" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "robotInventoryId" INTEGER NOT NULL,
    "pluginType" TEXT,
    "antennaType" TEXT,
    "hasWire" BOOLEAN NOT NULL DEFAULT false,
    "wireLength" INTEGER,
    "shelterPrice" DOUBLE PRECISION,
    "installationDate" TIMESTAMP(3),
    "needsInstaller" BOOLEAN NOT NULL DEFAULT false,
    "orderPdfId" TEXT,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_robotInventoryId_fkey" FOREIGN KEY ("robotInventoryId") REFERENCES "RobotInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
