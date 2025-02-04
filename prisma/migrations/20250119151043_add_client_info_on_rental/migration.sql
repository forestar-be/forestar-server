-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "clientAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientFirstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientLastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientPostal" TEXT NOT NULL DEFAULT '';
