import express from 'express';
import asyncHandler from '../helper/asyncHandler';
import logger from '../config/logger';
import multer from 'multer';
import {
  uploadFileToDrive,
  getFileFromDrive,
  deleteFileFromDrive,
} from '../helper/ggdrive';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { RequestClientPurchaseOrdersDevisSignature } from '../types/clientPurchaseOrdersDevisSignature.types';
import purchaseOrderCache from '../services/purchaseOrderCache';
import path from 'path';
import { sendEmail } from '../helper/mailer';
import { generateDevisSignatureConfirmationEmailContent } from '../helper/devisSignature.helper';
const DEVIS_FOLDER = process.env.DEVIS_BASE_DIR;
if (!DEVIS_FOLDER) {
  throw new Error('DEVIS_BASE_DIR is not defined');
}
const clientPurchaseOrdersDevisSignatureRoutes = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

clientPurchaseOrdersDevisSignatureRoutes.get(
  '/',
  asyncHandler(async (req: RequestClientPurchaseOrdersDevisSignature, res) => {
    const installationPreparationTexts =
      await prisma.installationPreparationText.findMany({
        orderBy: {
          order: 'asc',
        },
      });

    res.json({
      purchaseOrder: req.purchaseOrder,
      installationPreparationTexts,
    });
  }),
);

clientPurchaseOrdersDevisSignatureRoutes.get(
  '/pdf',
  asyncHandler(async (req: RequestClientPurchaseOrdersDevisSignature, res) => {
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

clientPurchaseOrdersDevisSignatureRoutes.patch(
  '/status',
  upload.single('pdf'),
  asyncHandler(
    async (
      req: RequestClientPurchaseOrdersDevisSignature<
        Record<string, string>,
        { message: string },
        { devis: boolean | string; clientSignature: string }
      >,
      res,
    ) => {
      const id = req.query.id as string;
      const { devis, clientSignature } = req.body;
      const currentOrder = req.purchaseOrder;

      if (!currentOrder.devis) {
        return res.status(400).json({
          message: "Cette commande n'est pas un devis",
        });
      }

      if (devis !== 'false' && devis !== false) {
        return res.status(400).json({
          message:
            'Le devis doit être converti en bon de commande pour cette action',
        });
      }

      if (!clientSignature) {
        return res.status(400).json({
          message: 'Client signature is required',
        });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          message: 'PDF file is required',
        });
      }

      // Update only the signature status fields
      const updateData: {
        devis?: boolean;
        clientSignature?: string;
        signatureTimestamp?: Date;
        orderPdfId?: string;
      } = {
        devis: false, // Always converting to bon de commande
        clientSignature,
        signatureTimestamp: new Date(),
      };

      if (currentOrder.orderPdfId) {
        // Delete the old PDF first
        await deleteFileFromDrive(currentOrder.orderPdfId);
      }

      // Upload the new PDF
      const pdfBuffer = req.file.buffer;
      const filePrefix = 'bon_commande_';
      const { id: newFileId } = await uploadFileToDrive(
        pdfBuffer,
        `${filePrefix}${id}_${currentOrder.clientFirstName || ''}_${currentOrder.clientLastName || ''}.pdf`,
        'application/pdf',
        'PURCHASE_ORDERS',
      );

      // Add the PDF ID to the update data
      updateData.orderPdfId = newFileId;

      const idInt = parseInt(id);
      purchaseOrderCache.invalidate(idInt);
      const updatedOrder = await prisma.purchaseOrder.update({
        where: { id: idInt },
        data: updateData,
        include: {
          robotInventory: true,
          antenna: true,
          plugin: true,
          shelter: true,
        },
      });

      // Send email notification to the company address
      try {
        // Generate email content and send notification to company address
        await sendEmail({
          to: process.env.REPLY_TO!,
          subject: `Confirmation de signature de devis - ${updatedOrder.clientFirstName} ${updatedOrder.clientLastName}`,
          html: generateDevisSignatureConfirmationEmailContent(updatedOrder),
          fromName: 'Forestar',
        });
        logger.info(`Signature confirmation email sent for order ${idInt}`);
      } catch (emailError) {
        // Log error but don't fail the request if email sending fails
        logger.error(
          `Failed to send signature confirmation email: ${emailError}`,
        );
      }

      return res.status(200).json({
        message: 'Mise à jour effectuée avec succès',
      });
    },
  ),
);

clientPurchaseOrdersDevisSignatureRoutes.get(
  '/photo/:photoIndex',
  asyncHandler(async (req: RequestClientPurchaseOrdersDevisSignature, res) => {
    const { photoIndex } = req.params;

    const { purchaseOrder } = req;
    const id = req.query.id as string;

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

export default clientPurchaseOrdersDevisSignatureRoutes;
