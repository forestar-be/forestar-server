import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import logger from '../config/logger';
import cron from 'node-cron';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
];
const TOKEN_PATH = process.env.OAUTH_CLIENT_TOKEN_FILE!;

if (!TOKEN_PATH) {
  throw new Error('OAUTH_CLIENT_TOKEN_FILE is not defined');
}

if (!process.env.OAUTH_CLIENT_SECRET_FILE) {
  throw new Error('OAUTH_CLIENT_SECRET_FILE is not defined');
}

const credentials = JSON.parse(
  fs.readFileSync(process.env.OAUTH_CLIENT_SECRET_FILE, 'utf8'),
);
const { client_secret, client_id, redirect_uris } = credentials.web;

const oAuth2Client: OAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris?.[0] || process.env.OAUTH_REDIRECT_URI,
);

let authenticated = false;

const verifyToken = async () => {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    await oauth2.userinfo.get(); // Fetch user info as a test request
    logger.info('Token is valid and authenticated');
    return true;
  } catch (error: any) {
    logger.error(error.message);
    return false;
  }
};

if (fs.existsSync(TOKEN_PATH)) {
  logger.info(`Reading token from ${TOKEN_PATH}`);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));

  verifyToken().then((isValid) => {
    authenticated = isValid;
    if (!isValid) {
      logger.warn('Token is invalid or expired');
      oAuth2Client.setCredentials({});
    }
  });
} else {
  logger.warn('Token file not found');
}

export const getAuthUrl = () => {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // needed to always get a refresh token
    scope: SCOPES,
  });
};

export const authenticate = async (code: string) => {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  logger.info(`Writing token to ${TOKEN_PATH}`);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  logger.info('Token stored');

  authenticated = await verifyToken();

  if (!authenticated) {
    throw new Error('Failed to authenticate');
  }
};

export const isAuthenticated = () => authenticated;

export const getOAuth2Client = () => oAuth2Client;

export const initRefreshTokenCron = () => {
  logger.info('Starting token refresh cron job');
  cron.schedule('0 0 * * *', async () => {
    logger.info('Refreshing token');
    authenticated = await verifyToken();
    if (!authenticated) {
      logger.error('Failed to refresh token');
    }
  });
};
