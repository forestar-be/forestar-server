const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const asyncHandler = require('../helper/asyncHandler').default;
const { generateUniqueString } = require('../helper/common.helper');
const { doLogin } = require('../helper/auth.helper');

const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);
const bucketName = process.env.BUCKET_IMAGE_NAME;

// Function to convert Base64 string to Blob
function base64ToBlob(base64, contentType = '', sliceSize = 512) {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

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
        address,
        phone,
        email,
        machine_type_name,
        repair_or_maintenance,
        robot_code,
        fault_description,
        brand_name,
        warranty,
        devis,
        hivernage,
        signature, // Base64 string
      } = req.body;

      const requiredFields = [
        first_name,
        last_name,
        address,
        phone,
        email,
        machine_type_name,
        repair_or_maintenance,
        fault_description,
        brand_name,
        signature,
      ];

      for (const field of requiredFields) {
        if (!field || field === '') {
          logger.error('Missing required fields');
          return res.status(400).send('Veuillez remplir tous les champs.');
        }
      }

      // decode uri encoded strings
      const firstNameDecoded = decodeURIComponent(first_name);
      const lastNameDecoded = decodeURIComponent(last_name);
      const addressDecoded = decodeURIComponent(address);
      const phoneDecoded = decodeURIComponent(phone);
      const emailDecoded = decodeURIComponent(email);
      const machineTypeDecoded = decodeURIComponent(machine_type_name);
      const repairOrMaintenanceDecoded = decodeURIComponent(
        repair_or_maintenance,
      );
      const robotCodeDecoded = robot_code
        ? decodeURIComponent(robot_code)
        : null;
      const faultDescriptionDecoded = decodeURIComponent(fault_description);

      const webpBuffer = req.file.buffer; // WebP image buffer
      const fileName = req.file.originalname;

      // Upload the WebP image to Supabase Storage
      const imagePath = `images/${generateUniqueString()}_${fileName}`;
      const { data: imageUpload, error: imageError } = await supabase.storage
        .from(bucketName)
        .upload(imagePath, webpBuffer, {
          contentType: 'image/webp',
        });

      if (imageError) {
        throw new Error(
          `Erreur lors du téléchargement de l'image : ${imageError.message}`,
        );
      }

      // Convert base64 signature to a buffer and upload to Supabase
      const signatureBuffer = base64ToBlob(signature, 'image/png');
      const signatureFileName = `signature_${generateUniqueString()}.png`;

      const signaturePath = `signatures/${signatureFileName}`;
      const { data: signatureUpload, error: signatureError } =
        await supabase.storage
          .from(bucketName)
          .upload(signaturePath, signatureBuffer, {
            contentType: 'image/png',
          });

      if (signatureError) {
        throw new Error(
          `Erreur lors du téléchargement de la signature : ${signatureError.message}`,
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
          warranty: Boolean(warranty),
          devis: Boolean(devis),
          hivernage: Boolean(hivernage),
        },
      });

      res
        .status(200)
        .json({ message: 'Données enregistrées avec succès.', newRepair });
    } catch (error) {
      console.error(`Erreur dans /submit: ${error.message}`);
      res.status(500).send('Erreur interne du serveur.');
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
    const [brands, machineType] = await prisma.$transaction([
      prisma.brand.findMany(),
      prisma.machineType.findMany(),
    ]);
    res.json({
      brands: brands.map((brand) => brand.name),
      machineType: machineType.map((type) => type.name),
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
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.json(JSON.parse(config.value));
  }),
);

module.exports = router;
