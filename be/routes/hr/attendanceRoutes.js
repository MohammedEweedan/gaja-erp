// routes/hr/attendanceRoutes.js
const express = require('express');
const router = express.Router();

const attendance = require('../../controllers/HR/attendanceController');

// Preview daily attendance values derived from fingerprint + leave
// GET /attendance/preview-daily?employeeId=123&date=YYYY-MM-DD
router.get('/preview-daily', attendance.previewDaily);

// Sync a full month into TS table for an employee
// POST /attendance/sync-month  { employeeId, year, month }
router.post('/sync-month', attendance.syncMonth);

// List PS values with employee counts
router.get('/ps-list', attendance.psList);

// Today attendance for a PS
router.get('/ps-today', attendance.psToday);

// Range punches per employee
router.get('/range-punches', attendance.rangePunches);

router.post('/save-monthly-missing', attendance.saveMonthlyMissing);

// Manual punch
router.put('/manual-punch', attendance.manualPunch);

module.exports = router;
