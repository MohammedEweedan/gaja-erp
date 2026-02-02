const WachtchesOriginalAchat = require("../../../models/Purchase/WachtchesOriginalAchat");
const User = require("../../../models/hr/user"); // Make sure the path is correct
const jwt = require("jsonwebtoken");
const Brand = require("../../../models/sales/Supplier");
const Vendor = require("../../../models/sales/Vendors");
// JWT Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded;
    next();
  });
};

// If you have a user association, set it up here (adjust foreign keys as needed)
// WachtchesOriginalAchat.belongsTo(User, { foreignKey: 'Usr', targetKey: 'id_user', as: 'user' });
// User.hasMany(WachtchesOriginalAchat, { foreignKey: 'Usr', sourceKey: 'id_user' });

// This line creates the association
WachtchesOriginalAchat.belongsTo(User, { foreignKey: 'Usr', targetKey: 'id_user', as: 'user' });
User.hasMany(WachtchesOriginalAchat, { foreignKey: 'Usr', sourceKey: 'id_user' });

WachtchesOriginalAchat.belongsTo(Brand, { foreignKey: 'Brand', targetKey: 'id_client', as: 'brand' });
Brand.hasMany(WachtchesOriginalAchat, { foreignKey: 'Brand', sourceKey: 'id_client' });

WachtchesOriginalAchat.belongsTo(Vendor, { foreignKey: 'vendorsID', targetKey: 'ExtraClient_ID', as: 'vendor' });
Vendor.hasMany(WachtchesOriginalAchat, { foreignKey: 'vendorsID', sourceKey: 'ExtraClient_ID' });

// GET all Watch records
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await WachtchesOriginalAchat.findAll({
        // Uncomment and adjust if you have user association
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id_user', 'name', 'name_user', 'email']
          },

          {
            model: Brand,
            as: 'brand',
            attributes: ['id_client', 'client_name']
          }
        ]
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Watches Error:", err);
      res.status(500).json({ message: "Error fetching Watches records" });
    }
  },
];











exports.findbyid_achat = [
  verifyToken,
  async (req, res) => {
    const { id_achat } = req.params;
    try {
      const data = await WachtchesOriginalAchat.findOne({
        where: { id_achat },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id_user', 'name', 'name_user', 'email']
          },
          {
            model: Brand,
            as: 'brand',
            attributes: ['id_client', 'client_name']
          },

        ]
      });
      if (!data) {
        return res.status(404).json({ message: "Watch not found" });
      }
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Watch by id_achat Error:", err);
      res.status(500).json({ message: "Error fetching Watch record" });
    }
  },
];



// CREATE Watch record
exports.create = [
  verifyToken,
  async (req, res) => {


    try {
      const watchData = req.body;

      if (!watchData) {
        return res.status(400).json({ message: "Request body is empty" });
      }

      // If expiry_date is empty string or null, remove it so it will be NULL in DB
      if (watchData.hasOwnProperty('ExpiryDate') && (watchData.ExpiryDate === '' || watchData.ExpiryDate === null)) {
        delete watchData.ExpiryDate;
      }

      await WachtchesOriginalAchat.create(watchData);
      res.status(201).json({ message: "Watch created successfully" });
    } catch (err) {
      console.error("Create Watch Error:", err);
      res.status(500).json({ message: "Error creating Watch" });
    }
  },
];

// UPDATE Watch record
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_achat } = req.params;
    const updatedData = req.body;
    console.log("Update Data:", updatedData);

    if (!updatedData) {
      return res.status(400).json({ message: "No update data provided" });
    }

    try {
      const record = await WachtchesOriginalAchat.findByPk(id_achat);
      if (!record) {
        return res.status(404).json({ message: "Watch not found" });
      }

      await record.update(updatedData);
      res.status(200).json({ message: "Watch updated successfully" });
    } catch (err) {
      console.error("Update Watch Error:", err);
      res.status(500).json({ message: "Error updating Watch" });
    }
  },
];

// DELETE Watch record
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_achat } = req.params;

    try {
      const record = await WachtchesOriginalAchat.findByPk(id_achat);
      if (!record) {
        return res.status(404).json({ message: "Watch not found" });
      }

      await record.destroy();
      res.status(200).json({ message: "Watch deleted successfully" });
    } catch (err) {
      console.error("Delete Watch Error:", err);
      res.status(500).json({ message: "Error deleting Watch" });
    }
  },
];

// UPLOAD attachment for Watch
exports.uploadAttachment = [
  verifyToken,
  async (req, res) => {
    // This assumes you use multer middleware in your route before this controller
    const { id_watch } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/purchase/${req.file.filename}`;
    try {
      await WachtchesOriginalAchat.update(
        { attachmentUrl: fileUrl },
        { where: { id_watch } }
      );
      res.json({ link: fileUrl });
    } catch (err) {
      console.error("Upload Attachment Error:", err);
      res.status(500).json({ error: "Failed to update watch with attachment" });
    }
  }
];
