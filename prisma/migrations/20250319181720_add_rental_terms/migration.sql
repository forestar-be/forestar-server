-- CreateEnum
CREATE TYPE "RentalTermType" AS ENUM ('TITLE', 'SUBTITLE', 'SUBTITLE2', 'PARAGRAPH');

-- CreateTable
CREATE TABLE "RentalTerms" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "type" "RentalTermType" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalTerms_pkey" PRIMARY KEY ("id")
);
