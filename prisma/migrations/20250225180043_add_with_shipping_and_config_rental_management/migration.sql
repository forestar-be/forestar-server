-- AlterTable
ALTER TABLE "MachineRented" ADD COLUMN     "with_shipping" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConfigRentalManagement" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigRentalManagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigRentalManagement_key_key" ON "ConfigRentalManagement"("key");
