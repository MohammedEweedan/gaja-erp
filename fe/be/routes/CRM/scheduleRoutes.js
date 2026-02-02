const express = require('express');
const router = express.Router();
router.use('/', require('../../controllers/CRM/scheduleController'));
module.exports = router;
