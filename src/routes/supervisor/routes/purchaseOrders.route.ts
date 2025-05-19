import express from 'express';
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from '../../../helper/calendar.helper';
import asyncHandler from '../../../helper/asyncHandler';
import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import fs from 'node:fs';
import path from 'path';
import sharp from 'sharp';

const {
  uploadFileToDrive,
  getFileFromDrive,
  deleteFileFromDrive,
} = require('../../../helper/ggdrive');

const prisma = new PrismaClient();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const purchaseOrdersRoutes = express.Router();

const GOOGLE_CALENDAR_PURCHASE_ORDERS_ID =
  process.env.GOOGLE_CALENDAR_PURCHASE_ORDERS_ID;
const CALENDAR_ID_PHONE_CALLBACKS = process.env.CALENDAR_ID_PHONE_CALLBACKS;
const DEVIS_FOLDER = process.env.DEVIS_BASE_DIR;

if (!DEVIS_FOLDER) {
  throw new Error('DEVIS_BASE_DIR is not defined');
}

if (!fs.existsSync(DEVIS_FOLDER) || !fs.statSync(DEVIS_FOLDER).isDirectory()) {
  throw new Error(
    `Directory ${DEVIS_FOLDER} does not exist or is not a directory`,
  );
}

const PHOTOS_FOLDER = path.join(DEVIS_FOLDER, 'photos');

// Create photos directory if it doesn't exist
if (!fs.existsSync(PHOTOS_FOLDER)) {
  fs.mkdirSync(PHOTOS_FOLDER, { recursive: true });
}

if (!GOOGLE_CALENDAR_PURCHASE_ORDERS_ID) {
  throw new Error('GOOGLE_CALENDAR_PURCHASE_ORDERS_ID is not defined');
}

if (!CALENDAR_ID_PHONE_CALLBACKS) {
  throw new Error('CALENDAR_ID_PHONE_CALLBACKS is not defined');
}

// Add this helper function to handle calendar event creation and updates
const createOrUpdateCalendarEventPurchaseOrder = async (eventData: {
  eventId?: any;
  summary: any;
  description: any;
  location?: any;
  startDate: any;
  endDate: any;
  attendees: any;
}) => {
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

// Helper function to compress and save photo
const processAndSavePhoto = async (
  buffer: Buffer,
  orderId: number,
  index: number,
): Promise<string> => {
  const orderDir = path.join(PHOTOS_FOLDER, orderId.toString());

  // Create directory if it doesn't exist
  if (!fs.existsSync(orderDir)) {
    fs.mkdirSync(orderDir, { recursive: true });
  }

  const fileName = `photo_${index}_${Date.now()}.webp`;
  const photoPath = path.join(orderDir, fileName);

  // Process and save as WebP
  await sharp(buffer)
    .resize(800) // Resize to a reasonable dimension
    .webp({ quality: 75 }) // Use WebP format with moderate quality
    .toFile(photoPath);

  // Check if the file is larger than 50KB
  const stats = fs.statSync(photoPath);
  if (stats.size > 50 * 1024) {
    // If too large, reprocess with lower quality
    await sharp(buffer)
      .resize(600) // Smaller dimensions
      .webp({ quality: 60 }) // Lower quality
      .toFile(photoPath);

    // If still too large, try one more time with even lower quality
    const newStats = fs.statSync(photoPath);
    if (newStats.size > 50 * 1024) {
      await sharp(buffer)
        .resize(400) // Even smaller dimensions
        .webp({ quality: 40 }) // Much lower quality
        .toFile(photoPath);
    }
  }

  // Return relative path to be stored in DB
  return path.join('photos', orderId.toString(), fileName);
};

// Helper function to delete photo file
const deletePhotoFile = (photoPath: string) => {
  if (!photoPath) return;

  const fullPath = path.join(DEVIS_FOLDER, photoPath);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);

    // Check if directory is empty and remove it if it is
    const dirPath = path.dirname(fullPath);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        fs.rmdirSync(dirPath);
      }
    }
  }
};

// Helper function to save invoice file locally
const saveInvoiceFile = async (
  buffer: Buffer,
  orderId: number,
  fileName: string,
) => {
  const orderDir = path.join(DEVIS_FOLDER, orderId.toString());

  // Create directory if it doesn't exist
  if (!fs.existsSync(orderDir)) {
    fs.mkdirSync(orderDir, { recursive: true });
  }

  const invoicePath = path.join(orderDir, fileName);

  // Write file to disk
  fs.writeFileSync(invoicePath, buffer);

  // Return relative path to be stored in DB
  return path.join(orderId.toString(), fileName);
};

// Helper function to delete invoice file
const deleteInvoiceFile = (invoicePath: string) => {
  if (!invoicePath) return;

  const fullPath = path.join(DEVIS_FOLDER, invoicePath);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);

    // Check if directory is empty and remove it if it is
    const dirPath = path.dirname(fullPath);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      if (files.length === 0) {
        fs.rmdirSync(dirPath);
      }
    }
  }
};

// Helper function to process purchase order creation and updates
const processPurchaseOrder = async (
  req: express.Request,
  res: express.Response,
  isUpdate = false,
) => {
  let orderData = req.body;
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const { id } = req.params || {};

  // If the request contains files and orderData as JSON string
  if (files && req.body.orderData) {
    orderData = JSON.parse(req.body.orderData);
  } else if (req.file && req.body.orderData) {
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
    validUntil,
    bankAccountNumber,
    deleteInvoice,
    photosToDelete,
  } = orderData;

  // Validate required fields for new orders
  if (!isUpdate && (!clientFirstName || !clientLastName || !robotInventoryId)) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Check if inventory items exist and are of the correct category (for new orders or changes in inventory items)
  if (!isUpdate || robotInventoryId !== existingOrder!.robotInventoryId) {
    // Check if robot exists
    const robot = await prisma.robotInventory.findUnique({
      where: { id: robotInventoryId },
    });

    if (!robot) {
      return res.status(400).json({ message: 'Robot not found' });
    }
  }

  // Check if antenna exists if an ID is provided and it differs from current
  if (
    antennaInventoryId &&
    (!isUpdate || antennaInventoryId !== existingOrder!.antennaInventoryId)
  ) {
    const antenna = await prisma.robotInventory.findUnique({
      where: { id: antennaInventoryId },
    });
    if (!antenna || antenna.category !== 'ANTENNA') {
      return res
        .status(400)
        .json({ message: 'Antenna not found or invalid category' });
    }
  }

  // Check if plugin exists if an ID is provided and it differs from current
  if (
    pluginInventoryId &&
    (!isUpdate || pluginInventoryId !== existingOrder!.pluginInventoryId)
  ) {
    const plugin = await prisma.robotInventory.findUnique({
      where: { id: pluginInventoryId },
    });
    if (!plugin || plugin.category !== 'PLUGIN') {
      return res
        .status(400)
        .json({ message: 'Plugin not found or invalid category' });
    }
  }

  // Check if shelter exists if an ID is provided and it differs from current
  if (
    shelterInventoryId &&
    (!isUpdate || shelterInventoryId !== existingOrder!.shelterInventoryId)
  ) {
    const shelter = await prisma.robotInventory.findUnique({
      where: { id: shelterInventoryId },
    });
    if (!shelter || shelter.category !== 'SHELTER') {
      return res
        .status(400)
        .json({ message: 'Shelter not found or invalid category' });
    }
  }

  // Prepare data for create/update
  const orderDataForDb = isUpdate
    ? {
        clientFirstName: clientFirstName || existingOrder!.clientFirstName,
        clientLastName: clientLastName || existingOrder!.clientLastName,
        clientAddress:
          clientAddress !== undefined
            ? clientAddress
            : existingOrder!.clientAddress,
        clientCity:
          clientCity !== undefined ? clientCity : existingOrder!.clientCity,
        clientPhone:
          clientPhone !== undefined ? clientPhone : existingOrder!.clientPhone,
        deposit: deposit !== undefined ? deposit : existingOrder!.deposit,
        robotInventoryId: robotInventoryId || existingOrder!.robotInventoryId,
        serialNumber:
          serialNumber !== undefined
            ? serialNumber
            : existingOrder!.serialNumber,
        pluginInventoryId:
          pluginInventoryId !== undefined
            ? pluginInventoryId
            : existingOrder!.pluginInventoryId,
        antennaInventoryId:
          antennaInventoryId !== undefined
            ? antennaInventoryId
            : existingOrder!.antennaInventoryId,
        shelterInventoryId:
          shelterInventoryId !== undefined
            ? shelterInventoryId
            : existingOrder!.shelterInventoryId,
        hasWire: hasWire !== undefined ? hasWire : existingOrder!.hasWire,
        wireLength:
          wireLength !== undefined ? wireLength : existingOrder!.wireLength,
        hasAntennaSupport:
          hasAntennaSupport !== undefined
            ? hasAntennaSupport
            : existingOrder!.hasAntennaSupport,
        hasPlacement:
          hasPlacement !== undefined
            ? hasPlacement
            : existingOrder!.hasPlacement,
        installationDate:
          installationDate !== undefined
            ? installationDate
              ? new Date(installationDate)
              : null
            : existingOrder!.installationDate,
        needsInstaller:
          needsInstaller !== undefined
            ? needsInstaller
            : existingOrder!.needsInstaller,
        installationNotes:
          installationNotes !== undefined
            ? installationNotes
            : existingOrder!.installationNotes,
        hasAppointment:
          hasAppointment !== undefined
            ? hasAppointment
            : existingOrder!.hasAppointment,
        isInstalled:
          isInstalled !== undefined ? isInstalled : existingOrder!.isInstalled,
        isInvoiced:
          isInvoiced !== undefined ? isInvoiced : existingOrder!.isInvoiced,
        validUntil:
          validUntil !== undefined
            ? validUntil && validUntil.trim() !== ''
              ? new Date(validUntil)
              : null
            : existingOrder!.validUntil,
        bankAccountNumber:
          bankAccountNumber !== undefined
            ? bankAccountNumber
            : existingOrder!.bankAccountNumber,
        // If deleteInvoice is true, set invoicePath to null
        invoicePath: deleteInvoice === true ? null : undefined,
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
        validUntil:
          validUntil && validUntil.trim() !== '' ? new Date(validUntil) : null,
        photosPaths: [], // Initialize empty for new orders
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

      // Handle inventory updates for edit case
      // Get the creation date of the original order to determine inventory year
      const orderDate = new Date(existingOrder!.createdAt);
      const inventoryYear = orderDate.getFullYear();

      // Check if robot has changed
      if (
        robotInventoryId &&
        robotInventoryId !== existingOrder!.robotInventoryId
      ) {
        // Restore old robot inventory
        await restoreInventoryItem(
          tx,
          existingOrder!.robotInventoryId,
          inventoryYear,
        );
        // Update new robot inventory
        await updateInventoryForItem(tx, robotInventoryId, inventoryYear);
      }

      // Check if antenna has changed
      if (antennaInventoryId !== existingOrder!.antennaInventoryId) {
        // If there was a previous antenna, restore its inventory
        if (existingOrder!.antennaInventoryId) {
          await restoreInventoryItem(
            tx,
            existingOrder!.antennaInventoryId,
            inventoryYear,
          );
        }

        // If there's a new antenna, update its inventory
        if (antennaInventoryId) {
          await updateInventoryForItem(tx, antennaInventoryId, inventoryYear);
        }
      }

      // Check if plugin has changed
      if (pluginInventoryId !== existingOrder!.pluginInventoryId) {
        // If there was a previous plugin, restore its inventory
        if (existingOrder!.pluginInventoryId) {
          await restoreInventoryItem(
            tx,
            existingOrder!.pluginInventoryId,
            inventoryYear,
          );
        }

        // If there's a new plugin, update its inventory
        if (pluginInventoryId) {
          await updateInventoryForItem(tx, pluginInventoryId, inventoryYear);
        }
      }

      // Check if shelter has changed
      if (shelterInventoryId !== existingOrder!.shelterInventoryId) {
        // If there was a previous shelter, restore its inventory
        if (existingOrder!.shelterInventoryId) {
          await restoreInventoryItem(
            tx,
            existingOrder!.shelterInventoryId,
            inventoryYear,
          );
        }

        // If there's a new shelter, update its inventory
        if (shelterInventoryId) {
          await updateInventoryForItem(tx, shelterInventoryId, inventoryYear);
        }
      }

      // Handle invoice deletion if requested
      if (deleteInvoice && existingOrder!.invoicePath) {
        deleteInvoiceFile(existingOrder!.invoicePath);
      }

      // Handle photos to delete if any
      if (Array.isArray(photosToDelete) && photosToDelete.length > 0) {
        // Get existing photos
        const existingPhotos = existingOrder!.photosPaths || [];
        const updatedPhotos = existingPhotos.filter(
          (path) => !photosToDelete.includes(path),
        );

        // Delete photo files
        photosToDelete.forEach((photoPath: string) => {
          deletePhotoFile(photoPath);
        });

        // Update photos array in database
        await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { photosPaths: updatedPhotos },
        });

        // Update local purchaseOrder object
        purchaseOrder.photosPaths = updatedPhotos;
      }
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

      // Update robot inventory
      await updateInventoryForItem(tx, robotInventoryId, currentYear);

      // Update antenna inventory if selected
      if (antennaInventoryId) {
        await updateInventoryForItem(tx, antennaInventoryId, currentYear);
      }

      // Update plugin inventory if selected
      if (pluginInventoryId) {
        await updateInventoryForItem(tx, pluginInventoryId, currentYear);
      }

      // Update shelter inventory if selected
      if (shelterInventoryId) {
        await updateInventoryForItem(tx, shelterInventoryId, currentYear);
      }
    }

    // Handle separate invoice file if it exists
    let invoicePath = existingOrder?.invoicePath;
    let invoiceFile = null;

    if (files && files.invoice && files.invoice[0]) {
      invoiceFile = files.invoice[0];
    } else if (files && files.pdf && files.pdf[1]) {
      // Handle case when both PDF and invoice are uploaded as array
      invoiceFile = files.pdf[1];
    }

    if (invoiceFile) {
      // If updating and there's an existing invoice, delete it
      if (isUpdate && existingOrder!.invoicePath && !deleteInvoice) {
        deleteInvoiceFile(existingOrder!.invoicePath);
      }

      // Save the new invoice file
      const fileName = `invoice_${purchaseOrder.id}_${Date.now()}.pdf`;
      invoicePath = await saveInvoiceFile(
        invoiceFile.buffer,
        purchaseOrder.id,
        fileName,
      );

      // Update the purchase order with the invoice path
      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { invoicePath },
      });
    }

    // Handle photo uploads if they exist
    if (files && files.photos) {
      const photoFiles = files.photos;
      const photosPaths = [...(purchaseOrder.photosPaths || [])];

      // Process each photo
      for (let i = 0; i < photoFiles.length; i++) {
        const photoFile = photoFiles[i];
        try {
          const photoPath = await processAndSavePhoto(
            photoFile.buffer,
            purchaseOrder.id,
            photosPaths.length,
          );
          photosPaths.push(photoPath);
        } catch (error) {
          console.error(`Error processing photo ${i}:`, error);
        }
      }

      // Update the purchase order with the photo paths
      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { photosPaths },
      });

      // Update local purchaseOrder object
      purchaseOrder.photosPaths = photosPaths;
    }

    // Handle PDF upload
    if (req.file || (files && files.pdf && files.pdf[0])) {
      const pdfFile = req.file || files?.pdf?.[0];

      if (isUpdate && purchaseOrder.orderPdfId) {
        await deleteFileFromDrive(purchaseOrder.orderPdfId);
      }
      const { id: fileId } = await uploadFileToDrive(
        pdfFile?.buffer,
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
            eventId: existingOrder!.eventId,
            summary: `Installation robot - ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}`,
            description: `Installation robot ${purchaseOrder.robotInventory.name} pour ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}
  Adresse: ${purchaseOrder.clientAddress}
  Téléphone: ${purchaseOrder.clientPhone}`,
            location: purchaseOrder.clientAddress,
            startDate: new Date(installationDate),
            endDate: new Date(installationDate),
            attendees: [],
          });

          if (eventId && !existingOrder!.eventId) {
            await tx.purchaseOrder.update({
              where: { id: purchaseOrder.id },
              data: { eventId },
            });
            purchaseOrder.eventId = eventId;
          }
        } else if (existingOrder!.eventId) {
          // If installation date removed, delete event
          await deleteEvent(
            existingOrder!.eventId,
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
const updateInventoryForItem = async (
  tx: {
    inventoryPlan: {
      findUnique: (arg0: {
        where: { robotInventoryId_year: { robotInventoryId: any; year: any } };
      }) => any;
      update: (arg0: {
        where: { robotInventoryId_year: { robotInventoryId: any; year: any } };
        data: { quantity: number };
      }) => any;
      create: (arg0: {
        data: { robotInventoryId: any; year: any; quantity: number };
      }) => any;
    };
  },
  inventoryId: any,
  year: number,
) => {
  const inventoryPlan = await tx.inventoryPlan.findUnique({
    where: {
      robotInventoryId_year: {
        robotInventoryId: inventoryId,
        year,
      },
    },
  });

  if (inventoryPlan) {
    // If inventory plan exists, update it
    await tx.inventoryPlan.update({
      where: {
        robotInventoryId_year: {
          robotInventoryId: inventoryId,
          year,
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
        quantity: -1, // Start with -1 since we're selling one
      },
    });
  }
};

// Purchase Orders routes
purchaseOrdersRoutes.get(
  '/',
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

purchaseOrdersRoutes.get(
  '/:id',
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

// Route to get invoice file
purchaseOrdersRoutes.get(
  '/:id/invoice',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      select: { invoicePath: true },
    });

    if (!purchaseOrder || !purchaseOrder.invoicePath) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const fullPath = path.join(DEVIS_FOLDER, purchaseOrder.invoicePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Invoice file not found' });
    }

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice_${id}.pdf"`,
    );

    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  }),
);

// Route to get photo file
purchaseOrdersRoutes.get(
  '/:id/photo/:photoIndex',
  asyncHandler(async (req, res) => {
    const { id, photoIndex } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      select: { photosPaths: true },
    });

    if (
      !purchaseOrder ||
      !purchaseOrder.photosPaths ||
      purchaseOrder.photosPaths.length <= parseInt(photoIndex)
    ) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const photoPath = purchaseOrder.photosPaths[parseInt(photoIndex)];
    const fullPath = path.join(DEVIS_FOLDER, photoPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Photo file not found' });
    }

    // Set headers
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="photo_${id}_${photoIndex}.webp"`,
    );

    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  }),
);

// Update multer to handle multiple file uploads including photos
const multiUpload = multer({ storage: multer.memoryStorage() }).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
  { name: 'photos', maxCount: 10 }, // Allow up to 10 photos
]);

purchaseOrdersRoutes.post(
  '/',
  multiUpload,
  asyncHandler(async (req, res) => {
    return processPurchaseOrder(req, res, false);
  }),
);

purchaseOrdersRoutes.put(
  '/:id',
  multiUpload,
  asyncHandler(async (req, res) => {
    return processPurchaseOrder(req, res, true);
  }),
);

purchaseOrdersRoutes.delete(
  '/:id',
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

      // Delete invoice file if exists
      if (existingOrder.invoicePath) {
        try {
          deleteInvoiceFile(existingOrder.invoicePath);
        } catch (error) {
          console.error('Failed to delete invoice file:', error);
        }
      }

      // Delete all photo files if exist
      if (existingOrder.photosPaths && existingOrder.photosPaths.length > 0) {
        existingOrder.photosPaths.forEach((photoPath) => {
          try {
            deletePhotoFile(photoPath);
          } catch (error) {
            console.error('Failed to delete photo file:', error);
          }
        });
      }

      // Get the creation date of the purchase order to determine the inventory period
      const orderDate = new Date(existingOrder.createdAt);
      const orderYear = orderDate.getFullYear();

      // Find and update the robot inventory plan
      await restoreInventoryItem(tx, existingOrder.robotInventoryId, orderYear);

      // Restore antenna inventory if exists
      if (existingOrder.antennaInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.antennaInventoryId,
          orderYear,
        );
      }

      // Restore plugin inventory if exists
      if (existingOrder.pluginInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.pluginInventoryId,
          orderYear,
        );
      }

      // Restore shelter inventory if exists
      if (existingOrder.shelterInventoryId) {
        await restoreInventoryItem(
          tx,
          existingOrder.shelterInventoryId,
          orderYear,
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
const restoreInventoryItem = async (
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  inventoryId: any,
  year: number,
) => {
  const inventoryPlan = await tx.inventoryPlan.findUnique({
    where: {
      robotInventoryId_year: {
        robotInventoryId: inventoryId,
        year,
      },
    },
  });

  if (inventoryPlan) {
    await tx.inventoryPlan.update({
      where: {
        robotInventoryId_year: {
          robotInventoryId: inventoryId,
          year,
        },
      },
      data: {
        quantity: inventoryPlan.quantity + 1,
      },
    });
  }
};

// Get PDF for a purchase order
purchaseOrdersRoutes.get(
  '/:id/pdf',
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
      res.status(500).json({
        message: 'Failed to get PDF',
        error: (error as Error).message,
      });
    }
  }),
);

purchaseOrdersRoutes.patch(
  '/:id/status',
  upload.single('pdf'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { hasAppointment, isInstalled, isInvoiced, devis, clientSignature } =
      req.body;

    // Validate that at least one status field is provided
    if (
      hasAppointment === undefined &&
      isInstalled === undefined &&
      isInvoiced === undefined &&
      devis === undefined
    ) {
      return res.status(400).json({ message: 'No status fields provided' });
    }

    // Update only the provided status fields
    const updateData = {} as {
      hasAppointment?: boolean;
      isInstalled?: boolean;
      isInvoiced?: boolean;
      devis?: boolean;
      orderPdfId?: string;
      clientSignature?: string;
      signatureTimestamp?: Date;
    };
    if (hasAppointment !== undefined)
      updateData.hasAppointment =
        hasAppointment === 'true' || hasAppointment === true;
    if (isInstalled !== undefined)
      updateData.isInstalled = isInstalled === 'true' || isInstalled === true;
    if (isInvoiced !== undefined)
      updateData.isInvoiced = isInvoiced === 'true' || isInvoiced === true;
    if (devis !== undefined) {
      updateData.devis = devis === 'true' || devis === true;

      // If converting from devis to bon de commande and a signature is provided
      if (updateData.devis === false && clientSignature) {
        updateData.clientSignature = clientSignature;
        updateData.signatureTimestamp = new Date();
      }
    }

    try {
      // If a new PDF is uploaded, update the file in the system
      if (req.file) {
        // Get the current purchase order to check if it has an existing PDF
        const currentOrder = await prisma.purchaseOrder.findUnique({
          where: { id: parseInt(id) },
          select: {
            orderPdfId: true,
            clientFirstName: true,
            clientLastName: true,
          },
        });

        if (!currentOrder) {
          return res.status(404).json({ message: 'Purchase order not found' });
        }

        // Handle the PDF file
        const pdfBuffer = req.file.buffer;

        if (currentOrder.orderPdfId) {
          // Delete the old PDF first
          await deleteFileFromDrive(currentOrder.orderPdfId);
        }

        // Upload the new PDF
        const { id: newFileId } = await uploadFileToDrive(
          pdfBuffer,
          `bon_commande_${id}_${currentOrder.clientFirstName || ''}_${currentOrder.clientLastName || ''}.pdf`,
          'application/pdf',
          'PURCHASE_ORDERS',
        );

        // Add the PDF ID to the update data
        updateData.orderPdfId = newFileId;
      }

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

export default purchaseOrdersRoutes;
