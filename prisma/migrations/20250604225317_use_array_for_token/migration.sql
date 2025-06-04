/*
  Warnings:

  - You are about to drop the column `devisSignatureAccessToken` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "devisSignatureAccessToken",
ADD COLUMN     "devisSignatureAccessTokenArray" TEXT[] DEFAULT ARRAY[]::TEXT[];
