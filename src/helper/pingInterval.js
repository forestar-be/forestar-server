const axios = require('axios');
const logger = require('../config/logger');
const cron = require('node-cron');

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

const initPingCron = () => {
  logger.info('Starting cron jobs for pinging URLs every minute');

  cron.schedule('*/1 * * * *', () => {
    pingUrl(process.env.FRONTEND_URL);
    pingUrl(`${process.env.API_URL}/health`);
  });
};

module.exports = { initPingCron };
