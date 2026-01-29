const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const payroll = require('../../controllers/HR/payrollController');

// Run payroll for a given month; optional filters: ps, employeeId
router.post('/payroll/run', authenticateToken, payroll.run);

// Get a single payslip for an employee and month
router.get('/payroll/payslip', authenticateToken, payroll.payslip);

// Get a PDF stream for a single payslip
router.get('/payroll/payslip/pdf', authenticateToken, payroll.payslipPdf);

// Sales metrics aggregated by seller for the month (mapped to employees)
router.get('/payroll/sales-metrics', authenticateToken, payroll.salesMetrics);

// Adjustments (bonuses, deductions, advances/loans) stored per period
router.get('/payroll/adjustments', authenticateToken, payroll.getAdjustments);
router.post('/payroll/adjustments', authenticateToken, payroll.addAdjustment);
router.put('/payroll/adjustments/:id', authenticateToken, payroll.updateAdjustment);
router.delete('/payroll/adjustments/:id', authenticateToken, payroll.deleteAdjustment);

// Change logs (salary/allowance modifications) for the month/employee
router.get('/payroll/change-logs', authenticateToken, payroll.changeLogs);

// Loans & Advances
router.get('/payroll/loans', authenticateToken, payroll.listLoans);
router.post('/payroll/loans/create', authenticateToken, payroll.createLoan);
router.post('/payroll/loans/skip', authenticateToken, payroll.skipLoanMonth);
router.post('/payroll/loans/payoff', authenticateToken, payroll.payoffLoan);

// History totals
router.get('/payroll/history/total', authenticateToken, payroll.historyTotals);

module.exports = router;
