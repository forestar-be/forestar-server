-- AlterTable
ALTER TABLE "MachineRepair" ADD COLUMN     "robot_type_name" TEXT;

-- CreateTable
CREATE TABLE "RobotType" (
    "name" TEXT NOT NULL,

    CONSTRAINT "RobotType_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "RobotType_name_key" ON "RobotType"("name");

-- AddForeignKey
ALTER TABLE "MachineRepair" ADD CONSTRAINT "MachineRepair_robot_type_name_fkey" FOREIGN KEY ("robot_type_name") REFERENCES "RobotType"("name") ON DELETE SET NULL ON UPDATE CASCADE;
