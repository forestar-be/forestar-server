// Extend express.Request to include user attribute
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        username?: string;
        role?: string;
      };
      isAdmin?: boolean;
    }
  }
}
