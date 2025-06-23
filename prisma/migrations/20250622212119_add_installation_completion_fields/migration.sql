-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "additionalComments" TEXT,
ADD COLUMN     "antennaInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "antennaSupportInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "installationPdfId" TEXT,
ADD COLUMN     "missingItems" TEXT,
ADD COLUMN     "placementCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pluginInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "robotInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shelterInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wireInstalled" BOOLEAN NOT NULL DEFAULT false;
