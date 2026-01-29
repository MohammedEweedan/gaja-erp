const currency = require("../models/Currency");
const jwt = require("jsonwebtoken");

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized!" });
    }
    req.userId = decoded.id; // لو تبي تعرف الـ id متاع المستخدم لاحقا
    next();
  });
}

// Controller to get currency
exports.find = [
  verifyToken, // Use the middleware here
  (req, res) => {
    if (req.params.id) {
      const id = req.params.id;
      currency
        .findByPk(id)
        .then((data) => {
          if (!data) {
            res.status(404).json({ message: "Not found currency with id " + id });
          } else {
            res.status(200).json(data);
          }
        })
        .catch((err) => {
          res.status(500).json({ message: "Error retrieving currency with id " + id });
        });
    } else {
      currency
        .findAll()
        .then((currencies) => res.status(200).json(currencies))
        .catch((err) => {
          res.status(500).json({
            message: err.message || "Error occurred while retrieving currencies",
          });
        });
    }
  }
];
