import {
  MachineRentalView,
  MachineRentedView,
  PrismaClient,
} from '@prisma/client';
import * as runtime from '@prisma/client/runtime/library.js';

export function getMachineRentalView(
  idParsed: number,
  includeMachineRented: boolean = true,
) {
  return async (
    prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
  ): Promise<MachineRentalView & { machineRented: MachineRentedView | null }> => {
    const machineRental: MachineRentalView | null =
      await prisma.machineRentalView.findUnique({
        where: { id: idParsed },
      });

    if (!machineRental) {
      throw new Error('Machine rental not found');
    }

    let machineRented: MachineRentedView | null = null;

    if (includeMachineRented) {
      machineRented = await prisma.machineRentedView.findUnique({
        where: { id: machineRental.machineRentedId },
      });
    }

    return { ...machineRental, machineRented };
  };
}
