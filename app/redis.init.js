const { Fit } = require("fit");
const redisClient = Fit.connections.redis.grindor.write;

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};
redisClient.options = {
    ...redisClient.options,
    ...redisOptions,
};

module.exports = {
    redisClient,
    redisOptions,
}