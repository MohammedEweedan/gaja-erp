const Purchase = require("../../models/sales/Purchase"); // Adjust path if needed
const jwt = require("jsonwebtoken");
const Supplier = require("../../models/sales/Supplier");
const User = require("../../models/hr/user");
const DistributionPurchase = require("../../models/sales/DistributionPurchase");
const OriginalAchatDiamonds = require("../../models/Purchase/DiamonOriginalAchat");
const { Op } = require('sequelize'); // Make sure to import Op at the top of your file
const Invoice = require("../../models/sales/Invoice");
const Pic = require("../../models/sales/Pic");

const WachtchesOriginalAchat = require("../../models/Purchase/WachtchesOriginalAchat");

// Add associations for the required relations
Purchase.belongsTo(Supplier, { foreignKey: 'client' });
Supplier.hasMany(Purchase, { foreignKey: 'client', useJunctionTable: false });
// Add associations for the required relations
Purchase.belongsTo(User, { foreignKey: 'usr' });
User.hasMany(Purchase, { foreignKey: 'usr', useJunctionTable: false });
// Add associations for the required relations
Purchase.hasOne(DistributionPurchase, { foreignKey: 'distributionID', sourceKey: 'Original_Invoice' });
DistributionPurchase.belongsTo(Purchase, { foreignKey: 'distributionID', targetKey: 'Original_Invoice' });
// Add associations for Pic (image)
Purchase.hasOne(Pic, { foreignKey: 'id_art', sourceKey: 'id_fact' });
Pic.belongsTo(Purchase, { foreignKey: 'id_art', targetKey: 'id_fact' });



exports.findActive = async (req, res) => {

  Purchase.hasMany(Invoice, { foreignKey: 'id_art', sourceKey: 'id_fact' });
  Invoice.belongsTo(Purchase, { foreignKey: 'id_art', targetKey: 'id_fact' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { ps, type_supplier } = req.query;

     
      const whereCondition = {};

      if (ps) whereCondition.ps = ps;

      const includeConditions = [{
        model: Supplier,
        attributes: ['client_name', 'code_supplier', 'TYPE_SUPPLIER','Price_G_Gold','Price_G_Gold_Sales'],
        where: {}
      }];

      if (type_supplier) {
        includeConditions[0].where.TYPE_SUPPLIER = {
          [Op.like]: `%${type_supplier}%`
        };
      }

      includeConditions.push({
        model: User,
        attributes: ['id_user', 'name_user', 'email']
      });

      // Include Invoice model
      includeConditions.push({
        model: Invoice,
        attributes: ['id_art', 'qty'],
        required: false // LEFT JOIN
      });

      // Add Pic include for images
      includeConditions.push({
        model: Pic,
        attributes: ['PIC1'], // Add more fields if needed
        required: false
      });

      // Dynamically include nested models based on type_supplier
      if (type_supplier && type_supplier.toLowerCase().includes('diamond')) {

        DistributionPurchase.hasOne(OriginalAchatDiamonds, { foreignKey: 'id_achat', sourceKey: 'PurchaseID' });
        OriginalAchatDiamonds.belongsTo(DistributionPurchase, { foreignKey: 'id_achat', targetKey: 'PurchaseID' });

        includeConditions.push({
          model: DistributionPurchase,
          required: false,
          include: [
            {
              model: OriginalAchatDiamonds,
              required: false
            }
          ]
        });
      } else if (type_supplier && type_supplier.toLowerCase().includes('watche')) {
      
        DistributionPurchase.hasOne(WachtchesOriginalAchat, { foreignKey: 'id_achat', sourceKey: 'PurchaseID' });
        WachtchesOriginalAchat.belongsTo(DistributionPurchase, { foreignKey: 'id_achat', targetKey: 'PurchaseID' });


        includeConditions.push({
          model: DistributionPurchase,
          required: false,
          include: [
            {
              model: WachtchesOriginalAchat,
              required: false
            }
          ]
        });
      }

      // Get the Sequelize instance from your Purchase model
      const sequelize = Purchase.sequelize;

      const data = await Purchase.findAll({
        where: {
          ...whereCondition,
          [Op.and]: [
            sequelize.literal('COALESCE(ACHAT.qty, 0) - COALESCE(Facture.qty, 0) > 0')
          ]
        },
        include: includeConditions,
        attributes: {
          include: [
            // Calculate the difference between purchase qty and invoice qty
            [sequelize.literal('COALESCE(ACHAT.qty, 0) - COALESCE(Facture.qty, 0)'), 'qty_difference']
          ]
        },
       
    //limit: 20 // Only last 40 items
      });


      res.json(data);


 


    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });
};










exports.find = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    try {
      const { ps, type_supplier } = req.query;
      const whereCondition = {};

      if (ps) whereCondition.ps = ps;

      const includeConditions = [{
        model: Supplier,
        attributes: ['client_name', 'code_supplier', 'TYPE_SUPPLIER'],
        where: {}
      }];

      // Modified type_supplier condition to use LIKE
      if (type_supplier) {
        includeConditions[0].where.TYPE_SUPPLIER = {
          [Op.like]: `%${type_supplier}%`
        };
      }

      includeConditions.push({
        model: User,
        attributes: ['id_user', 'name_user', 'email']
      });

      const data = await Purchase.findAll({
        where: whereCondition,
        include: includeConditions,
        logging: console.log // Add this line for debugging
      });

      res.json(data);

    

    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });
};

function toSQLDate(date) {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 23); // kills the 'Z' or '+00:00'
}

exports.create = async (req, res) => {


  const formattedDate = toSQLDate(new Date());


  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);



    const {
      date_fact, client, id_art, qty, Full_qty, Unite, num_fact, usr,
      Design_art, Color_Gold, Color_Rush, Cost_Currency, RATE, Cost_Lyd,
      Selling_Price_Currency, CODE_EXTERNAL, Selling_Rate, is_selled,
      ps, IS_OK, COMMENT, comment_edit, date_inv, CURRENCY, General_Comment,
      MakingCharge, ShippingCharge, TravelExpesenes, cost_g, ExtraClient,
      Model, Serial_Number, WarrantyDate, Notes, Original_Invoice
    } = req.body;

    // Validate required fields

    console.log(usr)
    if (!date_fact || !client || !qty || !num_fact || !usr) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    // Prepare dates




    // Create the record with explicit date handling
    const result = await Purchase.create({
      date_fact: formattedDate,
      client,
      id_art: id_art || 0,
      qty,
      Full_qty: Full_qty || qty,
      Unite: Unite || '',
      num_fact,
      usr,
      d_time: formattedDate,
      Design_art: Design_art || '',
      Color_Gold: Color_Gold || '',
      Color_Rush: Color_Rush || '',
      Cost_Currency: Cost_Currency || 0,
      RATE: RATE || 0,
      Cost_Lyd: Cost_Lyd || 0,
      Selling_Price_Currency: Selling_Price_Currency || 0,
      CODE_EXTERNAL: CODE_EXTERNAL || '',
      Selling_Rate: Selling_Rate || 0,
      is_selled: is_selled || false,
      ps: ps,
      IS_OK: IS_OK || false,
      COMMENT: COMMENT || '',
      comment_edit: comment_edit || '',
      date_inv: formattedDate,
      CURRENCY: CURRENCY,
      General_Comment: General_Comment || '',
      MakingCharge: MakingCharge || 0,
      ShippingCharge: ShippingCharge || 0,
      TravelExpesenes: TravelExpesenes || 0,
      cost_g: cost_g || 0,
      ExtraClient: ExtraClient || 0,
      Model: Model || '',
      Serial_Number: Serial_Number || '',
      WarrantyDate: formattedDate,
      Notes: Notes || '',
      Original_Invoice: Original_Invoice || ''
    }, {

      returning: true,
      raw: true
    });

    res.status(201).json({
      message: "Purchase record added successfully",
      data: result
    });

  } catch (error) {
    console.error("Create Purchase Error:", {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      parameters: error.parameters
    });

    if (error.name === 'SequelizeDatabaseError') {
      return res.status(400).json({
        message: "Database error occurred",
        details: {
          code: error.parent?.number,
          state: error.parent?.state,
          serverMessage: error.parent?.message
        }
      });
    }

    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};






exports.update = (req, res) => {

  console.log(req.params.id_fact)
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const purchaseId = req.params.id_fact; // Changed to use id_fact for purchase
    const {
      date_fact, client, id_art, qty, Full_qty, Unite, num_fact, usr, d_time,
      Design_art, Color_Gold, Color_Rush, Cost_Currency, RATE, Cost_Lyd,
      Selling_Price_Currency, CODE_EXTERNAL, Selling_Rate, is_selled,
      ps, IS_OK, COMMENT, comment_edit, date_inv, CURRENCY, General_Comment,
      MakingCharge, ShippingCharge, TravelExpesenes, cost_g, ExtraClient,
      Model, Serial_Number, WarrantyDate, Notes, Original_Invoice
    } = req.body;

    try {

      const purchase = await Purchase.findByPk(purchaseId); // Find purchase by primary key
      if (!purchase) return res.status(404).json({ message: "Purchase record not found" });

      await purchase.update({
        date_fact, client, id_art, qty, Full_qty, Unite, num_fact, usr, d_time,
        Design_art, Color_Gold, Color_Rush, Cost_Currency, RATE, Cost_Lyd,
        Selling_Price_Currency, CODE_EXTERNAL, Selling_Rate, is_selled,
        ps, IS_OK, COMMENT, comment_edit, date_inv, CURRENCY, General_Comment,
        MakingCharge, ShippingCharge, TravelExpesenes, cost_g, ExtraClient,
        Model, Serial_Number, WarrantyDate, Notes, Original_Invoice
      });

      res.status(200).json({ message: "Purchase record updated successfully" });
    } catch (error) {
      console.error("Update Purchase Error:", error);
      res.status(500).json({ message: "Error updating purchase record" });
    }
  });
};

exports.delete = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const purchaseId = req.params.id_fact; // Changed to use id_fact for purchase
    try {
      const purchase = await Purchase.findByPk(purchaseId); // Find purchase by primary key
      if (!purchase) return res.status(404).json({ message: "Purchase record not found" });

      await purchase.destroy();
      res.status(200).json({ message: "Purchase record deleted successfully" });
    } catch (error) {
      console.error("Delete Purchase Error:", error);
      res.status(500).json({ message: "Error deleting purchase record" });
    }
  });
};





exports.getByNumFact = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      // Assuming `ps` is a parameter you're expecting (maybe from query/body?)
      const { ps, num_fact } = req.query; // or req.body depending on how you pass it

      const data = await Purchase.findAll({
        where: { ps, num_fact },
        include: [{
          model: Supplier,
          attributes: ['client_name', 'code_supplier', 'TYPE_SUPPLIER']
        }]
      });

      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });
};





exports.getNewNumFact = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      // Find the highest num_fact in purchases, assuming numeric values
      const lastPurchase = await Purchase.findOne({
        order: [['num_fact', 'DESC']],
        attributes: ['num_fact']
      });

      let newNumFact = 1; // default if no records

      if (lastPurchase && lastPurchase.num_fact) {
        // Try to parse num_fact as integer, fallback if needed
        const lastNum = parseInt(lastPurchase.num_fact, 10);
        if (!isNaN(lastNum)) {
          newNumFact = lastNum + 1;
        } else {
          // If num_fact is not numeric, handle accordingly — here just return error or custom logic
          return res.status(400).json({ message: "Last num_fact is not a number, cannot generate new number" });
        }
      }

      res.status(200).json({ new_num_fact: newNumFact.toString() });
    } catch (error) {
      console.error("Get New num_fact Error:", error);
      res.status(500).json({ message: "Error generating new purchase number" });
    }
  });
};

// Find purchases by Original_Invoice
exports.findByOriginalInvoice = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { original_invoice } = req.query;
      if (!original_invoice) {
        return res.status(400).json({ message: "original_invoice query param is required" });
      }

      const data = await Purchase.findAll({
        where: { Original_Invoice: original_invoice },
        include: [
          {
            model: Supplier,
            attributes: ['client_name', 'code_supplier', 'TYPE_SUPPLIER']
          },
          {
            model: User,
            attributes: ['id_user', 'name_user', 'email']
          }
        ]
      });

      res.json(data);
    } catch (dbErr) {
      console.error("Find by Original_Invoice Error:", dbErr);
      res.status(500).json({ message: "Error fetching by Original_Invoice" });
    }
  });
};



