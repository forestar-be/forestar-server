-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "photosPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];
