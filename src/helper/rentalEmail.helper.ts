import fs from 'fs';
import path from 'path';
import { sendEmail as sendEmailMailer } from './mailer';
import { formatPriceNumberToFrenchFormatStr } from './common.helper';
import { getRentalPrice } from './machineRental.helper';
import logger from '../config/logger';
import { MachineRentalView, MachineRentedView } from '@prisma/client';

// Load the rental notification template once
const templateRentalNotificationPath = path.join(
  __dirname,
  '../templateEmail/rentalNotification.html',
);
const templateRentalNotification = fs.readFileSync(
  templateRentalNotificationPath,
  'utf8',
);

/**
 * Generate email content for a rental notification.
 */
export function generateRentalNotificationEmailContent(rental: any): string {
  return templateRentalNotification
    .replace(/{{machine_name}}/g, rental.machineRented.name)
    .replace(
      /{{rental_start_date}}/g,
      new Date(rental.rentalDate).toLocaleDateString('fr-FR'),
    )
    .replace(
      /{{rental_end_date}}/g,
      rental.returnDate
        ? new Date(rental.returnDate).toLocaleDateString('fr-FR')
        : 'Non définie',
    )
    .replace(
      /{{deposit}}/g,
      formatPriceNumberToFrenchFormatStr(rental.machineRented.deposit),
    )
    .replace(
      /{{rental_price}}/g,
      formatPriceNumberToFrenchFormatStr(
        getRentalPrice(rental, rental.machineRented),
      ),
    )
    .replace(/{{deposit_paid}}/g, rental.depositToPay ? 'Oui' : 'Non')
    .replace(/{{rental_paid}}/g, rental.paid ? 'Oui' : 'Non');
}

/**
 * Send the rental notification email.
 */
export async function sendRentalNotificationEmail(
  rental: MachineRentalView & { machineRented: MachineRentedView | null },
): Promise<void> {
  logger.info(
    `Sending rental notification email for rental ${rental.id} to ${rental.guests}`,
  );
  const emailContent = generateRentalNotificationEmailContent(rental);
  const emailOptions = {
    to: rental.guests,
    subject: `Notification de location pour la machine ${rental.machineRented?.name}`,
    html: emailContent,
    replyTo: process.env.REPLY_TO,
    fromName: 'Forestar',
  };
  await sendEmailMailer(emailOptions);
}
