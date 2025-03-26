import express, { Request, Response } from 'express';
import { isAuthenticated, getAuthUrl } from '../helper/authGoogle';
import asyncHandler from '../helper/asyncHandler';

const ggAuthRoutes = express.Router();

const MAIL_AUTH_GG = process.env.MAIL_AUTH_GG;

if (!MAIL_AUTH_GG) {
  throw new Error('MAIL_AUTH_GG is not set');
}

ggAuthRoutes.get(
  '/url',
  asyncHandler(
    async (
      req: Request<unknown, unknown, unknown, { redirect?: string }>,
      res: Response,
    ) => {
      const { redirect } = req.query;

      if (!redirect) {
        return res.status(400).json({ message: 'redirect is required' });
      }

      if (isAuthenticated()) {
        return res.status(200).json({ message: 'Déjà authentifié' });
      }

      const url = getAuthUrl(redirect || '');

      res.status(200).json({ url, email: MAIL_AUTH_GG });
    },
  ),
);

ggAuthRoutes.get(
  '/is-authenticated',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ isAuthenticated: isAuthenticated() });
  }),
);

export default ggAuthRoutes;
