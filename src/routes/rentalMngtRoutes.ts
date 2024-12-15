import express from 'express';
import {
  MachineRental,
  MachineRentedWithNextMaintenance,
  PrismaClient,
} from '@prisma/client';
import asyncHandler from '../helper/asyncHandler';
import { MachineRented } from '.prisma/client';
import { doLogin } from '../helper/auth.helper';

const prisma = new PrismaClient();
const rentalMngtRoutes = express.Router();
import logger from '../config/logger';
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from '../helper/calendar.helper';

const RENTAL_MANAGER_SECRET_KEY = process.env.RENTAL_MANAGER_SECRET_KEY;

rentalMngtRoutes.post(
  '/machine-rented',
  asyncHandler(async (req, res) => {
    // Extract query parameters
    const {
      sortBy = 'next_maintenance', // default sorting by next_maintenance
      sortOrder = 'desc', // default sorting order is descending
      page,
      itemsPerPage,
    } = req.query;

    if (typeof sortBy !== 'string') {
      throw new Error('Invalid sortBy parameter');
    }

    if (page && typeof page !== 'string') {
      throw new Error('Invalid page parameter');
    }

    if (itemsPerPage && typeof itemsPerPage !== 'string') {
      throw new Error('Invalid itemsPerPage parameter');
    }

    // Extract filter from request body
    const { filter = {} } = req.body;

    // Set up pagination
    const skip =
      page && itemsPerPage
        ? (parseInt(page) - 1) * parseInt(itemsPerPage)
        : null;
    const take = itemsPerPage ? parseInt(itemsPerPage) : null;

    const filterQuery = Object.keys(filter).reduce((acc, key) => {
      return { ...acc, [key]: { contains: filter[key] } };
    }, {});

    // Fetch filtered, paginated, and sorted data
    const machineRepairs =
      await prisma.machineRentedWithNextMaintenance.findMany({
        where: filterQuery,
        orderBy: { [sortBy]: sortOrder }, // Apply sorting
        ...(skip && { skip }), // Apply pagination
        ...(take && { take }), // Apply pagination
      });

    // Get total count for pagination metadata
    const totalCount = await prisma.machineRepair.count({
      where: filter,
    });

    // Return data with pagination info
    res.json({
      data: machineRepairs,
      pagination: {
        totalItems: totalCount,
        totalPages: take ? Math.ceil(totalCount / take) : 1,
        currentPage: page ? parseInt(page) : 1,
        itemsPerPage: take,
      },
    });
  }),
);

function getMachineRentedViewWithRentals(idParsed: number) {
  return async (prisma: {
    machineRentedWithNextMaintenance: {
      findUnique: (arg0: { where: { id: number } }) => any;
    };
    machineRental: {
      findMany: (arg0: { where: { machineRentedId: number } }) => any;
    };
  }) => {
    const machineRented =
      await prisma.machineRentedWithNextMaintenance.findUnique({
        where: { id: idParsed },
      });

    if (!machineRented) {
      throw new Error('Machine rented not found');
    }

    const machineRentals = await prisma.machineRental.findMany({
      where: { machineRentedId: idParsed },
    });

    return { ...machineRented, machineRentals };
  };
}

rentalMngtRoutes.get(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    logger.info(`Getting machine rented of id ${req.params.id}`);
    const { id } = req.params;
    const idParsed = parseInt(id);

    const result = await prisma.$transaction(
      getMachineRentedViewWithRentals(idParsed),
    );

    res.json(result);
  }),
);

const machineRentedNotFound = 'Machine rented not found';

const getEventUpdateAction = (
  currentMachine: MachineRentedWithNextMaintenance,
  updatedMachine: MachineRentedWithNextMaintenance,
): 'update' | 'create' | 'delete' | 'none' => {
  // if next_maintenance not updated, and same name, none
  if (
    currentMachine.name === updatedMachine.name &&
    currentMachine.next_maintenance === updatedMachine.next_maintenance
  ) {
    return 'none';
  }

  // if the only change is the last maintenance date, and if the new date is in the future from the previous date, then we should create new event for next maintenance
  if (
    currentMachine.name === updatedMachine.name &&
    currentMachine.maintenance_type === updatedMachine.maintenance_type &&
    ((updatedMachine.maintenance_type === 'BY_DAY' &&
      updatedMachine.nb_day_before_maintenance ===
        currentMachine.nb_day_before_maintenance) ||
      (updatedMachine.maintenance_type === 'BY_NB_RENTAL' &&
        updatedMachine.nb_rental_before_maintenance ===
          currentMachine.nb_rental_before_maintenance &&
        currentMachine.last_maintenance_date !==
          updatedMachine.last_maintenance_date &&
        currentMachine.last_maintenance_date &&
        updatedMachine.last_maintenance_date &&
        new Date(updatedMachine.last_maintenance_date).getTime() >
          new Date(currentMachine.last_maintenance_date).getTime()))
  ) {
    return 'create';
  }

  if (updatedMachine.next_maintenance) {
    return currentMachine.next_maintenance && updatedMachine.eventId
      ? 'update'
      : 'create';
  }

  return currentMachine.next_maintenance ? 'delete' : 'update';
};

async function updateCalendarEvent(
  existingMachine: MachineRentedWithNextMaintenance,
  updatedMachine: MachineRentedWithNextMaintenance,
  prisma: any,
  idParsed: number,
) {
  const eventUpdateType = getEventUpdateAction(existingMachine, updatedMachine);

  // Calendar Event Handling
  switch (eventUpdateType) {
    case 'update':
    case 'create':
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
        await updateEvent(existingMachine.eventId!, eventData);
      } else {
        logger.info(`Creating event for machine ${idParsed}`);
        const eventId = await createEvent(eventData);
        logger.info(`Event created with id ${eventId}`);
        await prisma.machineRented.update({
          where: { id: idParsed },
          data: { eventId },
        });
      }
      break;
    case 'delete':
      logger.info(
        `Deleting event ${existingMachine.eventId} of machine ${idParsed}`,
      );
      await deleteEvent(existingMachine.eventId!);
      await prisma.machineRented.update({
        where: { id: idParsed },
        data: { eventId: null },
      });
      break;
    case 'none':
      logger.info(`No event update needed for machine ${idParsed}`);
      break;
    default:
      break;
  }
}

rentalMngtRoutes.patch(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body as Partial<MachineRented>;

    try {
      const result = await prisma.$transaction(async (prisma) => {
        // Fetch the existing machine
        const existingMachine =
          await prisma.machineRentedWithNextMaintenance.findUnique({
            where: { id: idParsed },
          });

        if (!existingMachine) {
          throw new Error(machineRentedNotFound);
        }

        // Update machineRented
        await prisma.machineRented.update({
          where: { id: idParsed },
          data,
        });

        const updatedMachine =
          await prisma.machineRentedWithNextMaintenance.findUnique({
            where: { id: idParsed },
          });

        if (!updatedMachine) {
          throw new Error(
            `Unexpected error: Machine rented with id ${idParsed} not found after update`,
          );
        }
        await updateCalendarEvent(
          existingMachine,
          updatedMachine,
          prisma,
          idParsed,
        );

        return updatedMachine;
      });

      res.json(result);
    } catch (error: any) {
      if (error.message === machineRentedNotFound) {
        return res.status(404).json({ message: error.message });
      }
      throw error;
    }
  }),
);

rentalMngtRoutes.delete(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);

    const result = await prisma
      .$transaction(async (prisma) => {
        // check if exists
        const machineRented = await prisma.machineRented.findUnique({
          where: { id: idParsed },
        });

        if (!machineRented) {
          throw new Error(machineRentedNotFound);
        }

        return prisma.machineRented.delete({
          where: { id: idParsed },
        });
      })
      .catch((error) => {
        if (error.message === machineRentedNotFound) {
          return res.status(404).json({ message: error.message });
        }
        throw error;
      });

    res.json(result);
  }),
);

rentalMngtRoutes.put(
  '/machine-rented/:id/rental',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body as MachineRental;

    const result = await prisma
      .$transaction(async (prisma) => {
        // check if exists
        const machineRented = await prisma.machineRented.findUnique({
          where: { id: idParsed },
        });

        if (!machineRented) {
          throw new Error(machineRentedNotFound);
        }

        return prisma.machineRental.create({
          data: {
            ...data,
            machineRentedId: idParsed,
          },
        });
      })
      .catch((error) => {
        if (error.message === machineRentedNotFound) {
          return res.status(404).json({ message: error.message });
        }
        throw error;
      });

    res.json(result);
  }),
);

rentalMngtRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const role = 'RENTAL_MANAGER';
    const key = RENTAL_MANAGER_SECRET_KEY!;
    return await doLogin(req, res, role, key, prisma);
  }),
);

rentalMngtRoutes.put(
  '/machine-rented',
  asyncHandler(async (req, res) => {
    const data = req.body as Omit<MachineRented, 'id'>;
    const result = await prisma.machineRented.create({
      data: {
        ...data,
        id: undefined, // Ensure id is not set manually
      },
    });

    res.json(await getMachineRentedViewWithRentals(result.id)(prisma));
  }),
);

export default rentalMngtRoutes;
