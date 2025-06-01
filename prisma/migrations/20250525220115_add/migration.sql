-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "devisSignatureAccessToken" TEXT,
ADD COLUMN     "emailDevisSent" BOOLEAN NOT NULL DEFAULT false;
