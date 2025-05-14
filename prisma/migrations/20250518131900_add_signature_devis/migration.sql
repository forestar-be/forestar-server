-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "clientSignature" TEXT,
ADD COLUMN     "signatureTimestamp" TIMESTAMP(3);
