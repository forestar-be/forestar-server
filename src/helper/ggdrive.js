const { google } = require('googleapis');
const path = require('path');
const { Readable } = require('stream');
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

async function uploadFileToDrive(fileBuffer, fileName, mimeType) {
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: mimeType,
      parents: [process.env.DRIVE_FOLDER_ID],
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

module.exports = { uploadFileToDrive };
