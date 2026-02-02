const { Router } = require("express");
const controller = require("../../controllers/Purchase/invoiceController.js");
const authenticateToken = require("../../middleware/auth.js");

const router = Router();

// 🔐 Protected routes
router.get("/all", authenticateToken, controller.find);  // Protecting the "find" route

router.get("/NewNF", authenticateToken, controller.getNewNumFact);

router.get("/SetNF", authenticateToken, controller.setNumFact);


router.get("/CloseNF", authenticateToken, controller.CloseInvoice); 



// Protecting the "find" route
router.get('/Getinvoice/',authenticateToken, controller.getByNumFact);

router.post("/Add", authenticateToken, controller.create);  // Protecting the "create" route
router.put("/Update/:id_fact", authenticateToken, controller.update);  // Changing to PUT and protecting the "update" route
router.delete("/Delete/:id_fact", authenticateToken, controller.delete);  // Changing to PUT and protecting the "delete" route
router.put("/UpdateCh/:id_fact", authenticateToken, controller.updateChira);  // Changing to PUT and protecting the "update" route

router.put('/UpdateTotals/:num_fact', controller.updateTotals);
router.put('/UpdateTotal/:id_fact', controller.updateTotal);
router.get("/allDetails", authenticateToken, controller.getBynum_factAllData);  // Protecting the "find" route
router.get("/allDetailsP", authenticateToken, controller.getBynum_factAllDataPeriod);  // Protecting the "find" route
router.get("/allDetailsPC", authenticateToken, controller.getBynum_factAllDataPeriodClient);  // Protecting the "find" route

// Customer purchases (flattened items across invoices for a client)
router.get("/customerPurchases", authenticateToken, controller.getCustomerPurchases);


module.exports = router;
