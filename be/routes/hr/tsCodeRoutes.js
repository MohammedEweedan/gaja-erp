// routes/HR/tsCodeRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/HR/tsCodeController");

// CRUD
router.get("/hr/codes", ctrl.list);
router.post("/hr/codes", ctrl.create);
router.put("/hr/codes/:id", ctrl.update);
router.delete("/hr/codes/:id", ctrl.remove);

module.exports = router;
