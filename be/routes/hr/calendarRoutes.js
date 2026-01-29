// routes/calendarRoutes.js

const express = require('express');
const authenticateToken = require("../../middleware/auth.js");
const router = express.Router();

// Import controller
const leaveController = require('../../controllers/HR/leaveController');

// Route to get leave and holiday data for calendar view
router.get('/calendar-log', authenticateToken, leaveController.getCalendarLog);

module.exports = router;
