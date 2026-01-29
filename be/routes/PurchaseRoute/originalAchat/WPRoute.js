const { Router } = require("express");
const controller = require("../../../controllers/Purchase/OriginalDetails/WatchesOriginalAchatController");
const authenticateToken = require("../../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route
 
router.get("/getitem/:id_achat", authenticateToken, controller.findbyid_achat); 


router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:id_achat", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:id_achat", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route
module.exports = router;
