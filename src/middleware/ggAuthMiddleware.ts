import { Request, Response, NextFunction } from 'express';

import logger from '../config/logger';
import { isAuthenticated } from '../helper/authGoogle';

/**
 * Middleware to check if the server is authenticated with google
 */
export function ggAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (req.path === '/login') {
      return next();
    }

    if (!isAuthenticated()) {
      return res.status(403).send({
        message: 're_auth_gg_required',
      });
    }
    next();
  } catch (error) {
    logger.error('Error in ggAuthMiddleware', error);
    return res
      .status(500)
      .send(
        `Une erreur est survenue lors de la vérification de l'authentification avec google: ${error}`,
      );
  }
}

export default ggAuthMiddleware;
