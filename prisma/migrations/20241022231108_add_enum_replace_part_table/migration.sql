/*
  Warnings:

  - The `replaced_part_list` column on the `MachineRepair` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ReplacedPart" AS ENUM ('Moteur', 'Batterie', 'Lame');

-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "replaced_part_list",
ADD COLUMN     "replaced_part_list" "ReplacedPart"[];
