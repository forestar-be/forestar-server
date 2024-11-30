const express = require('express');
const axios = require('axios');
const logger = require('../config/logger');
const { sendEmail } = require('../helper/mailer');

const router = express.Router();

router.post('/submit-form', async (req, res) => {
  try {
    const formData = req.body;
    logger.info(`Form received: ${JSON.stringify(formData)} from ${req.ip}`);

    // convert boolean values to oui or non
    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'boolean') {
        formData[key] = value ? 'oui' : 'non';
      }
    }

    let emailContent = '<h1>Nouvelle demande de service reçu</h1><ul>';
    for (const [key, value] of Object.entries(formData)) {
      emailContent += `<li><strong>${key}</strong>: ${value}</li>`;
    }
    emailContent += '</ul>';

    const options = {
      to: process.env.TO_EMAIL,
      subject: 'Nouvelle demande de service',
      html: emailContent,
      replyTo: process.env.REPLY_TO,
    };

    await sendEmail(options);

    logger.info(`Email successfully sent to admin for form from ${req.ip}`);
    res.status(200).send('Form received and email sent.');
  } catch (error) {
    logger.error(
      `Error sending email: ${error.message ? error.message : ''} ${error.response && typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : ''}`,
    );
    res.status(500).send('Error sending email.');
  }
});

router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
