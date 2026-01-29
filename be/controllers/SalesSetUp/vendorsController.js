const Vendors = require("../../models/sales/Vendors"); // Adjust path if needed
const jwt = require("jsonwebtoken");

exports.find = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const data = await Vendors.findAll();
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Vendors Error:", dbErr);
      res.status(500).json({ message: "Error fetching vendors" });
    }
  });
};

exports.create = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const { ExtraClient_ID, Client_Name, Intial_Sold_Money, Intial_Sold_Gold } = req.body;

    if (
    
      !Client_Name ||
      Intial_Sold_Money === undefined ||
      Intial_Sold_Gold === undefined
    ) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    try {
      await Vendors.create({
         
        Client_Name,
        Intial_Sold_Money,
        Intial_Sold_Gold
      });
      res.status(201).json({ message: "Vendor added successfully" });
    } catch (error) {
      console.error("Create Vendor Error:", error);
      res.status(500).json({ message: "Error creating vendor" });
    }
  });
};

exports.update = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    const clientId = req.params.id_client;
    const { ExtraClient_ID, Client_Name, Intial_Sold_Money, Intial_Sold_Gold } = req.body;

    try {
      const vendor = await Vendors.findByPk(clientId);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });

      await vendor.update({
        ExtraClient_ID,
        Client_Name,
        Intial_Sold_Money,
        Intial_Sold_Gold
      });
      res.status(200).json({ message: "Vendor updated successfully" });
    } catch (error) {
      console.error("Update Vendor Error:", error);
      res.status(500).json({ message: "Error updating vendor" });
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

    const clientId = req.params.id_client;
    try {
      const vendor = await Vendors.findByPk(clientId);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });

      await vendor.destroy();
      res.status(200).json({ message: "Vendor deleted successfully" });
    } catch (error) {
      console.error("Delete Vendor Error:", error);
      res.status(500).json({ message: "Error deleting vendor" });
    }
  });
};
