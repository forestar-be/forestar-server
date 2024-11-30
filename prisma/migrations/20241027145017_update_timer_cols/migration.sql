/*
  Warnings:

  - You are about to drop the column `working_time_hour` on the `MachineRepair` table. All the data in the column will be lost.
  - You are about to drop the column `working_time_minute` on the `MachineRepair` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MachineRepair" DROP COLUMN "working_time_hour",
DROP COLUMN "working_time_minute",
ADD COLUMN     "start_timer" TIMESTAMP(3),
ADD COLUMN     "working_time_in_sec" INTEGER NOT NULL DEFAULT 0;
