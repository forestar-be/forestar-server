-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "validUntil" TIMESTAMP(3);
