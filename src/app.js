// Load environment variables
require('dotenv').config();

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
const { initPingIntervals } = require('./helper/pingInterval');

const app = express();
const port = 3001;

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

// Routes
app.use('/operator', authMiddleware, operatorRoutes);
app.use('/supervisor', authMiddleware, supervisorRoutes);
app.use('/admin', authMiddleware, adminRoutes);
app.use('/', publicAuthMiddleware, publicSiteRoutes);

// Error-handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error occurred: ${err.message}`);
  res.status(500).send('Internal Server Error');
});

// Démarrage du serveur
app.listen(port, () => {
  logger.info(`Serveur en écoute sur le port ${port}`);
  // useful to keep the servers awake
  initPingIntervals();
});
