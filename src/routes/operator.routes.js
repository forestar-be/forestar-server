const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const asyncHandler = require('../helper/asyncHandler').default;
const { generateUniqueString } = require('../helper/common.helper');
const { doLogin } = require('../helper/auth.helper');
const fs = require('fs');
const path = require('path');
const { saveFile } = require('../helper/file.helper');

const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY;
const IMAGES_BASE_DIR = process.env.IMAGES_BASE_DIR || '/app/images';

const bucketName = process.env.BUCKET_IMAGE_NAME;

router.post(
  '/submit',
  upload.single('machine_photo'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        logger.error('No file received');
        return res.status(400).send('Aucun fichier reçu.');
      }

      const {
        first_name,
        last_name,
        address, // Optional, will default to empty string if not provided
        postal_code, // Optional, will default to empty string if not provided
        city, // Optional, will default to empty string if not provided
        phone,
        email, // Optional, will default to empty string if not provided
        machine_type_name,
        repair_or_maintenance,
        robot_code,
        fault_description,
        brand_name,
        robot_type_name,
        warranty,
        devis,
        hivernage,
        signature, // Base64 string
      } = req.body;

      const requiredFields = [
        first_name,
        last_name,
        phone,
        machine_type_name,
        repair_or_maintenance,
        fault_description,
        brand_name,
        signature,
      ];

      for (const field of requiredFields) {
        if (!field || field === '') {
          logger.error('Missing required fields');
          return res
            .status(400)
            .send('Veuillez remplir tous les champs obligatoires.');
        }
      }

      // Decode URI encoded strings and set optional ones to empty string if missing
      const firstNameDecoded = decodeURIComponent(first_name);
      const lastNameDecoded = decodeURIComponent(last_name);
      const addressDecoded = address ? decodeURIComponent(address) : '';
      const postalCodeDecoded = postal_code
        ? decodeURIComponent(postal_code)
        : '';
      const cityDecoded = city ? decodeURIComponent(city) : '';
      const phoneDecoded = decodeURIComponent(phone);
      const emailDecoded = email ? decodeURIComponent(email) : '';
      const machineTypeDecoded = decodeURIComponent(machine_type_name);
      const repairOrMaintenanceDecoded = decodeURIComponent(
        repair_or_maintenance,
      );
      const robotCodeDecoded = robot_code
        ? decodeURIComponent(robot_code)
        : null;
      const faultDescriptionDecoded = decodeURIComponent(fault_description);
      const robotTypeNameDecoded = robot_type_name
        ? decodeURIComponent(robot_type_name)
        : null;

      const webpBuffer = req.file.buffer; // WebP image buffer
      const fileName = req.file.originalname;

      // Save the WebP image to local storage
      const uniqueString = generateUniqueString();
      const imagePath = `${uniqueString}_${fileName}`;

      try {
        saveFile(bucketName, imagePath, webpBuffer);
      } catch (error) {
        throw new Error(
          `Error saving image to local storage: ${error.message}`,
        );
      }

      // Convert base64 signature to a Buffer and save to local storage
      // Extract the base64 data part (remove the data:image/png;base64, prefix)
      const base64Data = signature.split(',')[1];
      // Convert base64 to Buffer directly
      const signatureBuffer = Buffer.from(base64Data, 'base64');
      const signatureFileName = `signature_${uniqueString}.png`;
      const signaturePath = `signatures/${signatureFileName}`;

      try {
        // Ensure signatures directory exists
        const signaturesDir = path.join(
          IMAGES_BASE_DIR,
          bucketName,
          'signatures',
        );
        if (!fs.existsSync(signaturesDir)) {
          fs.mkdirSync(signaturesDir, { recursive: true });
        }

        saveFile(bucketName, signaturePath, signatureBuffer);
      } catch (error) {
        throw new Error(
          `Error saving signature to local storage: ${error.message}`,
        );
      }

      // Save the URLs to PostgreSQL using Prisma
      const newRepair = await prisma.machineRepair.create({
        data: {
          first_name: firstNameDecoded,
          last_name: lastNameDecoded,
          address: addressDecoded,
          phone: phoneDecoded,
          email: emailDecoded,
          machine_type_name: machineTypeDecoded,
          repair_or_maintenance: repairOrMaintenanceDecoded,
          robot_code: robotCodeDecoded,
          fault_description: faultDescriptionDecoded,
          client_signature: signaturePath,
          image_path_list: [imagePath],
          bucket_name: bucketName,
          brand_name,
          robot_type_name: robotTypeNameDecoded,
          postal_code: postalCodeDecoded,
          city: cityDecoded,
          warranty: Boolean(warranty),
          devis: Boolean(devis),
          hivernage: Boolean(hivernage),
        },
      });

      res
        .status(200)
        .json({ message: 'Données enregistrées avec succès.', newRepair });
    } catch (error) {
      console.error(
        `Erreur dans /submit: ${error.message} for data: ${JSON.stringify(req.body)}`,
      );
      res
        .status(500)
        .send(`Erreur lors de l'enregistrement des données : ${error.message}`);
    }
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const role = 'OPERATOR';
    return await doLogin(req, res, role, OPERATOR_SECRET_KEY, prisma);
  }),
);

router.get(
  '/optionsListByName',
  asyncHandler(async (req, res) => {
    const [brands, machineType, robotType] = await prisma.$transaction([
      prisma.brand.findMany(),
      prisma.machineType.findMany(),
      prisma.robotType.findMany(),
    ]);
    res.json({
      brands: brands.map((brand) => brand.name),
      machineType: machineType.map((type) => type.name),
      robotType: robotType.map((type) => type.name),
    });
  }),
);

router.get(
  '/formConfig',
  asyncHandler(async (req, res) => {
    const config = await prisma.config.findUnique({
      where: { key: 'Formulaire Opérateur' },
    });

    if (!config) {
      logger.error(
        'Configuration not found when Formulaire Opérateur in table config',
      );
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.json(JSON.parse(config.value));
  }),
);

module.exports = router;
