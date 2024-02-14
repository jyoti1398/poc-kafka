const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const config = require('../config');
const { redisClient } = require('././redis.init');

let timer;
// consumer health check
const file_healthz_path = path.resolve('/tmp/_healthz');
const changeHealthFile = () => {
    fs.closeSync(fs.openSync(file_healthz_path, 'w'));
};
const startHealthCheckDaemon = () => {
    redisClient
    changeHealthFile();
    timer = setInterval(() => {
        if (config.isRedisConnected === true) {
            changeHealthFile();
            logger.info("healthz worker " + new Date().toLocaleString());
        }
    }, 30 * 1000);
};
const stopHealthCheckDaemon = () => {
    timer && clearInterval(timer);
}

module.exports = { startHealthCheckDaemon, stopHealthCheckDaemon };