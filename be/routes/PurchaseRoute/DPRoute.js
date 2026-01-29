const { Router } = require("express");
const controller = require("../../controllers/SalesSetUp/DistributionPurchaseController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route
router.get("/not-received", authenticateToken, controller.findNotReceived); // New route
 
router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:distributionID", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:distributionID", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route

router.put("/UpdateStatus/:distributionID", authenticateToken, controller.updateDistributionISOK);  // Changing to PUT and protecting the "update" route

 router.get("/ProductDetails", authenticateToken, controller.findbyId); // New route
 
module.exports = router;
