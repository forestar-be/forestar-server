import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';
import { MachineRentedView, Prisma } from '@prisma/client';
import prisma from './prisma';
import { sendEmail } from './mailer';

// Environment variables validation
const REQUIRED_ENV_VARS = [
  'EMAILS_REMINDER_MAINTENANCE',
  'RENTAL_MANAGEMENT_FRONTEND_URL',
];

REQUIRED_ENV_VARS.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`${varName} is not defined`);
  }
});

const DEFAULT_EMAILS = process.env.EMAILS_REMINDER_MAINTENANCE!.split(',');
const FRONTEND_URL = process.env.RENTAL_MANAGEMENT_FRONTEND_URL!;

// Email template handling
const TEMPLATES_DIR = path.join(__dirname, '../templateEmail');

const readHtmlTemplate = (templateName: string): string => {
  return fs.readFileSync(
    path.join(TEMPLATES_DIR, `${templateName}.html`),
    'utf8',
  );
};

const generateEmailContent = (
  machine: MachineRentedView,
  templateName: string,
) => {
  const nextMaintenanceDate =
    machine.next_maintenance?.toLocaleDateString('fr-FR') || 'Non définie';
  const daysLate = machine.next_maintenance
    ? Math.floor((Date.now() - machine.next_maintenance.getTime()) / 86400000)
    : 0;
  const nbDaysRemaining = Math.max(
    0,
    Math.floor(
      (machine.next_maintenance?.getTime() || Date.now()) / 86400000 -
        Date.now() / 86400000,
    ),
  );

  return readHtmlTemplate(templateName)
    .replace(/{{machine_name}}/g, machine.name!)
    .replace(/{{next_maintenance_date}}/g, nextMaintenanceDate)
    .replace(
      /{{maintenance_type}}/g,
      machine.maintenance_type === 'BY_DAY'
        ? 'par jour'
        : 'par nombre de locations',
    )
    .replace(/{{machine_page_link}}/g, `${FRONTEND_URL}/machines/${machine.id}`)
    .replace(/{{nb_days_late}}/g, daysLate.toString())
    .replace(/{{nb_days_remaining}}/g, nbDaysRemaining.toString());
};

// Unified reminder function
const sendMaintenanceReminders = async (
  whereCondition: Prisma.MachineRentedViewWhereInput,
  templateName: string,
  context: string,
) => {
  logger.info(`Checking for ${context} maintenance reminders`);

  const machines = await prisma.machineRentedView.findMany({
    where: whereCondition,
  });

  for (const machine of machines) {
    logger.info(`Sending ${context} reminder for ${machine.name}`);

    const emailOptions = {
      to: [...DEFAULT_EMAILS, ...machine.guests],
      subject: `Rappel de maintenance pour la machine ${machine.name}`,
      html: generateEmailContent(machine, templateName),
      replyTo: process.env.REPLY_TO,
      fromName: 'Forestar Shop Atelier',
    };

    await sendEmail(emailOptions);
  }
};

// Specific reminder functions
const remindLateMaintenance = () =>
  sendMaintenanceReminders(
    { next_maintenance: { lt: new Date() } },
    'reminderMaintenanceLate',
    'late',
  );

const remindFutureMaintenance = () =>
  sendMaintenanceReminders(
    {
      next_maintenance: {
        gte: new Date(),
        lt: new Date(Date.now() + 7 * 86400000),
      },
    },
    'reminderMaintenanceFuture',
    'future',
  );

// Cron job setup
export const initMaintenanceReminderCron = () => {
  logger.info('Initializing maintenance reminder cron job');

  cron.schedule('0 8 * * *', async () => {
    // Runs daily at 8:00 AM
    logger.info('Starting scheduled maintenance reminders');
    try {
      await remindLateMaintenance();
    } catch (error) {
      logger.error(`Error sending late maintenance reminder: ${error}`);
    }

    try {
      await remindFutureMaintenance();
    } catch (error) {
      logger.error(`Error sending future maintenance reminder: ${error}`);
    }
    logger.info('Completed maintenance reminders');
  });
};
