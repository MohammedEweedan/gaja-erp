const DistributionPurchase = require("../../models/sales/DistributionPurchase");
const jwt = require("jsonwebtoken");
const User = require("../../models/hr/user");
const Brand = require("../../models/sales/Supplier");
const Gachat = require("../../models/Purchase/GoldOriginalAchat");
const Dachat = require("../../models/Purchase/DiamonOriginalAchat");
const Wachat = require("../../models/Purchase/WachtchesOriginalAchat");

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};




// Fix this association:
DistributionPurchase.belongsTo(Gachat, { foreignKey: 'PurchaseID', targetKey: 'id_achat', as: 'purchase' });
Gachat.hasMany(DistributionPurchase, { foreignKey: 'PurchaseID', sourceKey: 'id_achat' });

// Add this association:
DistributionPurchase.belongsTo(Wachat, { foreignKey: 'PurchaseID', targetKey: 'id_achat', as: 'purchaseW' });
Wachat.hasMany(DistributionPurchase, { foreignKey: 'PurchaseID', sourceKey: 'id_achat' });



// Add this association:
DistributionPurchase.belongsTo(Dachat, { foreignKey: 'PurchaseID', targetKey: 'id_achat', as: 'purchaseD' });
Dachat.hasMany(DistributionPurchase, { foreignKey: 'PurchaseID', sourceKey: 'id_achat' });


Gachat.belongsTo(Brand, { foreignKey: 'Brand', targetKey: 'id_client', as: 'supplier' });
Brand.hasMany(Gachat, { foreignKey: 'Brand', sourceKey: 'id_client', as: 'purchases' });




Dachat.belongsTo(Brand, { foreignKey: 'Brand', targetKey: 'id_client', as: 'supplier' });
Brand.hasMany(Dachat, { foreignKey: 'Brand', sourceKey: 'id_client', as: 'purchasesD' });



Wachat.belongsTo(Brand, { foreignKey: 'Brand', targetKey: 'id_client', as: 'supplier' });
Brand.hasMany(Wachat, { foreignKey: 'Brand', sourceKey: 'id_client', as: 'purchasesW' });



DistributionPurchase.belongsTo(User, { foreignKey: 'Usr', targetKey: 'id_user', as: 'user' });
User.hasMany(DistributionPurchase, { foreignKey: 'Usr', sourceKey: 'id_user' });


// Add this function
exports.findbyId = async (req, res) => {
  try {
    const { type } = req.query;

    let include = [
      {
        model: User,
        as: 'user',
        attributes: ['id_user', 'name', 'name_user', 'email']
      }
    ];

    if (type?.toLowerCase().includes('gold')) {
      include.push({
        model: Gachat,
        as: 'purchase',
        // You can use all fields or keep as is
        // attributes: { exclude: [] },
        attributes: ['id_achat', 'Brand'],
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else if (type?.toLowerCase().includes('diamond')) {
      include.push({
        model: Dachat,
        as: 'purchaseD',
        attributes: { exclude: [] }, // <-- get all fields for diamond
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else if (type?.toLowerCase().includes('watche')) {
      include.push({
        model: Wachat,
        as: 'purchaseW',
        attributes: { exclude: [] }, // <-- get all fields for watches
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else {
      // If no type, include all
      include.push(
        {
          model: Gachat,
          as: 'purchase',
          attributes: ['id_achat', 'Brand'],
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        },
        {
          model: Dachat,
          as: 'purchaseD',
          attributes: { exclude: [] }, // all fields for diamond
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        },
        {
          model: Wachat,
          as: 'purchaseW',
          attributes: { exclude: [] }, // all fields for watches
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        }
      );
    }

    const distributions = await DistributionPurchase.findAll({
      include,
      where: {
        distributionISOK: false,
        ...(type ? { PurchaseType: type } : {})
      }
    }).catch(err => {
      console.error("Error fetching distributions:", err);
      throw err;
    });
    res.json(distributions);

    console.log("Fetched not received distributions:", distributions.length, "items");
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch not received distributions" });
  }
};






exports.findNotReceived = async (req, res) => {
  try {
    const { type } = req.query;


    let include = [
      {
        model: User,
        as: 'user',
        attributes: ['id_user', 'name', 'name_user', 'email']
      }
    ];

    if (type?.toLowerCase().includes('gold')) {
      include.push({
        model: Gachat,
        as: 'purchase',
        attributes: ['id_achat', 'Brand'],
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else if (type?.toLowerCase().includes('diamond')) {
      include.push({
        model: Dachat,
        as: 'purchaseD', // must match association
        attributes: ['id_achat', 'Brand'],
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else if (type?.toLowerCase().includes('watche')) {
      include.push({
        model: Wachat,
        as: 'purchaseW', // must match association
        attributes: ['id_achat', 'Brand'],
        include: [
          {
            model: Brand,
            as: 'supplier',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
    } else {
      // If no type, include all
      include.push(
        {
          model: Gachat,
          as: 'purchase',
          attributes: ['id_achat', 'Brand'],
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        },
        {
          model: Dachat,
          as: 'purchaseD',
          attributes: ['id_achat', 'Brand'],
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        },
        {
          model: Wachat,
          as: 'purchaseW',
          attributes: ['id_achat', 'Brand'],
          include: [
            {
              model: Brand,
              as: 'supplier',
              attributes: ['id_client', 'client_name']
            }
          ]
        }
      );
    }
 
    const distributions = await DistributionPurchase.findAll({
      include,
      where: {
        distributionISOK: false,
        ...(type ? { PurchaseType: type } : {})
      }
    }).catch(err => {
      console.error("Error fetching distributions:", err);
      throw err;
    });
    res.json(distributions);

    console.log("Fetched not received distributions:", distributions.length, "items");
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch not received distributions" });
  }
};

// GET all DistributionPurchases
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await DistributionPurchase.findAll();
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch DistributionPurchase Error:", err);
      res.status(500).json({ message: "Error fetching DistributionPurchase" });
    }
  },
];

// CREATE new DistributionPurchase
exports.create = [
  verifyToken,
  async (req, res) => {
    const { ps, Weight, distributionDate, usr, PurchaseID, PurchaseType } = req.body;

    if (
      ps === undefined ||
      Weight === undefined ||
      !distributionDate ||
      usr === undefined ||
      PurchaseID === undefined ||
      PurchaseType === undefined
    ) {
      return res.status(400).json({

        message: "All fields (ps, Weight, distributionDate, usr, PurchaseID, PurchaseType) are required",
      });
    }

    console.log("Creating DistributionPurchase with data:", {
      ps,
      Weight,
      distributionDate,
      usr,
      PurchaseID,
      PurchaseType
    });

    try {
      await DistributionPurchase.create({
        ps,
        Weight,
        distributionDate,
        usr,
        PurchaseID,
        PurchaseType,
        distributionISOK: false
      });
      res.status(201).json({ message: "DistributionPurchase created successfully" });
    } catch (err) {
      console.error("Create DistributionPurchase Error:", err);
      res.status(500).json({ message: "Error creating DistributionPurchase" });
    }
  },
];

// UPDATE existing DistributionPurchase
exports.update = [
  verifyToken,
  async (req, res) => {


    const { distributionID } = req.params;
    const { ps, Weight, distributionDate, usr, PurchaseID, PurchaseType } = req.body;

    try {
      const dist = await DistributionPurchase.findByPk(distributionID);
      if (!dist) {
        return res.status(404).json({ message: "DistributionPurchase not found" });
      }

      await dist.update({ ps, Weight, distributionDate, usr, PurchaseID, PurchaseType });




      res.status(200).json({ message: "DistributionPurchase updated successfully" });
    } catch (err) {
      console.error("Update DistributionPurchase Error:", err);
      res.status(500).json({ message: "Error updating DistributionPurchase" });
    }
  },
];






// DELETE DistributionPurchase
exports.delete = [
  verifyToken,
  async (req, res) => {


    const { distributionID } = req.params;

    try {
      const dist = await DistributionPurchase.findByPk(distributionID);
      if (!dist) {
        return res.status(404).json({ message: "DistributionPurchase not found" });
      }

      await dist.destroy();
      res.status(200).json({ message: "DistributionPurchase deleted successfully" });
    } catch (err) {
      console.error("Delete DistributionPurchase Error:", err);
      res.status(500).json({ message: "Error deleting DistributionPurchase" });
    }
  },
];

// Find DistributionPurchases by Original_Invoice (reference purchase)

// Update only DistributionISOK field
exports.updateDistributionISOK = [
  verifyToken,
  async (req, res) => {






    const { distributionID } = req.params;

    try {
      const dist = await DistributionPurchase.findByPk(distributionID);
      if (!dist) {
        return res.status(404).json({ message: "DistributionPurchase not found" });
      }

      await dist.update({ distributionISOK: true });

      res.status(200).json({ message: "distributionISOK updated successfully" });

    } catch (err) {
      console.error("Update distributionISOK Error:", err);
      res.status(500).json({ message: "Error updating distributionISOK" });
    }
  }
];




