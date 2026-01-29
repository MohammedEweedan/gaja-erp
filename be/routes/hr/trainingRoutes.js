const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const trainingController = require('../../controllers/HR/trainingController');

router.post('/training', authenticateToken, trainingController.createTraining);
router.get('/trainings', authenticateToken, trainingController.getTrainings);
router.get('/trainings/:employeeId', authenticateToken, trainingController.getTrainingsByEmployee);

module.exports = router;
