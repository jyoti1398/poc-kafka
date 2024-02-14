const { Fit } = require('fit');

const conf = require('../config');


const { brokers } = conf.kafka;
const kafka = Fit.initKafka({
    clientId: `grindor-${conf.consumer_type}`,
    brokers: brokers.split(','),
    logLevel: Fit.kafkajs.logLevel.WARN
})

const producer = Fit.initKafkaProducer(kafka);

module.exports = {
    producer,
    kafka
};
