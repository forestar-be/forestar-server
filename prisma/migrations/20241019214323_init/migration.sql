-- CreateTable
CREATE TABLE "MachineRepair" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "adress" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "machine_type" TEXT NOT NULL,
    "repair_or_maintenance" TEXT NOT NULL,
    "robot_code" TEXT NOT NULL,
    "fault_description" TEXT NOT NULL,
    "client_signature" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "binaryData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineRepair_pkey" PRIMARY KEY ("id")
);
