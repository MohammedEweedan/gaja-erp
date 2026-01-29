const Invoice = require("../../models/sales/Invoice"); // Updated model import
const Purchase = require("../../models/sales/Purchase"); // Updated model import
const jwt = require("jsonwebtoken");
const Customer = require("../../models/sales/Customers");
const User = require("../../models/hr/user");
const Supplier = require("../../models/sales/Supplier");
const Revenue = require("../../models/Finance/Revenue"); // Adjust path and model name if needed

const Pic = require("../../models/sales/Pic");
const { Op, Sequelize } = require("sequelize");

// =========================
// SAFE ASSOCIATIONS (GUARDED)
// =========================
const ensureAssoc = (model, assocKey, fn) => {
  try {
    if (!model.associations || !model.associations[assocKey]) fn();
  } catch (err) {
    console.warn(`ensureAssoc warn for ${model?.name || "Model"} -> ${assocKey}:`, err?.message || err);
  }
};

// Invoice -> Customer
ensureAssoc(Invoice, "Customer", () => {
  Invoice.belongsTo(Customer, { foreignKey: "client" });
});
ensureAssoc(Customer, "Invoices", () => {
  Customer.hasMany(Invoice, { foreignKey: "client", useJunctionTable: false, as: "Invoices" });
});

// Invoice -> User
ensureAssoc(Invoice, "User", () => {
  Invoice.belongsTo(User, { foreignKey: "usr" });
});
ensureAssoc(User, "Invoices", () => {
  User.hasMany(Invoice, { foreignKey: "usr", useJunctionTable: false, as: "Invoices" });
});

// Invoice -> Purchase (frontend expects Invoice.ACHATs)
ensureAssoc(Invoice, "ACHATs", () => {
  Invoice.hasMany(Purchase, { foreignKey: "id_fact", sourceKey: "id_art", as: "ACHATs" });
});

// Purchase -> Invoice (unique alias)
ensureAssoc(Purchase, "Invoice", () => {
  Purchase.belongsTo(Invoice, { foreignKey: "id_fact", targetKey: "id_art", as: "Invoice" });
});

// Purchase -> Supplier (alias: Fournisseur)
ensureAssoc(Purchase, "Fournisseur", () => {
  Purchase.belongsTo(Supplier, { foreignKey: "client", targetKey: "id_client", as: "Fournisseur" });
});
ensureAssoc(Supplier, "SupplierPurchases", () => {
  Supplier.hasMany(Purchase, { foreignKey: "client", sourceKey: "id_client", as: "SupplierPurchases" });
});

// Invoice -> Pic
ensureAssoc(Invoice, "Pic", () => {
  Invoice.belongsTo(Pic, { foreignKey: "id_art" });
});
ensureAssoc(Pic, "Invoices", () => {
  Pic.hasMany(Invoice, { foreignKey: "id_art", useJunctionTable: false, as: "Invoices" });
});




exports.find = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    try {
      const { ps, date_from, date_to, type_supplier } = req.query;
      const whereCondition = {
        id_art: {
          [Op.gt]: 0 // Add condition for id_art > 0
        }
      };


      if (ps) whereCondition.ps = ps;

      // Date range filtering
      if (date_from && date_to) {
        whereCondition.date_fact = {
          [Op.between]: [new Date(date_from), new Date(date_to)]
        };
      }

      const includeConditions = [{
        model: Customer,
        attributes: ['client_name', 'tel_client']
      }];

      includeConditions.push({
        model: User,
        attributes: ['id_user', 'name_user', 'email']
      });





      // Add Purchase -> Supplier include conditions
      includeConditions.push({
        model: Purchase,
        as: 'ACHATs',
        attributes: ['id_fact', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush'],
        include: [{
          model: Supplier,
          as: 'Fournisseur',
          attributes: ['id_client', 'client_name', 'code_supplier', 'TYPE_SUPPLIER'],
          where: {}
        }]
      });

      // Add supplier type filter if provided
      if (type_supplier) {
        includeConditions[2].include[0].where.TYPE_SUPPLIER = {
          [Op.like]: `%${type_supplier}%`
        };
      }

      const data = await Invoice.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['date_fact', 'DESC'], ['num_fact', 'DESC']]
      });

      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Invoices Error:", dbErr);
      res.status(500).json({ message: "Error fetching invoices" });
    }
  });
};

function toSQLDate(date) {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 23); // kills the 'Z' or '+00:00'
}





require('dotenv').config();

const sequelize = new Sequelize(process.env.SRV, process.env.USER, process.env.PASSWORD, {
  host: process.env.HOST,
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
      useOutputParameter: false // Disable OUTPUT parameter usage globally
    }
  }
});






exports.create = async (req, res) => {


  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().slice(0, 10); // "YYYY-MM-DD" format
  const formattedDateTime = currentDate.toISOString().replace('T', ' ').replace(/\..+/, '');

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);



    const {
      date_fact, client, id_art, qty, num_fact, usr,
      prix_vente, prix_vente_remise, COMMENT,
      d_time, IS_OK, rate, remise, is_printed, ps,
      phone_client, total_remise, total_remise_final,
      currency, amount_currency, amount_lyd, amount_EUR,
      amount_currency_LYD, amount_EUR_LYD, accept_discount,
      return_chira, comment_chira, usr_receive_chira,
      id_box1, id_box2, id_box3, IS_GIFT, IS_WHOLE_SALE,
      USD_Rate, EURO_Rate, TOTAL_INV_FROM_DIAMOND, is_chira,
      is_request, is_ok_commission_extra, client_redirected,
      SourceMark, mode_fact, picint, remise_per, total_remise_final_lyd
    } = req.body;

    // Validate required fields

    if (!qty || !usr) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    // Prepare dates




    // Create the record with explicit date handling
    const result = await Invoice.create({

      client,
      id_art: id_art || 0,
      qty,
      num_fact: 0,
      usr,
      prix_vente: prix_vente || 0,
      prix_vente_remise: prix_vente_remise || 0,
      COMMENT: COMMENT || '',
      //d_time: formattedDateTime,
      IS_OK: false,
      rate: 1,
      remise: 0,
      is_printed: is_printed || true,
      ps: ps || null,
      phone_client: phone_client || 0,
      total_remise: prix_vente_remise * qty || 0,
      total_remise_final: 0 || 0,
      currency: '',
      amount_currency: amount_currency || 0,
      amount_lyd: amount_lyd || 0,
      amount_EUR: amount_EUR || 0,
      amount_currency_LYD: amount_currency_LYD || 0,
      amount_EUR_LYD: amount_EUR_LYD || 0,
      accept_discount: accept_discount || false,
      //return_chira: return_chira || null,
      comment_chira: comment_chira || '',
      usr_receive_chira: usr_receive_chira || 0,
      IS_GIFT: IS_GIFT || false,
      IS_WHOLE_SALE: IS_WHOLE_SALE,
      USD_Rate: USD_Rate || 1,
      EURO_Rate: EURO_Rate || 1,
      TOTAL_INV_FROM_DIAMOND: TOTAL_INV_FROM_DIAMOND || 0,
      is_chira: is_chira,
      is_request: is_request || false,
      is_ok_commission_extra: is_ok_commission_extra || false,
      client_redirected: client_redirected || 0,
      SourceMark: SourceMark || '',
      mode_fact: mode_fact || '',
      picint: picint, remise_per: remise_per,
      total_remise_final_lyd: 0,
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

  console.log("Update inoice called zied");
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const invoiceId = req.params.id_fact;
    const {
      date_fact, client, id_art, qty, num_fact, usr,
      desig_art, prix_vente, prix_vente_remise, COMMENT,
      d_time, IS_OK, rate, remise, is_printed, ps,
      phone_client, total_remise, total_remise_final,
      currency, amount_currency, amount_lyd, amount_EUR,
      amount_currency_LYD, amount_EUR_LYD, accept_discount,
      return_chira, comment_chira, usr_receive_chira,
      id_box1, id_box2, id_box3, IS_GIFT, IS_WHOLE_SALE,
      USD_Rate, EURO_Rate, TOTAL_INV_FROM_DIAMOND, is_chira,
      is_request, is_ok_commission_extra, client_redirected,
      SourceMark, remise_per, total_remise_final_lyd
    } = req.body;

    try {
      const invoice = await Invoice.findByPk(invoiceId);
      if (!invoice) return res.status(404).json({ message: "Invoice record not found" });

      await invoice.update({
        date_fact, client, id_art, qty, num_fact, usr,
        desig_art, prix_vente, prix_vente_remise, COMMENT,
        d_time, IS_OK, rate, remise, is_printed, ps,
        phone_client, total_remise, total_remise_final,
        currency, amount_currency, amount_lyd, amount_EUR,
        amount_currency_LYD, amount_EUR_LYD, accept_discount,
        return_chira, comment_chira, usr_receive_chira,
        id_box1, id_box2, id_box3, IS_GIFT, IS_WHOLE_SALE,
        USD_Rate, EURO_Rate, TOTAL_INV_FROM_DIAMOND, is_chira,
        is_request, is_ok_commission_extra, client_redirected,
        SourceMark, remise_per, total_remise_final_lyd
      });

      res.status(200).json({ message: "Invoice record updated successfully" });
    } catch (error) {
      console.error("Update Invoice Error:", error);
      res.status(500).json({ message: "Error updating invoice record" });
    }
  });
};

// Delete an invoice row by id_fact
exports.delete = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const invoiceId = req.params.id_fact;
    try {
      const invoice = await Invoice.findByPk(invoiceId);
      if (!invoice) return res.status(404).json({ message: "Invoice record not found" });

      await invoice.destroy();
      return res.status(200).json({ message: "Invoice record deleted successfully" });
    } catch (error) {
      console.error("Delete Invoice Error:", error);
      return res.status(500).json({ message: "Error deleting invoice record" });
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


      const { ps, num_fact, type_supplier, usr } = req.query;

      // Dynamically build include for DistributionPurchase
      let purchaseInclude = [
        {
          model: Supplier,
          as: 'Fournisseur',
          attributes: ['client_name', 'code_supplier', 'TYPE_SUPPLIER', 'Price_G_Gold', 'Price_G_Gold_Sales', 'Percentage_Diamond'],
        },

      ];


      // 1️⃣ Fetch invoices with standard relations
      let whereClause;
      if (usr === '-1' || usr === -1) {
        if (num_fact === '-1' || num_fact === -1) {
          whereClause = { ps, num_fact: { [Op.gt]: 0 } };
        } else {
          whereClause = { ps, num_fact };
        }
      } else {
        if (num_fact === '-1' || num_fact === -1) {
          whereClause = { ps, usr, num_fact: { [Op.gt]: 0 } };
        } else {
          whereClause = { ps, num_fact, usr };
        }
      }


      const invoices = await Invoice.findAll({
        where: whereClause,
        include: [
          {
            model: Customer,
            attributes: ['client_name', 'tel_client']
          },
          {
            model: User,
            attributes: ['id_user', 'name_user', 'email']
          },
          {
            model: Purchase,
            as: 'ACHATs',
            attributes: ['id_fact', 'id_art', 'Original_Invoice', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush',
              'CODE_EXTERNAL', 'comment_edit'
            ],
            include: purchaseInclude
          }
        ]
      });
      /*
          // 2️⃣ Extract all unique id_art values from invoices
          const idArts = [...new Set(invoices.map(inv => inv.id_art).filter(Boolean))];
    
          // 3️⃣ Fetch corresponding pictures from GJ_DATA_PIC
          const ACHAT_pic = await Pic.findAll({
            where: { id_art: idArts },
            attributes: ['id_art', 'ID_PIC', 'PIC1', 'PIC2', 'PIC3']
          });
    
          // 4️⃣ Attach pictures to each invoice
          // 4️⃣ Attach Base64 pictures to each invoice
        
          invoices.forEach(invoice => {
            const relatedPics = ACHAT_pic
              .filter(pic => pic.id_art === invoice.id_art)
              .map(pic => ({
                ...pic.dataValues,
                PIC1: pic.PIC1 ? Buffer.from(pic.PIC1).toString('base64') : null,
                PIC2: pic.PIC2 ? Buffer.from(pic.PIC2).toString('base64') : null,
                PIC3: pic.PIC3 ? Buffer.from(pic.PIC3).toString('base64') : null,
              }));
    
            invoice.dataValues.ACHAT_pic = relatedPics; // match what frontend expects
          });
    
    */


      res.json(invoices);




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

    const { ps, usr } = req.query;
    if (!ps || !usr) return res.status(400).json({ message: "ps and usr are required" });

    try {
      // 1. Get new invoice number
      const lastInvoice = await Invoice.findOne({
        order: [['num_fact', 'DESC']],
        attributes: ['num_fact']
      });

      let newNumFact = 1;
      if (lastInvoice && lastInvoice.num_fact) {
        const lastNum = parseInt(lastInvoice.num_fact, 10);
        if (!isNaN(lastNum)) {
          newNumFact = lastNum + 1;
        } else {
          return res.status(400).json({ message: "Last num_fact is not a number, cannot generate new number" });
        }
      }

      // 2. Find invoice with num_fact=0, ps=ps, usr=usr
      const invoice = await Invoice.findOne({
        where: { num_fact: 0, ps: ps, usr: usr }
      });


      /*
      if (invoice) {
        // 3. Update num_fact to newNumFact for all matching rows
        await Invoice.update(
          { num_fact: newNumFact },
          { where: { num_fact: 0, ps: ps, usr: usr } }
        );
      }
*/



      res.status(200).json({ new_num_fact: newNumFact.toString() });
    } catch (error) {
      console.error("Get New num_fact Error:", error);
      res.status(500).json({ message: "Error generating new invoice number" });
    }
  });
};




exports.updateTotals = async (req, res) => {

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {

      const { num_fact } = req.params;


      const { total_remise_final, amount_currency, amount_lyd, amount_EUR,
        amount_currency_LYD, amount_EUR_LYD, ps, usr, customer, sm, is_chira,
        IS_WHOLE_SALE, remise_per, remise, total_remise_final_lyd } = req.body;



      // Validate input
      if (!num_fact || isNaN(num_fact)) {
        return res.status(400).json({ message: "Invalid invoice number" });
      }

      // Update all invoice items with this invoice number




      /*
       
            const lastInvoice = await Invoice.findOne({
              order: [['num_fact', 'DESC']],
              attributes: ['num_fact']
            });
      
            let newNumFact = 1;
      
            if (lastInvoice && lastInvoice.num_fact) {
              const lastNum = parseInt(lastInvoice.num_fact, 10);
              
                newNumFact = lastNum + 1;
              
            }
      */


      newNumFact = 0

      const [updatedCount] = await Invoice.update(
        {
          total_remise_final,
          amount_currency,
          amount_lyd,
          amount_EUR,
          amount_currency_LYD,
          amount_EUR_LYD,
          num_fact: 0,
          client: customer,
          SourceMark: sm,
          is_chira: is_chira,
          IS_WHOLE_SALE: IS_WHOLE_SALE,
          remise_per: remise_per,
          remise: remise,
          total_remise_final_lyd
        },
        {
          where: { num_fact: 0, ps: ps, usr: usr },
        }
      ).catch(error => {
        console.error("Update Totals Error:", error);
        throw new Error("Database error occurred while updating totals");
      });

      if (updatedCount === 0) {
        return res.status(404).json({ message: "No invoices found with this number" });
      }


      res.status(200).json({
        message: 'Invoice totals updated successfully',
        updatedCount
      });
    } catch (error) {
      console.error("Update Totals Error:", error);
      res.status(500).json({ message: 'Error updating invoice totals' });
    }
  });
};






exports.getBynum_factAllData = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { ps, num_fact } = req.query;

      // 1️⃣ Fetch invoices with standard relations
      const invoices = await Invoice.findAll({
        where: { ps, num_fact },
        include: [
          {
            model: Customer,
            attributes: ['client_name', 'tel_client']
          },
          {
            model: User,
            attributes: ['id_user', 'name_user', 'email']
          },
          {
            model: Purchase,
            as: 'ACHATs',
            attributes: ['id_fact', 'id_art', 'Original_Invoice', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush',
              'CODE_EXTERNAL', 'comment_edit'
            ],
            include: [
              {
                model: Supplier,
                as: 'Fournisseur',
                attributes: ['id_client', 'client_name', 'code_supplier', 'TYPE_SUPPLIER']
              }

            ]
          }
        ]
      });
      /*
            // 2️⃣ Extract all unique id_art values from invoices
            const idArts = [...new Set(invoices.map(inv => inv.id_art).filter(Boolean))];
      
            // 3️⃣ Fetch corresponding pictures from GJ_DATA_PIC
            const ACHAT_pic = await Pic.findAll({
              where: { id_art: idArts },
              attributes: ['id_art', 'ID_PIC', 'PIC1', 'PIC2', 'PIC3']
            });
      
            // 4️⃣ Attach pictures to each invoice
            // 4️⃣ Attach Base64 pictures to each invoice
            invoices.forEach(invoice => {
              const relatedPics = ACHAT_pic
                .filter(pic => pic.id_art === invoice.id_art)
                .map(pic => ({
                  ...pic.dataValues,
                  PIC1: pic.PIC1 ? Buffer.from(pic.PIC1).toString('base64') : null,
                  PIC2: pic.PIC2 ? Buffer.from(pic.PIC2).toString('base64') : null,
                  PIC3: pic.PIC3 ? Buffer.from(pic.PIC3).toString('base64') : null,
                }));
      
              invoice.dataValues.ACHAT_pic = relatedPics; // match what frontend expects
            });
      
      */

      res.json(invoices);




    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });
};













exports.getBynum_factAllDataPeriod = async (req, res) => {

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { ps, num_fact, from, to, type, is_chira, is_whole_sale, client } = req.query;

      // 1️⃣ Fetch invoices with standard relations
      const whereCondition = {};
      if (typeof ps !== 'undefined' && ps !== null && ps !== '') {
        whereCondition.ps = ps;
      }
      // Add num_fact filter
      if (typeof num_fact !== 'undefined' && num_fact !== null && num_fact !== '') {
        whereCondition.num_fact = num_fact;
      } else {
        whereCondition.num_fact = { [Op.gt]: 0 };
      }
      // Add id_art > 0 condition
      whereCondition.id_art = { [Op.gt]: 0 };
      // Add client filter if provided
      if (typeof client !== 'undefined' && client !== null && client !== '') {
        whereCondition.client = client;
      }
      // Add date filter if from/to provided
      if (from || to) {
        whereCondition.date_fact = {};
        if (from && to) {
          whereCondition.date_fact = { [Op.between]: [new Date(from), new Date(to)] };
        } else if (from) {
          whereCondition.date_fact = { [Op.gte]: new Date(from) };
        } else if (to) {
          whereCondition.date_fact = { [Op.lte]: new Date(to) };
        }
      }
      // Add is_chira filter
      if (typeof is_chira !== 'undefined' && is_chira !== null && is_chira !== '' && (is_chira === '0' || is_chira === '1' || is_chira === 0 || is_chira === 1)) {
        whereCondition.is_chira = is_chira;
      }
      // Add IS_WHOLE_SALE filter (case sensitive)
      if (typeof is_whole_sale !== 'undefined' && is_whole_sale !== null && is_whole_sale !== '' && (is_whole_sale === '0' || is_whole_sale === '1' || is_whole_sale === 0 || is_whole_sale === 1)) {
        whereCondition.IS_WHOLE_SALE = is_whole_sale;
      }

      const invoices = await Invoice.findAll({
        where: whereCondition,
        include: [
          {
            model: Customer,
            attributes: ['client_name', 'tel_client']
          },
          {
            model: User,
            attributes: ['id_user', 'name_user', 'email']
          },
          {
            model: Purchase,
            as: 'ACHATs',
            attributes: ['id_fact', 'id_art', 'Original_Invoice', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush',
              'CODE_EXTERNAL', 'comment_edit'],
            include: [
              {
                model: Supplier,
                as: 'Fournisseur',
                attributes: ['id_client', 'client_name', 'code_supplier', 'TYPE_SUPPLIER'],
                // No where clause here
              },
              {
                model: require('../../models/sales/DistributionPurchase'),
                as: 'DistributionPurchase',
                required: false,
                foreignKey: 'PurchaseID',
                targetKey: 'Original_Invoice',
                attributes: ['PurchaseID', 'PurchaseType'],
                include: [
                  {
                    model: require('../../models/Purchase/GoldOriginalAchat'),
                    as: 'purchase',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/WachtchesOriginalAchat'),
                    as: 'purchaseW',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/DiamonOriginalAchat'),
                    as: 'purchaseD',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  }
                ]
              }
            ]
          }
        ]
      });


      // If type_supplier is provided, filter the result in JS for any matching TYPE_SUPPLIER in any ACHATs
      let filteredInvoices = invoices;
      if (type) {
        filteredInvoices = invoices.filter(inv =>
          inv.ACHATs && inv.ACHATs.some(achat =>
            achat.Fournisseur && achat.Fournisseur.TYPE_SUPPLIER && achat.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes(type.toLowerCase())
          )
        );
      }

      res.json(filteredInvoices);
    } catch (dbErr) {
      console.error("Fetch Purchases Error (getBynum_factAllDataPeriod):", dbErr);
      if (dbErr.parent) {
        console.error("Sequelize parent error:", dbErr.parent);
      }
      if (dbErr.original) {
        console.error("Sequelize original error:", dbErr.original);
      }
      res.status(500).json({ message: "Error fetching purchases", error: dbErr.message, details: dbErr.parent || dbErr.original });
    }
  });
};











exports.updateTotal = async (req, res) => {

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {


      const { id_fact } = req.params;


      const { prix_vente_remise, total_remise, remise, remise_per, IS_GIFT } = req.body;








      const [updatedCount] = await Invoice.update(
        {
          prix_vente_remise, total_remise, remise, remise_per, IS_GIFT
        },
        {
          where: { id_fact: id_fact },
        }
      ).catch(error => {
        console.error("Update Totals Error:", error);
        throw new Error("Database error occurred while updating totals");
      });

      if (updatedCount === 0) {
        return res.status(404).json({ message: "No invoices found with this number" });
      }


      res.status(200).json({
        message: 'Invoice totals updated successfully',
        updatedCount
      });
    } catch (error) {
      console.error("Update Totals Error:", error);
      res.status(500).json({ message: 'Error updating invoice totals' });
    }
  });
};





exports.setNumFact = async (req, res) => {


  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const { ps, usr } = req.query;
    if (!ps || !usr) return res.status(400).json({ message: "ps and usr are required" });

    try {
      // 1. Get new invoice number
      const lastInvoice = await Invoice.findOne({
        order: [['num_fact', 'DESC']],
        attributes: ['num_fact']
      });

      let newNumFact = 1;
      if (lastInvoice && lastInvoice.num_fact) {
        const lastNum = parseInt(lastInvoice.num_fact, 10);
        if (!isNaN(lastNum)) {
          newNumFact = lastNum + 1;
        } else {
          return res.status(400).json({ message: "Last num_fact is not a number, cannot generate new number" });
        }
      }




      // 3. Update num_fact to newNumFact for all matching rows
      await Invoice.update(
        { num_fact: newNumFact },
        { where: { num_fact: 0, ps: ps, usr: usr } }
      );





      res.status(200).json({ new_num_fact: newNumFact.toString() });
    } catch (error) {
      console.error("Get New num_fact Error:", error);
      res.status(500).json({ message: "Error generating new invoice number" });
    }
  });
};






exports.CloseInvoice = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const { ps, usr, num_fact, MakeCashVoucher } = req.query;
    if (!ps || !usr) return res.status(400).json({ message: "ps and usr are required" });

    try {

      // 3. Fetch the updated invoices
      const invoices = await Invoice.findAll({ where: { num_fact: num_fact, ps: ps, usr: usr } });

      const isGiftInvoice = Array.isArray(invoices) && invoices.length > 0
        ? invoices.every((inv) => Boolean(inv.IS_GIFT))
        : false;

      const GLTran = require("../../models/Finance/GLTran");
      const gltranRows = [];

      const AR_ACC_NO = process.env.AR_ACC_NO || '11030101';
      const REVENUE_ACC_NO = process.env.REVENUE_ACC_NO || '42010101';
      const GIFT_REVENUE_ACC_NO = process.env.GIFT_REVENUE_ACC_NO || process.env.GIFT_ACC_NO || REVENUE_ACC_NO;
      const COGS_ACC_NO = process.env.COGS_ACC_NO || '51010101';
      const GIFT_EXPENSE_ACC_NO = process.env.GIFT_EXPENSE_ACC_NO || process.env.GIFT_EXP_ACC_NO || COGS_ACC_NO;
      const INVENTORY_ACC_NO = process.env.INVENTORY_ACC_NO || '13010101';

      // Gift invoices: revenue must be 0 and we only post COGS at cost (not sale price)
      if (isGiftInvoice) {
        const inv0 = invoices[0];
        const paidCurrencyLyd = Number(inv0?.amount_currency_LYD) || 0;
        const paidEurLyd = Number(inv0?.amount_EUR_LYD) || 0;
        const paidLyd = Number(inv0?.amount_lyd) || 0;
        const giftRevenueLyd = paidCurrencyLyd + paidEurLyd + paidLyd;

        // Fetch costs for each sold item
        const itemIds = invoices
          .map((inv) => inv.id_art)
          .filter((v) => v !== undefined && v !== null);

        const purchases = await Purchase.findAll({
          where: {
            id_fact: { [Op.in]: itemIds }
          }
        });
        const purchaseById = new Map(purchases.map((p) => [p.id_fact, p]));

        const totalCostLyd = invoices.reduce((sum, inv) => {
          const p = purchaseById.get(inv.id_art);
          const unitCost = Number(p?.Cost_Lyd ?? p?.Cost_Lyd ?? 0);
          const qty = Number(inv.qty ?? 0);
          return sum + (unitCost * qty);
        }, 0);

        // Post Gift revenue to close/balance: Debit AR, Credit GIFT revenue.
        // This uses the paid amounts (LYD + USD_LYD + EUR_LYD) so Finance reports match the invoice settlement.
        if (giftRevenueLyd > 0) {
          gltranRows.push({
            Acc_No: AR_ACC_NO,
            KidNoT: 'INV',
            Date: new Date(),
            Cridt: 0,
            Dibt: giftRevenueLyd,
            Note: `Gift invoice ${num_fact} closed (Debit AR)`,
            NUM_FACTURE: num_fact,
            ENTETE: '',
            SOURCE: 'INV',
            is_closed: false,
            check_number: '',
            usr: usr,
            ref_emp: 0,
            num_sarf: 0,
            DATE_FACT: new Date(),
            fl: false,
            Cridt_Curr: 0,
            Dibt_Curr: giftRevenueLyd,
            Id_Cost_Center: 0,
            id_supp_cuss: inv0?.client ?? 0,
            Cridt_Curr_A: 0,
            Dibt_Curr_A: 0,
            Cridt_Curr_B: 0,
            Dibt_Curr_B: 0,
            rate: 1,
            date_effect: new Date(),
            sor_1: 0,
            fll: false,
            original_value_cridt: 0,
            original_value_dibt: 0,
            Curr_riginal_value: '',
            MrkzName: '',
            NUM_SARFF: '',
            CLIENT: inv0?.client ?? 0,
            PS: ps
          });
          gltranRows.push({
            Acc_No: GIFT_REVENUE_ACC_NO,
            KidNoT: 'INV',
            Date: new Date(),
            Cridt: giftRevenueLyd,
            Dibt: 0,
            Note: `Gift invoice ${num_fact} closed (Credit Gift Revenue)`,
            NUM_FACTURE: num_fact,
            ENTETE: '',
            SOURCE: 'INV',
            is_closed: false,
            check_number: '',
            usr: usr,
            ref_emp: 0,
            num_sarf: 0,
            DATE_FACT: new Date(),
            fl: false,
            Cridt_Curr: giftRevenueLyd,
            Dibt_Curr: 0,
            Id_Cost_Center: 0,
            id_supp_cuss: inv0?.client ?? 0,
            Cridt_Curr_A: 0,
            Dibt_Curr_A: 0,
            Cridt_Curr_B: 0,
            Dibt_Curr_B: 0,
            rate: 1,
            date_effect: new Date(),
            sor_1: 0,
            fll: false,
            original_value_cridt: 0,
            original_value_dibt: 0,
            Curr_riginal_value: '',
            MrkzName: '',
            NUM_SARFF: '',
            CLIENT: inv0?.client ?? 0,
            PS: ps
          });

          await Revenue.create({
            id_client: inv0?.client ?? 0,
            montant: giftRevenueLyd,
            date: new Date(),
            comment: `Gift revenue from invoice number ${num_fact} [LYD]`,
            usr: usr,
            rate: 1,
            Debit: AR_ACC_NO,
            IS_OK: true,
            ps: ps,
            montant_currency: giftRevenueLyd,
            currency: 'LYD',
            credit: GIFT_REVENUE_ACC_NO,
            is_watches: true
          });
        }

        if (totalCostLyd > 0) {
          // Debit COGS
          gltranRows.push({
            Acc_No: GIFT_EXPENSE_ACC_NO,
            KidNoT: 'INV',
            Date: new Date(),
            Cridt: 0,
            Dibt: totalCostLyd,
            Note: `Gift invoice ${num_fact} closed (Gift Expense Debit)`,
            NUM_FACTURE: num_fact,
            ENTETE: '',
            SOURCE: 'INV',
            is_closed: false,
            check_number: '',
            usr: usr,
            ref_emp: 0,
            num_sarf: 0,
            DATE_FACT: new Date(),
            fl: false,
            Cridt_Curr: 0,
            Dibt_Curr: totalCostLyd,
            Id_Cost_Center: 0,
            id_supp_cuss: invoices[0]?.client ?? 0,
            Cridt_Curr_A: 0,
            Dibt_Curr_A: 0,
            Cridt_Curr_B: 0,
            Dibt_Curr_B: 0,
            rate: 1,
            date_effect: new Date(),
            sor_1: 0,
            fll: false,
            original_value_cridt: 0,
            original_value_dibt: 0,
            Curr_riginal_value: '',
            MrkzName: '',
            NUM_SARFF: '',
            CLIENT: invoices[0]?.client ?? 0,
            PS: ps
          });
          // Credit Inventory
          gltranRows.push({
            Acc_No: INVENTORY_ACC_NO,
            KidNoT: 'INV',
            Date: new Date(),
            Cridt: totalCostLyd,
            Dibt: 0,
            Note: `Gift invoice ${num_fact} closed (Inventory Credit)`,
            NUM_FACTURE: num_fact,
            ENTETE: '',
            SOURCE: 'INV',
            is_closed: false,
            check_number: '',
            usr: usr,
            ref_emp: 0,
            num_sarf: 0,
            DATE_FACT: new Date(),
            fl: false,
            Cridt_Curr: totalCostLyd,
            Dibt_Curr: 0,
            Id_Cost_Center: 0,
            id_supp_cuss: invoices[0]?.client ?? 0,
            Cridt_Curr_A: 0,
            Dibt_Curr_A: 0,
            Cridt_Curr_B: 0,
            Dibt_Curr_B: 0,
            rate: 1,
            date_effect: new Date(),
            sor_1: 0,
            fll: false,
            original_value_cridt: 0,
            original_value_dibt: 0,
            Curr_riginal_value: '',
            MrkzName: '',
            NUM_SARFF: '',
            CLIENT: invoices[0]?.client ?? 0,
            PS: ps
          });
        }

        if (gltranRows.length > 0) {
          await GLTran.bulkCreate(gltranRows);
        }

        await Invoice.update(
          { IS_OK: true },
          { where: { num_fact: num_fact, ps: ps, usr: usr } }
        );

        return res.status(200).json({
          new_num_fact: num_fact,
          gltranRowsCreated: gltranRows.length,
          giftInvoice: true,
          revenuePosted: giftRevenueLyd,
          costPosted: totalCostLyd,
          giftExpenseAccNo: GIFT_EXPENSE_ACC_NO
        });
      }
      // Only process the first invoice row
      const invoice = invoices[0];
      if (invoice) {
        let sumCurr = Number(invoice.total_remise_final) || 0;
        if (Number(invoice.remise) > 0) {
          sumCurr = sumCurr - Number(invoice.remise);
        } else if (Number(invoice.remise_per) > 0) {
          sumCurr = sumCurr - (sumCurr * Number(invoice.remise_per));
        }
        const amount_currency_LYD = Number(invoice.amount_currency_LYD) || 0;
        const amount_EUR_LYD = Number(invoice.amount_EUR_LYD) || 0;
        const amount_lyd = Number(invoice.amount_lyd) || 0;
        const total_remise_final = amount_currency_LYD + amount_EUR_LYD + amount_lyd;
        // Row 1: Debit
        gltranRows.push({
          Acc_No: '11030101', // TODO: Replace with actual account number
          KidNoT: 'INV',
          Date: new Date(),
          Cridt: 0,
          Dibt: total_remise_final,
          Note: `Invoice ${invoice.num_fact} closed (Debit)`,
          NUM_FACTURE: invoice.num_fact,
          ENTETE: '',
          SOURCE: 'INV',
          is_closed: false,
          check_number: '',
          usr: invoice.usr,
          ref_emp: 0,
          num_sarf: 0,
          DATE_FACT: invoice.date_fact,
          fl: false,
          Cridt_Curr: 0,
          Dibt_Curr: sumCurr,
          Id_Cost_Center: 0,
          id_supp_cuss: invoice.client,
          Cridt_Curr_A: 0,
          Dibt_Curr_A: 0,
          Cridt_Curr_B: 0,
          Dibt_Curr_B: 0,
          rate: 1,
          date_effect: new Date(),
          sor_1: 0,
          fll: false,
          original_value_cridt: 0,
          original_value_dibt: 0,
          Curr_riginal_value: '',
          MrkzName: '',
          NUM_SARFF: '',
          CLIENT: invoice.client,
          PS: invoice.ps
        });
        // Row 2: Credit
        gltranRows.push({
          Acc_No: '42010101', // TODO: Replace with actual account number
          KidNoT: 'INV',
          Date: new Date(),
          Cridt: total_remise_final,
          Dibt: 0,
          Note: `Invoice ${invoice.num_fact} closed (Credit)`,
          NUM_FACTURE: invoice.num_fact,
          ENTETE: '',
          SOURCE: 'INV',
          is_closed: false,
          check_number: '',
          usr: invoice.usr,
          ref_emp: 0,
          num_sarf: 0,
          DATE_FACT: invoice.date_fact,
          fl: false,
          Cridt_Curr: sumCurr,
          Dibt_Curr: 0,
          Id_Cost_Center: 0,
          id_supp_cuss: invoice.client,
          Cridt_Curr_A: 0,
          Dibt_Curr_A: 0,
          Cridt_Curr_B: 0,
          Dibt_Curr_B: 0,
          rate: 1,
          date_effect: new Date(),
          sor_1: 0,
          fll: false,
          original_value_cridt: 0,
          original_value_dibt: 0,
          Curr_riginal_value: '',
          MrkzName: '',
          NUM_SARFF: '',
          CLIENT: invoice.client,
          PS: invoice.ps
        });
        // Add cash voucher GL rows if MakeCashVoucher is true
        if (MakeCashVoucher === 'true' || MakeCashVoucher === true) {
          // For amount_currency
          if (Number(invoice.amount_currency) > 0) {
            // Debit
            gltranRows.push({
              Acc_No: '11010108', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: 0,
              Dibt: amount_currency_LYD,
              Note: `Deposit -  for Invoice ${invoice.num_fact} [USD]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: 0,
              Dibt_Curr: Number(invoice.amount_currency),
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            // Credit
            gltranRows.push({
              Acc_No: '11030101', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: amount_currency_LYD,
              Dibt: 0,
              Note: `Deposit -  (Credit) for Invoice ${invoice.num_fact} [USD]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: Number(invoice.amount_currency),
              Dibt_Curr: 0,
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            // Insert Revenue for USD
            await Revenue.create({
              id_client: invoice.client,
              montant: amount_currency_LYD, // Debit or Credit amount
              date: new Date(),
              comment: `Revenue from invoice number ${invoice.num_fact} [USD]`,
              usr: invoice.usr,
              rate: 1,
              Debit: '11010108', // Debit Acc_No
              IS_OK: true,
              ps: invoice.ps,
              montant_currency: invoice.amount_currency,
              currency: 'USD',
              credit: '11030101', // Credit Acc_No
              is_watches: invoice.type === 'watch' ? true : true // Set based on type if available
            });
          }
          // For amount_EUR
          if (Number(invoice.amount_EUR) > 0) {
            gltranRows.push({
              Acc_No: '11010109', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: 0,
              Dibt: amount_EUR_LYD,
              Note: `Deposit -  (Debit) for Invoice ${invoice.num_fact} [EUR]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: 0,
              Dibt_Curr: Number(invoice.amount_EUR),
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            gltranRows.push({
              Acc_No: '11030101', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: amount_EUR_LYD,
              Dibt: 0,
              Note: `Deposit -  (Credit) for Invoice ${invoice.num_fact} [EUR]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: Number(invoice.amount_EUR),
              Dibt_Curr: 0,
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            // Insert Revenue for EUR
            await Revenue.create({
              id_client: invoice.client,
              montant: amount_EUR_LYD,
              date: new Date(),
              comment: `Revenue from invoice number ${invoice.num_fact} [EUR]`,
              usr: invoice.usr,
              rate: 1,
              Debit: '11010109',
              IS_OK: true,
              ps: invoice.ps,
              montant_currency: invoice.amount_EUR,
              currency: 'EUR',
              credit: '11030101',
              is_watches: invoice.type === 'watch' ? true : true
            });
          }
          // For amount_lyd
          if (Number(invoice.amount_lyd) > 0) {
            gltranRows.push({
              Acc_No: '11010106', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: 0,
              Dibt: amount_lyd,
              Note: `Deposit -  (Debit) for Invoice ${invoice.num_fact} [LYD]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: 0,
              Dibt_Curr: amount_lyd,
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            gltranRows.push({
              Acc_No: '11030101', // TODO: Replace with actual cash account number
              KidNoT: 'CASH',
              Date: new Date(),
              Cridt: amount_lyd,
              Dibt: 0,
              Note: `Deposit -  (Credit) for Invoice ${invoice.num_fact} [LYD]`,
              NUM_FACTURE: invoice.num_fact,
              ENTETE: '',
              SOURCE: 'CASH',
              is_closed: false,
              check_number: '',
              usr: invoice.usr,
              ref_emp: 0,
              num_sarf: 0,
              DATE_FACT: invoice.date_fact,
              fl: false,
              Cridt_Curr: amount_lyd,
              Dibt_Curr: 0,
              Id_Cost_Center: 0,
              id_supp_cuss: invoice.client,
              Cridt_Curr_A: 0,
              Dibt_Curr_A: 0,
              Cridt_Curr_B: 0,
              Dibt_Curr_B: 0,
              rate: 1,
              date_effect: new Date(),
              sor_1: 0,
              fll: false,
              original_value_cridt: 0,
              original_value_dibt: 0,
              Curr_riginal_value: '',
              MrkzName: '',
              NUM_SARFF: '',
              CLIENT: invoice.client,
              PS: invoice.ps
            });
            // Insert Revenue for LYD
            await Revenue.create({
              id_client: invoice.client,
              montant: amount_lyd,
              date: new Date(),
              comment: `Revenue from invoice number ${invoice.num_fact} [LYD]`,
              usr: invoice.usr,
              rate: 1,
              Debit: '11010106',
              IS_OK: true,
              ps: invoice.ps,
              montant_currency: invoice.amount_lyd,
              currency: 'LYD',
              credit: '11030101',
              is_watches: invoice.type === 'watch' ? true : true
            });
          }
        }
      }




      // 4. Bulk insert into GLTran
      if (gltranRows.length > 0) {

        await GLTran.bulkCreate(gltranRows);
      }
      res.status(200).json({ new_num_fact: num_fact, gltranRowsCreated: gltranRows.length });



      await Invoice.update(
        { IS_OK: true },
        { where: { num_fact: num_fact, ps: ps, usr: usr } }
      );



    } catch (error) {
      console.error("CloseInvoice Error:", error);



      res.status(500).json({ message: "Error closing invoice and creating journal entries" });
    }
  });
};

















exports.getBynum_factAllDataPeriodClient = async (req, res) => {
  console.log("getBynum_factAllDataPeriod called");
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { ps, num_fact, from, to, type, is_chira, is_whole_sale, client } = req.query;

      // 1️⃣ Fetch invoices with standard relations
      const whereCondition = {};
      if (typeof ps !== 'undefined' && ps !== null && ps !== '') {
        whereCondition.ps = ps;
      }
      // Add num_fact filter
      if (typeof num_fact !== 'undefined' && num_fact !== null && num_fact !== '') {
        whereCondition.num_fact = num_fact;
      } else {
        whereCondition.num_fact = { [Op.gt]: 0 };
      }
      // Add id_art > 0 condition
      whereCondition.id_art = { [Op.gt]: 0 };
      // Add client filter if provided
      if (typeof client !== 'undefined' && client !== null && client !== '') {
        whereCondition.client = client;
      }
      // Add date filter if from/to provided
      if (from || to) {
        whereCondition.date_fact = {};
        if (from && to) {
          whereCondition.date_fact = { [Op.between]: [new Date(from), new Date(to)] };
        } else if (from) {
          whereCondition.date_fact = { [Op.gte]: new Date(from) };
        } else if (to) {
          whereCondition.date_fact = { [Op.lte]: new Date(to) };
        }
      }
      // Add is_chira filter
      if (typeof is_chira !== 'undefined' && is_chira !== null && is_chira !== '' && (is_chira === '0' || is_chira === '1' || is_chira === 0 || is_chira === 1)) {
        whereCondition.is_chira = is_chira;
      }
      // Add IS_WHOLE_SALE filter (case sensitive)
      if (typeof is_whole_sale !== 'undefined' && is_whole_sale !== null && is_whole_sale !== '' && (is_whole_sale === '0' || is_whole_sale === '1' || is_whole_sale === 0 || is_whole_sale === 1)) {
        whereCondition.IS_WHOLE_SALE = is_whole_sale;
      }

      const invoices = await Invoice.findAll({
        where: whereCondition,
        include: [
          {
            model: Customer,
            attributes: ['client_name', 'tel_client']
          },
          {
            model: User,
            attributes: ['id_user', 'name_user', 'email']
          },
          {
            model: Purchase,
            as: 'ACHATs',
            attributes: ['id_fact', 'id_art', 'Original_Invoice', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush',
              'CODE_EXTERNAL', 'comment_edit'],
            include: [
              {
                model: Supplier,
                as: 'Fournisseur',
                attributes: ['id_client', 'client_name', 'code_supplier', 'TYPE_SUPPLIER'],
                // No where clause here
              },
              {
                model: require('../../models/sales/DistributionPurchase'),
                as: 'DistributionPurchase',
                required: false,
                foreignKey: 'PurchaseID',
                targetKey: 'Original_Invoice',
                attributes: ['PurchaseID', 'PurchaseType'],
                include: [
                  {
                    model: require('../../models/Purchase/GoldOriginalAchat'),
                    as: 'purchase',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/WachtchesOriginalAchat'),
                    as: 'purchaseW',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/DiamonOriginalAchat'),
                    as: 'purchaseD',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  }
                ]
              }
            ]
          }
        ]
      });


      // If type_supplier is provided, filter the result in JS for any matching TYPE_SUPPLIER in any ACHATs
      let filteredInvoices = invoices;
      if (type) {
        filteredInvoices = invoices.filter(inv =>
          inv.ACHATs && inv.ACHATs.some(achat =>
            achat.Fournisseur && achat.Fournisseur.TYPE_SUPPLIER && achat.Fournisseur.TYPE_SUPPLIER.toLowerCase().includes(type.toLowerCase())
          )
        );
      }

      res.json(filteredInvoices);
    } catch (dbErr) {
      console.error("Fetch Purchases Error (getBynum_factAllDataPeriod):", dbErr);
      if (dbErr.parent) {
        console.error("Sequelize parent error:", dbErr.parent);
      }
      if (dbErr.original) {
        console.error("Sequelize original error:", dbErr.original);
      }
      res.status(500).json({ message: "Error fetching purchases", error: dbErr.message, details: dbErr.parent || dbErr.original });
    }
  });
};










exports.updateChira = (req, res) => {


  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const invoiceId = req.params.id_fact;
    const {

      return_chira, comment_chira, usr_receive_chira


    } = req.body;

    try {
      const invoice = await Invoice.findByPk(invoiceId);
      if (!invoice) return res.status(404).json({ message: "Invoice record not found" });

      // Check if user has permission to modify this invoice
      // Allow if: 1) User is admin, 2) User owns the invoice, or 3) User has access to the same PS
      const currentUserRole = decoded.Privilege || decoded.roles || '';
      const currentUserId = decoded.id_user || decoded.Cuser;
      const currentUserPs = decoded.ps;
      
      const isAdmin = currentUserRole.includes('ROLE_ADMIN');
      const isOwner = String(invoice.usr) === String(currentUserId);
      const samePs = currentUserPs && String(invoice.ps) === String(currentUserPs);
      
      if (!isAdmin && !isOwner && !samePs) {
        return res.status(403).json({ message: "You don't have permission to modify this invoice" });
      }

      await invoice.update({
        id_art: invoice.id_art * -1,
        return_chira,
        comment_chira,
        usr_receive_chira,
        is_chira: false
      });

      res.status(200).json({ message: "Invoice record updated successfully" });
    } catch (error) {
      console.error("Update Invoice Error:", error);
      res.status(500).json({ message: "Error updating invoice record" });
    }
  });
};

// Return all purchases (flattened items) across all invoices for a specific customer
exports.getCustomerPurchases = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    try {
      const { client, from, to, type, is_chira, is_whole_sale, ps } = req.query;
      if (!client) return res.status(400).json({ message: "client query param is required" });

      const whereCondition = { client };
      // Only valid invoice rows
      whereCondition.id_art = { [Op.gt]: 0 };
      whereCondition.num_fact = { [Op.gt]: 0 };
      if (typeof ps !== 'undefined' && ps !== null && ps !== '') whereCondition.ps = ps;
      if (from || to) {
        whereCondition.date_fact = {};
        if (from && to) whereCondition.date_fact = { [Op.between]: [new Date(from), new Date(to)] };
        else if (from) whereCondition.date_fact = { [Op.gte]: new Date(from) };
        else if (to) whereCondition.date_fact = { [Op.lte]: new Date(to) };
      }
      if (
        typeof is_chira !== 'undefined' && is_chira !== null && is_chira !== '' &&
        (is_chira === '0' || is_chira === '1' || is_chira === 0 || is_chira === 1)
      ) whereCondition.is_chira = is_chira;
      if (
        typeof is_whole_sale !== 'undefined' && is_whole_sale !== null && is_whole_sale !== '' &&
        (is_whole_sale === '0' || is_whole_sale === '1' || is_whole_sale === 0 || is_whole_sale === 1)
      ) whereCondition.IS_WHOLE_SALE = is_whole_sale;

      const invoices = await Invoice.findAll({
        where: whereCondition,
        include: [
          { model: Customer, attributes: ['client_name', 'tel_client'] },
          { model: User, attributes: ['id_user', 'name_user', 'email'] },
          {
            model: Purchase,
            as: 'ACHATs',
            attributes: [
              'id_fact', 'id_art', 'Original_Invoice', 'Design_art', 'client', 'qty', 'Color_Gold', 'Color_Rush',
              'CODE_EXTERNAL', 'comment_edit'
            ],
            include: [
              {
                model: Supplier,
                as: 'Fournisseur',
                attributes: ['id_client', 'client_name', 'code_supplier', 'TYPE_SUPPLIER'],
              },
              {
                model: require('../../models/sales/DistributionPurchase'),
                as: 'DistributionPurchase',
                required: false,
                foreignKey: 'PurchaseID',
                targetKey: 'Original_Invoice',
                attributes: ['PurchaseID', 'PurchaseType'],
                include: [
                  {
                    model: require('../../models/Purchase/GoldOriginalAchat'),
                    as: 'purchase',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/WachtchesOriginalAchat'),
                    as: 'purchaseW',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  },
                  {
                    model: require('../../models/Purchase/DiamonOriginalAchat'),
                    as: 'purchaseD',
                    required: false,
                    foreignKey: 'PurchaseID',
                    targetKey: 'id_achat',
                    attributes: { exclude: [] }
                  }
                ]
              }
            ]
          }
        ],
        order: [['date_fact', 'DESC'], ['num_fact', 'DESC']]
      });

      const items = [];
      invoices.forEach((inv) => {
        const achats = inv.Purchases || inv.ACHATs || [];
        achats.forEach((a) => {
          const t = (a?.Fournisseur?.TYPE_SUPPLIER || '').toLowerCase();
          if (type && !t.includes(String(type).toLowerCase())) return;
          items.push({
            invoice: {
              num_fact: inv.num_fact,
              date_fact: inv.date_fact,
              ps: inv.ps,
              usr: inv.usr,
              amount_lyd: inv.amount_lyd,
              amount_currency: inv.amount_currency,
              amount_EUR: inv.amount_EUR,
              amount_currency_LYD: inv.amount_currency_LYD,
              amount_EUR_LYD: inv.amount_EUR_LYD,
              total_remise_final: inv.total_remise_final,
              remise: inv.remise,
              remise_per: inv.remise_per,
              IS_OK: inv.IS_OK,
              picint: inv.picint,
            },
            achat: a,
            supplier: a?.Fournisseur || null,
            distribution: a?.DistributionPurchase || null,
          });
        });
      });

      return res.json(items);
    } catch (e) {
      console.error('getCustomerPurchases error:', e);
      return res.status(500).json({ message: 'Error fetching customer purchases' });
    }
  });
};
