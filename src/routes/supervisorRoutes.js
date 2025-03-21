import { sendEmail } from '../helper/mailer';
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from '../helper/rentalCalendar.helper';

const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const { doLogin } = require('../helper/auth.helper');
const logger = require('../config/logger');
const asyncHandler = require('../helper/asyncHandler').default;

const { uploadFileToDrive } = require('../helper/ggdrive');
const { generateUniqueString } = require('../helper/common.helper');
const { getImageUrl } = require('../helper/images.helper');
const { deleteFile, saveFile } = require('../helper/file.helper');

const SUPERVISOR_SECRET_KEY = process.env.SUPERVISOR_SECRET_KEY;
const CALENDAR_ID_PHONE_CALLBACKS = process.env.CALENDAR_ID_PHONE_CALLBACKS;

if (!CALENDAR_ID_PHONE_CALLBACKS) {
  throw new Error('CALENDAR_ID_PHONE_CALLBACKS is not defined');
}

// POST /machine-repairs
router.post(
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

router.get(
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

router.delete(
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

router.put(
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

router.patch(
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

router.delete(
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

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const role = 'SUPERVISOR';
    return await doLogin(req, res, role, SUPERVISOR_SECRET_KEY, prisma);
  }),
);

router.get(
  '/replaced-parts',
  asyncHandler(async (req, res) => {
    const replacedParts = await prisma.replacedParts.findMany();
    res.json(replacedParts);
  }),
);

router.put(
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

router.delete(
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

router.get(
  '/repairer_names',
  asyncHandler(async (req, res) => {
    const repairerNames = await prisma.repairer.findMany();
    res.json(repairerNames.map((repairer) => repairer.name));
  }),
);

router.put(
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

router.delete(
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

router.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany();
    res.json(brands.map((brand) => brand.name));
  }),
);

router.get(
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

router.get(
  '/config',
  asyncHandler(async (req, res) => {
    const config = await prisma.config.findMany();
    res.json(config);
  }),
);

router.put(
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

router.delete(
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

router.patch(
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

router.put(
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

router.delete(
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

router.put(
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

router.put(
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

router.get(
  '/machine_types',
  asyncHandler(async (req, res) => {
    const machineTypes = await prisma.machineType.findMany();
    res.json(machineTypes.map((type) => type.name));
  }),
);

router.put(
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

router.delete(
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

router.get(
  '/robot-types',
  asyncHandler(async (req, res) => {
    const robotTypes = await prisma.robotType.findMany();
    res.json(robotTypes.map((type) => type.name));
  }),
);

router.put(
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

router.delete(
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
router.get(
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
router.get(
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
router.post(
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
router.get(
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
router.put(
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
router.delete(
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

module.exports = router;
