-- AlterTable
ALTER TABLE "MachineRental" ADD COLUMN     "finalTermsPdfId" TEXT,
ADD COLUMN     "idCardBackId" TEXT,
ADD COLUMN     "idCardFrontId" TEXT,
ADD COLUMN     "termsEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "termsPdfId" TEXT,
ADD COLUMN     "termsSignedAt" TIMESTAMP(3);
