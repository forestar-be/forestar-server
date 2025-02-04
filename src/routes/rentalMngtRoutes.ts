import express from 'express';
import {
  MachineRental,
  MachineRentedWithNextMaintenance,
  PrismaClient,
} from '@prisma/client';
import asyncHandler from '../helper/asyncHandler';
import { MachineRented } from '.prisma/client';
import { doLogin } from '../helper/auth.helper';
import { createClient } from '@supabase/supabase-js';

const rentalMngtRoutes = express.Router();
import logger from '../config/logger';
import {
  calendarEntretienId,
  calendarRentalId,
  createEvent,
  deleteEvent,
  updateEvent,
} from '../helper/calendar.helper';
import multer from 'multer';
import { generateUniqueString } from '../helper/common.helper';
import { getImageUrl, notFoundImage } from '../helper/supabase.helper';
import prisma from '../helper/prisma';
const upload = multer({ storage: multer.memoryStorage() });

const RENTAL_MANAGER_SECRET_KEY = process.env.RENTAL_MANAGER_SECRET_KEY;
const BUCKET_NAME = process.env.BUCKET_IMAGE_MACHINES;

if (!RENTAL_MANAGER_SECRET_KEY) {
  throw new Error('RENTAL_MANAGER_SECRET_KEY is not set');
}

if (!BUCKET_NAME) {
  throw new Error('BUCKET_IMAGE_MACHINES is not set');
}

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is not set');
}

if (!process.env.SUPABASE_KEY) {
  throw new Error('SUPABASE_KEY is not set');
}

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

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
    const { filter = {}, withImages = false } = req.body;

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
    const machineRepairs: (MachineRentedWithNextMaintenance & {
      imageUrl?: string;
    })[] = await prisma.machineRentedWithNextMaintenance.findMany({
      where: filterQuery,
      orderBy: { [sortBy]: sortOrder }, // Apply sorting
      ...(skip && { skip }), // Apply pagination
      ...(take && { take }), // Apply pagination
    });

    if (withImages) {
      for (const machine of machineRepairs) {
        machine.imageUrl =
          machine.bucket_name && machine.image_path
            ? await getImageUrl(
                supabase,
                machine.bucket_name,
                machine.image_path,
              )
            : notFoundImage;
      }
    }

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
    const machineRented: MachineRentedWithNextMaintenance =
      await prisma.machineRentedWithNextMaintenance.findUnique({
        where: { id: idParsed },
      });

    if (!machineRented) {
      throw new Error('Machine rented not found');
    }

    const machineRentals: MachineRental[] = await prisma.machineRental.findMany(
      {
        where: { machineRentedId: idParsed },
      },
    );

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

    const { bucket_name, image_path, ...machineRented } = result;

    res.json({
      ...machineRented,
      imageUrl:
        bucket_name && image_path
          ? await getImageUrl(supabase, bucket_name, image_path)
          : notFoundImage,
    });
  }),
);

const machineRentedNotFound = 'Machine rented not found';

const getEventMaintenanceUpdateAction = (
  currentMachine: MachineRentedWithNextMaintenance,
  updatedMachine: MachineRentedWithNextMaintenance,
  dbUpdateType: 'update' | 'create' | 'delete',
): 'update' | 'create' | 'delete' | 'none' => {
  if (dbUpdateType === 'create') {
    return updatedMachine.next_maintenance ? 'create' : 'none';
  }

  if (dbUpdateType === 'delete') {
    return currentMachine.eventId ? 'delete' : 'none';
  }

  if (dbUpdateType === 'update') {
    // if next_maintenance not updated, and same name, none
    if (
      currentMachine.name === updatedMachine.name &&
      currentMachine.next_maintenance?.getTime() ===
        updatedMachine.next_maintenance?.getTime()
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
};

async function updateCalendarEventMaintenance(
  existingMachine: MachineRentedWithNextMaintenance,
  updatedMachine: MachineRentedWithNextMaintenance,
  prisma: any,
  idParsed: number,
  dbUpdateType: 'update' | 'create' | 'delete' = 'update',
) {
  const eventUpdateType = getEventMaintenanceUpdateAction(
    existingMachine,
    updatedMachine,
    dbUpdateType,
  );

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
    case 'delete':
      logger.info(
        `Deleting event ${existingMachine.eventId} of machine ${idParsed}`,
      );
      await deleteEvent(existingMachine.eventId!, calendarEntretienId);
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

  return eventUpdateType;
}

rentalMngtRoutes.patch(
  '/machine-rented/:id/image',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { id } = req.params;
    const machineRented = await prisma.machineRented.findUnique({
      where: { id: parseInt(id) },
      select: { bucket_name: true, image_path: true },
    });

    if (!machineRented) {
      return res.status(404).json({ message: 'Machine rented not found' });
    }

    const { bucket_name: _bucket_name, image_path } = machineRented;

    const bucket_name: string = _bucket_name || BUCKET_NAME;

    if (image_path) {
      // try to delete
      const { error: deleteError } = await supabase.storage
        .from(bucket_name)
        .remove([image_path]);
      if (deleteError) {
        throw new Error(
          `Erreur lors de la suppression de l'image : ${deleteError.message}`,
        );
      }
    }

    const webpBuffer = req.file.buffer; // WebP image buffer
    const fileName = req.file.originalname;
    const imagePath = `images/${generateUniqueString()}_${fileName}`;

    const { data: imageUpload, error: imageError } = await supabase.storage
      .from(bucket_name)
      .upload(imagePath, webpBuffer, {
        contentType: 'image/webp',
      });

    if (imageError) {
      throw new Error(
        `Erreur lors du téléchargement de l'image : ${imageError.message}`,
      );
    }
    const result = await prisma.machineRented.update({
      where: { id: parseInt(id) },
      data: { image_path: imagePath, bucket_name },
    });

    res.json({ imageUrl: await getImageUrl(supabase, bucket_name, imagePath) });
  }),
);

rentalMngtRoutes.patch(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body as Partial<MachineRented> & {
      machineRentals?: MachineRental[];
    };
    const { machineRentals, image_path, bucket_name, ...dataWithoutRentals } =
      data;

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

        if (dataWithoutRentals) {
          await prisma.machineRented.update({
            where: { id: idParsed },
            data: dataWithoutRentals,
          });
        }

        const updatedMachine =
          await getMachineRentedViewWithRentals(idParsed)(prisma);

        if (!updatedMachine) {
          throw new Error(
            `Unexpected error: Machine rented with id ${idParsed} not found after update`,
          );
        }

        const eventUpdateType = await updateCalendarEventMaintenance(
          existingMachine,
          updatedMachine,
          prisma,
          idParsed,
        );

        return { ...updatedMachine, eventUpdateType };
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
        const machineRented =
          await prisma.machineRentedWithNextMaintenance.findUnique({
            where: { id: idParsed },
          });

        if (!machineRented) {
          throw new Error(machineRentedNotFound);
        }

        await updateCalendarEventMaintenance(
          machineRented,
          machineRented,
          prisma,
          idParsed,
        );

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

        const eventId = await createEvent(
          {
            summary: `Location ${machineRented.name}`,
            start: new Date(data.rentalDate),
            end: data.returnDate
              ? new Date(data.returnDate)
              : new Date(data.rentalDate),
            description: `Location de la machine ${machineRented.name} par ${data.clientFirstName} ${data.clientLastName} (${data.clientEmail} - ${data.clientPhone}) situé au ${data.clientAddress}, ${data.clientPostal} ${data.clientCity}`,
          },
          calendarRentalId,
          data.guests,
        );

        if (!eventId) {
          throw new Error('Event creation failed');
        }

        return prisma.machineRental.create({
          data: {
            ...data,
            eventId,
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
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const data = req.body as { [K in keyof MachineRented]: string };

    const bucket_name = BUCKET_NAME;
    const fileName = req.file.originalname;
    const imagePath = `images/${generateUniqueString()}_${fileName}`;
    const webpBuffer = req.file.buffer; // WebP image buffer

    const { data: imageUpload, error: imageError } = await supabase.storage
      .from(bucket_name)
      .upload(imagePath, webpBuffer, {
        contentType: 'image/webp',
      });

    if (imageError) {
      throw new Error(
        `Erreur lors du téléchargement de l'image : ${imageError.message}`,
      );
    }

    if (data.maintenance_type === 'BY_NB_RENTAL') {
      if (!data.nb_rental_before_maintenance) {
        throw new Error('nb_rental_before_maintenance is required');
      }
    }

    if (data.maintenance_type === 'BY_DAY') {
      if (!data.nb_day_before_maintenance) {
        throw new Error('nb_day_before_maintenance is required');
      }
    }

    if (
      data.maintenance_type !== 'BY_DAY' &&
      data.maintenance_type !== 'BY_NB_RENTAL'
    ) {
      throw new Error('maintenance_type must be BY_DAY or BY_NB_RENTAL');
    }

    if (!data.price_per_day) {
      throw new Error('price_per_day is required');
    }

    const result = await prisma.machineRented.create({
      data: {
        name: data.name,
        maintenance_type:
          data.maintenance_type === 'BY_DAY' ? 'BY_DAY' : 'BY_NB_RENTAL',
        last_maintenance_date: data.last_maintenance_date
          ? new Date(data.last_maintenance_date)
          : undefined,
        nb_day_before_maintenance: data.nb_day_before_maintenance
          ? parseInt(data.nb_day_before_maintenance)
          : undefined,
        nb_rental_before_maintenance: data.nb_rental_before_maintenance
          ? parseInt(data.nb_rental_before_maintenance)
          : undefined,
        image_path: imagePath,
        price_per_day: data.price_per_day ? parseFloat(data.price_per_day) : 0,
        bucket_name,
        guests: data.guests ? data.guests.split(',') : undefined,
      },
    });

    const machineRented = await getMachineRentedViewWithRentals(result.id)(
      prisma,
    );

    await updateCalendarEventMaintenance(
      machineRented,
      machineRented,
      prisma,
      machineRented.id,
    );

    res.json(machineRented);
  }),
);

rentalMngtRoutes.get(
  '/machine-rental',
  asyncHandler(async (req, res) => {
    const rentals = await prisma.machineRental.findMany({
      include: {
        machineRented: true,
      },
    });

    return res.json(rentals);
  }),
);

rentalMngtRoutes.get(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);

    const rental = await prisma.$transaction(async (prisma) => {
      // Fetch the rental
      const rental = await prisma.machineRental.findUnique({
        where: { id: idParsed },
      });

      if (!rental) {
        throw new Error('Machine rental not found');
      }

      // Fetch the associated machine
      const machine = await prisma.machineRentedWithNextMaintenance.findUnique({
        where: { id: rental.machineRentedId },
      });

      if (!machine) {
        throw new Error('Machine rented not found');
      }

      return { ...rental, machineRented: machine };
    });

    return res.json(rental);
  }),
);

rentalMngtRoutes.delete(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);

    const rental = await prisma.machineRental.delete({
      where: { id: idParsed },
    });

    await deleteEvent(rental.eventId, calendarRentalId);

    return res.json(rental);
  }),
);

rentalMngtRoutes.patch(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body as Partial<MachineRental>;

    if (data.rentalDate || data.returnDate || data.guests) {
      const rental = await prisma.machineRental.findUnique({
        where: { id: idParsed },
      });

      if (!rental) {
        throw new Error('Machine rental not found');
      }

      await updateEvent(
        rental.eventId,
        {
          ...(data.rentalDate && { start: new Date(data.rentalDate) }),
          ...(data.returnDate && { end: new Date(data.returnDate) }),
        },
        calendarRentalId,
        data.guests,
      );
    }

    const updatedRental = await prisma.machineRental.update({
      where: { id: idParsed },
      data: { ...data },
    });

    return res.json(updatedRental);
  }),
);

export default rentalMngtRoutes;
