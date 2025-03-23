-- CreateTable
CREATE TABLE "RobotInventory" (
    "id" SERIAL NOT NULL,
    "reference" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sellingPrice" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPlan" (
    "id" SERIAL NOT NULL,
    "robotInventoryId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPlan_robotInventoryId_year_month_key" ON "InventoryPlan"("robotInventoryId", "year", "month");

-- AddForeignKey
ALTER TABLE "InventoryPlan" ADD CONSTRAINT "InventoryPlan_robotInventoryId_fkey" FOREIGN KEY ("robotInventoryId") REFERENCES "RobotInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
