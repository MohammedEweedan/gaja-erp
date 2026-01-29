const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const holidayController = require('../../controllers/HR/holidayController');

router.get('/holidays', authenticateToken, holidayController.getHolidays);
router.post('/holiday', authenticateToken, holidayController.createHoliday);
router.put('/holiday/:id', authenticateToken, holidayController.updateHoliday);
router.delete('/holiday/:id', authenticateToken, holidayController.deleteHoliday);
// Seeding routes
router.post('/holidays/seed/fixed', authenticateToken, holidayController.seedFixedLibya);
router.post('/holidays/seed/islamic/:year', authenticateToken, holidayController.seedIslamicForYear);

module.exports = router;
