const { Router } = require("express");
const controller = require("../../controllers/SalesSetUp/ItemPicController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected Routes for ItemsPicture
//router.get("/all", authenticateToken, controller.find); // GET all item pictures
router.get("/PIC/:id_art", authenticateToken, controller.findById); // GET single item picture by ID
 

module.exports = router;
