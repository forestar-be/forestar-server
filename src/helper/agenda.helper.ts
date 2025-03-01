import {
  MachineRental,
  MachineRentalView,
  MachineRented,
  MachineRentedView,
} from '@prisma/client';
import { formatPriceNumberToFrenchFormatStr } from './common.helper';
import logger from '../config/logger';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  calendarEntretienId,
} from './rentalCalendar.helper';
import { getRentalPrice } from './machineRental.helper';

/**
 * Build a detailed event description for a rental.
 */
export function getEventRentalDescription(
  machineRental: MachineRental | MachineRentalView,
  machineRented: MachineRented | MachineRentedView,
): string {
  const lines = [];
  lines.push(
    `Location de la machine ${machineRented.name} par ${machineRental.clientFirstName} ${machineRental.clientLastName} (${machineRental.clientPhone}).`,
  );
  lines.push(
    machineRental.depositToPay
      ? 'La caution est à payer.'
      : 'La caution est déjà payée.',
  );
  lines.push(
    machineRental.paid
      ? 'Le paiement est déjà effectué.'
      : 'Le paiement est à effectuer.',
  );
  lines.push(
    `Prix de la caution: ${formatPriceNumberToFrenchFormatStr(machineRented.deposit)}.`,
  );
  lines.push(
    `Prix de la location: ${formatPriceNumberToFrenchFormatStr(getRentalPrice(machineRental, machineRented))}.`,
  );
  return lines.join('\n');
}

/**
 * Decide what type of calendar event update is needed.
 */
export function getEventMaintenanceUpdateAction(
  currentMachine: MachineRentedView,
  updatedMachine: MachineRentedView,
  dbUpdateType: 'update' | 'create' | 'delete',
): 'update' | 'create' | 'delete' | 'none' {
  if (dbUpdateType === 'create') {
    return updatedMachine.next_maintenance ? 'create' : 'none';
  }

  if (dbUpdateType === 'delete') {
    return currentMachine.eventId ? 'delete' : 'none';
  }

  if (dbUpdateType === 'update') {
    if (
      currentMachine.name === updatedMachine.name &&
      currentMachine.next_maintenance?.getTime() ===
        updatedMachine.next_maintenance?.getTime()
    ) {
      return 'none';
    }

    if (
      currentMachine.name === updatedMachine.name &&
      currentMachine.maintenance_type === updatedMachine.maintenance_type &&
      ((updatedMachine.maintenance_type === 'BY_DAY' &&
        updatedMachine.nb_day_before_maintenance ===
          currentMachine.nb_day_before_maintenance) ||
        (updatedMachine.maintenance_type === 'BY_NB_RENTAL' &&
          updatedMachine.nb_rental_before_maintenance ===
            currentMachine.nb_rental_before_maintenance)) &&
      currentMachine.last_maintenance_date !==
        updatedMachine.last_maintenance_date &&
      currentMachine.last_maintenance_date &&
      updatedMachine.last_maintenance_date &&
      new Date(updatedMachine.last_maintenance_date).getTime() >
        new Date(currentMachine.last_maintenance_date).getTime()
    ) {
      return 'create';
    }

    if (updatedMachine.next_maintenance) {
      return currentMachine.next_maintenance && updatedMachine.eventId
        ? 'update'
        : 'create';
    }

    return currentMachine.next_maintenance ? 'delete' : 'update';
  }

  throw new Error('Unexpected dbUpdateType');
}

/**
 * Update the calendar event related to machine maintenance.
 */
export async function updateCalendarEventMaintenance(
  existingMachine: MachineRentedView,
  updatedMachine: MachineRentedView,
  prisma: any,
  idParsed: number,
  dbUpdateType: 'update' | 'create' | 'delete' = 'update',
): Promise<'update' | 'create' | 'delete' | 'none'> {
  const eventUpdateType = getEventMaintenanceUpdateAction(
    existingMachine,
    updatedMachine,
    dbUpdateType,
  );

  switch (eventUpdateType) {
    case 'update':
    case 'create': {
      const eventData = {
        summary: `Maintenance ${updatedMachine.name}`,
        description: `Maintenance pour la machine ${updatedMachine.name}`,
        start: updatedMachine.next_maintenance!,
        end: updatedMachine.next_maintenance!,
      };
      if (eventUpdateType === 'update') {
        logger.info(
          `Updating event ${existingMachine.eventId} for machine ${idParsed} with data: ${JSON.stringify(eventData)}`,
        );
        await updateEvent(
          existingMachine.eventId!,
          eventData,
          calendarEntretienId,
        );
      } else {
        logger.info(`Creating event for machine ${idParsed}`);
        const eventId = await createEvent(eventData, calendarEntretienId);
        logger.info(`Event created with id ${eventId}`);
        await prisma.machineRented.update({
          where: { id: idParsed },
          data: { eventId },
        });
      }
      break;
    }
    case 'delete': {
      logger.info(
        `Deleting event ${existingMachine.eventId} of machine ${idParsed}`,
      );
      await deleteEvent(existingMachine.eventId!, calendarEntretienId);
      await prisma.machineRented.update({
        where: { id: idParsed },
        data: { eventId: null },
      });
      break;
    }
    case 'none':
      logger.info(`No event update needed for machine ${idParsed}`);
      break;
  }
  return eventUpdateType;
}
