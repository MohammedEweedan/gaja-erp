const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const payrollV2 = require('../../controllers/HR/payrollV2Controller');

// Compute on-the-fly (read-only)
router.get('/payroll/v2/compute', authenticateToken, payrollV2.compute);

// Load saved/open month or archived month
router.get('/payroll/v2', authenticateToken, payrollV2.getMonth);

// Save current month rows (upsert by (year,month,id_emp))
router.post('/payroll/v2/save', authenticateToken, payrollV2.saveMonth);

// Close month: archives rows and posts GL entries
router.post('/payroll/v2/close', authenticateToken, payrollV2.closeMonth);

// Loans (V2)
router.get('/payroll/v2/loans', authenticateToken, payrollV2.listLoans);
router.post('/payroll/v2/loans/create', authenticateToken, payrollV2.createLoan);
router.post('/payroll/v2/loans/skip', authenticateToken, payrollV2.skipLoanMonth);
router.post('/payroll/v2/loans/payoff', authenticateToken, payrollV2.payoffLoan);

module.exports = router;
