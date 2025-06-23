-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INSTALLER';

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "installationCompletedAt" TIMESTAMP(3),
ADD COLUMN     "installerName" TEXT;
