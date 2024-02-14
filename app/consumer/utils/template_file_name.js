const _ = require("lodash");
const config = require("../../../config");
const { timestampFolderPath } = require("../../utils/generator");
const logger = require("../../../logger");

const templateFileName = (event, topicName, pdfConfig) => {
    logger.info('templateFileName');
    let filename = '';
    const slug=_.get(event, "meta.slug", "");
    const format=_.get(pdfConfig, "format", "").toLowerCase();
    switch(topicName) {
        case config.kafka_topics.pdf_generator_order:
            if(slug=='jiomart_label'){
                filename = `${config.storage.assetsBucketPrefix}/documents/label/PDFs/${_.get(event, "payload.uid", "")}_label.pdf`;
            }
            else if(slug=='credit_note_a4'){
                filename = `${config.storage.assetsBucketPrefix}/documents/${slug}/PDFs/${_.get(event, "payload.uid", "")}_${slug}.pdf`;
            }
            else if(slug=='ajio_b2b'){
                filename = `${config.storage.assetsBucketPrefix}/documents/b2b/PDFs/${_.get(event, "payload.uid", "")}_b2b.pdf`;
            }
            else if(slug=='ajio_credit_note'){
                filename = `${config.storage.assetsBucketPrefix}/documents/credit_note/PDFs/${_.get(event, "payload.uid", "")}_credit_note.pdf`;
            }
            else if (slug=='payment_receipt') {
                filename = `${config.storage.assetsBucketPrefix}/documents/payment_receipt/PDFs/${_.get(event, "payload.uid", "")}.pdf`;
            }
            else{
                filename = `${config.storage.assetsBucketPrefix}/documents/${slug}_${format}/PDFs/${_.get(event, "payload.uid", "")}_${slug}_${format}.pdf`;
            }
            break;
        case config.kafka_topics.pdf_generator_finance:
            filename = `${config.storage.assetsBucketPrefix}/documents/daytrader/PDFs/${_.get(event, "meta.invoice_path", "")}`;
            break;
        case config.kafka_topics.manifest_generator_order: 
            filename = `${config.storage.assetsBucketPrefix}/documents/${timestampFolderPath('manifest')}/${_.get(event, "payload.manifest_id", "")}.pdf`
            break;
    }
    logger.info('templateFileName', { filename });
    return filename.replace(/^\/{0,}/, '');
}

module.exports = templateFileName;