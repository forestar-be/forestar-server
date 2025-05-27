import express from 'express';
import asyncHandler from '../helper/asyncHandler';
import logger from '../config/logger';
import multer from 'multer';
import {
  uploadFileToDrive,
  getFileFromDrive,
  deleteFileFromDrive,
} from '../helper/ggdrive';
import { PrismaClient } from '@prisma/client';

const clientPurchaseOrdersDevisSignatureRoutes = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

clientPurchaseOrdersDevisSignatureRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // The purchase order is already verified and attached by the middleware
    res.json(req.purchaseOrder);
  }),
);

// GET endpoint to retrieve purchase order PDF for client
clientPurchaseOrdersDevisSignatureRoutes.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const purchaseOrder = req.purchaseOrder;

    if (!purchaseOrder.orderPdfId) {
      return res.status(404).json({ message: 'Purchase order PDF not found' });
    }

    try {
      // Get file from Google Drive
      const { fileBuffer, fileName, mimeType } = await getFileFromDrive(
        purchaseOrder.orderPdfId,
      );

      // Set response headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

      // Send file
      res.send(fileBuffer);
    } catch (error) {
      logger.error(`Error retrieving PDF for client: ${error}`);
      res.status(500).json({
        message: 'Failed to get PDF',
        error: (error as Error).message,
      });
    }
  }),
);

// PATCH endpoint to update purchase order status for client (signature functionality)
clientPurchaseOrdersDevisSignatureRoutes.patch(
  '/:id/status',
  upload.single('pdf'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { devis, clientSignature } = req.body;
    const currentOrder = req.purchaseOrder;

    // Update only the signature status fields
    const updateData = {} as {
      devis?: boolean;
      clientSignature?: string;
      signatureTimestamp?: Date;
      orderPdfId?: string;
    };

    // For client access, we only allow converting from devis to bon de commande
    if (devis !== undefined) {
      updateData.devis = devis === 'true' || devis === true;

      // If converting from devis to bon de commande and a signature is provided
      if (updateData.devis === false && clientSignature) {
        updateData.clientSignature = clientSignature;
        updateData.signatureTimestamp = new Date();
      }
    } else if (clientSignature) {
      // Just adding a signature without changing devis status
      updateData.clientSignature = clientSignature;
      updateData.signatureTimestamp = new Date();
    }

    // If a new PDF is uploaded, update the file in the system
    if (req.file) {
      // Handle the PDF file
      const pdfBuffer = req.file.buffer;

      if (currentOrder.orderPdfId) {
        // Delete the old PDF first
        await deleteFileFromDrive(currentOrder.orderPdfId);
      }

      // Determine if this is a quote based on the new value or the existing value
      const isDevis =
        devis !== undefined
          ? devis === 'true' || devis === true
          : currentOrder.devis;

      // Set the appropriate prefix based on whether it's a quote or purchase order
      const filePrefix = isDevis ? 'devis_' : 'bon_commande_';

      // Upload the new PDF
      const { id: newFileId } = await uploadFileToDrive(
        pdfBuffer,
        `${filePrefix}${id}_${currentOrder.clientFirstName || ''}_${currentOrder.clientLastName || ''}.pdf`,
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
  }),
);

export default clientPurchaseOrdersDevisSignatureRoutes;
