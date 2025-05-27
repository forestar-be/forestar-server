require('dotenv').config();

import { initMaintenanceReminderCron } from './helper/maintenanceReminder';
import rentalMngtRoutes from './routes/rentalMngt.routes';
import rentalOperatorRoutes from './routes/rentalOperator.routes';
import { initRefreshTokenCron } from './helper/authGoogle';
import authenticateImageAccess from './middleware/imageAuthMiddleware';
import clientPurchaseOrdersDevisSignatureMiddleware from './middleware/clientPurchaseOrdersDevisSignature.middleware';
import fs from 'fs';
import ggAuthMiddleware from './middleware/ggAuthMiddleware';
import ggAuthRoutes from './routes/ggAuth.routes';
import supervisorRoutes from './routes/supervisor/supervisor.routes';
import clientPurchaseOrdersDevisSignatureRoutes from './routes/clientPurchaseOrdersDevisSignature.route';
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./config/logger');
const publicAuthMiddleware = require('./middleware/publicAuthMiddleware');
const publicSiteRoutes = require('./routes/publicSite.routes');
const authMiddleware = require('./middleware/authMiddleware');
const operatorRoutes = require('./routes/operator.routes');
const adminRoutes = require('./routes/admin.routes');
const rateLimit = require('express-rate-limit');
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

const loginLimiter = rateLimit({
  windowMs: 2.5 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for client purchase orders - more generous than login but still protected
const clientPurchaseOrderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all routes ending with /login
app.use(/\/.*\/login$/, loginLimiter);

// Apply to client purchase order routes
app.use('/client/purchase-orders', clientPurchaseOrderLimiter);

// Middleware to log each request
app.use((req, res, next) => {
  // do not log health check
  if (req.path === '/health') {
    return next();
  }

  const start = Date.now();
  logger.info(`Starting request: ${req.method} ${req.originalUrl}...`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms (${req.ip})`,
    );
  });
  next();
});

// Image authentication middleware
app.use(authenticateImageAccess);

// Serve image files statically
app.use('/images', express.static(IMAGES_BASE_DIR));

// Routes
app.use('/auth-google', authMiddleware, ggAuthRoutes);
app.use('/operator', authMiddleware, operatorRoutes);
app.use('/supervisor', [authMiddleware, ggAuthMiddleware], supervisorRoutes);
app.use('/admin', authMiddleware, adminRoutes);
app.use('/rental-mngt', [authMiddleware, ggAuthMiddleware], rentalMngtRoutes);
app.use('/rental-operator', authMiddleware, rentalOperatorRoutes);
app.use(
  '/client/purchase-orders/devis/signature',
  clientPurchaseOrdersDevisSignatureMiddleware,
  clientPurchaseOrdersDevisSignatureRoutes,
);
app.use('/', publicAuthMiddleware, publicSiteRoutes); // must be last

// Error-handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error occurred: ${err.message} ${err.stack}`);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// Démarrage du serveur
app.listen(port, () => {
  logger.info(`Serveur en écoute sur le port ${port}`);
  initPingCron();
  initMaintenanceReminderCron();
  initRefreshTokenCron();
});
