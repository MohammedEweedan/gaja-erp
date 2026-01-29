const OriginalAchat = require("../../../models/Purchase/DiamonOriginalAchat");
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




// This line creates the association
OriginalAchat.belongsTo(User, { foreignKey: 'Usr', targetKey: 'id_user', as: 'user' });
User.hasMany(OriginalAchat, { foreignKey: 'Usr', sourceKey: 'id_user' });


OriginalAchat.belongsTo(Brand, { foreignKey: 'Brand', targetKey: 'id_client', as: 'brand' });
Brand.hasMany(OriginalAchat, { foreignKey: 'Brand', sourceKey: 'id_client' });


OriginalAchat.belongsTo(Vendor, { foreignKey: 'vendorsID', targetKey: 'ExtraClient_ID', as: 'vendor' });
Vendor.hasMany(OriginalAchat, { foreignKey: 'vendorsID', sourceKey: 'ExtraClient_ID' });


// GET all Achat records with User info
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await OriginalAchat.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id_user', 'name', 'name_user', 'email']
          },

           {
            model: Brand,
            as: 'brand',
            attributes: ['id_client', 'client_name' ]
          }
        ]
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Achat Error:", err);
      res.status(500).json({ message: "Error fetching Achat records" });
    }
  },
];

// CREATE Achat record
exports.create = [
  verifyToken,
  async (req, res) => {
    try {
      const data = req.body;
      // Remove fields you don't want to insert
      delete data.total_price;
      delete data.IsApprouved;
      delete data.Approval_Date;
      delete data.ApprouvedBy;
      // sharepoint_url is allowed and will be saved

      await OriginalAchat.create(data);
      res.status(201).json({ message: "Achat created successfully" });
    } catch (err) {
      console.error("Create Achat Error:", err);
      res.status(500).json({ message: "Error creating Achat" });
    }
  },
];

// UPDATE Achat record
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_achat } = req.params;
    const updatedData = req.body;

    if (!updatedData) {
      return res.status(400).json({ message: "No update data provided" });
    }

    try {
      const record = await OriginalAchat.findByPk(id_achat);
      if (!record) {
        return res.status(404).json({ message: "Achat not found" });
      }

      await record.update(updatedData); // sharepoint_url will be updated if present
      res.status(200).json({ message: "Achat updated successfully" });
    } catch (err) {
      console.error("Update Achat Error:", err);
      res.status(500).json({ message: "Error updating Achat" });
    }
  },
];

// DELETE Achat record
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_achat } = req.params;

    try {
      const record = await OriginalAchat.findByPk(id_achat);
      if (!record) {
        return res.status(404).json({ message: "Achat not found" });
      }

      await record.destroy();
      res.status(200).json({ message: "Achat deleted successfully" });
    } catch (err) {
      console.error("Delete Achat Error:", err);
      res.status(500).json({ message: "Error deleting Achat" });
    }
  },
];

// UPLOAD attachment for Achat
exports.uploadAttachment = [
  verifyToken,
  async (req, res) => {
    try {
      const { id_achat } = req.body;
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'No file uploaded' });

      // Save file path or URL to DB
      await OriginalAchat.update(
        { attachmentUrl: `/uploads/${file.filename}` },
        { where: { id_achat } }
      );
      res.status(200).json({ message: 'Attachment uploaded', url: `/uploads/${file.filename}` });
    } catch (err) {
      res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];
