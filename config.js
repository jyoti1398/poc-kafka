'use strict';

const _ = require('lodash');
const convict = require("fit").Fit.convict;

const mongodbUri = require('mongodb-uri');
const urlJoin = require('url-join');

convict.addFormat({
    name: 'mongo-uri',
    validate: function (val) {
        let parsed = mongodbUri.parse(val);
        mongodbUri.format(parsed);
    },
    coerce: function (urlString) {
        if (urlString) {
            let parsed = mongodbUri.parse(urlString)
            urlString = mongodbUri.format(parsed);
        }
        return urlString;
    }
});

const conf = convict({
    cdn: {
        assets: {
            doc: 'CDN Assets Domain',
            format: String,
            default: 'hdn-1.addsale.com',//cdn.pixelbin.io
            env: 'CDN_ITEM_DOMAINS',
            arg: 'cdn_item_domains'
        },
        path: {
            doc: 'CDN Assets path',
            format: String,
            default: '',
            env: 'CDN_ITEM_PATH',
            arg: 'cdn_item_PATH'
        },
        base_path: {
            doc: 'CDN item base path',
            format: String,
            default: 'cdn.pixelbin.io/v2/falling-surf-7c8bb8/fyndnp/wrkr/',
            env: 'CDN_ITEM_BASE_PATH',
            arg: 'cdn_item_base_path'
        },
        old_base_paths: {
            doc: 'old cdn base paths',
            format: Array,
            default: [],
            env: 'OLD_CDN_BASE_URLS',
            arg: 'old_cdn_base_urls'
        }
    },
    kafka: {
        consumerGroupName: {
            doc: "kafka consumer group name",
            format: String,
            default: "group-1",
            env: "KAFKA_CONSUMER_GROUP_NAME",
            arg: "kafka_consumer_group_name"
        },
        brokers: {
            doc: "Kafka Brokers List",
            format: String,
            default: "localhost:29092",
            env: 'KAFKA_BROKER_LIST',
            arg: 'kafka_broker_list'
        }
    },
    port: {
        doc: "The port to bind",
        format: "port",
        default: 8123,
        env: "PORT",
        arg: "port"
    },
    consumer_type: {
        doc: "consumer for",
        format: String,
        default: "PdfGeneratorEvent",
        env: "CONSUMER_TYPE",
        arg: "consumer_type",
    },
    kafka_internal_topics: {
        pdf_generator_internal: "impetus-json-pdf-generator-internal",
        daytrader_internal: "impetus-json-daytrader-internal",
        manifest_internal: "impetus-json-manifest-internal",
    },
    kafka_topics: {
        pdf_generator_order: "impetus-json-pdf-generator-order",
        pdf_generator_finance: "impetus-json-pdf-generator-finance",
        pdf_generator_publish_topic: "impetus-json-pdf-generator-update",
        pdf_generator_finance_publish_topic:"impetus-json-enigma-seller-invoice-status",
        manifest_generator_order: "impetus-json-manifest-order",
        manifest_generator_publish: "impetus-json-manifest-shipment-init",
        audit_trail: "impetus-json-audit-trail-logs"
    },
    WORKER_TYPE: {
        doc: "Type of worker",
        format: String,
        default: "local",
        env: "WORKER_TYPE",
        arg: "worker_type",
    },
});

// Perform validation
conf.validate({ allowed: "strict" });

// console.log("Final Config", conf.get());

_.extend(conf, conf.get());
conf.appVersion = '1.0.0';
conf.USER_AGENT = `PdfGenerator/${conf.appVersion} Node.JS/${process.env.NODE_VERSION} request/2.88`;
conf.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";

if(!conf.get('cdn.base_path').startsWith("https://")) {
    conf.cdn.base_path = urlJoin("https://", conf.get('cdn.base_path'));
}

conf.cdn.old_base_paths = conf.get("cdn.old_base_paths").filter(element => element).map(entry => {
    if(!entry.startsWith("https://")){
        entry = urlJoin("https://", entry);
    }
    return entry;
});

module.exports = conf;
