const logger = require('../config/logger');

const AUTH_TOKEN = process.env.AUTH_TOKEN;

function authMiddleware(req, res, next) {
  // do not require authentication for health check or google callback
  if (req.path === '/health' || req.path === '/oauth/google/callback') {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${AUTH_TOKEN}`) {
    next();
  } else {
    logger.warn(`Tentative d'accès non autorisée sur public site route`);
    res.status(401).send('Non autorisé');
  }
}

module.exports = authMiddleware;
