// routes/rentalMngtRoutes.ts
import express from 'express';
import asyncHandler from '../helper/asyncHandler';
import { doLogin } from '../helper/auth.helper';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import logger from '../config/logger';
import prisma from '../helper/prisma';
import path from 'path';

import {
  generateUniqueString,
  formatPriceNumberToFrenchFormatStr,
} from '../helper/common.helper';
import { getImagePublicUrl, notFoundImage } from '../helper/supabase.helper';
import {
  calendarRentalId,
  createEvent,
  deleteEvent,
  updateEvent,
} from '../helper/rentalCalendar.helper';

import {
  getMachineRentedView,
  machineRentedNotFound,
} from '../helper/machineRented.helper';
import { getMachineRentalView } from '../helper/machineRental.helper';
import {
  getRentalPrice,
  getEventRentalDescription,
  updateCalendarEventMaintenance,
} from '../helper/agenda.helper';
import { sendRentalNotificationEmail } from '../helper/rentalEmail.helper';
import {
  MachineRental,
  MachineRented,
  MachineRentedView,
} from '@prisma/client';
const rentalMngtRoutes = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const RENTAL_MANAGER_SECRET_KEY = process.env.RENTAL_MANAGER_SECRET_KEY;
const BUCKET_NAME = process.env.BUCKET_IMAGE_MACHINES;
if (!RENTAL_MANAGER_SECRET_KEY)
  throw new Error('RENTAL_MANAGER_SECRET_KEY is not set');
if (!BUCKET_NAME) throw new Error('BUCKET_IMAGE_MACHINES is not set');
if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
if (!process.env.SUPABASE_KEY) throw new Error('SUPABASE_KEY is not set');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// ----------------------
// MACHINE RENTED ENDPOINTS
// ----------------------

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
        deposit: data.deposit ? parseFloat(data.deposit) : 0,
      },
    });

    const machineRented = await getMachineRentedView(result.id)(prisma);

    await updateCalendarEventMaintenance(
      machineRented,
      machineRented,
      prisma,
      machineRented.id,
      'create',
    );

    res.json(machineRented);
  }),
);

rentalMngtRoutes.post(
  '/machine-rented',
  asyncHandler(async (req, res) => {
    const {
      sortBy = 'next_maintenance',
      sortOrder = 'desc',
      page,
      itemsPerPage,
    } = req.query;
    if (typeof sortBy !== 'string') throw new Error('Invalid sortBy parameter');
    if (page && typeof page !== 'string')
      throw new Error('Invalid page parameter');
    if (itemsPerPage && typeof itemsPerPage !== 'string')
      throw new Error('Invalid itemsPerPage parameter');

    const { filter = {}, withImages = false } = req.body;
    const skip =
      page && itemsPerPage
        ? (parseInt(page) - 1) * parseInt(itemsPerPage)
        : null;
    const take = itemsPerPage ? parseInt(itemsPerPage) : null;
    const filterQuery = Object.keys(filter).reduce(
      (acc, key) => ({ ...acc, [key]: { contains: filter[key] } }),
      {},
    );

    const machineRentedList: (MachineRentedView & { imageUrl?: string })[] =
      await prisma.machineRentedView.findMany({
        where: filterQuery,
        orderBy: { [sortBy]: sortOrder },
        ...(skip && { skip }),
        ...(take && { take }),
      });

    if (withImages) {
      for (const machine of machineRentedList) {
        machine.imageUrl =
          machine.bucket_name && machine.image_path
            ? await getImagePublicUrl(
                supabase,
                machine.bucket_name,
                machine.image_path,
              )
            : notFoundImage;
      }
    }

    const totalCount = await prisma.machineRepair.count({ where: filter });
    res.json({
      data: machineRentedList,
      pagination: {
        totalItems: totalCount,
        totalPages: take ? Math.ceil(totalCount / take) : 1,
        currentPage: page ? parseInt(page) : 1,
        itemsPerPage: take,
      },
    });
  }),
);

rentalMngtRoutes.patch(
  '/machine-rented/:id/image',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { id } = req.params;
    const machineRented = await prisma.machineRented.findUnique({
      where: { id: parseInt(id) },
      select: { bucket_name: true, image_path: true },
    });
    if (!machineRented)
      return res.status(404).json({ message: 'Machine rented not found' });
    const bucket_name: string = machineRented.bucket_name || BUCKET_NAME;
    if (machineRented.image_path) {
      const { error: deleteError } = await supabase.storage
        .from(bucket_name)
        .remove([machineRented.image_path]);
      if (deleteError)
        throw new Error(
          `Erreur lors de la suppression de l'image : ${deleteError.message}`,
        );
    }
    const fileName = req.file.originalname;
    const imagePath = `images/${generateUniqueString()}_${fileName}`;
    const webpBuffer = req.file.buffer;
    const { error: imageError } = await supabase.storage
      .from(bucket_name)
      .upload(imagePath, webpBuffer, {
        contentType: 'image/webp',
      });
    if (imageError)
      throw new Error(
        `Erreur lors du téléchargement de l'image : ${imageError.message}`,
      );
    await prisma.machineRented.update({
      where: { id: parseInt(id) },
      data: { image_path: imagePath, bucket_name },
    });
    res.json({
      imageUrl: await getImagePublicUrl(supabase, bucket_name, imagePath),
    });
  }),
);

rentalMngtRoutes.patch(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body;
    const {
      machineRentals,
      parts,
      maintenanceHistories,
      ...dataWithoutRentals
    } = data;

    if (dataWithoutRentals?.guests) {
      dataWithoutRentals.guests = dataWithoutRentals.guests.filter(
        (guest: string, index: number, self: string[]) =>
          guest && self.indexOf(guest) === index,
      );
    }

    try {
      const result = await prisma.$transaction(async (prisma) => {
        const existingMachine = await prisma.machineRentedView.findUnique({
          where: { id: idParsed },
        });
        if (!existingMachine) throw new Error(machineRentedNotFound);

        if (machineRentals) {
          const existingRentals = await prisma.machineRental.findMany({
            where: { machineRentedId: idParsed },
          });
          const existingRentalsIds = existingRentals.map((r) => r.id);
          const dataRentalsIds = machineRentals.map((r: any) => r.id);
          const toDelete = existingRentalsIds.filter(
            (id: number) => !dataRentalsIds.includes(id),
          );
          const toUpdate = existingRentalsIds.filter((id: number) =>
            dataRentalsIds.includes(id),
          );
          const toCreate = machineRentals.filter(
            (r: any) => !r.id || (r.id && !existingRentalsIds.includes(r.id)),
          );

          await prisma.machineRental.deleteMany({
            where: { id: { in: toDelete } },
          });
          await Promise.all(
            toUpdate.map((id: number) =>
              prisma.machineRental.update({
                where: { id },
                data: machineRentals.find((r: any) => r.id === id)!,
              }),
            ),
          );
          await Promise.all(
            toCreate.map((r: any) =>
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

        if (parts !== undefined) {
          await prisma.machineRentedPart.deleteMany({
            where: { machineRentedId: idParsed },
          });
          await Promise.all(
            parts.map((part: { partName: string }) =>
              prisma.machineRentedPart.create({
                data: { machineRentedId: idParsed, partName: part.partName },
              }),
            ),
          );
        }

        if (maintenanceHistories !== undefined) {
          await prisma.maintenanceHistory.deleteMany({
            where: { machineRentedId: idParsed },
          });
          await Promise.all(
            maintenanceHistories.map((history: any) =>
              prisma.maintenanceHistory.create({
                data: { ...history, machineRentedId: idParsed },
              }),
            ),
          );
        }

        const updatedMachine = await getMachineRentedView(idParsed)(prisma);
        if (!updatedMachine)
          throw new Error(
            `Unexpected error: Machine rented with id ${idParsed} not found after update`,
          );

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
        const machineRented = await prisma.machineRentedView.findUnique({
          where: { id: idParsed },
        });
        if (!machineRented) throw new Error(machineRentedNotFound);
        await updateCalendarEventMaintenance(
          machineRented,
          machineRented,
          prisma,
          idParsed,
          'delete',
        );
        return prisma.machineRented.delete({ where: { id: idParsed } });
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

// ----------------------
// MACHINE RENTAL ENDPOINTS
// ----------------------

rentalMngtRoutes.put(
  '/machine-rented/:id/rental',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data = req.body;
    const result = await prisma
      .$transaction(async (prisma) => {
        const rentalCreated = await prisma.machineRental.create({
          data: { ...data, eventId: 'null', machineRentedId: idParsed },
        });
        const rental = await getMachineRentalView(
          rentalCreated.id,
          true,
        )(prisma);
        if (!rental.machineRented) {
          throw new Error('Machine rented details not found');
        }

        if (rental.guests.length > 0) {
          // Use the email helper to send the rental notification
          await sendRentalNotificationEmail(rental);
        }

        const eventId = await createEvent(
          {
            summary: `Location ${rental.machineRented.name}`,
            start: new Date(rental.rentalDate),
            end: rental.returnDate
              ? new Date(rental.returnDate)
              : new Date(rental.rentalDate),
            description: getEventRentalDescription(
              rental,
              rental.machineRented,
            ),
          },
          calendarRentalId,
          rental.guests,
        );
        if (!eventId) throw new Error('Event creation failed');

        await prisma.machineRental.update({
          where: { id: rental.id },
          data: { eventId },
        });
        return { ...rental, eventId };
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

rentalMngtRoutes.get(
  '/machine-rental',
  asyncHandler(async (req, res) => {
    const rentals = await prisma.machineRental.findMany({
      include: { machineRented: true },
    });
    res.status(200).json(rentals);
  }),
);

rentalMngtRoutes.get(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const idParsed = parseInt(req.params.id);
    if (isNaN(idParsed))
      return res.status(400).json({ message: 'ID invalide.' });
    const rental = await prisma.$transaction(getMachineRentalView(idParsed));
    res.json(rental);
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
    res.json(rental);
  }),
);

rentalMngtRoutes.patch(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const idParsed = parseInt(id);
    const data: Partial<MachineRental> = req.body;
    const updatedRental = await prisma.$transaction(async (prisma) => {
      const existingRental = await prisma.machineRental.findUnique({
        where: { id: idParsed },
      });
      if (!existingRental) throw new Error('Rental not found');

      if (data.guests) {
        data.guests = data.guests.filter(
          (guest: string, index: number, self: string[]) =>
            guest && self.indexOf(guest) === index,
        );
      }
      await prisma.machineRental.update({
        where: { id: idParsed },
        data: { ...data },
      });
      const updatedRental = await getMachineRentalView(idParsed)(prisma);
      if (
        data.rentalDate ||
        data.returnDate ||
        data.guests ||
        data.depositToPay ||
        data.paid
      ) {
        await updateEvent(
          updatedRental.eventId,
          {
            ...(data.rentalDate && { start: new Date(data.rentalDate) }),
            ...(data.returnDate && { end: new Date(data.returnDate) }),
            description: getEventRentalDescription(
              updatedRental,
              updatedRental.machineRented!,
            ),
          },
          calendarRentalId,
          updatedRental.guests,
        );
      }

      // check if new guests are added by comparing the new guests with the old guests
      // send notification only to the new guests
      const newGuests = updatedRental.guests.filter(
        (guest: string) => !existingRental.guests.includes(guest),
      );
      if (newGuests.length > 0) {
        await sendRentalNotificationEmail(updatedRental);
      }

      return updatedRental;
    });
    res.json(updatedRental);
  }),
);

// ----------------------
// OTHER ENDPOINTS (emails, parts, config, etc.)
// ----------------------

rentalMngtRoutes.get(
  '/known-emails',
  asyncHandler(async (req, res) => {
    const [machineRenteds, machineRentals] = await prisma.$transaction([
      prisma.machineRentedView.findMany({ select: { guests: true } }),
      prisma.machineRentalView.findMany({ select: { guests: true } }),
    ]);
    const emails = [
      ...new Set(
        [...machineRenteds, ...machineRentals].flatMap((machine: any) =>
          machine.guests.filter(
            (guest: string) => guest && guest.trim() !== '',
          ),
        ),
      ),
    ];
    res.json(emails);
  }),
);

rentalMngtRoutes.get(
  '/machine-rented/parts',
  asyncHandler(async (req, res) => {
    const parts = await prisma.machineRentedPart.findMany({
      select: { partName: true },
      orderBy: { partName: 'asc' },
    });
    res.json({ parts: parts.map((p) => p.partName) });
  }),
);

rentalMngtRoutes.get(
  '/machine-rented/:id',
  asyncHandler(async (req, res) => {
    logger.info(`Getting machine rented of id ${req.params.id}`);
    const idParsed = parseInt(req.params.id);
    const result = await prisma.$transaction(getMachineRentedView(idParsed));
    const { bucket_name, image_path, ...machineRented } = result;
    res.json({
      ...machineRented,
      imageUrl:
        bucket_name && image_path
          ? await getImagePublicUrl(supabase, bucket_name, image_path)
          : notFoundImage,
    });
  }),
);

rentalMngtRoutes.get(
  '/config',
  asyncHandler(async (req, res) => {
    const config = await prisma.configRentalManagement.findMany();
    res.json(config);
  }),
);

rentalMngtRoutes.put(
  '/config',
  asyncHandler(async (req, res) => {
    const config = req.body;
    if (
      !config ||
      typeof config !== 'object' ||
      typeof config['key'] !== 'string' ||
      typeof config['value'] !== 'string'
    ) {
      return res
        .status(400)
        .json({ message: 'Veuillez fournir une configuration valide.' });
    }
    const result = await prisma.configRentalManagement.createMany({
      data: [config],
      skipDuplicates: true,
    });
    res.json(result);
  }),
);

rentalMngtRoutes.delete(
  '/config/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const config = await prisma.configRentalManagement.findUnique({
      where: { key },
    });
    if (!config)
      return res.status(404).json({ message: 'Configuration non trouvée.' });
    await prisma.configRentalManagement.delete({ where: { key } });
    res.json(config);
  }),
);

rentalMngtRoutes.patch(
  '/config/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const config = await prisma.configRentalManagement.findUnique({
      where: { key },
    });
    if (!config)
      return res.status(404).json({ message: 'Configuration non trouvée.' });
    const updatedConfig = await prisma.configRentalManagement.update({
      where: { key },
      data: { value },
    });
    res.json(updatedConfig);
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

export default rentalMngtRoutes;
