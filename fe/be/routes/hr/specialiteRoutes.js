const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const specialiteController = require('../../controllers/HR/specialiteController');

router.post('/specialite', authenticateToken, specialiteController.createSpecialite);
router.get('/specialites', authenticateToken, specialiteController.getSpecialites);
router.put('/specialite/:id_specialite', authenticateToken, specialiteController.updateSpecialite);
router.delete('/specialite/:id_specialite', authenticateToken, specialiteController.deleteSpecialite);

module.exports = router;
