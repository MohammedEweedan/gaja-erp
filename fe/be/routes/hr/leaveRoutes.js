const express = require('express');
const router = express.Router();
const authenticateToken = require("../../middleware/auth.js");
const leaveController = require('../../controllers/HR/leaveController');

router.post('/leave-request', authenticateToken, leaveController.createLeaveRequest);
router.get('/leave-requests/:employeeId', authenticateToken, leaveController.getLeaveRequests);
router.put('/leave-status', authenticateToken, leaveController.updateLeaveStatus);
router.delete('/leave-request/:leaveId', authenticateToken, leaveController.deleteLeaveRequest);

router.get('/leave-balance/:employeeId', authenticateToken, leaveController.getLeaveBalance);
router.get('/calendar-log', authenticateToken, leaveController.getCalendarLog);
router.get('/leave-types', authenticateToken, leaveController.getLeaveTypes);
router.get('/leave-days/preview', authenticateToken, leaveController.previewLeaveDays);

router.put('/leave-request/:leaveId', authenticateToken, leaveController.updateLeaveRequest);   // e.g. PUT /leave/leave-request/122
router.post('/leave-request/update', authenticateToken, leaveController.updateLeaveRequest);     // e.g. POST /leave/leave-request/update  (body must contain leaveId)

// New: detailed accrual/deduction ledger and CSV exports
router.get('/leave-ledger/:employeeId', authenticateToken, leaveController.getLeaveLedger);
router.get('/leave-ledger/:employeeId/export', authenticateToken, leaveController.exportLeaveLedgerCSV);
router.get('/leave-ledgers/export', authenticateToken, leaveController.exportAllLeaveLedgersCSV);
router.get('/vacations-range', authenticateToken, leaveController.getVacationsInRange);

module.exports = router;
