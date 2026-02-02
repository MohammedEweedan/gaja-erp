// controllers/calendarController.js

const LeaveRequest = require('../../models/hr/LeaveRequest');
const Holiday = require('../../models/hr/Holiday');
const jwt = require("jsonwebtoken");

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

exports.getCalendarLog = 
[
    verifyToken,
    async (req, res) => {
  try {
    const { startDate, endDate } = req.query; // Should be passed as query parameters

    const leaveRequests = await LeaveRequest.findAll({
      where: {
        DATE_START: { [Sequelize.Op.gte]: startDate },
        DATE_END: { [Sequelize.Op.lte]: endDate },
        STATUS: 'Approved', // Filter only approved leaves
      },
    });

    const holidays = await Holiday.findAll({
      where: {
        HOLIDAY_DATE: { [Sequelize.Op.gte]: startDate, [Sequelize.Op.lte]: endDate },
      },
    });

    res.status(200).json({
      leaveRequests,
      holidays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching calendar log' });
  }
}];
