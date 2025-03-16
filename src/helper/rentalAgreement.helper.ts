import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

// Load the rental agreement template once
const templateRentalAgreementPath = path.join(
  __dirname,
  '../templateEmail/rentalAgreement.html',
);

const templateRentalAgreement = fs.readFileSync(
  templateRentalAgreementPath,
  'utf8',
);

/**
 * Generate email content for a rental agreement.
 */
export function generateRentalAgreementEmailContent(
  clientFirstName: string,
  machineName: string,
): string {
  logger.info(
    `Generating rental agreement email content for ${clientFirstName}`,
  );

  return templateRentalAgreement
    .replace(/{{client_first_name}}/g, clientFirstName)
    .replace(/{{machine_name}}/g, machineName);
}
