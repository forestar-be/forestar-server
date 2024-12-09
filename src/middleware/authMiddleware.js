const { verify, decode } = require('jsonwebtoken');
const logger = require('../config/logger');

const SUPERVISOR_SECRET_KEY = process.env.SUPERVISOR_SECRET_KEY;
const OPERATOR_SECRET_KEY = process.env.OPERATOR_SECRET_KEY;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RENTAL_MANAGER_SECRET_KEY = process.env.RENTAL_MANAGER_SECRET_KEY;

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
    default:
      return null;
  }
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

  verify(token, getKey(role), (err, user) => {
    if (err) {
      logger.error(err);
      return res.sendStatus(403);
    }
    req.user = user;
    req.isAdmin = role === 'ADMIN';
    next();
  });
}

module.exports = authenticateToken;
