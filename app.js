const express = require('express');
const bodyParser = require('body-parser');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT | 3000;

const AUTH_KEY = '52FB3AZWF5WMS6I';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        // You can add file transport if needed:
        new winston.transports.File({ filename: 'logs.log' })
    ],
});

app.use(bodyParser.json());

app.post('/test/webhook', (req, res) => {
    const data = req.body;
    logger.info('Received webhook data:', data);
    logger.info('Received webhook headers:', req.rawHeaders);
    logger.info('Received webhook:', JSON.stringify(req));
    res.status(200).json({ status: 'ok' });
});

app.get('/test', (req, res) => {
    res.send('It workz!');
});

app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
});