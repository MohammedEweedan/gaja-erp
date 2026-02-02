const Customers = require("../../models/sales/Customers"); // Adjust path if needed
const jwt = require("jsonwebtoken");

exports.find = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const data = await Customers.findAll();
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Clients Error:", dbErr);
      res.status(500).json({ message: "Error fetching clients" });
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

    const { client_name, tel_client, Adresse, email } = req.body;
    if (!client_name || !tel_client) {
      return res.status(400).json({ message: "Client name and telephone are required" });
    }

    try {
      await Customers.create({ client_name, tel_client, Adresse, email });
      res.status(201).json({ message: "Client added successfully" });
    } catch (error) {
      console.error("Create Client Error:", error);
      res.status(500).json({ message: error.message });
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
    const { client_name, tel_client, Adresse, email } = req.body;

    try {
      const client = await Customers.findByPk(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      await client.update({ client_name, tel_client, Adresse, email });
      res.status(200).json({ message: "Client updated successfully" });
    } catch (error) {
      console.error("Update Client Error:", error);
      res.status(500).json({ message: "Error updating client" });
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
      const client = await Customers.findByPk(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      await client.destroy();
      res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Delete Client Error:", error);
      res.status(500).json({ message: "Error deleting client" });
    }
  });
};
