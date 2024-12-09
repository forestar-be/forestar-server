-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('BY_DAY', 'BY_NB_RENTAL');

-- CreateTable
CREATE TABLE "MachineRented" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL,
    "nb_day_before_maintenance" INTEGER,
    "nb_rental_before_maintenance" INTEGER,
    "last_maintenance_date" TIMESTAMP(3),

    CONSTRAINT "MachineRented_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineRental" (
    "id" SERIAL NOT NULL,
    "machineRentedId" INTEGER NOT NULL,
    "rentalDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),

    CONSTRAINT "MachineRental_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MachineRental" ADD CONSTRAINT "MachineRental_machineRentedId_fkey" FOREIGN KEY ("machineRentedId") REFERENCES "MachineRented"("id") ON DELETE CASCADE ON UPDATE CASCADE;
