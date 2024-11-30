/*
  Warnings:

  - You are about to drop the column `binaryData` on the `MachineRepair` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `MachineRepair` table. All the data in the column will be lost.
  - Added the required column `bucket_name` to the `MachineRepair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_url` to the `MachineRepair` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "binaryData",
DROP COLUMN "fileName",
ADD COLUMN     "bucket_name" TEXT NOT NULL,
ADD COLUMN     "file_url" TEXT NOT NULL;
