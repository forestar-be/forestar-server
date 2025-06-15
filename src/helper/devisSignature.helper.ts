import fs from 'fs';
import path from 'path';
import logger from '../config/logger';
import { PurchaseOrder, RobotInventory } from '@prisma/client';
import { generateDriveLink } from './ggdrive';

// Load the devis signature confirmation template once
const templateDevisSignatureConfirmationPath = path.join(
  __dirname,
  '../templateEmail/devisSignatureConfirmation.html',
);

const templateDevisSignatureConfirmation = fs.readFileSync(
  templateDevisSignatureConfirmationPath,
  'utf8',
);

/**
 * Generate email content for a devis signature confirmation.
 */
export function generateDevisSignatureConfirmationEmailContent(
  purchaseOrder: {
    robotInventory: RobotInventory | null;
    plugin: RobotInventory | null;
    antenna: RobotInventory | null;
    shelter: RobotInventory | null;
  } & PurchaseOrder,
): string {
  logger.info(
    `Generating devis signature confirmation email content for client ${purchaseOrder.clientFirstName} ${purchaseOrder.clientLastName}`,
  );

  const currentDate = new Date().toLocaleDateString('fr-FR');
  const currentYear = new Date().getFullYear();
  // Generate the Google Drive link for the signed purchase order
  const driveLink = generateDriveLink(purchaseOrder.orderPdfId || '');

  let content = templateDevisSignatureConfirmation
    .replace(/{{client_first_name}}/g, purchaseOrder.clientFirstName || '')
    .replace(/{{client_last_name}}/g, purchaseOrder.clientLastName || '')
    .replace(/{{client_email}}/g, purchaseOrder.clientEmail || '')
    .replace(/{{order_id}}/g, purchaseOrder.id?.toString() || '')
    .replace(/{{signature_date}}/g, currentDate)
    .replace(/{{current_year}}/g, currentYear.toString())
    .replace(/{{robot_name}}/g, purchaseOrder.robotInventory?.name || '')
    .replace(/{{drive_link}}/g, driveLink);

  // Handle conditional parts
  if (purchaseOrder.antenna) {
    content = content
      .replace(/{{#has_antenna}}/g, '')
      .replace(/{{\/has_antenna}}/g, '')
      .replace(/{{antenna_name}}/g, purchaseOrder.antenna.name || '');
  } else {
    content = content.replace(/{{#has_antenna}}[\s\S]*?{{\/has_antenna}}/g, '');
  }

  if (purchaseOrder.plugin) {
    content = content
      .replace(/{{#has_plugin}}/g, '')
      .replace(/{{\/has_plugin}}/g, '')
      .replace(/{{plugin_name}}/g, purchaseOrder.plugin.name || '');
  } else {
    content = content.replace(/{{#has_plugin}}[\s\S]*?{{\/has_plugin}}/g, '');
  }

  if (purchaseOrder.shelter) {
    content = content
      .replace(/{{#has_shelter}}/g, '')
      .replace(/{{\/has_shelter}}/g, '')
      .replace(/{{shelter_name}}/g, purchaseOrder.shelter.name || '');
  } else {
    content = content.replace(/{{#has_shelter}}[\s\S]*?{{\/has_shelter}}/g, '');
  }

  return content;
}
