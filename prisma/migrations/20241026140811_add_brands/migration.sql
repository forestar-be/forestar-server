-- AlterTable
ALTER TABLE "MachineRepair" ADD COLUMN     "brand_name" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- AddForeignKey
ALTER TABLE "MachineRepair" ADD CONSTRAINT "MachineRepair_brand_name_fkey" FOREIGN KEY ("brand_name") REFERENCES "Brand"("name") ON DELETE SET NULL ON UPDATE CASCADE;
