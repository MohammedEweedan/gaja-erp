// routes/SetupRoutes/employeeRoutes.js
const express = require("express");
const router = express.Router();

const authenticateToken = require("../../middleware/auth.js");
const multer = require("multer");

// 10 MB in-memory for quick pass-through to controller/storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const employeeController = require("../../controllers/HR/employeeController");

// Validate and normalize :ID_EMP once
router.param("ID_EMP", (req, res, next, val) => {
  const id = Number(val);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid employee id" });
  }
  req.params.ID_EMP = id;
  next();
});

/**
 * ORDER MATTERS:
 * Specific picture routes must be defined before "/:ID_EMP"
 * to avoid being captured by the generic route.
 */

// --- Picture endpoints ---
// GET employee picture (BLOB/stream or redirect) — public for <img> usage
router.get("/:ID_EMP/picture", employeeController.getPicture);

// POST employee picture upload (multipart/form-data, field name: 'file')
router.post(
  "/:ID_EMP/picture",
  authenticateToken,
  upload.single("file"),
  employeeController.uploadPicture
);

// DELETE employee picture
router.delete(
  "/:ID_EMP/picture",
  authenticateToken,
  employeeController.deletePicture
);

// --- Collection endpoints ---
// GET all employees (supports filters/search inside controller)
router.get("/", authenticateToken, employeeController.find);

// CREATE employee
router.post("/", authenticateToken, employeeController.create);

// --- Single-resource endpoints ---
// GET single employee by ID
router.get("/:ID_EMP", authenticateToken, employeeController.findOne);

// UPDATE employee (full update)
router.put("/:ID_EMP", authenticateToken, employeeController.update);

// PARTIAL UPDATE (send only changed fields)
router.patch("/:ID_EMP", authenticateToken, employeeController.patch);

// DELETE employee
router.delete("/:ID_EMP", authenticateToken, employeeController.delete);

// --- Relations & actions ---
// GET employee's subordinates
router.get(
  "/:ID_EMP/subordinates",
  authenticateToken,
  employeeController.getSubordinates
);

// Calculate (and persist) leave balance for employee
router.post(
  "/:ID_EMP/calculate-leave",
  authenticateToken,
  employeeController.calculateLeaveBalance
);

module.exports = router;
