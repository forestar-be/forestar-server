import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
export const notFoundImage =
  'https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png';

// Directory where images are stored
const IMAGES_BASE_DIR = process.env.IMAGES_BASE_DIR || '/app/images';

const API_URL = process.env.API_URL;
if (!API_URL) {
  throw new Error('API_URL is not configured');
}

// Create signed URL for images
export async function getImageUrl(bucket_name: string, image_path: string) {
  const filePath = path.join(IMAGES_BASE_DIR, bucket_name, image_path);

  if (!fs.existsSync(filePath)) {
    return notFoundImage;
  }

  // Generate a temporary token for image access
  const token = jwt.sign(
    {
      path: `${bucket_name}/${image_path}`,
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration
    },
    process.env.IMAGES_SECRET_KEY!,
  );

  // Return URL with auth token
  return `${API_URL}/images/${bucket_name}/${image_path}?auth=${token}`;
}

// Get public URL for images (without authentication)
export async function getImagePublicUrl(
  bucket_name: string,
  image_path: string,
) {
  const filePath = path.join(IMAGES_BASE_DIR, bucket_name, image_path);

  // Check if the image exists
  if (!fs.existsSync(filePath)) {
    return notFoundImage;
  }

  // Simply return the URL without authentication
  return `${API_URL}/images/${bucket_name}/${image_path}`;
}
