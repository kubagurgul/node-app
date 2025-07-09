const express = require('express');
const bodyParser = require('body-parser');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT;

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

app.post('/webhook', (req, res) => {
    const data = req.body;
    logger.info('Received webhook:', data);
    res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.send('It workz!');
});

app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
});