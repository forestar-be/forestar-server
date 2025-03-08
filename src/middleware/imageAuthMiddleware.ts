import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import logger from '../config/logger';

// Directory where images are stored
const IMAGES_BASE_DIR = process.env.IMAGES_BASE_DIR || '/app/images';

// Image authentication key
const IMAGES_SECRET_KEY = process.env.IMAGES_SECRET_KEY;

// List of public bucket names (comma-separated string)
const PUBLIC_BUCKET_NAMES = (process.env.PUBLIC_BUCKET_NAMES || '')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

if (!IMAGES_SECRET_KEY) {
  logger.error('IMAGES_SECRET_KEY is not configured');
  process.exit(1);
}

/**
 * Middleware to authenticate image access tokens
 */
export function authenticateImageAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Path format: /images/bucket_name/image_path
  const urlPath = req.path;

  // Skip if not requesting an image
  if (!urlPath.startsWith('/images/')) {
    return next();
  }

  // Parse the path to extract bucket and image path
  const pathParts = urlPath.split('/');

  // At minimum should have /images/bucket_name/file.jpg
  if (pathParts.length < 4) {
    return res.status(404).send('Image not found');
  }

  const bucketName = pathParts[2];
  const imagePath = pathParts.slice(3).join('/');

  // Check if this bucket is in the public buckets list
  if (PUBLIC_BUCKET_NAMES.includes(bucketName)) {
    // logger.debug(`Allowing public access to bucket: ${bucketName}`);
    return next();
  }

  // If auth token is provided, validate it
  const authToken = req.query.auth as string;

  if (authToken) {
    // Verify token
    try {
      // Check if we have the secret key
      if (!IMAGES_SECRET_KEY) {
        logger.error('IMAGES_SECRET_KEY is not configured');
        return res.status(500).send('Server configuration error');
      }

      // Verify the token
      const decoded = verify(authToken, IMAGES_SECRET_KEY) as { path: string };

      // Verify the path matches what's in the token
      if (decoded.path !== `${bucketName}/${imagePath}`) {
        logger.warn('Token path mismatch');
        return res.status(403).send('Unauthorized');
      }

      // All good, proceed
      return next();
    } catch (err) {
      logger.error('Token verification failed', err);
      return res.status(403).send('Unauthorized');
    }
  } else {
    // If no auth token is provided and bucket is not in public list, deny access
    logger.warn(
      `Attempted unauthorized access to non-public bucket: ${bucketName}`,
    );
    return res.status(403).send('Authentication required');
  }
}

export default authenticateImageAccess;
