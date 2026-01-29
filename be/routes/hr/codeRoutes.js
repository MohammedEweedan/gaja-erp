const express = require('express');
const router = express.Router();
const codeController = require('../../controllers/HR/codeController');

router.get('/codes', codeController.list);          // GET  /hr/codes
router.post('/codes', codeController.create);       // POST /hr/codes
router.put('/codes/:int_can', codeController.update); // PUT /hr/codes/:int_can
router.delete('/codes/:int_can', codeController.remove); // DELETE /hr/codes/:int_can

module.exports = router;
