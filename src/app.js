// Load environment variables
import { initMaintenanceReminderCron } from './helper/maintenanceReminder';

require('dotenv').config();

import rentalMngtRoutes from './routes/rentalMngtRoutes';
import rentalOperatorRoutes from './routes/rentalOperatorRoutes';
import { initRefreshTokenCron } from './helper/authGoogle';
import authenticateImageAccess from './middleware/imageAuthMiddleware';
import path from 'path';
import fs from 'fs';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./config/logger');
const publicAuthMiddleware = require('./middleware/publicAuthMiddleware');
const publicSiteRoutes = require('./routes/publicSiteRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const operatorRoutes = require('./routes/operatorRoutes');
const supervisorRoutes = require('./routes/supervisorRoutes');
const adminRoutes = require('./routes/adminRoutes');
// const rateLimit = require('express-rate-limit');
const { initPingCron } = require('./helper/pingInterval');

const app = express();
const port = 3001;

// Directory where images are stored
const IMAGES_BASE_DIR = process.env.IMAGES_BASE_DIR || '/app/images';

// Ensure images directory exists
if (!fs.existsSync(IMAGES_BASE_DIR)) {
  fs.mkdirSync(IMAGES_BASE_DIR, { recursive: true });
  logger.info(`Created images directory at ${IMAGES_BASE_DIR}`);
}

// Middleware CORS
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Middleware pour parser le JSON
app.use(bodyParser.json());

// Rate limiting middleware
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 20, // Limit each IP to 100 requests per windowMs
//   message: 'Trop de demandes de votre part, veuillez réessayer plus tard.',
// });
//
// // Apply the rate limiting middleware to all requests
// app.use(limiter);

// Middleware to log each request
app.use((req, res, next) => {
  res.on('finish', () => {
    // do not log health check
    if (req.path === '/health') {
      return;
    }

    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${req.ip}`,
    );
  });
  next();
});

// Image authentication middleware
app.use(authenticateImageAccess);

// Serve image files statically
app.use('/images', express.static(IMAGES_BASE_DIR));

// Routes
app.use('/operator', authMiddleware, operatorRoutes);
app.use('/supervisor', authMiddleware, supervisorRoutes);
app.use('/admin', authMiddleware, adminRoutes);
app.use('/rental-mngt', authMiddleware, rentalMngtRoutes);
app.use('/rental-operator', authMiddleware, rentalOperatorRoutes);
app.use('/', publicAuthMiddleware, publicSiteRoutes); // must be last

// Error-handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error occurred: ${err.message} ${err.stack}`);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// Démarrage du serveur
app.listen(port, () => {
  logger.info(`Serveur en écoute sur le port ${port}`);
  initPingCron(); // useful to keep the servers awake
  initMaintenanceReminderCron();
  initRefreshTokenCron();
});
