const axios = require('axios');
const logger = require('../config/logger');

const interval = 60000; // Interval in milliseconds

function pingUrl(url) {
  axios
    .get(url)
    .then((response) => {
      logger.debug(`Successfully pinged ${url}: ${response.status}`);
    })
    .catch((error) => {
      logger.error(`Error pinging ${url}: ${error}`);
    });
}

const initPingIntervals = () => {
  logger.info('Starting ping intervals');
  setInterval(() => pingUrl(process.env.FRONTEND_URL), interval);
  setInterval(() => pingUrl(`${process.env.API_URL}/health`), interval);
};

module.exports = { initPingIntervals };
