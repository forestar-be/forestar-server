import { sendEmail } from '../helper/mailer';
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from '../helper/calendar.helper';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const supervisorRoutes = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const { doLogin } = require('../helper/auth.helper');
const logger = require('../config/logger');
const asyncHandler = require('../helper/asyncHandler').default;

const {
  uploadFileToDrive,
  getFileFromDrive,
  deleteFileFromDrive,
} = require('../helper/ggdrive');
const { generateUniqueString } = require('../helper/common.helper');
const { getImageUrl } = require('../helper/images.helper');
const { deleteFile, saveFile } = require('../helper/file.helper');
const GOOGLE_CALENDAR_PURCHASE_ORDERS_ID =
  process.env.GOOGLE_CALENDAR_PURCHASE_ORDERS_ID;
const SUPERVISOR_SECRET_KEY = process.env.SUPERVISOR_SECRET_KEY;
const CALENDAR_ID_PHONE_CALLBACKS = process.env.CALENDAR_ID_PHONE_CALLBACKS;

if (!GOOGLE_CALENDAR_PURCHASE_ORDERS_ID) {
  throw new Error('GOOGLE_CALENDAR_PURCHASE_ORDERS_ID is not defined');
}

if (!CALENDAR_ID_PHONE_CALLBACKS) {
  throw new Error('CALENDAR_ID_PHONE_CALLBACKS is not defined');
}

// POST /machine-repairs
supervisorRoutes.post(
  '/machine-repairs',
  asyncHandler(async (req, res) => {
    // Extract query parameters
    const {
      sortBy = 'createdAt', // default sorting by createdAt
      sortOrder = 'asc', // default sort order
      page,
      itemsPerPage,
    } = req.query;

    // Extract filter from request body
    const { filter = {} } = req.body;

    // Set up pagination
    const skip = page ? (parseInt(page) - 1) * parseInt(itemsPerPage) : null;
    const take = itemsPerPage ? parseInt(itemsPerPage) : null;

    const filterQuery = Object.keys(filter).reduce((acc, key) => {
      return { ...acc, [key]: { contains: filter[key] } };
    }, {});

    // Fetch filtered, paginated, and sorted data
    const machineRepairs = await prisma.machineRepair.findMany({
      where: filterQuery,
      orderBy: { [sortBy]: sortOrder }, // Apply sorting
      ...(skip && { skip }), // Apply pagination
      ...(take && { take }), // Apply pagination
      include: {
        replaced_part_list: {
          select: {
            machineRepairId: false,
            replacedPartName: false,
            quantity: true,
            replacedPart: true,
          },
        },
      },
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
        totalPages: Math.ceil(totalCount / take),
        currentPage: parseInt(page),
        itemsPerPage: take,
      },
    });
  }),
);

supervisorRoutes.get(
  '/machine-repairs/:id',
  asyncHandler(async (req, res) => {
    logger.info(`Getting machine repair of id ${req.params.id}`);
    const { id } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      include: {
        replaced_part_list: {
          select: {
            machineRepairId: false,
            replacedPartName: false,
            quantity: true,
            replacedPart: true,
          },
        },
      },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { bucket_name, image_path_list, client_signature, ...response } =
      machineRepair;

    if (bucket_name) {
      try {
        const imageUrls = await Promise.all(
          image_path_list.map((image_path) =>
            getImageUrl(bucket_name, image_path),
          ),
        );
        const signatureUrl = await getImageUrl(bucket_name, client_signature);
        res.json({ ...response, imageUrls, signatureUrl });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ error: error.message });
      }
    }
  }),
);

supervisorRoutes.delete(
  '/machine-repairs/:id/image/:imageIndex',
  asyncHandler(async (req, res) => {
    const { id, imageIndex } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      select: { bucket_name: true, image_path_list: true },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { bucket_name, image_path_list } = machineRepair;

    if (imageIndex < 0 || imageIndex >= image_path_list.length) {
      return res.status(404).json({ message: 'Image non trouvée.' });
    }

    const image_path = image_path_list[imageIndex];

    if (!image_path) {
      return res.status(404).json({ message: 'Image non trouvée.' });
    }

    try {
      // Delete the file from local storage
      deleteFile(bucket_name, image_path);

      const newImagePathList = image_path_list.filter(
        (path) => path !== image_path,
      );
      await prisma.machineRepair.update({
        where: { id: parseInt(id) },
        data: {
          image_path_list: newImagePathList,
        },
      });

      const imageUrls = await Promise.all(
        newImagePathList.map(async (image_path) => {
          return await getImageUrl(bucket_name, image_path);
        }),
      );

      res.json({ message: 'Succès.', imageUrls });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: error.message });
    }
  }),
);

supervisorRoutes.put(
  '/machine-repairs/:id/image',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      select: { bucket_name: true, image_path_list: true },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { bucket_name, image_path_list } = machineRepair;

    if (image_path_list.length >= 5) {
      return res.status(400).json({
        message: 'Vous ne pouvez pas ajouter plus de 5 images.',
      });
    }

    const webpBuffer = req.file.buffer; // WebP image buffer
    const fileName = req.file.originalname;
    const imagePath = `images/${generateUniqueString()}_${fileName}`;

    try {
      saveFile(bucket_name, imagePath, webpBuffer);
    } catch (error) {
      throw new Error(`Error saving image to local storage: ${error.message}`);
    }

    const newImagePathList = [...image_path_list, imagePath];
    await prisma.machineRepair.update({
      where: { id: parseInt(id) },
      data: {
        image_path_list: newImagePathList,
      },
    });

    const imageUrls = await Promise.all(
      newImagePathList.map(async (image_path) => {
        return await getImageUrl(bucket_name, image_path);
      }),
    );

    res.json({ message: 'Image ajoutée avec succès.', imageUrls });
  }),
);

supervisorRoutes.patch(
  '/machine-repairs/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      include: { replaced_part_list: true },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const currentParts = machineRepair.replaced_part_list;
    const newParts = data.replaced_part_list ?? null;

    // Determine parts to delete
    const partsToDelete = newParts
      ? currentParts.filter(
          (currentPart) =>
            !newParts.some(
              (newPart) =>
                newPart.replacedPart.name === currentPart.replacedPartName,
            ),
        )
      : null;

    const updatedMachineRepair = await prisma.machineRepair.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        ...(newParts
          ? {
              replaced_part_list: {
                deleteMany: partsToDelete.map((part) => ({
                  machineRepairId: parseInt(id),
                  replacedPartName: part.replacedPartName,
                })),
                upsert: newParts.map((part) => ({
                  where: {
                    machineRepairId_replacedPartName: {
                      machineRepairId: parseInt(id),
                      replacedPartName: part.replacedPart.name,
                    },
                  },
                  update: {
                    quantity: part.quantity,
                  },
                  create: {
                    quantity: part.quantity,
                    replacedPart: {
                      connect: {
                        name: part.replacedPart.name,
                      },
                    },
                  },
                })),
              },
            }
          : {}),
      },
    });

    res.json(updatedMachineRepair);
  }),
);

supervisorRoutes.delete(
  '/machine-repairs/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { bucket_name, image_path_list, client_signature } = machineRepair;

    if (bucket_name) {
      try {
        await Promise.all(
          image_path_list.map(async (image_path) => {
            logger.info(`Deleting image: ${image_path} in ${bucket_name}`);
            try {
              deleteFile(bucket_name, image_path);
            } catch (error) {
              throw new Error(`Error deleting file: ${error.message}`);
            }
          }),
        );
        logger.info(
          `Deleting signature: ${client_signature} in ${bucket_name}`,
        );
        try {
          deleteFile(bucket_name, client_signature);
        } catch (error) {
          throw new Error(`Error deleting file: ${error.message}`);
        }
      } catch (error) {
        logger.error(error);
        return res.status(500).json({ error: error.message });
      }
    }

    logger.info(`Deleting machine repair: ${id}`);
    await prisma.machineRepair.delete({
      where: { id: parseInt(id) },
    });

    res.json(machineRepair);
  }),
);

supervisorRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const role = 'SUPERVISOR';
    return await doLogin(req, res, role, SUPERVISOR_SECRET_KEY, prisma);
  }),
);

supervisorRoutes.get(
  '/replaced-parts',
  asyncHandler(async (req, res) => {
    const replacedParts = await prisma.replacedParts.findMany();
    res.json(replacedParts);
  }),
);

supervisorRoutes.put(
  '/replaced-parts',
  asyncHandler(async (req, res) => {
    const newReplacedParts = req.body;
    logger.info(`Received new replaced parts: ${newReplacedParts.length}`);

    // check if newReplacedParts is array of object if key name string and price float
    if (
      !Array.isArray(newReplacedParts) ||
      !newReplacedParts.every(
        (part) =>
          typeof part.name === 'string' && typeof part.price === 'number',
      )
    ) {
      logger.info('Invalid replaced parts format');
      return res
        .status(400)
        .json({ message: 'Veuillez fournir une liste valide de pièces.' });
    }

    const existingParts = await prisma.replacedParts.findMany();
    logger.info(`Fetching existing parts: ${existingParts.length}`);

    const existingPartsMap = new Map(
      existingParts.map((part) => [part.name, part]),
    );

    const partsToCreate = [];
    const partsToUpdate = [];
    const partsToDelete = [];

    newReplacedParts.forEach((part) => {
      if (existingPartsMap.has(part.name)) {
        const existingPart = existingPartsMap.get(part.name);
        if (existingPart.price !== part.price) {
          partsToUpdate.push(part);
        }
        existingPartsMap.delete(part.name);
      } else {
        partsToCreate.push(part);
      }
    });

    partsToDelete.push(...existingPartsMap.values());

    if (partsToDelete.length > 0) {
      logger.error(`Not allowed to delete parts: ${partsToDelete.length}`);
      return res.status(400).json({
        message: 'Vous ne pouvez pas supprimer des pièces existantes.',
      });
    }

    logger.info(`Parts to create: ${partsToCreate.length}`);
    logger.info(`Parts to update: ${partsToUpdate.length}`);

    await prisma.$transaction([
      prisma.replacedParts.createMany({
        data: partsToCreate,
      }),
      ...partsToUpdate.map((part) =>
        prisma.replacedParts.update({
          where: { name: part.name },
          data: { price: part.price },
        }),
      ),
    ]);

    logger.info('Transaction completed successfully');

    res.json({
      created: partsToCreate,
      updated: partsToUpdate,
    });
  }),
);

supervisorRoutes.delete(
  '/replaced-parts/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const replacedPart = await prisma.replacedParts.findUnique({
      where: { name },
    });
    if (!replacedPart) {
      return res.status(404).json({ message: 'Pièce non trouvée.' });
    }
    logger.info(`Deleting replaced part: ${name}`);
    await prisma.replacedParts.delete({ where: { name } });
    res.json(replacedPart);
  }),
);

supervisorRoutes.get(
  '/repairer_names',
  asyncHandler(async (req, res) => {
    const repairerNames = await prisma.repairer.findMany();
    res.json(repairerNames.map((repairer) => repairer.name));
  }),
);

supervisorRoutes.put(
  '/repairer_names',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Veuillez fournir un nom.' });
    }
    const repairer = await prisma.repairer.create({ data: { name } });
    res.json(repairer);
  }),
);

supervisorRoutes.delete(
  '/repairer_names/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const repairer = await prisma.repairer.findUnique({ where: { name } });
    if (!repairer) {
      return res.status(404).json({ message: 'Réparateur non trouvé.' });
    }
    await prisma.repairer.delete({ where: { name } });
    res.json(repairer);
  }),
);

supervisorRoutes.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany();
    res.json(brands.map((brand) => brand.name));
  }),
);

supervisorRoutes.get(
  '/allConfig',
  asyncHandler(async (req, res) => {
    const [
      brands,
      repairerNames,
      replacedParts,
      config,
      machineType,
      robotType,
    ] = await prisma.$transaction([
      prisma.brand.findMany(),
      prisma.repairer.findMany(),
      prisma.replacedParts.findMany(),
      prisma.config.findMany(),
      prisma.machineType.findMany(),
      prisma.robotType.findMany(),
    ]);
    res.json({
      brands: brands.map((brand) => brand.name),
      repairerNames: repairerNames.map((repairer) => repairer.name),
      replacedParts,
      config: config.reduce((acc, { key, value }) => {
        return { ...acc, [key]: value };
      }, {}),
      machineType: machineType.map((type) => type.name),
      robotType: robotType.map((type) => type.name),
    });
  }),
);

supervisorRoutes.get(
  '/config',
  asyncHandler(async (req, res) => {
    const config = await prisma.config.findMany();
    res.json(config);
  }),
);

supervisorRoutes.put(
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

    // update config
    const result = await prisma.config.createMany({
      data: [config],
      skipDuplicates: true,
    });

    res.json(result);
  }),
);

supervisorRoutes.delete(
  '/config/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const config = await prisma.config.findUnique({ where: { key } });
    if (!config) {
      return res.status(404).json({ message: 'Configuration non trouvée.' });
    }
    await prisma.config.delete({ where: { key } });
    res.json(config);
  }),
);

supervisorRoutes.patch(
  '/config/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const config = await prisma.config.findUnique({ where: { key } });
    if (!config) {
      return res.status(404).json({ message: 'Configuration non trouvée.' });
    }
    const updatedConfig = await prisma.config.update({
      where: { key },
      data: { value },
    });
    res.json(updatedConfig);
  }),
);

supervisorRoutes.put(
  '/brands',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Veuillez fournir un nom.' });
    }
    const brand = await prisma.brand.create({ data: { name } });
    res.json(brand);
  }),
);

supervisorRoutes.delete(
  '/brands/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const brand = await prisma.brand.findUnique({ where: { name } });
    if (!brand) {
      return res.status(404).json({ message: 'Marque non trouvée.' });
    }
    await prisma.brand.delete({ where: { name } });
    res.json(brand);
  }),
);

supervisorRoutes.put(
  '/machine-repairs/drive/:id',
  upload.single('attachment'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      select: { repair_or_maintenance: true },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { repair_or_maintenance } = machineRepair;
    const type = String(repair_or_maintenance).toLowerCase();
    const mimeType = req.file.mimetype;
    const fileName = `bon_de_${type}_${id}.pdf`;

    const response = await uploadFileToDrive(
      req.file.buffer,
      fileName,
      mimeType,
    );

    res.json(response);
  }),
);

supervisorRoutes.put(
  '/machine-repairs/email/:id',
  upload.single('attachment'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRepair = await prisma.machineRepair.findUnique({
      where: { id: parseInt(id) },
      select: { repair_or_maintenance: true, email: true },
    });

    if (!machineRepair) {
      return res.status(404).json({ message: 'Réparation non trouvée.' });
    }

    const { repair_or_maintenance, email } = machineRepair;
    const type = String(repair_or_maintenance).toLowerCase();
    const options = {
      to: email,
      subject: `Bon de ${type} - ${id}`,
      html: `Bonjour,<br>Vous trouverez ci-joint le bon pour ${type} n°${id}.
        <br><br>En vous remerciant,
        <br>Cordialement.
        <br><br>L'équipe de Forestar.`,
      attachments: [
        {
          filename: `bon_de_${type}_${id}.pdf`,
          content: req.file.buffer.toString('base64'),
          encoding: 'base64',
        },
      ],
      replyTo: process.env.REPLY_TO,
      fromName: 'Forestar Shop Atelier',
    };

    await sendEmail(options);

    res.json({ message: 'Email envoyé avec succès.' });
  }),
);

supervisorRoutes.get(
  '/machine_types',
  asyncHandler(async (req, res) => {
    const machineTypes = await prisma.machineType.findMany();
    res.json(machineTypes.map((type) => type.name));
  }),
);

supervisorRoutes.put(
  '/machine_types',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Veuillez fournir un nom.' });
    }
    const machineType = await prisma.machineType.create({ data: { name } });
    res.json(machineType);
  }),
);

supervisorRoutes.delete(
  '/machine_types/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const machineType = await prisma.machineType.findUnique({
      where: { name },
    });
    if (!machineType) {
      return res.status(404).json({ message: 'Type de machine non trouvé.' });
    }
    await prisma.machineType.delete({ where: { name } });
    res.json(machineType);
  }),
);

supervisorRoutes.get(
  '/robot-types',
  asyncHandler(async (req, res) => {
    const robotTypes = await prisma.robotType.findMany();
    res.json(robotTypes.map((type) => type.name));
  }),
);

supervisorRoutes.put(
  '/robot-types',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Veuillez fournir un nom.' });
    }
    const robotType = await prisma.robotType.create({ data: { name } });
    res.json(robotType);
  }),
);

supervisorRoutes.delete(
  '/robot-types/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const robotType = await prisma.robotType.findUnique({ where: { name } });
    if (!robotType) {
      return res.status(404).json({ message: 'Type de robot non trouvé.' });
    }
    await prisma.robotType.delete({ where: { name } });
    res.json(robotType);
  }),
);

// ===== Routes pour la gestion des rappels téléphoniques =====

// Récupérer tous les rappels téléphoniques sans pagination/filtres pour traitement côté client
supervisorRoutes.get(
  '/phone-callbacks/all',
  asyncHandler(async (req, res) => {
    try {
      const allCallbacks = await prisma.phoneCallback.findMany({
        orderBy: { createdAt: 'desc' },
      });

      res.json({ data: allCallbacks });
    } catch (error) {
      console.error('Error fetching all callbacks:', error);
      res.status(500).json({ error: 'Failed to fetch callbacks' });
    }
  }),
);

// Récupérer tous les rappels téléphoniques
supervisorRoutes.get(
  '/phone-callbacks',
  asyncHandler(async (req, res) => {
    // Extract query parameters
    const {
      sortBy = 'createdAt', // default sorting by createdAt
      sortOrder = 'desc', // default sort order
      page,
      itemsPerPage,
      completed,
    } = req.query;

    // Set up pagination
    const skip = page ? (parseInt(page) - 1) * parseInt(itemsPerPage) : null;
    const take = itemsPerPage ? parseInt(itemsPerPage) : null;

    // Set up filter
    const filter = {};
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }

    // Fetch filtered, paginated, and sorted data
    const callbacks = await prisma.phoneCallback.findMany({
      where: filter,
      orderBy: { [sortBy]: sortOrder }, // Apply sorting
      ...(skip && { skip }), // Apply pagination
      ...(take && { take }), // Apply pagination
    });

    // Get total count for pagination metadata
    const totalCount = await prisma.phoneCallback.count({
      where: filter,
    });

    // Return data with pagination info
    res.json({
      data: callbacks,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / take) || 1,
        currentPage: parseInt(page) || 1,
        itemsPerPage: take || totalCount,
      },
    });
  }),
);

// Créer un nouveau rappel téléphonique
supervisorRoutes.post(
  '/phone-callbacks',
  asyncHandler(async (req, res) => {
    const { phoneNumber, clientName, reason, description, responsiblePerson } =
      req.body;

    // Validation des données
    if (
      !phoneNumber ||
      !clientName ||
      !reason ||
      !description ||
      !responsiblePerson
    ) {
      return res
        .status(400)
        .json({ message: 'Tous les champs sont obligatoires.' });
    }

    // Utiliser une transaction Prisma pour garantir l'atomicité des opérations
    const newCallback = await prisma.$transaction(async (tx) => {
      // Créer l'entrée dans la base de données
      let callback = await tx.phoneCallback.create({
        data: {
          phoneNumber,
          clientName,
          reason,
          description,
          responsiblePerson,
          completed: false,
        },
      });

      // Créer une date de début à partir de la date actuelle
      const startDate = new Date();
      // Par défaut, prévoir 30 minutes pour le rappel
      const endDate = new Date(startDate.getTime() + 30 * 60000);

      // Créer un titre pour l'événement
      const summary = `Rappel: ${clientName} - ${getReasonText(reason)}`;
      // Créer une description pour l'événement
      const eventDescription = `
Rappel téléphonique pour ${clientName}
Numéro: ${phoneNumber}
Raison: ${getReasonText(reason)}
Description: ${description}
Responsable: ${responsiblePerson}
ID Rappel: ${callback.id}
        `;

      // Créer l'événement dans le calendrier
      const eventDetails = {
        summary,
        description: eventDescription,
        start: startDate,
        end: endDate,
      };

      // Créer l'événement et récupérer l'ID
      const eventId = await createEvent(
        eventDetails,
        CALENDAR_ID_PHONE_CALLBACKS,
        [],
        false,
      );

      // Mettre à jour le callback avec l'ID de l'événement
      callback = await tx.phoneCallback.update({
        where: { id: callback.id },
        data: { eventId: eventId },
      });

      return callback;
    });

    res.status(201).json(newCallback);
  }),
);

// Récupérer un rappel téléphonique spécifique
supervisorRoutes.get(
  '/phone-callbacks/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const callback = await prisma.phoneCallback.findUnique({
      where: { id: parseInt(id) },
    });

    if (!callback) {
      return res
        .status(404)
        .json({ message: 'Rappel téléphonique non trouvé.' });
    }

    res.json(callback);
  }),
);

// Mettre à jour un rappel téléphonique
supervisorRoutes.put(
  '/phone-callbacks/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      phoneNumber,
      clientName,
      reason,
      description,
      responsiblePerson,
      completed,
    } = req.body;

    try {
      // Vérifier si le rappel existe
      const existingCallback = await prisma.phoneCallback.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingCallback) {
        return res
          .status(404)
          .json({ message: 'Rappel téléphonique non trouvé.' });
      }

      // Mettre à jour
      const updatedCallback = await prisma.phoneCallback.update({
        where: { id: parseInt(id) },
        data: {
          phoneNumber,
          clientName,
          reason,
          description,
          responsiblePerson,
          completed,
        },
      });

      // Mettre à jour l'événement dans l'agenda si un eventId existe
      if (updatedCallback.eventId) {
        // Créer un titre pour l'événement
        const summary = `Rappel: ${clientName} - ${getReasonText(reason)}`;
        // Créer une description pour l'événement
        const eventDescription = `
Rappel téléphonique pour ${clientName}
Numéro: ${phoneNumber}
Raison: ${getReasonText(reason)}
Description: ${description}
Responsable: ${responsiblePerson}
ID Rappel: ${updatedCallback.id}
Statut: ${completed ? 'Terminé' : 'À faire'}
        `;

        // Mettre à jour l'événement avec les nouvelles informations
        const updates = {
          summary,
          description: eventDescription,
        };

        try {
          await updateEvent(
            updatedCallback.eventId,
            updates,
            CALENDAR_ID_PHONE_CALLBACKS,
            [],
            false,
          );

          // Si le rappel est marqué comme terminé, on pourrait changer la couleur de l'événement
          // ou ajouter un préfixe au titre (ex: "[TERMINÉ] Rappel...")
        } catch (error) {
          logger.error(
            `Erreur lors de la mise à jour de l'événement dans l'agenda`,
            error,
          );
        }
      }

      res.json(updatedCallback);
    } catch (error) {
      logger.error(
        'Erreur lors de la mise à jour du rappel téléphonique',
        error,
      );
      res.status(500).json({
        message: 'Erreur lors de la mise à jour du rappel téléphonique',
      });
    }
  }),
);

// Supprimer un rappel téléphonique
supervisorRoutes.delete(
  '/phone-callbacks/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Utiliser une transaction Prisma
    return await prisma.$transaction(async (tx) => {
      // Vérifier si le rappel existe
      const existingCallback = await tx.phoneCallback.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingCallback) {
        return res
          .status(404)
          .json({ message: 'Rappel téléphonique non trouvé.' });
      }

      // Supprimer l'événement du calendrier si un eventId existe
      if (existingCallback.eventId) {
        try {
          await deleteEvent(
            existingCallback.eventId,
            CALENDAR_ID_PHONE_CALLBACKS,
          );
        } catch (error) {
          logger.error(
            `Erreur lors de la suppression de l'événement dans l'agenda ${existingCallback.eventId}`,
            error,
          );
        }
      }

      // Supprimer
      await tx.phoneCallback.delete({
        where: { id: parseInt(id) },
      });

      return res.sendStatus(204);
    });
  }),
);

// Fonction utilitaire pour obtenir le texte de la raison
function getReasonText(reason) {
  switch (reason) {
    case 'warranty':
      return 'Garantie';
    case 'delivery':
      return 'Livraison';
    case 'rental':
      return 'Location';
    case 'other':
    default:
      return 'Autre';
  }
}

// Récupérer tous les robots d'inventaire
supervisorRoutes.get(
  '/robot-inventory',
  asyncHandler(async (req, res) => {
    try {
      const robots = await prisma.robotInventory.findMany({
        orderBy: { name: 'asc' },
        include: {
          inventoryPlans: true,
        },
      });

      res.json({ data: robots });
    } catch (error) {
      logger.error('Error fetching robot inventory:', error);
      res.status(500).json({ error: 'Failed to fetch robot inventory' });
    }
  }),
);

// Créer un nouveau robot d'inventaire
supervisorRoutes.post(
  '/robot-inventory',
  asyncHandler(async (req, res) => {
    const { reference, name, category, sellingPrice, purchasePrice } = req.body;

    // Validation de base
    if (!name) {
      return res
        .status(400)
        .json({ message: 'Le nom du robot est obligatoire.' });
    }

    try {
      const robot = await prisma.robotInventory.create({
        data: {
          reference,
          name,
          category,
          sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        },
      });

      res.status(201).json(robot);
    } catch (error) {
      logger.error('Error creating robot inventory:', error);
      res.status(500).json({ error: 'Failed to create robot inventory item' });
    }
  }),
);

// Récupérer un robot d'inventaire spécifique
supervisorRoutes.get(
  '/robot-inventory/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const robot = await prisma.robotInventory.findUnique({
        where: { id: parseInt(id) },
        include: {
          inventoryPlans: true,
        },
      });

      if (!robot) {
        return res.status(404).json({ message: 'Robot non trouvé.' });
      }

      res.json(robot);
    } catch (error) {
      logger.error('Error fetching robot inventory item:', error);
      res.status(500).json({ error: 'Failed to fetch robot inventory item' });
    }
  }),
);

// Mettre à jour un robot d'inventaire
supervisorRoutes.put(
  '/robot-inventory/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reference, name, category, sellingPrice, purchasePrice } = req.body;

    // Validation de base
    if (!name) {
      return res
        .status(400)
        .json({ message: 'Le nom du robot est obligatoire.' });
    }

    try {
      const robot = await prisma.robotInventory.update({
        where: { id: parseInt(id) },
        data: {
          reference,
          name,
          category,
          sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        },
      });

      res.json(robot);
    } catch (error) {
      logger.error('Error updating robot inventory:', error);
      res.status(500).json({ error: 'Failed to update robot inventory item' });
    }
  }),
);

// Supprimer un robot d'inventaire
supervisorRoutes.delete(
  '/robot-inventory/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      await prisma.robotInventory.delete({
        where: { id: parseInt(id) },
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting robot inventory:', error);
      res.status(500).json({ error: 'Failed to delete robot inventory item' });
    }
  }),
);

// Récupérer les plans d'inventaire filtrés par année et mois
supervisorRoutes.get(
  '/inventory-plans',
  asyncHandler(async (req, res) => {
    const { year, month } = req.query;

    const filter = {};
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    try {
      const plans = await prisma.inventoryPlan.findMany({
        where: filter,
        include: {
          robotInventory: true,
          antenna: true,
          plugin: true,
        },
        orderBy: {
          robotInventory: {
            name: 'asc',
          },
        },
      });

      res.json({ data: plans });
    } catch (error) {
      logger.error('Error fetching inventory plans:', error);
      res.status(500).json({ error: 'Failed to fetch inventory plans' });
    }
  }),
);

// Récupérer les plans d'inventaire groupés par année et mois
supervisorRoutes.get(
  '/inventory-summary',
  asyncHandler(async (req, res) => {
    try {
      const robots = await prisma.robotInventory.findMany({
        include: {
          inventoryPlans: true,
        },
        orderBy: { name: 'asc' },
      });

      // Obtenir toutes les années et mois uniques disponibles
      const yearsMonths = await prisma.inventoryPlan.groupBy({
        by: ['year', 'month'],
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });

      res.json({
        robots,
        periods: yearsMonths,
      });
    } catch (error) {
      logger.error('Error fetching inventory summary:', error);
      res.status(500).json({ error: 'Failed to fetch inventory summary' });
    }
  }),
);

// Créer ou mettre à jour un plan d'inventaire
supervisorRoutes.post(
  '/inventory-plans',
  asyncHandler(async (req, res) => {
    const { robotInventoryId, year, month, quantity } = req.body;

    // Validation de base
    if (!robotInventoryId || !year || !month || quantity === undefined) {
      return res.status(400).json({
        message:
          'Tous les champs (robotInventoryId, year, month, quantity) sont obligatoires.',
      });
    }

    try {
      // Upsert: Create if doesn't exist, update if exists
      const plan = await prisma.inventoryPlan.upsert({
        where: {
          robotInventoryId_year_month: {
            robotInventoryId: parseInt(robotInventoryId),
            year: parseInt(year),
            month: parseInt(month),
          },
        },
        update: {
          quantity: parseInt(quantity),
        },
        create: {
          robotInventoryId: parseInt(robotInventoryId),
          year: parseInt(year),
          month: parseInt(month),
          quantity: parseInt(quantity),
        },
      });

      res.json(plan);
    } catch (error) {
      logger.error('Error creating/updating inventory plan:', error);
      res.status(500).json({ error: 'Failed to create/update inventory plan' });
    }
  }),
);

// Supprimer un plan d'inventaire
supervisorRoutes.delete(
  '/inventory-plans/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      await prisma.inventoryPlan.delete({
        where: { id: parseInt(id) },
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting inventory plan:', error);
      res.status(500).json({ error: 'Failed to delete inventory plan' });
    }
  }),
);

// Mettre à jour plusieurs plans d'inventaire en une seule requête
supervisorRoutes.post(
  '/inventory-plans/batch',
  asyncHandler(async (req, res) => {
    const { plans } = req.body;

    if (!Array.isArray(plans)) {
      return res.status(400).json({
        message: 'Les plans doivent être fournis sous forme de tableau.',
      });
    }

    try {
      const result = await prisma.$transaction(
        plans.map((plan) => {
          return prisma.inventoryPlan.upsert({
            where: {
              robotInventoryId_year_month: {
                robotInventoryId: parseInt(plan.robotInventoryId),
                year: parseInt(plan.year),
                month: parseInt(plan.month),
              },
            },
            update: {
              quantity: parseInt(plan.quantity),
            },
            create: {
              robotInventoryId: parseInt(plan.robotInventoryId),
              year: parseInt(plan.year),
              month: parseInt(plan.month),
              quantity: parseInt(plan.quantity),
            },
          });
        }),
      );

      res.json({
        message: 'Plans mis à jour avec succès',
        count: result.length,
      });
    } catch (error) {
      logger.error('Error updating inventory plans in batch:', error);
      res.status(500).json({ error: 'Failed to update inventory plans' });
    }
  }),
);

// Add this helper function to handle calendar event creation and updates
const createOrUpdateCalendarEventPurchaseOrder = async (eventData) => {
  const {
    eventId,
    summary,
    description,
    startDate,
    endDate,
    attendees = [],
  } = eventData;

  if (eventId) {
    // Update existing event
    await updateEvent(
      eventId,
      {
        summary,
        description,
        start: startDate,
        end: endDate,
      },
      GOOGLE_CALENDAR_PURCHASE_ORDERS_ID,
      attendees,
      true,
    );
    return eventId;
  } else {
    // Create new event
    return await createEvent(
      {
        summary,
        description,
        start: startDate,
        end: endDate,
      },
      GOOGLE_CALENDAR_PURCHASE_ORDERS_ID,
      attendees,
      true,
    );
  }
};

// Helper function to process purchase order creation and updates
const processPurchaseOrder = async (req, res, isUpdate = false) => {
  let orderData = req.body;
  const { id } = req.params || {};

  // If the request contains a file and orderData as JSON string
  if (req.file && req.body.orderData) {
    orderData = JSON.parse(req.body.orderData);
  }

  // Get existing order if update
  let existingOrder = null;
  if (isUpdate) {
    existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
  }

  const {
    clientFirstName,
    clientLastName,
    clientAddress,
    clientCity,
    clientPhone,
    deposit,
    robotInventoryId,
    serialNumber,
    pluginInventoryId,
    antennaInventoryId,
    shelterInventoryId,
    hasWire,
    wireLength,
    hasAntennaSupport,
    hasPlacement,
    installationDate,
    needsInstaller,
    installationNotes,
    hasAppointment,
    isInstalled,
    isInvoiced,
  } = orderData;

  // Validate required fields for new orders
  if (!isUpdate && (!clientFirstName || !clientLastName || !robotInventoryId)) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!isUpdate) {
    // Check if robot exists
    const robot = await prisma.robotInventory.findUnique({
      where: { id: robotInventoryId },
    });

    if (!robot) {
      return res.status(400).json({ message: 'Robot not found' });
    }

    // Check if antenna exists if an ID is provided
    if (antennaInventoryId) {
      const antenna = await prisma.robotInventory.findUnique({
        where: { id: antennaInventoryId },
      });
      if (!antenna || antenna.category !== 'ANTENNA') {
        return res
          .status(400)
          .json({ message: 'Antenna not found or invalid category' });
      }
    }

    // Check if plugin exists if an ID is provided
    if (pluginInventoryId) {
      const plugin = await prisma.robotInventory.findUnique({
        where: { id: pluginInventoryId },
      });
      if (!plugin || plugin.category !== 'PLUGIN') {
        return res
          .status(400)
          .json({ message: 'Plugin not found or invalid category' });
      }
    }

    // Check if shelter exists if an ID is provided
    if (shelterInventoryId) {
      const shelter = await prisma.robotInventory.findUnique({
        where: { id: shelterInventoryId },
      });
      if (!shelter || shelter.category !== 'SHELTER') {
        return res
          .status(400)
          .json({ message: 'Shelter not found or invalid category' });
      }
    }
  }

  // Prepare data for create/update
  const orderDataForDb = isUpdate
    ? {
        clientFirstName: clientFirstName || existingOrder.clientFirstName,
        clientLastName: clientLastName || existingOrder.clientLastName,
        clientAddress:
          clientAddress !== undefined
            ? clientAddress
            : existingOrder.clientAddress,
        clientCity:
          clientCity !== undefined ? clientCity : existingOrder.clientCity,
        clientPhone:
          clientPhone !== undefined ? clientPhone : existingOrder.clientPhone,
        deposit: deposit !== undefined ? deposit : existingOrder.deposit,
        robotInventoryId: robotInventoryId || existingOrder.robotInventoryId,
        serialNumber:
          serialNumber !== undefined
            ? serialNumber
            : existingOrder.serialNumber,
        pluginInventoryId:
          pluginInventoryId !== undefined
            ? pluginInventoryId
            : existingOrder.pluginInventoryId,
        antennaInventoryId:
          antennaInventoryId !== undefined
            ? antennaInventoryId
            : existingOrder.antennaInventoryId,
        shelterInventoryId:
          shelterInventoryId !== undefined
            ? shelterInventoryId
            : existingOrder.shelterInventoryId,
        hasWire: hasWire !== undefined ? hasWire : existingOrder.hasWire,
        wireLength:
          wireLength !== undefined ? wireLength : existingOrder.wireLength,
        hasAntennaSupport:
          hasAntennaSupport !== undefined
            ? hasAntennaSupport
            : existingOrder.hasAntennaSupport,
        hasPlacement:
          hasPlacement !== undefined
            ? hasPlacement
            : existingOrder.hasPlacement,
        installationDate:
          installationDate !== undefined
            ? installationDate
              ? new Date(installationDate)
              : null
            : existingOrder.installationDate,
        needsInstaller:
          needsInstaller !== undefined
            ? needsInstaller
            : existingOrder.needsInstaller,
        installationNotes:
          installationNotes !== undefined
            ? installationNotes
            : existingOrder.installationNotes,
        hasAppointment:
          hasAppointment !== undefined
            ? hasAppointment
            : existingOrder.hasAppointment,
        isInstalled:
          isInstalled !== undefined ? isInstalled : existingOrder.isInstalled,
        isInvoiced:
          isInvoiced !== undefined ? isInvoiced : existingOrder.isInvoiced,
      }
    : {
        clientFirstName,
        clientLastName,
        clientAddress: clientAddress || '',
        clientCity: clientCity || '',
        clientPhone: clientPhone || '',
        deposit: deposit || 0,
        robotInventoryId,
        serialNumber: serialNumber || '',
        pluginInventoryId,
        antennaInventoryId,
        shelterInventoryId,
        hasWire: hasWire || false,
        wireLength: wireLength || null,
        hasAntennaSupport: hasAntennaSupport || false,
        hasPlacement: hasPlacement || false,
        installationDate: installationDate ? new Date(installationDate) : null,
        needsInstaller: needsInstaller || false,
        installationNotes: installationNotes || null,
        hasAppointment: hasAppointment || false,
        isInstalled: isInstalled || false,
        isInvoiced: isInvoiced || false,
      };

  // Create or update purchase order using transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create or update the purchase order
    let purchaseOrder;

    if (isUpdate) {
      purchaseOrder = await tx.purchaseOrder.update({
        where: { id: parseInt(id) },
        data: orderDataForDb,
        include: {
          robotInventory: true,
          antenna: true,
          plugin: true,
          shelter: true,
        },
      });
    } else {
      purchaseOrder = await tx.purchaseOrder.create({
        data: orderDataForDb,
        include: {
          robotInventory: true,
          antenna: true,
          plugin: true,
          shelter: true,
        },
      });

      // Update inventory only on creation
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Update robot inventory
      await updateInventoryForItem(
        tx,
        robotInventoryId,
        currentYear,
        currentMonth,
      );

      // Update antenna inventory if selected
      if (antennaInventoryId) {
        await updateInventoryForItem(
          tx,
          antennaInventoryId,
          currentYear,
          currentMonth,
        );
      }

      // Update plugin inventory if selected
      if (pluginInventoryId) {
        await updateInventoryForItem(
          tx,
          pluginInventoryId,
          currentYear,
          currentMonth,
        );
      }

      // Update shelter inventory if selected
      if (shelterInventoryId) {
        await updateInventoryForItem(
          tx,
          shelterInventoryId,
          currentYear,
          currentMonth,
        );
      }
    }

    // Handle PDF upload
    if (req.file) {
      if (isUpdate && purchaseOrder.orderPdfId) {
        await deleteFileFromDrive(purchaseOrder.orderPdfId);
      }

      const { id: fileId } = await uploadFileToDrive(
        req.file.buffer,
        `bon_commande_${purchaseOrder.id}_${purchaseOrder.clientFirstName}_${purchaseOrder.clientLastName}.pdf`,
        'application/pdf',
        'PURCHASE_ORDERS',
      );

      // Update the purchase order with the PDF ID
      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { orderPdfId: fileId },
      });

      purchaseOrder.orderPdfId = fileId;
    }

    // Handle calendar event
    if (isUpdate) {
      // Update/create/delete event if needed
      if (installationDate !== undefined) {
        if (installationDate) {
          const eventId = await createOrUpdateCalendarEventPurchaseOrder({
            eventId: existingOrder.eventId,
            summary: `Installation robot - ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}`,
            description: `Installation robot ${purchaseOrder.robotInventory.name} pour ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}
Adresse: ${purchaseOrder.clientAddress}
Téléphone: ${purchaseOrder.clientPhone}`,
            location: purchaseOrder.clientAddress,
            startDate: new Date(installationDate),
            endDate: new Date(installationDate),
            attendees: [],
          });

          if (eventId && !existingOrder.eventId) {
            await tx.purchaseOrder.update({
              where: { id: purchaseOrder.id },
              data: { eventId },
            });
            purchaseOrder.eventId = eventId;
          }
        } else if (existingOrder.eventId) {
          // If installation date removed, delete event
          await deleteEvent(
            existingOrder.eventId,
            GOOGLE_CALENDAR_PURCHASE_ORDERS_ID,
          );
          await tx.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: { eventId: null },
          });
          purchaseOrder.eventId = null;
        }
      }
    } else if (installationDate) {
      // For new orders, create event if installationDate is provided
      const eventId = await createOrUpdateCalendarEventPurchaseOrder({
        summary: `Installation robot - ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}`,
        description: `Installation robot ${purchaseOrder.robotInventory.name} pour ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}
Adresse: ${purchaseOrder.clientAddress}
Téléphone: ${purchaseOrder.clientPhone}`,
        location: purchaseOrder.clientAddress,
        startDate: new Date(installationDate),
        endDate: new Date(installationDate),
        attendees: [],
      });

      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { eventId },
      });
      purchaseOrder.eventId = eventId;
    }

    return purchaseOrder;
  });

  // Return purchase order data
  res.status(isUpdate ? 200 : 201).json(result);
};

// Helper function to update inventory for an item
const updateInventoryForItem = async (tx, inventoryId, year, month) => {
  const inventoryPlan = await tx.inventoryPlan.findUnique({
    where: {
      robotInventoryId_year_month: {
        robotInventoryId: inventoryId,
        year,
        month,
      },
    },
  });

  if (inventoryPlan) {
    // If inventory plan exists, update it
    await tx.inventoryPlan.update({
      where: {
        robotInventoryId_year_month: {
          robotInventoryId: inventoryId,
          year,
          month,
        },
      },
      data: {
        quantity: inventoryPlan.quantity - 1,
      },
    });
  } else {
    // If inventory plan doesn't exist, create it with quantity = -1
    await tx.inventoryPlan.create({
      data: {
        robotInventoryId: inventoryId,
        year,
        month,
        quantity: -1, // Start with -1 since we're selling one
      },
    });
  }
};

// Purchase Orders routes
supervisorRoutes.get(
  '/purchase-orders',
  asyncHandler(async (req, res) => {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ data: purchaseOrders });
  }),
);

supervisorRoutes.get(
  '/purchase-orders/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    res.json(purchaseOrder);
  }),
);

supervisorRoutes.post(
  '/purchase-orders',
  upload.single('pdf'),
  asyncHandler(async (req, res) => {
    return processPurchaseOrder(req, res, false);
  }),
);

supervisorRoutes.put(
  '/purchase-orders/:id',
  upload.single('pdf'),
  asyncHandler(async (req, res) => {
    return processPurchaseOrder(req, res, true);
  }),
);

supervisorRoutes.delete(
  '/purchase-orders/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if purchase order exists
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete calendar event if exists
      if (existingOrder.eventId) {
        try {
          await deleteEvent(
            existingOrder.eventId,
            GOOGLE_CALENDAR_PURCHASE_ORDERS_ID,
          );
        } catch (error) {
          console.error('Failed to delete calendar event:', error);
        }
      }

      // Delete file from Google Drive if exists
      if (existingOrder.orderPdfId) {
        try {
          await deleteFileFromDrive(existingOrder.orderPdfId);
        } catch (error) {
          console.error('Failed to delete PDF from drive:', error);
        }
      }

      // Get the creation date of the purchase order to determine the inventory period
      const orderDate = new Date(existingOrder.createdAt);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth() + 1; // JavaScript months are 0-indexed

      // Find and update the robot inventory plan
      await restoreInventoryItem(
        tx,
        existingOrder.robotInventoryId,
        orderYear,
        orderMonth,
      );

      // Restore antenna inventory if exists
      if (existingOrder.antennaInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.antennaInventoryId,
          orderYear,
          orderMonth,
        );
      }

      // Restore plugin inventory if exists
      if (existingOrder.pluginInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.pluginInventoryId,
          orderYear,
          orderMonth,
        );
      }

      // Restore shelter inventory if exists
      if (existingOrder.shelterInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.shelterInventoryId,
          orderYear,
          orderMonth,
        );
      }

      // Delete purchase order
      await tx.purchaseOrder.delete({
        where: { id: parseInt(id) },
      });
    });

    res.status(204).send();
  }),
);

// Helper function to restore inventory item quantity
const restoreInventoryItem = async (tx, inventoryId, year, month) => {
  const inventoryPlan = await tx.inventoryPlan.findUnique({
    where: {
      robotInventoryId_year_month: {
        robotInventoryId: inventoryId,
        year,
        month,
      },
    },
  });

  if (inventoryPlan) {
    await tx.inventoryPlan.update({
      where: {
        robotInventoryId_year_month: {
          robotInventoryId: inventoryId,
          year,
          month,
        },
      },
      data: {
        quantity: inventoryPlan.quantity + 1,
      },
    });
  }
};

// Get PDF for a purchase order
supervisorRoutes.get(
  '/purchase-orders/:id/pdf',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if purchase order exists
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingOrder || !existingOrder.orderPdfId) {
      return res.status(404).json({ message: 'Purchase order PDF not found' });
    }

    try {
      // Get file from Google Drive
      const { fileBuffer, fileName, mimeType } = await getFileFromDrive(
        existingOrder.orderPdfId,
        'PURCHASE_ORDERS',
      );

      // Set response headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

      // Send file
      res.send(fileBuffer);
    } catch (error) {
      console.error('Failed to get PDF from drive:', error);
      res
        .status(500)
        .json({ message: 'Failed to get PDF', error: error.message });
    }
  }),
);

supervisorRoutes.patch(
  '/purchase-orders/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { hasAppointment, isInstalled, isInvoiced } = req.body;

    // Validate that at least one status field is provided
    if (
      hasAppointment === undefined &&
      isInstalled === undefined &&
      isInvoiced === undefined
    ) {
      return res.status(400).json({ message: 'No status fields provided' });
    }

    // Update only the provided status fields
    const updateData = {};
    if (hasAppointment !== undefined)
      updateData.hasAppointment = hasAppointment;
    if (isInstalled !== undefined) updateData.isInstalled = isInstalled;
    if (isInvoiced !== undefined) updateData.isInvoiced = isInvoiced;

    try {
      const updatedOrder = await prisma.purchaseOrder.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          robotInventory: true,
          antenna: true,
          plugin: true,
          shelter: true,
        },
      });

      res.json(updatedOrder);
    } catch (error) {
      console.error('Error updating purchase order status:', error);
      res
        .status(500)
        .json({ message: 'Failed to update purchase order status' });
    }
  }),
);

// Get all installation preparation texts
supervisorRoutes.get(
  '/installation-preparation-texts',
  asyncHandler(async (req, res) => {
    const texts = await prisma.installationPreparationText.findMany({
      orderBy: {
        order: 'asc',
      },
    });
    res.json(texts);
  }),
);

// Add a new installation preparation text
supervisorRoutes.post(
  '/installation-preparation-texts',
  asyncHandler(async (req, res) => {
    const { content, type, order } = req.body;

    // Validate input
    if (!content || !type || order === undefined) {
      return res
        .status(400)
        .json({ message: 'Content, type, and order are required' });
    }

    // If order is specified, shift all items with equal or higher order
    if (order !== undefined) {
      await prisma.installationPreparationText.updateMany({
        where: {
          order: {
            gte: order,
          },
        },
        data: {
          order: {
            increment: 1,
          },
        },
      });
    }

    const newText = await prisma.installationPreparationText.create({
      data: {
        content,
        type,
        order,
      },
    });

    res.status(201).json(newText);
  }),
);

// Update an installation preparation text
supervisorRoutes.patch(
  '/installation-preparation-texts/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, type, order } = req.body;

    // Get the current text
    const currentText = await prisma.installationPreparationText.findUnique({
      where: { id: parseInt(id) },
    });

    if (!currentText) {
      return res.status(404).json({ message: 'Text not found' });
    }

    // Handle order changes if needed
    if (order !== undefined && order !== currentText.order) {
      if (order > currentText.order) {
        // Moving down - decrement items in between
        await prisma.installationPreparationText.updateMany({
          where: {
            order: {
              gt: currentText.order,
              lte: order,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
          },
        });
      } else {
        // Moving up - increment items in between
        await prisma.installationPreparationText.updateMany({
          where: {
            order: {
              gte: order,
              lt: currentText.order,
            },
          },
          data: {
            order: {
              increment: 1,
            },
          },
        });
      }
    }

    // Update the text
    const updatedText = await prisma.installationPreparationText.update({
      where: { id: parseInt(id) },
      data: {
        content: content !== undefined ? content : undefined,
        type: type !== undefined ? type : undefined,
        order: order !== undefined ? order : undefined,
      },
    });

    res.json(updatedText);
  }),
);

// Delete an installation preparation text
supervisorRoutes.delete(
  '/installation-preparation-texts/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get the text to delete
    const textToDelete = await prisma.installationPreparationText.findUnique({
      where: { id: parseInt(id) },
    });

    if (!textToDelete) {
      return res.status(404).json({ message: 'Text not found' });
    }

    // Delete the text
    await prisma.installationPreparationText.delete({
      where: { id: parseInt(id) },
    });

    // Reorder remaining texts
    await prisma.installationPreparationText.updateMany({
      where: {
        order: {
          gt: textToDelete.order,
        },
      },
      data: {
        order: {
          decrement: 1,
        },
      },
    });

    res.status(204).send();
  }),
);

// Reorder installation preparation texts
supervisorRoutes.post(
  '/installation-preparation-texts/reorder',
  asyncHandler(async (req, res) => {
    const { textIds } = req.body;

    if (!Array.isArray(textIds)) {
      return res.status(400).json({ message: 'textIds array is required' });
    }

    // Update order in transaction
    await prisma.$transaction(
      textIds.map((id, index) =>
        prisma.installationPreparationText.update({
          where: { id: parseInt(id.toString()) },
          data: { order: index },
        }),
      ),
    );

    const updatedTexts = await prisma.installationPreparationText.findMany({
      orderBy: { order: 'asc' },
    });

    res.json(updatedTexts);
  }),
);

module.exports = supervisorRoutes;
