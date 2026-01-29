const Purchase = require("../../models/sales/Purchase"); // Adjust path if needed
const jwt = require("jsonwebtoken");
const Supplier = require("../../models/sales/Supplier");
const User = require("../../models/hr/user");

Purchase.belongsTo(Supplier, { foreignKey: 'client' });
Supplier.hasMany(Purchase, { foreignKey: 'client', useJunctionTable: false });
const Pic = require("../../models/sales/Pic");
Purchase.belongsTo(User, { foreignKey: 'usr' });
User.hasMany(Purchase, { foreignKey: 'usr', useJunctionTable: false });






const { Op } = require('sequelize'); // Make sure to import Op at the top of your file
const Invoice = require("../../models/sales/Invoice");




const DistributionPurchase = require("../../models/sales/DistributionPurchase");
const OriginalAchatDiamonds = require("../../models/Purchase/DiamonOriginalAchat");
const WachtchesOriginalAchat = require("../../models/Purchase/WachtchesOriginalAchat");

exports.findActive = async (req, res) => {

  Purchase.hasMany(Invoice, { foreignKey: 'id_art', sourceKey: 'id_fact' });
  Invoice.belongsTo(Purchase, { foreignKey: 'id_art', targetKey: 'id_fact' });





  // Add associations for the required relations
  Purchase.hasOne(DistributionPurchase, { foreignKey: 'distributionID', sourceKey: 'Original_Invoice' });
  DistributionPurchase.belongsTo(Purchase, { foreignKey: 'distributionID', targetKey: 'Original_Invoice' });
  // Add associations for Pic (image)
  Purchase.hasOne(Pic, { foreignKey: 'id_art', sourceKey: 'id_fact' });
  Pic.belongsTo(Purchase, { foreignKey: 'id_art', targetKey: 'id_fact' });






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

      const purchases = await Purchase.findAll({
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
        }
      });









      res.json(purchases);




    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });
};










exports.findPic = async (req, res) => {

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const { id_art } = req.query;
      const whereCondition = {};
      if (id_art) whereCondition.id_art = id_art;
      const pics = await Pic.findAll({
        where: {
          ...whereCondition
        },
      });
      res.json(pics);


    } catch (dbErr) {
      console.error("Fetch pics Error:", dbErr);
      res.status(500).json({ message: "Error fetching pics" });
    }
  });
};



