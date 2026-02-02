const Suppliers = require("../../models/sales/Supplier"); // Adjust path if needed
const jwt = require("jsonwebtoken");

exports.find = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const data = await Suppliers.findAll();
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Suppliers Error:", dbErr);
      res.status(500).json({ message: "Error fetching suppliers" });
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

    const { client_name, tel_client, Adresse, Solde_initial, code_supplier, STATE_GOL_DIAMON, TYPE_SUPPLIER, Price_G_Gold, Percentage_Diamond, Price_G_Gold_Sales } = req.body;

    if (!client_name || !code_supplier || !TYPE_SUPPLIER) {
      return res.status(400).json({ message: "Brand name, other required fields are missing" });
    }

    try {
      await Suppliers.create({
        client_name,
        tel_client,
        Adresse,
        Solde_initial,
        code_supplier,
        STATE_GOL_DIAMON,
        TYPE_SUPPLIER,
        Price_G_Gold,
        Percentage_Diamond,
        Price_G_Gold_Sales
      });
      res.status(201).json({ message: "Supplier added successfully" });
    } catch (error) {
      console.error("Create Supplier Error:", error);
      res.status(500).json({ message: "Error creating supplier" });
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
    const { client_name, tel_client, Adresse, Solde_initial, code_supplier, STATE_GOL_DIAMON, TYPE_SUPPLIER, Price_G_Gold, Percentage_Diamond, Price_G_Gold_Sales } = req.body;

    try {
      const supplier = await Suppliers.findByPk(clientId);
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });

      await supplier.update({
        client_name,
        tel_client,
        Adresse,
        Solde_initial,
        code_supplier,
        STATE_GOL_DIAMON,
        TYPE_SUPPLIER,
        Price_G_Gold,
        Percentage_Diamond,
        Price_G_Gold_Sales
      });
      res.status(200).json({ message: "Supplier updated successfully" });
    } catch (error) {
      console.error("Update Supplier Error:", error);
      res.status(500).json({ message: "Error updating supplier" });
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
      const supplier = await Suppliers.findByPk(clientId);
      if (!supplier) return res.status(404).json({ message: "Supplier not found" });

      await supplier.destroy();
      res.status(200).json({ message: "Supplier deleted successfully" });
    } catch (error) {
      console.error("Delete Supplier Error:", error);
      res.status(500).json({ message: "Error deleting supplier" });
    }
  });
};
