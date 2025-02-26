import {
  MachineRental,
  MachineRentedView,
  MaintenanceHistory,
  PrismaClient,
} from '@prisma/client';
import * as runtime from '@prisma/client/runtime/library.js';

export const machineRentedNotFound = 'Machine rented not found';

/**
 * Fetch a machine rented record along with its related rentals, parts, and maintenance histories.
 */
export function getMachineRentedView(
  idParsed: number,
  includeRentals: boolean = true,
  includeParts: boolean = true,
  includeMaintenanceHistories: boolean = true,
) {
  return async (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => {
    const machineRented: MachineRentedView | null =
      await prisma.machineRentedView.findUnique({
        where: { id: idParsed },
      });

    if (!machineRented) {
      throw new Error('Machine rented not found');
    }

    let machineRentals: MachineRental[] = [];
    let parts: { partName: string }[] = [];
    let maintenanceHistories: MaintenanceHistory[] = [];

    if (includeRentals) {
      machineRentals = await prisma.machineRental.findMany({
        where: { machineRentedId: idParsed },
      });
    }

    if (includeParts) {
      parts = await prisma.machineRentedPart.findMany({
        where: { machineRentedId: idParsed },
        select: { partName: true },
      });
    }

    if (includeMaintenanceHistories) {
      maintenanceHistories = await prisma.maintenanceHistory.findMany({
        where: { machineRentedId: idParsed },
        orderBy: { performedAt: 'desc' },
      });
    }

    return { ...machineRented, machineRentals, parts, maintenanceHistories };
  };
}
