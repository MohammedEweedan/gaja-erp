const express = require('express');
const router = express.Router();
const ApprovalRequestsController = require('../controllers/ApprovalRequestsController');

console.log('ApprovalRequestsRoute loaded');

const authenticateToken = require("../middleware/auth.js");
// GET /ApprovalRequests - get pending requests, messageCount, and playGoldSound

router.get('/prequests', authenticateToken, ApprovalRequestsController.find);
router.get('/prequestsNot', authenticateToken, ApprovalRequestsController.findNotification);
router.get('/byRef/:ref', authenticateToken, ApprovalRequestsController.findLatestByReference);
// Create a new approval request
router.post('/create', authenticateToken, (req, res, next) => {
  
  next();
}, ApprovalRequestsController.create);

// Update an approval request by ID
router.put('/:id', authenticateToken, ApprovalRequestsController.update);

module.exports = router;





 