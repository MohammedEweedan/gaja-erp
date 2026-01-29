const { Router } = require("express");
const controller = require("../../controllers/Purchase/InventoryController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
 
router.get("/allActive", authenticateToken, controller.findActive);  // Protecting the "find" route
router.get("/getpic", authenticateToken, controller.findPic);  // Protecting the "find" route
router.get("/list", authenticateToken, controller.listInventory); // New: list from Inventory model

// CRUD routes for Inventory
router.post("/", authenticateToken, controller.createInventory);
router.put("/:id_inv", authenticateToken, controller.updateInventory);
router.delete("/:id_inv", authenticateToken, controller.deleteInventory);

// Bulk activate session
router.post("/activate-session", authenticateToken, controller.activateInventorySession);


module.exports = router;
