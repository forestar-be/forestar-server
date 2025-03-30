-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "hasAppointment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInstalled" BOOLEAN NOT NULL DEFAULT false;
