const express = require('express');
const router = express.Router();
router.use('/', require('../../controllers/CRM/ticketsController'));
module.exports = router;
