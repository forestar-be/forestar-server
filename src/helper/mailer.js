const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let lastSentTime = 0;
const COOLDOWN_PERIOD = 1000 * 20; // 20 seconds

const sendEmail = async ({
  to,
  subject,
  html,
  attachments,
  replyTo,
  fromName = null,
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
    replyTo,
  });

  lastSentTime = currentTime;
};

module.exports = { sendEmail };
