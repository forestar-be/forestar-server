/*
  Warnings:

  - You are about to drop the column `working_time` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "working_time",
ADD COLUMN     "working_time_hour" INTEGER,
ADD COLUMN     "working_time_minute" INTEGER;
