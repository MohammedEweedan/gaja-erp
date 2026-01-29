const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const actionFormController = require('../../controllers/HR/ActionFormController');

router.post('/action', authenticateToken, actionFormController.createAction);
router.get('/actions/:employeeId', authenticateToken, actionFormController.getActionsByEmployee);

module.exports = router;
