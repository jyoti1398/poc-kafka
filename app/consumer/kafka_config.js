'use strict';
const config = require('../../config');
const { consumerGroupName } = config.kafka;

const TOPICS = {
    // pdf_generator_order: config.kafka_topics.pdf_generator_order,
    // pdf_generator_publish_topic: config.kafka_topics.pdf_generator_publish_topic,
    // pdf_generator_finance: config.kafka_topics.pdf_generator_finance,
    // pdf_generator_finance_publish_topic: config.kafka_topics.pdf_generator_finance_publish_topic,
    // manifest_generator_order: config.kafka_topics.manifest_generator_order,
    // manifest_generator_publish: config.kafka_topics.manifest_generator_publish,
    test_topic: config.kafka_topics.abc
};
const INTERNAL_TOPICS = {
    PDF_GENERATOR_INTERNAL: config.kafka_internal_topics.pdf_generator_internal,
    DAYTRADER_INTERNAL: config.kafka_internal_topics.daytrader_internal,
    MANIFEST_INTERNAL: config.kafka_internal_topics.manifest_internal
}
module.exports.INTERNAL_TOPICS_MAPPING = {
    [TOPICS.pdf_generator_order]: INTERNAL_TOPICS.PDF_GENERATOR_INTERNAL,
    [TOPICS.pdf_generator_finance]: INTERNAL_TOPICS.DAYTRADER_INTERNAL,
    [TOPICS.manifest_generator_order]: INTERNAL_TOPICS.MANIFEST_INTERNAL
}
module.exports.PUBLISH_TOPICS_MAPPING = {
    [TOPICS.pdf_generator_order]: TOPICS.pdf_generator_publish_topic,
    [TOPICS.pdf_generator_finance]: TOPICS.pdf_generator_finance_publish_topic,
    [TOPICS.manifest_generator_order]: TOPICS.manifest_generator_publish
}
module.exports.consumerConfig = {
    PdfGeneratorEvent: {
        name: 'PdfGeneratorEvent',
        consumerOptions: {
            groupId: `pdf-generator-${consumerGroupName}`
        },
        messageCount: 1,
        topics: {
            topics: [
                // TOPICS.pdf_generator_order,
                // TOPICS.pdf_generator_finance,
                // TOPICS.manifest_generator_order
                TOPICS.test_topic
            ], fromBeginning: false
        }
    },
    PdfGeneratorInternal: {
        name: 'PdfGeneratorInternal',
        consumerOptions: {
            groupId: `pdf-generator-internal-${consumerGroupName}`,
            sessionTimeout: 30000,
            heartbeatInterval: 10000,
        },
        messageCount: 1,
        topics: { topics: [
                INTERNAL_TOPICS.PDF_GENERATOR_INTERNAL
            ],  fromBeginning: false
        }},
    DaytraderInternal: {
        name: 'DaytraderInternal',
        consumerOptions: {
            groupId: `daytrader-internal-${consumerGroupName}`
        },
        messageCount: 1,
        topics: { topics: [
            INTERNAL_TOPICS.DAYTRADER_INTERNAL
        ],  fromBeginning: false
    }},
    ManifestInternal: {
        name: 'ManifestInternal',
        consumerOptions: {
            groupId: `manifest-internal-${consumerGroupName}`
        },
        messageCount: 1,
        topics: { topics: [
            INTERNAL_TOPICS.MANIFEST_INTERNAL
        ],  fromBeginning: false
    }}
}

module.exports.topicMapping = () => {
    const GenericEventHandler = require('../consumer/handler/generic_event_handler');
    const InternalEventHandler = require('../consumer/handler/internal_event_handler');

    return {
        [TOPICS.pdf_generator_order]: [
            new GenericEventHandler(),
        ],
        [TOPICS.pdf_generator_finance]: [
            new GenericEventHandler()
        ],
        [TOPICS.manifest_generator_order]: [
            new GenericEventHandler()
        ],
        [INTERNAL_TOPICS.PDF_GENERATOR_INTERNAL]: [
            new InternalEventHandler(),
        ],
        [INTERNAL_TOPICS.DAYTRADER_INTERNAL]: [
            new InternalEventHandler(),
        ],
        [INTERNAL_TOPICS.MANIFEST_INTERNAL]: [
            new InternalEventHandler(),
        ]
    };
};


module.exports = { ...module.exports, TOPICS, INTERNAL_TOPICS }