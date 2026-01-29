const { Router } = require("express");
const controller = require("../../controllers/Purchase/purchaseController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route
router.get("/allActive", authenticateToken, controller.findActive);  // Protecting the "find" route
router.get("/NewNF", authenticateToken, controller.getNewNumFact);  // Protecting the "find" route
router.get('/Getpurchase/', authenticateToken, controller.getByNumFact);

router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:id_fact", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:id_fact", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route

// Route to find purchases by Original_Invoice
router.get(
  "/findByOriginalInvoice",
  authenticateToken,
  controller.findByOriginalInvoice
);

module.exports = router;
