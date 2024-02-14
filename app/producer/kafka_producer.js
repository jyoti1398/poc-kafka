'use strict';

const { producer } = require('../kafka.init');
const Sentry = require('@sentry/node');
const { v4: uuidv4 } = require("uuid");
const logger = require("../../logger");

async function sendToKafka(topicName, message, key = null) {
    try {
        message = JSON.stringify(message);
        let responseFormkafka = await (await producer).produce(
            topicName,
            [{ key: key == null ? null : key.toString(), value: message }]
        );
        logger.debug("RESPONSE FROM PRODUCER: ", responseFormkafka);
        logger.info('sendToKafka: Payload published to kafka', { topicName });
    } catch (error) {
        console.error(error)
        Sentry.captureException(error);
        throw error
    }
}

const produceAuditTrail = async (topicName, payload, job_type, action) => {
    logger.info('produceAuditTrail');
    const message = {
        payload: payload,
        meta: {
          job_type: job_type,
          action: action,
          trace: `grindor.${uuidv4()}`,
        },
    };
    try {
        await sendToKafka(topicName, message);
    } catch (err) {
        logger.error('produceAuditTrail', { topic: topicName, error: err });
    }
};

module.exports = {
    sendToKafka,
    produceAuditTrail,
}