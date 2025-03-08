import fs from 'fs';
import path from 'path';

// Directory where images are stored
const IMAGES_BASE_DIR = process.env.IMAGES_BASE_DIR || '/app/images';

/**
 * Ensures a directory exists, creating it if necessary
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Saves a file to the local file system
 */
export function saveFile(
  bucket_name: string,
  filePath: string,
  fileBuffer: Buffer,
): void {
  // Create the directory for storing images if it doesn't exist
  const bucketDir = path.join(IMAGES_BASE_DIR, bucket_name);
  ensureDirectoryExists(bucketDir);

  // Save the file to the local filesystem
  const fullFilePath = path.join(IMAGES_BASE_DIR, bucket_name, filePath);
  const dirName = path.dirname(fullFilePath);
  ensureDirectoryExists(dirName);

  try {
    fs.writeFileSync(fullFilePath, fileBuffer);
  } catch (error: any) {
    throw new Error(`Error saving file to local storage: ${error.message}`);
  }
}

/**
 * Deletes a file from the local file system
 */
export function deleteFile(bucket_name: string, filePath: string): void {
  try {
    const fullFilePath = path.join(IMAGES_BASE_DIR, bucket_name, filePath);

    if (fs.existsSync(fullFilePath)) {
      fs.unlinkSync(fullFilePath);
    }
  } catch (error: any) {
    throw new Error(`Error deleting file from local storage: ${error.message}`);
  }
}

export default {
  ensureDirectoryExists,
  saveFile,
  deleteFile,
};
