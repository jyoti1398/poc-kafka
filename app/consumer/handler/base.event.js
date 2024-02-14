const logger = require('../../../logger');

class BaseEventHandler {
    constructor(eventCategory) {
        logger.info('In BaseEventHandler');
        this.eventCategory = eventCategory
        if (!this.handleEvent) {
            throw new Error('Implementation of handleEvent(event, topic, messageKey, partition, offset');
        }
    }
}

module.exports = BaseEventHandler;