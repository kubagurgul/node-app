const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

const AUTH_KEY = '52FB3AZWF5WMS6I';

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    const data = req.body;
    console.log('Received webhook:', data);
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});