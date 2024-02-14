const config = require("../../../config");
const { sendToKafka } = require("../../producer/kafka_producer");
const CustomError = require("../../utils/error/index");
const { getSignedUrl, extractPageFormat } = require("../../helper")
const errorCodes = require("../../utils/error/codes");
const kafkaConfig = require("../kafka_config");
const _ = require("lodash");
const logger = require("../../../logger");

class PreparePublishPayload {
    prepareMediaList = async (pdfUrls, event, topic) => {
        logger.info('prepareMediaList', { pdfUrls });
        console.log('test value in merge pipeline', config.region)
        let mediaList = [];
        for (let pdfUrl of pdfUrls) {
            const format = extractPageFormat(pdfUrl.Key)
            if(event.meta.slug === "jiomart_label") {
                event.meta.slug = "label"
            }
            else if(event.meta.slug === "ajio_b2b") {
                event.meta.slug = "b2b"
            }
            else if(event.meta.slug === "ajio_credit_note") {
                event.meta.slug = "credit_note"
            }
            let media = Object.assign({}, {
                link: pdfUrl.Location,
                status: true,
                entity: event.payload.uid,
                code: 200,
                media_type: format ? `${event.meta.slug}_${format}` : event.meta.slug,
                private: true,
                file: {
                    bucket: pdfUrl.Bucket,
                    region: config.region,
                    key: pdfUrl.Key
                }
            });
            switch (topic) {
                case config.kafka_topics.pdf_generator_finance: {
                    const filePath = pdfUrls[0].Key;
                    const signedUrl = await getSignedUrl({
                        filePath, 
                        operation: 'getObject',
                        expiry: 1800
                    });
                    const obj = {
                        link: signedUrl,
                        status: true,
                        entity: event.payload.uid,
                        code: 200,
                        media_type: event.meta.slug,
                        private: false,
                        file: {
                            bucket: pdfUrl.Bucket,
                            region: config.region,
                            key: pdfUrl.Key
                        }
                    }
                    mediaList.push(obj);
                    break
                }
            }
            mediaList.push(media);
        }
        return mediaList;
    }


    prepareMeta = (event, topic) => {
        logger.info('prepareMeta', { topic });
        switch (topic) {
            case config.kafka_topics.pdf_generator_order: {
                return {
                    version: "2.0",
                    job_type: "pdf_generator",
                    action: "document_generation_update",
                    from: "grindor",
                    trace: event.meta.trace_id[0]
                }
            }
            case config.kafka_topics.pdf_generator_finance: {
                return {
                    version: "2.0",
                    trace: event.meta.trace_id[0]
                }
            }
            case config.kafka_topics.manifest_generator_order: {
                return {
                    version: '3.0',
                    trace: event.meta.trace_id[0],
                    job_type: "manifest",
                    action: "manifest_pdf_update"
                }
            }
        }
        return {
            version: "1.0",
            job_type: "pdf_generator",
        };
    }

    async publishToKafka(isSuccess, code, data, event, error) {
        const loggerObj = { isSuccess, code, uid: event.payload.uid };
        try {
            logger.info('publishToKafka', loggerObj);
            const publish_payload = {};
            const eventTopic = _.get(event, "meta.topic", "");
            Object.assign(publish_payload, {
                payload: {
                    success: isSuccess,
                    uid: event.payload.uid,
                    code: code || 601
                }
            });

            if(eventTopic === config.kafka_topics.manifest_generator_order) {
                publish_payload.payload.manifest_id = event.payload.manifest_id;
            }

            publish_payload.meta = this.prepareMeta(event, eventTopic);

            if (isSuccess) {
                let mediaList = await this.prepareMediaList(data, event, eventTopic);
                publish_payload.payload.media = mediaList;
            } else {
                publish_payload.debugger = error;
                publish_payload.error = data;
            }
            console.log("publish_payload", JSON.stringify(publish_payload));
            await sendToKafka(kafkaConfig.PUBLISH_TOPICS_MAPPING[eventTopic], publish_payload, event.payload?.manifest_id || event.payload?.uid);
            logger.info(`publishToKafka: Payload Published to kafka topic - ${kafkaConfig.PUBLISH_TOPICS_MAPPING[eventTopic]}`, loggerObj);
        } catch (error) {
            logger.error('publishToKafka: Failed to publish to kafka topic', { ...loggerObj, error });
            throw new CustomError(error, errorCodes.PUBLISH_MESSAGE_ERROR, { uid: event.payload.uid, consumer: config.consumer_type }).setSlackAlert(true)
        }
    }
}

module.exports = PreparePublishPayload;
