'use strict';

const nunjucks = require("nunjucks");
const fs = require("fs");
const _ = require('lodash');
const BaseEventHandler = require("./base.event");
const browser = require("../../utils/puppeterPdfGenerator");
const PreparePublishPayload = require("../utils/prepare_publish_payload");
const templateFileName = require("../utils/template_file_name");
const manifestTemplate = require("../../json/template")
const PAGE_OPTIONS = require("../page_options");
const CloudStorage = require('../../utils/storage');
const PdfGeneratorConfigHandler = require('../../handlers/pdfGenerator/pdfGeneratorConfig');
const PdfDefaultTemplateHandler = require('../../handlers/pdfGenerator/pdfDefaultTemplate');
const PdfTypeHandler = require('../../handlers/pdfGenerator/pdfType');
const CustomError = require("../../utils/error/index");
const errorCodes = require("../../utils/error/codes");
const {errorHandler} = require("../../utils/errorHandler");
const conf = require('../../../config');
const logger = require('../../../logger');
const { uploadBufferDataToPrometheus, measureSegment, recordPrometheus, measureTransaction } = require("../../decorators");
const { metrics } = require("../../utils/prometheus");
const { sendPaymentReciptData } = require('../../helper');
const stateManager = require("../../utils/stateManager");


class InternalEventHandler extends BaseEventHandler {
    preparePublishPaylod;
    constructor() {
        super();
        logger.info('In InternalEventHandler');
        this.preparePublishPaylod = new PreparePublishPayload();
    }

    async fetchPdfGeneratorConfig(event) {
        logger.info('InternalEventHandler: fetchPdfGeneratorConfig', { event, uid: event.payload.shipment_id });
        //Fetch pdf generator config on the basis of company id and application id and format
        try {
            const filters = {};
            const pdfTypeFilters = { name: event.meta.slug };
            if (event.meta.company_id) {
                filters.company_id = event.meta.company_id;
            }
    
            if (event.meta.application_id) {
                filters.application_id = event.meta.application_id[0];
            }


            if (event.meta.slugValue) {
                filters.format = { $in: event.meta.slugValue };
            }

            if(event?.payload?.company_detail?.country_code) {
                filters.country_code = event?.payload?.company_detail?.country_code || conf.country_code;
            }

            if (event.payload?.company_detail?.country_code) {
                pdfTypeFilters.country_code = event.payload.company_detail.country_code;
            }
            const pdfTypes = await PdfTypeHandler.fetchPdfTypes(pdfTypeFilters);
            if (pdfTypes.length) {
                filters.pdf_type_id = pdfTypes[0].pdf_type_id;
            } else {
                //Throw error for format is not valid
            }
            
            logger.info('fetchPdfGeneratorConfig', { pdfTypes, uid: event.payload.shipment_id });
            const pdfGeneratorConfigs = await PdfGeneratorConfigHandler.fetchPdfGeneratorConfigsForInternalPuppeterFlow(filters);
            let filteredFormat = Object.assign([], event.meta.slugValue);
            for(let config of pdfGeneratorConfigs) {
                let indx = filteredFormat.indexOf(config.format);
                if(indx > -1) {
                    filteredFormat.splice(indx, 1);
                }
            }

            let defaultTemplateFilters = {
                pdf_type_id: filters.pdf_type_id,
                format: { $in: filteredFormat }
            }
            if(event?.payload?.company_detail?.country_code) {
                defaultTemplateFilters.country_code = event?.payload?.company_detail?.country_code || conf.country_code;
            }
            const defaultConfigs = await PdfDefaultTemplateHandler.fetchPdfDefaultTemplate(defaultTemplateFilters);

            const mergedConfigs = _.concat(pdfGeneratorConfigs, defaultConfigs);
            logger.info('fetchPdfGeneratorConfig: mergedConfigs', { mergedConfigs_length: mergedConfigs.length });
            if(!mergedConfigs.length) {
                const error = "Config Not Found"
                throw new CustomError(error, errorCodes.PDF_CONFIG_NOT_FOUND, {uid: event.payload.shipment_id}).setSlackAlert(true)
            }
            return mergedConfigs;
        } catch(error) {
            logger.error('InternalEventHandler: fetchPdfGeneratorConfig error', { event, uid: event.payload.shipment_id, error });
            throw new CustomError(error, errorCodes.DATABASE_ERROR, {uid: event.payload.shipment_id, consumer: conf.consumer_type, meta: event.meta }).setSlackAlert(true)
        }
    }

    async generatePDF(event, config) {
        const uid = _.get(event, "payload.shipment_id", "") || _.get(event, "payload.uid", "");
        const manifestId = _.get(event, "payload.manifest_id", "");
        logger.info('InternalEventHandler: generatePDF', { event, config, uid });
        try {
            const pageOptions = PAGE_OPTIONS[config.format];
            const generatorKeys = Object.keys(_.get(event, "payload.meta.generator", {}));
            for (const generator of generatorKeys) {
                const generatorMethodParams = _.get(event, `payload.meta.generator[${generator}].kwargs`, {});
                if(_.isArray(generatorMethodParams.value)) {
                    const generatorKey = generator.split("_generator")[0];

                    const generatorData = await stateManager.getGeneratorData(manifestId || uid, generatorKey);
                    event.payload[generatorKey] = generatorData ? generatorData[generatorKey] || {} : {};
                }
            }
            const renderedTemplate = nunjucks.renderString(config.template, event.payload);
            return browser.renderPageToPdfBuffer(renderedTemplate, pageOptions,uid); // Assuming `this.browser` is the Puppeteer instance shared across calls
        } catch (error) {
            logger.error('InternalEventHandler: generatePDF error', { event, uid, error });
            throw new CustomError(error, errorCodes.PDF_GENERATION_ERROR, { uid, consumer: conf.consumer_type, meta: event.meta }).setSlackAlert(true);
        }
    }

    async savePdf(documentData) {
        //assuming document data will have buffer and full filePath 
        const { buffer, filePath } = documentData;
        const uploadFileMetric = measureSegment(CloudStorage.uploadFile, metrics.FILE_UPLOAD_LATENCY, [process.env.K8S_POD_NAME, conf.consumer_type, filePath], 'uploadFile', CloudStorage);
        const uploadResult = uploadFileMetric({ filePath, buffer });
        logger.info('InternalEventHandler: savePdf', { uploadResult });
        return uploadResult;
    }

    async generateAllPdf(event, pdfGeneratorConfigs) {
        const promises = pdfGeneratorConfigs.map(config => this.generatePDF(event, config));
        return Promise.all(promises);
    }

    async uploadPdfBuffers(event, pdfGeneratorConfigs, pdfBuffers) {
        const eventTopic = _.get(event, "meta.topic", "");
        const promises = pdfGeneratorConfigs.map((config, index) => {
            uploadBufferDataToPrometheus(metrics.PDF_SIZE, pdfBuffers[index].length, config.format, event.payload.uid);
            const filename = templateFileName(event, eventTopic, config);
            if( conf.environment === "development") {
                fs.writeFile(`${_.get(event, "payload.uid", "")}_${_.get(event, "meta.slug", "")}_${_.get(config, "format", "")}.pdf`, pdfBuffers[index], 'binary', (err) => console.error(err));
            }
            return this.savePdf({buffer: pdfBuffers[index], filePath: filename});
        });
        return Promise.all(promises);
    }

    async handleEvent(event, topic, partition, offset) {
        logger.info('InternalEventHandler: handleEvent', { event });
        try {
            logger.info('Consumed Event', { topic, partition, offset });
            // Schema validation -- Not required for now.
            // Fetch generator config
            const fetchPdfGeneratorConfigMetrics = measureSegment(this.fetchPdfGeneratorConfig, metrics.PDF_CONFIG_FETCH_LATENCY, [process.env.K8S_POD_NAME, conf.consumer_type], 'fetchPdfGeneratorConfig', this, { uid: event.payload.uid});
            const pdfGeneratorConfigs = await fetchPdfGeneratorConfigMetrics(event);
            // Generate PDF for all config
            const generateAllPdfsUploadMetric = measureSegment(this.generateAllPdf, metrics.PDF_GENERATION_LATENCY, [process.env.K8S_POD_NAME, conf.consumer_type], 'generateAllPdf', this, { uid: event.payload.uid });
            const pdfBuffers = await generateAllPdfsUploadMetric(event, pdfGeneratorConfigs);
            // Upload all PDF buffer

            const uploadPdfBuffersMetrics = measureSegment(this.uploadPdfBuffers, metrics.GET_PDF_BUFFER_LATENCY, [process.env.K8S_POD_NAME, conf.consumer_type], 'uploadPdfBuffers', this, { uid: event.payload.uid});

            const pdfUploadedDatas = await uploadPdfBuffersMetrics(event, pdfGeneratorConfigs, pdfBuffers);
            // Publish to documet topic
            if (event.payload.post_external_response) {
                // Send response of uploaded data to external service through API call (for eg: JMD Payment Receipt)
                const response = await sendPaymentReciptData(pdfUploadedDatas, event);
                logger.info('sendPaymentReciptData: Upload data Response', { response });
            }
            await this.preparePublishPaylod.publishToKafka(true, 200, pdfUploadedDatas, event, null);
        }
        catch (err) {
            await errorHandler(err, "Error In Internal Kafka Event Handler", event)
        }
    }
}
module.exports = InternalEventHandler