import {
  MachineRental,
  MachineRentalView,
  MachineRented,
  MachineRentedView,
  PrismaClient,
} from '@prisma/client';
import * as runtime from '@prisma/client/runtime/library.js';

/**
 * Calculate the rental price based on the rental and machine details.
 */
export function getRentalPrice(
  machineRental: MachineRental | MachineRentalView,
  machineRented: MachineRented | MachineRentedView,
  priceShipping: number,
): number {
  return machineRental.returnDate && machineRented.price_per_day
    ? (machineRented.price_per_day *
        (new Date(machineRental.returnDate).getTime() -
          new Date(machineRental.rentalDate).getTime())) /
        (1000 * 60 * 60 * 24) +
        1 +
        (machineRental.with_shipping ? priceShipping : 0)
    : 0;
}

/**
 * Check if the rental dates does overlap with any other rental dates
 * @param prisma - The Prisma client
 * @param machineRentedId - The id of the machine rented
 * @param startDate - The start date of the rental
 * @param returnDate - The return date of the rental
 */
export async function isRentalDateOverlapExisting(
  prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
  machineRentedId: number,
  startDate: Date,
  returnDate: Date | null,
) {
  const nbRentals = await prisma.machineRental.count({
    where: {
      machineRentedId,
      rentalDate: { gte: startDate, lte: returnDate || startDate },
    },
  });
  return nbRentals !== 0;
}

export async function getForbiddenDates(
  prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
  machineRentedId: number,
) {
  // get list of each day rented for the machine rented, days are between startDate and returnDate
  const rentals = await prisma.machineRental.findMany({
    where: { machineRentedId },
  });

  const forbiddenDates = rentals.map((rental) => {
    const start = new Date(rental.rentalDate);
    const end = new Date(rental.returnDate || rental.rentalDate);
    const dates = [];
    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(new Date(date));
    }
    return dates;
  });

  return forbiddenDates.flat();
}

export function getMachineRentalView(
  idParsed: number,
  includeMachineRented: boolean = true,
) {
  return async (
    prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
  ): Promise<
    MachineRentalView & { machineRented: MachineRentedView | null }
  > => {
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
