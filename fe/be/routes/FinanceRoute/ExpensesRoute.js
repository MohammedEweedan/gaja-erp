const { Router } = require("express");
const controller = require("../../controllers/Finance/ExpensesController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route
router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:ID_transaction", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:ID_transaction", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route
module.exports = router;
