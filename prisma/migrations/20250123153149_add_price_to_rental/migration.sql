-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MachineRented" ADD COLUMN     "price_per_day" INTEGER NOT NULL DEFAULT 0;
