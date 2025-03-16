import express from 'express';
import asyncHandler from '../helper/asyncHandler';
import multer from 'multer';
import logger from '../config/logger';
import prisma from '../helper/prisma';
import {
  getAllMachineRentalView,
  getMachineRentalView,
  isRentalDateOverlapExisting,
} from '../helper/machineRental.helper';
import { getMachineRentedView } from '../helper/machineRented.helper';
import { generateUniqueString } from '../helper/common.helper';
import { sendEmail } from '../helper/mailer';
import { getFileFromDrive, uploadFileToDrive } from '../helper/ggdrive';
import { doLogin } from '../helper/auth.helper';
import dayjs from 'dayjs';
import { generateRentalAgreementEmailContent } from '../helper/rentalAgreement.helper';

const rentalOperatorRoutes = express.Router();

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get all machine rentals
rentalOperatorRoutes.get(
  '/machine-rental',
  asyncHandler(async (req, res) => {
    const machineRentals = await prisma.$transaction(async (tx) => {
      return await getAllMachineRentalView(true)(tx);
    });

    res.json(machineRentals);
  }),
);

// Get a specific machine rental by ID
rentalOperatorRoutes.get(
  '/machine-rental/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRental = await getMachineRentalView(parseInt(id))(prisma);

    if (!machineRental) {
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    res.json(machineRental);
  }),
);

// Get rental agreement of a machine rental
rentalOperatorRoutes.get(
  '/machine-rental/:id/rental-agreement',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const machineRental = await getMachineRentalView(
      parseInt(id),
      false,
    )(prisma);

    if (!machineRental) {
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    if (!machineRental.finalTermsPdfId) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    const { fileBuffer } = await getFileFromDrive(
      machineRental.finalTermsPdfId,
    );

    res.status(200).send(fileBuffer);
  }),
);

// Save signature and finalize the terms and conditions
rentalOperatorRoutes.post(
  '/machine-rental/:id/save-signature',
  upload.single('pdfFile'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rentalId = parseInt(id);

    // Get rental info
    const machineRental = await getMachineRentalView(rentalId)(prisma);

    if (!machineRental) {
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'PDF file is required' });
    }

    try {
      const pdfBuffer: Buffer = req.file.buffer;

      // Upload the PDF to Google Drive
      const pdfResult = await uploadFileToDrive(
        pdfBuffer,
        `contrat_location_${rentalId}_${dayjs().format('DD-MM-YYYY_HH-mm-ss')}.pdf`,
        'application/pdf',
        'RENTAL_AGREEMENT',
      );

      // Update the rental with the signed PDF file ID
      await prisma.machineRental.update({
        where: { id: rentalId },
        data: {
          finalTermsPdfId: pdfResult.id,
        },
      });

      res.json({
        success: true,
        finalPdfId: pdfResult.id,
      });
    } catch (error) {
      console.error('Error generating or uploading signed PDF:', error);
      res.status(500).json({
        message: 'Failed to generate or upload signed PDF',
      });
    }
  }),
);

// Send finalized terms to client email
rentalOperatorRoutes.post(
  '/machine-rental/:id/send-terms-email',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rentalId = parseInt(id);
    const { email } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Get the rental information
      const machineRental = await getMachineRentalView(rentalId)(tx);

      if (!machineRental) {
        throw new Error('Machine rental not found');
      }

      if (!machineRental.finalTermsPdfId) {
        throw new Error('No finalized terms found for this rental');
      }

      if (!machineRental.machineRented) {
        throw new Error('Machine rented not found for this rental');
      }

      if (!email && !machineRental.clientEmail) {
        throw new Error('No email found for this rental');
      }

      if (email) {
        machineRental.clientEmail = email;
      }

      // update rental with the new email
      await tx.machineRental.update({
        where: { id: rentalId },
        data: {
          clientEmail: email,
        },
      });

      const { fileBuffer, fileName } = await getFileFromDrive(
        machineRental.finalTermsPdfId,
      );

      // Send email with the PDF attachment (using Google Drive URL)
      await sendEmail({
        to: machineRental.clientEmail,
        subject: 'Votre Contrat de Location',
        html: generateRentalAgreementEmailContent(
          `${machineRental.clientFirstName} ${machineRental.clientLastName}`,
          machineRental.machineRented!.name || 'Non renseigné',
        ),
        attachments: [
          {
            filename: fileName,
            content: fileBuffer.toString('base64'),
            encoding: 'base64',
          },
        ],
      });

      return {
        success: true,
        message: 'Terms and conditions sent to client email',
      };
    });

    res.json(result);
  }),
);

const RENTAL_OPERATOR_SECRET_KEY = process.env.RENTAL_OPERATOR_SECRET_KEY;

rentalOperatorRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const role = 'RENTAL_OPERATOR';
    const key = RENTAL_OPERATOR_SECRET_KEY;
    return await doLogin(req, res, role, key!, prisma);
  }),
);

export default rentalOperatorRoutes;
