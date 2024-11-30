/*
  Warnings:

  - The `replaced_part_list` column on the `MachineRepair` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "replaced_part_list",
ADD COLUMN     "replaced_part_list" TEXT[];

-- DropEnum
DROP TYPE "ReplacedPart";

-- CreateTable
CREATE TABLE "ReplacedParts" (
    "name" TEXT NOT NULL,

    CONSTRAINT "ReplacedParts_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplacedParts_name_key" ON "ReplacedParts"("name");
