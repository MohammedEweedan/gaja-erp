const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const timesheetController = require('../../controllers/HR/timesheetController');

router.post('/timesheet', authenticateToken, timesheetController.upsertTimesheet);
router.get('/timesheet', authenticateToken, timesheetController.getTimesheet);

module.exports = router;
