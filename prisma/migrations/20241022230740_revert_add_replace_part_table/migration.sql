/*
  Warnings:

  - You are about to drop the `ReplacedPart` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReplacedPart" DROP CONSTRAINT "ReplacedPart_machineRepairId_fkey";

-- AlterTable
ALTER TABLE "MachineRepair" ADD COLUMN     "replaced_part_list" TEXT[];

-- DropTable
DROP TABLE "ReplacedPart";
