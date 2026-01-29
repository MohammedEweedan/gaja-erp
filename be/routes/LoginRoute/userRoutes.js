const { Router } = require("express");
const controller = require("../../controllers/SalesSetUp/userController");
const authenticateToken = require("../../middleware/auth.js");
const router = Router();

// 🔓 Public routes
router.post("/login", controller.login);
router.get('/ListUsers/',authenticateToken, controller.getUserList);
// User profile update (POST for compatibility with frontend)
router.post("/users/update", authenticateToken, controller.updateUserProfile);

// (Optional) Keep the old update route if needed, but make sure the controller exists
// router.put("/Update/:id_user", authenticateToken, controller.update);

module.exports = router;
