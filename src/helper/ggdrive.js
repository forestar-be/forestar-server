const { google } = require('googleapis');
const { Readable } = require('stream');
const logger = require('../config/logger');
if (!process.env.KEY_FILE) {
  throw new Error('KEY_FILE environment variable is required');
}

const drive = google.drive({
  version: 'v3',
  auth: new google.auth.GoogleAuth({
    keyFile: process.env.KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  }),
});

// check connection to drive
const checkDriveConnection = async () => {
  const response = await drive.files.list({
    q: 'mimeType = "application/pdf"',
  });
  logger.info('Drive connection successful');
  return response;
};

checkDriveConnection().catch((error) => {
  logger.error('Error checking drive connection:', error);
  process.exit(1);
});

async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderKey) {
  let folderId = process.env.DRIVE_FOLDER_ID;
  logger.info(`Uploading file to Google Drive: ${fileName}`);
  if (folderKey) {
    folderId = process.env[`DRIVE_FOLDER_ID_${folderKey}`];

    if (!folderId) {
      throw new Error(`Folder ID for ${folderKey} not found`);
    }
  }

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: mimeType,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType,
      body: Readable.from(fileBuffer),
    },
  });

  await drive.permissions.create({
    fileId: response.data.id,
    // transferOwnership: true,
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: process.env.EMAIL_USER,
    },
  });

  return response.data;
}

/**
 * Retrieves a file from Google Drive by ID and returns its content as a buffer
 * @param {string} fileId - The ID of the file in Google Drive
 * @returns {Promise<{fileBuffer: Buffer, fileName: string}>} - The file content as a buffer and the file name
 */
async function getFileFromDrive(fileId) {
  try {
    logger.info(`Getting file from Google Drive: ${fileId}`);
    // Get the file metadata first
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType',
    });

    // Now get the file content
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      },
    );

    // Convert the response to a buffer
    return {
      fileBuffer: Buffer.from(response.data),
      fileName: fileMetadata.data.name,
      mimeType: fileMetadata.data.mimeType,
    };
  } catch (error) {
    logger.error('Error retrieving file from Google Drive:', error);
    throw error;
  }
}

/**
 * Deletes a file from Google Drive by ID
 * @param {string} fileId - The ID of the file in Google Drive to delete
 * @returns {Promise<void>}
 */
async function deleteFileFromDrive(fileId) {
  try {
    logger.info(`Deleting file from Google Drive: ${fileId}`);
    await drive.files.delete({
      fileId: fileId,
    });
  } catch (error) {
    logger.error('Error deleting file from Google Drive:', error);
    throw error;
  }
}

module.exports = { uploadFileToDrive, getFileFromDrive, deleteFileFromDrive };
