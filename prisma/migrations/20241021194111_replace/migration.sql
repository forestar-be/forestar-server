/*
  Warnings:

  - You are about to drop the column `additionnal_file_url_list` on the `MachineRepair` table. All the data in the column will be lost.
  - You are about to drop the column `file_url` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "additionnal_file_url_list",
DROP COLUMN "file_url",
ADD COLUMN     "image_path_list" TEXT[];
