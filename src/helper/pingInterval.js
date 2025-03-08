const axios = require('axios');
const logger = require('../config/logger');
const cron = require('node-cron');

function pingUrl(url) {
  axios.get(url).catch((error) => {
    logger.error(`Error pinging ${url}: ${error}`);
  });
}

const initPingCron = () => {
  logger.info('Starting cron jobs for pinging URLs every minute');

  cron.schedule('*/1 * * * *', () => {
    pingUrl(process.env.FRONTEND_URL_TO_PING);
    //pingUrl(`${process.env.API_URL}/health`);
  });
};

module.exports = { initPingCron };
