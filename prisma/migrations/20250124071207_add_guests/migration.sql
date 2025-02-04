-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "guests" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MachineRented" ADD COLUMN     "guests" TEXT[] DEFAULT ARRAY[]::TEXT[];
