const express = require('express');
const app = express();

app.use('/web', require('./channels/web'));
app.use('/telegram', require('./channels/telegram'));
app.use('/meta', require('./channels/meta'));

module.exports = app;
