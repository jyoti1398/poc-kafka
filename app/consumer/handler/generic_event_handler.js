'use strict';

const _ = require('lodash');
const BaseEventHandler = require("./base.event");
const { sendToKafka } = require("../../producer/kafka_producer");
const kafkaConfig = require("../kafka_config");
const generators = require("../../utils/generator");
const pdfTypeHandler = require("../../handlers/pdfGenerator/pdfType");
const eventMeta =  require("../../schemas/eventMeta.json")
const { validate } = require("../../schemas/parser");
const {errorHandler} = require("../../utils/errorHandler");
const errorCodes = require("../../utils/error/codes");
const CustomError = require("../../utils/error/index");
const logger = require('../../../logger');
const config = require('../../../config');
const { measureSegment } = require("../../decorators");
const { metrics } = require("../../utils/prometheus");
const stateManager = require("../../utils/stateManager");
const { getFormattedTimeFromUtc } = require('../../helper')

const GENERATORS = {
    'barcode': generators.generateBarCode,
    'qrcode': generators.generateQrCode,
    'signedqrcode': generators.generateSignedQrCode,
    'digital_signature': generators.getDigitalSignature,
}

class GenericEventHandler extends BaseEventHandler {
    constructor(eventCategory) {
        super(eventCategory);
        logger.info('In GenericEventHandler');
    }

    async generatorTransformation(message) {
        //Generate Bar code and QR code
        const generatorKeys = Object.keys(_.get(message, "payload.meta.generator", {}));
        const uid = _.get(message, "payload.shipment_id", "") || _.get(message, "payload.uid", "");
        const manifestId = _.get(message, "payload.manifest_id", "");
        logger.info('GenericEventHandler: generatorTransformation', { generatorKeys, uid });
        try {
            for (const generator of generatorKeys) {
                const generatorKey = generator.split("_generator")[0];
                const generatorMethod = _.get(message, `payload.meta.generator[${generator}].method`);
                const generatorMethodParams = _.get(message, `payload.meta.generator[${generator}].kwargs`, {});

                if (generatorMethod && GENERATORS[generatorMethod]) {
                    if(_.isArray(generatorMethodParams.value)) {
                        let awb_number_barcode = {};
                        for(let value of generatorMethodParams.value) {
                            awb_number_barcode[value] = await GENERATORS[generatorMethod]({ value });
                        }
                        await stateManager.setGeneratorData(manifestId || uid, generatorKey, { [generatorKey]: awb_number_barcode });
                    } else {
                        message.payload[generatorKey] = await GENERATORS[generatorMethod](generatorMethodParams);
                    }
                }
            }
            return message;
        } catch (error) {
            logger.error('GenericEventHandler: generatorTransformation error', { generatorKeys, uid, error });
            throw new CustomError(error, errorCodes.TRANSFORMATION_ERROR, { uid, consumer: config.consumer_type, meta: message.meta }).setSlackAlert(true);
        }
    }

    async generateTransformedEvents(message) {
        logger.info('GenericEventHandler:generateTransformedEvents', { uid: message.payload.shipment_id });
        try {
            let transformedEvents = [];
            const slugs = Object.keys(message.meta.format);
            logger.info('generatorTransformation', { slugs });
            for (let slug of slugs) {
                message.payload.uid = message.payload.uid || message.payload.shipment_id;
                let transformed = Object.assign({}, message);
                transformed.meta = Object.assign({}, transformed.meta);
                transformed.meta.slug = slug;
                transformed.meta.slugValue = transformed.meta.format[slug];
                transformedEvents.push(transformed);
            }

            console.log("transformedEvents", transformedEvents);
            return transformedEvents;
        } catch (error) {
            logger.error('GenericEventHandler: generateTransformedEvents error', { uid: message.payload.shipment_id, error });
            throw new CustomError(error, errorCodes.TRANSFORMATION_ERROR, { uid: message.payload.shipment_id, consumer: config.consumer_type, meta: message.meta }).setSlackAlert(true);
        }
    }

    transformTimeZone(message) {
        if (message?.meta?.service?.name === 'daytrader') return message.payload;
        const { date_of_issue, expiry_date, invoice_detail, company_detail, payments = [] } = message.payload;
        const timezone = company_detail?.business_country_timezone || 'Asia/Kolkata';
        logger.info('GenericEventHandler: transformTimeZone', { date_of_issue, expiry_date, invoice_date: invoice_detail?.invoice_date });
        if (payments?.length > 0) {
            message.payload.payments = payments.map((payment) => {
                return payment?.date ?
                {
                    ...payment,
                    date: !isNaN(new Date(payment.date)) ? getFormattedTimeFromUtc(payment.date, 'yyyy-MM-dd', timezone) : payment.date,
                    time: !isNaN(new Date(payment.time)) ? getFormattedTimeFromUtc(payment.date, 'HH:mm:ss', timezone) : payment.time,
                }
                : payment;
            });
        }
        if (date_of_issue) {
            message.payload.date_of_issue = !isNaN(new Date(date_of_issue)) ? getFormattedTimeFromUtc(date_of_issue, 'dd/MM/yyyy, hh:mm:ss a', timezone) : date_of_issue;
        }
        if (expiry_date) {
            message.payload.expiry_date = !isNaN(new Date(expiry_date)) ? getFormattedTimeFromUtc(expiry_date, 'dd/MM/yyyy, hh:mm:ss a', timezone) : expiry_date;
        }
        if (message.payload.invoice_detail?.invoice_date) {
            const { invoice_date } = message.payload.invoice_detail;
            message.payload.invoice_detail.invoice_date = !isNaN(new Date(invoice_date)) ? getFormattedTimeFromUtc(invoice_date, 'dd/MM/yyyy', timezone) : invoice_date;
        }
        return message.payload;
    }

    handleAddress(message){
        const {
            company_detail = {},
            store_detail = {},
            customer_billing_detail = {},
            customer_shipping_detail = {},
            return_detail = {},
            registered_company_detail = {},
            b2b_buyer_details = {}
        } = message.payload;

        const companyDetailAddress = company_detail?.display_address ||  company_detail?.address;
        const storeDetailAddress = store_detail?.display_address ||  store_detail?.address;
        const customerBillingDetailAddress = customer_billing_detail?.display_address ||  customer_billing_detail?.address;
        const customerShippingDetailAddress = customer_shipping_detail?.display_address ||  customer_shipping_detail?.address;
        const returnDetailAddress = return_detail?.display_address ||  return_detail?.address;
        const registeredCompanyDetailAddress = registered_company_detail?.display_address ||  registered_company_detail?.address;
        const b2bBuyerDetailsAddress = b2b_buyer_details?.display_address || b2b_buyer_details?.address;

        if (companyDetailAddress) message.payload.company_detail.address = companyDetailAddress;
        if (storeDetailAddress) message.payload.store_detail.address = storeDetailAddress;
        if (customerBillingDetailAddress) message.payload.customer_billing_detail.address = customerBillingDetailAddress;
        if (customerShippingDetailAddress) message.payload.customer_shipping_detail.address = customerShippingDetailAddress;
        if (returnDetailAddress) message.payload.return_detail.address = returnDetailAddress;
        if (registeredCompanyDetailAddress) message.payload.registered_company_detail.address = registeredCompanyDetailAddress;
        if (b2bBuyerDetailsAddress) message.payload.b2b_buyer_details.address = b2bBuyerDetailsAddress;

        return message.payload;

    }

    async transformMessage(message) {
        logger.info('GenericEventHandler: transformMessage', { uid: message.payload.shipment_id });
        try {

            const generatorTransformationMetrics = measureSegment(this.generatorTransformation, metrics.GENERATOR_TRANSFORMATION_LATENCY, [process.env.K8S_POD_NAME, config.consumer_type], 'generatorTransformation', this, { uid: message.payload.uid });
            let messageUpdated = await generatorTransformationMetrics(message);
            console.log(messageUpdated);
            messageUpdated.payload = this.transformTimeZone(messageUpdated);
            messageUpdated.payload=this.handleAddress(messageUpdated);
            const transformedEvents = await this.generateTransformedEvents(messageUpdated);
            return transformedEvents;
        } catch (error) {
            logger.error('GenericEventHandler: transformMessage error', { uid: message.payload.shipment_id, error });
            throw new CustomError(error, errorCodes.TRANSFORMATION_ERROR, { uid: message.payload.shipment_id, consumer: config.consumer_type, meta: message.meta }).setSlackAlert(true)
        }
    }

    async getSchemaFromDb(event) {
        logger.info('GenericEventHandler: getSchemaFromDb', { uid: event.payload.shipment_id });
        try {
            const slugs = Object.keys(event.meta.format);
            const name = slugs[0];
            if (!name) return {};
            const pdfType = await pdfTypeHandler.fetchPdfTypes({ name });
            return pdfType[0]?.schema || '';
        } catch (error) {
            logger.error('GenericEventHandler: getSchemaFromDb error', { uid: event.payload.shipment_id, error });
            throw new CustomError(error, errorCodes.TRANSFORMATION_ERROR, { uid: event.payload.shipment_id, consumer: config.consumer_type, meta: event.meta }).setSlackAlert(true)
        }
    }

    async handleEvent(event, topic, partition, offset) {
        logger.info('GenericEventHandler: handleEvent', { event, topic });
        try {
            logger.info('Consumed Event', { topic, partition, offset });
            let validation = { success: true };
            let transformedEvents;
            event.meta.topic = topic;
            // Validate Meta
            const isvalidMeta = await validate(eventMeta, event.meta);
            if(!isvalidMeta.success) {
                errorHandler(isvalidMeta.errors, "Error In Kafka Generic Event Handler", event);
                return;
            }
            //Validate Payload
            const schema = await this.getSchemaFromDb(event);
            if (schema) {
                validation = await validate(schema, event.payload);
            }
            if (validation.success) {
                //Transform payload and generate Bar codes
                const transformMessageMetrics = measureSegment(this.transformMessage, metrics.MESSAGE_TRANSFORMATION_LATENCY, [process.env.K8S_POD_NAME, config.consumer_type], 'transformMessage', this, { uid: event.payload.uid });
                transformedEvents = await transformMessageMetrics(event);

                for (let transformedEvent of transformedEvents) {
                    await sendToKafka(kafkaConfig.INTERNAL_TOPICS_MAPPING[topic], transformedEvent, event.payload?.manifest_id || event.payload?.uid);
                }
            } else {
                //Publish payload to document topic with error.
                errorHandler(validation.errors, "Error In Kafka Generic Event Handler", event)
            }
        } catch (error) {
            errorHandler(error, "Error In Kafka Generic Event Handler", event)
        }
    }
}
module.exports = GenericEventHandler
