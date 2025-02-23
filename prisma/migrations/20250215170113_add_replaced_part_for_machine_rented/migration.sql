-- CreateTable
CREATE TABLE "MachineRentedPart" (
    "machineRentedId" INTEGER NOT NULL,
    "replacedPartName" TEXT NOT NULL,

    CONSTRAINT "MachineRentedPart_pkey" PRIMARY KEY ("machineRentedId","replacedPartName")
);

-- AddForeignKey
ALTER TABLE "MachineRentedPart" ADD CONSTRAINT "MachineRentedPart_machineRentedId_fkey" FOREIGN KEY ("machineRentedId") REFERENCES "MachineRented"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRentedPart" ADD CONSTRAINT "MachineRentedPart_replacedPartName_fkey" FOREIGN KEY ("replacedPartName") REFERENCES "ReplacedParts"("name") ON DELETE CASCADE ON UPDATE CASCADE;
