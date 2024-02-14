const Sentry = require("@sentry/node");
const logger = require("../../logger");

async function processMessage(kfMessage) {
    let { topic, partition, message } = kfMessage;
    console.log('kfMessage---------',kfMessage)
    const offset = Number(message.offset)
    try {
        const { onData } = require("./index");
        logger.debug('KAFKA_MSG_CONSUMED', { topic, partition, offset: offset });
        let key = message.key ? message.key.toString() : null
        let payload = JSON.parse(message.value.toString())
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                await onData(topic, key, payload[i], partition, message.offset)
            };
        } else {
            await onData(topic, key, payload, partition, message.offset)
        }
        console.log('-----------------',{ topic, partition, offset: offset })
        logger.debug('KAFKA_MSG_PROCESS_SUCCESS', { topic, partition, offset: offset });
    } catch (err) {
        console.error(err)
        Sentry.captureException(err, {
            extra: {
                topic: topic,
                partition: partition,
                offset: offset
            }
        });
        logger.error('KAFKA_MSG_PROCESS_FAILED', { topic, partition, offset: offset });
    }
}

module.exports = {
    processMessage
}
