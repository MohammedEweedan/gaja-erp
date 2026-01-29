const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const catalogController = require('../../controllers/HR/catalogController');

router.get('/levels', authenticateToken, catalogController.getLevels);
router.get('/specialite', authenticateToken, catalogController.getSpecialite);
router.get('/leave-codes', authenticateToken, catalogController.getLeaveCodes);
// Create speciality
router.post('/catalog/specialite', authenticateToken, catalogController.createSpecialite);

module.exports = router;
