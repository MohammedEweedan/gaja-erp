const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/auth.js');
const contractTypeController = require('../../controllers/HR/contractTypeController');

router.post('/contract-type', authenticateToken, contractTypeController.createContractType);
router.get('/contract-types', authenticateToken, contractTypeController.getContractTypes);
router.put('/contract-type/:id_contract_type', authenticateToken, contractTypeController.updateContractType);
router.delete('/contract-type/:id_contract_type', authenticateToken, contractTypeController.deleteContractType);

module.exports = router;
