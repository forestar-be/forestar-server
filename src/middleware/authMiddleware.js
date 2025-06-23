const { verify, decode } = require('jsonwebtoken');
const logger = require('../config/logger');
const { stringifyIfPossible } = require('../helper/common.helper');
const SUPERVISOR_SECRET_KEY = process.env.SUPERVISOR_SECRET_KEY;
const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RENTAL_MANAGER_SECRET_KEY = process.env.RENTAL_MANAGER_SECRET_KEY;
const RENTAL_OPERATOR_SECRET_KEY = process.env.RENTAL_OPERATOR_SECRET_KEY;
const INSTALLER_SECRET_KEY = process.env.INSTALLER_SECRET_KEY;

// check if all keys are set
if (
  !SUPERVISOR_SECRET_KEY ||
  !OPERATOR_SECRET_KEY ||
  !ADMIN_SECRET_KEY ||
  !RENTAL_MANAGER_SECRET_KEY ||
  !RENTAL_OPERATOR_SECRET_KEY ||
  !INSTALLER_SECRET_KEY
) {
  throw new Error('All keys must be set');
}

const getKey = (role) => {
  switch (role) {
    case 'SUPERVISOR':
      return SUPERVISOR_SECRET_KEY;
    case 'RENTAL_MANAGER':
      return RENTAL_MANAGER_SECRET_KEY;
    case 'OPERATOR':
      return OPERATOR_SECRET_KEY;
    case 'ADMIN':
      return ADMIN_SECRET_KEY;
    case 'RENTAL_OPERATOR':
      return RENTAL_OPERATOR_SECRET_KEY;
    case 'INSTALLER':
      return INSTALLER_SECRET_KEY;
    default:
      return null;
  }
};

const allowedRoutesByRole = {
  SUPERVISOR: ['/supervisor', '/auth-google'],
  RENTAL_MANAGER: ['/rental-mngt', '/auth-google'],
  OPERATOR: ['/operator'],
  RENTAL_OPERATOR: ['/rental-operator'],
  INSTALLER: ['/installer'],
};

function authenticateToken(req, res, next) {
  if (req.path === '/login') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('No token provided');
    return res.sendStatus(401);
  }

  const { role } = decode(token);

  if (role !== 'ADMIN' && !allowedRoutesByRole[role].includes(req.baseUrl)) {
    return res.status(403).send({
      message: 'Non autorisé',
    });
  }

  verify(token, getKey(role), (err, user) => {
    if (err) {
      logger.error(stringifyIfPossible(err));
      return res.status(403).send({
        message: err?.message || 'Erreur lors de la vérification du token',
      });
    }
    req.user = user;
    req.isAdmin = role === 'ADMIN';
    next();
  });
}

module.exports = authenticateToken;
