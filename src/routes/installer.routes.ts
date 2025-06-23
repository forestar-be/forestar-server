import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';
import asyncHandler from '../helper/asyncHandler';
import { doLogin } from '../helper/auth.helper';

const prisma = new PrismaClient();
const router = express.Router();

const INSTALLER_SECRET_KEY = process.env.INSTALLER_SECRET_KEY;

if (!INSTALLER_SECRET_KEY) {
  throw new Error('INSTALLER_SECRET_KEY is not set');
}

// Login route for installers
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const role = 'INSTALLER';
    return await doLogin(req, res, role, INSTALLER_SECRET_KEY, prisma);
  }),
);

// Get purchase orders ready for installation
router.get(
  '/purchase-orders',
  asyncHandler(async (req: Request, res: Response) => {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        needsInstaller: true,
        devis: false,
      },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
      orderBy: {
        installationDate: 'asc',
      },
    });

    res.json(purchaseOrders);
  }),
);

// Get specific purchase order for installation
router.get(
  '/purchase-orders/:id',
  asyncHandler(async (req: Request, res: Response) => {
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

// Mark installation as completed
router.put(
  '/purchase-orders/:id/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      installationNotes,
      installerName,
      clientSignature,
      robotInstalled,
      pluginInstalled,
      antennaInstalled,
      shelterInstalled,
      wireInstalled,
      antennaSupportInstalled,
      placementCompleted,
      missingItems,
      additionalComments,
    } = req.body;

    // Update the purchase order with all installation details
    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id: parseInt(id) },
      data: {
        isInstalled: true,
        installationNotes: installationNotes || null,
        installerName: installerName || null,
        clientSignature: clientSignature || null,
        installationCompletedAt: new Date(),
        robotInstalled: robotInstalled || false,
        pluginInstalled: pluginInstalled || false,
        antennaInstalled: antennaInstalled || false,
        shelterInstalled: shelterInstalled || false,
        wireInstalled: wireInstalled || false,
        antennaSupportInstalled: antennaSupportInstalled || false,
        placementCompleted: placementCompleted || false,
        missingItems: missingItems || null,
        additionalComments: additionalComments || null,
      },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
    });

    // Generate and upload installation PDF
    try {
      const React = require('react');
      const ReactPDF = require('@react-pdf/renderer');
      const {
        InstallationPdfDocument,
      } = require('../components/InstallationPdfDocument.tsx');
      const { uploadFileToDrive } = require('../helper/ggdrive');

      // Generate PDF
      const pdfBuffer = await ReactPDF.renderToBuffer(
        React.createElement(InstallationPdfDocument, {
          purchaseOrder: updatedOrder,
        }),
      );

      // Upload to Google Drive
      const fileName = `Installation_${updatedOrder.id}_${new Date().getTime()}.pdf`;
      const driveFile = await uploadFileToDrive(
        pdfBuffer,
        fileName,
        'application/pdf',
        'INSTALLATION_PDFS',
      );

      // Update order with PDF file ID
      await prisma.purchaseOrder.update({
        where: { id: parseInt(id) },
        data: {
          installationPdfId: driveFile.id,
        },
      });

      logger.info(
        `Installation completed for purchase order ${id} by installer ${installerName}. PDF generated: ${driveFile.id}`,
      );
    } catch (pdfError) {
      logger.error('Error generating installation PDF:', pdfError);
      // Continue without failing the request - the installation is still complete
    }

    logger.info(
      `Installation completed for purchase order ${id} by installer ${installerName}`,
    );

    res.json(updatedOrder);
  }),
);

// Get installation PDF
router.get(
  '/purchase-orders/:id/installation-pdf',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      select: { installationPdfId: true },
    });

    if (!purchaseOrder?.installationPdfId) {
      return res.status(404).json({ message: 'Installation PDF not found' });
    }

    try {
      const { getFileFromDrive } = require('../helper/ggdrive');
      const { fileBuffer, fileName, mimeType } = await getFileFromDrive(
        purchaseOrder.installationPdfId,
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.send(fileBuffer);
    } catch (error) {
      logger.error('Error retrieving installation PDF:', error);
      res.status(500).json({ message: 'Error retrieving installation PDF' });
    }
  }),
);

// Test endpoint to generate installation PDF with mock data
router.get(
  '/test/installation-pdf',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const React = require('react');
      const ReactPDF = require('@react-pdf/renderer');
      const {
        InstallationPdfDocument,
      } = require('../components/InstallationPdfDocument.tsx');

      // Mock data for testing
      const mockPurchaseOrder = {
        id: 12345,
        clientFirstName: 'Jean',
        clientLastName: 'Dupont',
        clientAddress: '123 Rue de la Paix',
        clientCity: '75001 Paris',
        clientPhone: '01 23 45 67 89',
        clientEmail: 'jean.dupont@example.com',
        deposit: 500.0,
        installationDate: new Date('2025-06-20').toISOString(),
        installationNotes:
          'Installation réalisée sans problème. Terrain bien préparé, robot configuré selon les paramètres optimaux.',
        installerName: 'Pierre Martin',
        installationCompletedAt: new Date().toISOString(),
        robotInstalled: true,
        pluginInstalled: true,
        antennaInstalled: false,
        shelterInstalled: true,
        wireInstalled: true,
        antennaSupportInstalled: false,
        placementCompleted: true,
        missingItems:
          'Antenne de remplacement en rupture de stock - livraison prévue la semaine prochaine',
        additionalComments:
          "Client très satisfait. Formation dispensée sur l'utilisation du robot. Rappel programmé dans 1 semaine pour vérifier le bon fonctionnement.",
        clientSignature: null, // Pas de signature pour le test
        hasWire: true,
        wireLength: 150,
        hasAntennaSupport: true,
        hasPlacement: true,
        robotInventory: {
          name: 'Robot Tondeuse Pro 3000',
          sellingPrice: 2500.0,
        },
        plugin: {
          name: 'Module GPS Premium',
          sellingPrice: 300.0,
        },
        antenna: {
          name: 'Antenne Longue Portée',
          sellingPrice: 150.0,
        },
        shelter: {
          name: 'Abri Station de Charge Deluxe',
          sellingPrice: 200.0,
        },
      };

      // Generate PDF
      const pdfBuffer = await ReactPDF.renderToBuffer(
        React.createElement(InstallationPdfDocument, {
          purchaseOrder: mockPurchaseOrder,
        }),
      );

      // Set headers for PDF download
      const fileName = `Test_Installation_${new Date().getTime()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );

      // Send the PDF buffer
      res.send(pdfBuffer);

      logger.info('Test installation PDF generated successfully');
    } catch (error) {
      logger.error('Error generating test installation PDF:', error);
      res.status(500).json({
        message: 'Error generating test installation PDF',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }),
);

module.exports = router;
