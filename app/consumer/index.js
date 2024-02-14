"use strict";

const { Fit } = require("fit");

const { consumerConfig } = require("./kafka_config");
const { processMessage } = require("./consumer_process");
const config = require("./../../config");
const { kafka } = require("../kafka.init");
const { topicMapping } = require("./kafka_config");
const logger = require("../../logger");

logger.info(`Starting ${config.consumer_type} consumer`);
let kf;

async function startConsumer() {
  kf = await Fit.initKafkaConsumer(
    consumerConfig[config.consumer_type].consumerOptions,
    consumerConfig[config.consumer_type].topics,
    kafka
  );
    console.log(' topicss --------',consumerConfig[config.consumer_type].topics, config.consumer_type )
  await kf.consume(processMessage, { autoCommitInterval: 5000 });
  console.log("received");
}

async function shutdown(cb) {
  if (kf) {
    await kf.disconnect();
  }

  cb();
}

async function onData(topic, key, event, partition, offset) {
  console.log(event, 'event')
  const mapping = topicMapping();
  let eventsHandlers = mapping[topic];
  for (var i = 0; i < eventsHandlers.length; i++) {
    try {
      const evtHld = eventsHandlers[i];
      await evtHld.handleEvent(event, topic, partition, offset);
    } catch (err) {
      throw err;
    }
  }
  return true;
}

module.exports = {
  shutdown,
  startConsumer,
  onData,
};
