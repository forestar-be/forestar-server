-- AlterTable
ALTER TABLE "MachineRepair" ADD COLUMN     "additionnal_file_url_list" TEXT[],
ADD COLUMN     "replaced_part_list" TEXT[],
ADD COLUMN     "state" TEXT,
ADD COLUMN     "working_time" INTEGER;
