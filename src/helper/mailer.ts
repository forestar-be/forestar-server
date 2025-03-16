import logger from '../config/logger';
import nodemailer from 'nodemailer';

if (!process.env.EMAIL_SERVICE) {
  throw new Error('EMAIL_SERVICE is not defined');
}

if (!process.env.EMAIL_USER) {
  throw new Error('EMAIL_USER is not defined');
}

if (!process.env.EMAIL_PASS) {
  throw new Error('EMAIL_PASS is not defined');
}

if (!process.env.REPLY_TO) {
  throw new Error('REPLY_TO is not defined');
}

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let lastSentTime = 0;
const COOLDOWN_PERIOD = 1000 * 20; // 20 seconds

export const sendEmail = async ({
  to,
  subject,
  html,
  attachments,
  replyTo,
  fromName = null,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: any[];
  replyTo?: string;
  fromName?: string | null;
}) => {
  const currentTime = Date.now();
  const diff = currentTime - lastSentTime;
  lastSentTime = currentTime;
  if (diff < COOLDOWN_PERIOD) {
    logger.info(
      `Email cooldown period. Waiting for ${COOLDOWN_PERIOD - diff}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, COOLDOWN_PERIOD - diff));
  }

  logger.info(`Sending email to ${to} with subject: ${subject}`);
  await transporter.sendMail({
    from: fromName
      ? `${fromName} <${process.env.EMAIL_USER}>`
      : process.env.EMAIL_USER,
    to,
    subject,
    html,
    attachments,
    replyTo: replyTo || process.env.REPLY_TO,
  });

  lastSentTime = currentTime;
};
