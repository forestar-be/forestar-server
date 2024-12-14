import express from 'express';
import multer from 'multer';
import { MachineRental, PrismaClient } from '@prisma/client';
import asyncHandler from '../helper/asyncHandler';
import { MachineRented } from '.prisma/client';
import { doLogin } from '../helper/auth.helper';

const prisma = new PrismaClient();
const rentalMngtRoutes = express.Router();
import logger from '../config/logger';

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

rentalMngtRoutes.patch(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body as Partial<MachineRented> & {
      machineRentals?: MachineRental[];
    };
    const { machineRentals, ...dataWithoutRentals } = data;

    const result = await prisma
      .$transaction(async (prisma) => {
        // check if exists
        const machineRented = await prisma.machineRented.findUnique({
          where: { id: idParsed },
        });

        if (!machineRented) {
          throw new Error(machineRentedNotFound);
        }

        if (dataWithoutRentals) {
          await prisma.machineRented.update({
            where: { id: idParsed },
            data: dataWithoutRentals,
          });
        }
        if (machineRentals) {
          // update each rental, if not exists, create, if not in data, delete
          const existingRentals = await prisma.machineRental.findMany({
            where: { machineRentedId: idParsed },
          });

          const existingRentalsIds = existingRentals.map((r) => r.id);
          const dataRentalsIds = machineRentals.map((r) => r.id);

          const toDelete = existingRentalsIds.filter(
            (id) => !dataRentalsIds.includes(id),
          );
          const toUpdate = existingRentalsIds.filter((id) =>
            dataRentalsIds.includes(id),
          );
          const toCreate = machineRentals.filter(
            (r) => !r.id || (r.id && !existingRentalsIds.includes(r.id)),
          );

          await prisma.machineRental.deleteMany({
            where: { id: { in: toDelete } },
          });

          await Promise.all(
            toUpdate.map((id) =>
              prisma.machineRental.update({
                where: { id },
                data: machineRentals.find((r) => r.id === id)!,
              }),
            ),
          );

          await Promise.all(
            toCreate.map((r) =>
              prisma.machineRental.create({
                data: { ...r, machineRentedId: idParsed },
              }),
            ),
          );
        }

        return getMachineRentedViewWithRentals(idParsed)(prisma);
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
