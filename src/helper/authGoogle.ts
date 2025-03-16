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

// Add token update event handler
oAuth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // Store the new tokens
    const existingTokens = fs.existsSync(TOKEN_PATH)
      ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
      : {};
    const newTokens = { ...existingTokens, ...tokens };
    logger.info('Received new refresh token, updating stored tokens');
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(newTokens));
  } else if (tokens.access_token) {
    // Update the access token only
    const existingTokens = fs.existsSync(TOKEN_PATH)
      ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
      : {};
    const newTokens = { ...existingTokens, access_token: tokens.access_token };
    if (tokens.expiry_date) {
      newTokens.expiry_date = tokens.expiry_date;
    }
    logger.info('Received new access token, updating stored tokens');
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(newTokens));
  }
});

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
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(tokens);

    // For tokens with a refresh_token, try to ensure we have a valid access token
    if (tokens.refresh_token) {
      logger.info(
        'Found refresh token, attempting to refresh access token if needed',
      );
    }

    verifyToken().then((isValid) => {
      authenticated = isValid;
      if (!isValid) {
        logger.warn('Token verification failed - check logs for details');
        // Don't clear credentials as they may contain a valid refresh token
      } else {
        logger.info('Successfully authenticated with Google');
      }
    });
  } catch (error) {
    logger.error(
      `Error reading or parsing token file: ${error instanceof Error ? error.message : String(error)}`,
    );
    logger.warn('Authorization will be required');
  }
} else {
  logger.warn('Token file not found, authorization will be required');
}

export const getAuthUrl = () => {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // needed to always get a refresh token
    scope: SCOPES,
  });
};

export const authenticate = async (code: string) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);

    // Ensure we keep the refresh token if we already had one
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        const existingTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        // If the new tokens don't have a refresh token but the old ones do, keep it
        if (!tokens.refresh_token && existingTokens.refresh_token) {
          logger.info(
            'Preserving existing refresh token since new tokens did not include one',
          );
          tokens.refresh_token = existingTokens.refresh_token;
        }
      } catch (error) {
        logger.warn(
          `Error reading existing tokens, using only new tokens: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    oAuth2Client.setCredentials(tokens);

    logger.info(`Writing token to ${TOKEN_PATH}`);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    logger.info('Token stored');

    authenticated = await verifyToken();

    if (!authenticated) {
      throw new Error('Failed to authenticate');
    }

    return tokens;
  } catch (error) {
    logger.error(
      `Authentication error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

export const isAuthenticated = () => authenticated;

export const getOAuth2Client = () => oAuth2Client;

export const initRefreshTokenCron = () => {
  logger.info('Starting token refresh cron job');
  // Run every 30 minutes to ensure token stays valid
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Checking token validity');

    // Force a token refresh if we have a refresh token
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

      if (tokens.refresh_token) {
        try {
          // This will trigger a refresh if the access token is expired
          const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
          await oauth2.userinfo.get();
          authenticated = true;
          logger.info('Token refreshed successfully');
        } catch (error: any) {
          logger.error(`Failed to refresh token: ${error.message}`);
          authenticated = false;
        }
      } else {
        logger.warn('No refresh token found in stored credentials');
        authenticated = await verifyToken();
      }
    } else {
      logger.warn('No token file found during refresh check');
      authenticated = false;
    }
  });
};
