'use strict';

const express = require('express');
const { produceAuditTrail } = require('./app/producer/kafka_producer');

const app = express();
const port = 3000;

app.use(express.json());

// Define your API endpoint
app.post('/send', async (req, res) => {
    const { topicName, payload, job_type, action } = req.body;
    try {
        // Call the produceAuditTrail function
        await produceAuditTrail(topicName, payload, job_type, action);
        res.status(200).send('Message sent to Kafka successfully');
    } catch (error) {
        console.error('Error sending message to Kafka:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
