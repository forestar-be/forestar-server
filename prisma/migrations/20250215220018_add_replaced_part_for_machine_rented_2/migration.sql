/*
  Warnings:

  - The primary key for the `MachineRentedPart` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `replacedPartName` on the `MachineRentedPart` table. All the data in the column will be lost.
  - Added the required column `partName` to the `MachineRentedPart` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MachineRentedPart" DROP CONSTRAINT "MachineRentedPart_replacedPartName_fkey";

-- AlterTable
ALTER TABLE "MachineRentedPart" DROP CONSTRAINT "MachineRentedPart_pkey",
DROP COLUMN "replacedPartName",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "partName" TEXT NOT NULL,
ADD CONSTRAINT "MachineRentedPart_pkey" PRIMARY KEY ("id");
