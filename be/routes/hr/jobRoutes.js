const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const jobController = require('../../controllers/HR/jobController');

router.post('/job', authenticateToken, jobController.createJob);
router.get('/jobs', authenticateToken, jobController.getJobs);

module.exports = router;
