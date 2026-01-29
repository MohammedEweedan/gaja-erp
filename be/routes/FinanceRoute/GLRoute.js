const { Router } = require("express");
const controller = require("../../controllers/Finance/GLController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route

router.get("/allGlAP", authenticateToken, controller.findByAccountAndPeriod);  // Protecting the "find" route
router.get("/BlancesCash", authenticateToken, controller.find_balances);  // Protecting the "find" route


router.get("/findByAccountAndPeriod", authenticateToken, controller.findByAccountAndPeriod); // New route for account & period
router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:IND", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:IND", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route
module.exports = router;
