const positions = require("../../models/hr/Positions");
const jwt = require("jsonwebtoken");

exports.find = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    // Verify token
    jwt.verify(token,  process.env.JWT_SECRET, async (err, decoded) => {  // <-- هنا خليته نفس secret متاع login
      if (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      try {
        const data = await positions.findAll();
        res.json(data);
      } catch (dbErr) {
        res.status(500).json({ message: "Error fetching positions" });
      }
    });

  } catch (e) {
    console.error('API Error:', e);
    res.status(500).json({ message: "Server error" });
  }
};


 

exports.create = (req, res) => {


  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  // Verify token
  jwt.verify(token,   process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!req.body) {
      return res.status(400).json({ message: "Content cannot be empty!" });
    }

    try {
      await positions.create({
        job_name: req.body.job_name,
        year_job: req.body.year_job,
        Job_degree: req.body.Job_degree,
        Job_level: req.body.Job_level,
        Job_title: req.body.Job_title,
        Job_code: req.body.Job_code,
        job_categories: req.body.job_categories,
        NBR_YEAR_FOR_JOB: req.body.NBR_YEAR_FOR_JOB
      });

      res.status(200).json({ message: "Position added successfully" });
    } catch (err) {
      console.error('Create Position Error:', err);
      res.status(500).json({
        message: err.message || "Some error occurred while creating the position"
      });
    }
  });
};





exports.update = async (req, res) => {

console.log("update position");

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const positionId = req.params.id_job;  // Assume the ID is passed in the URL as a parameter
    if (!positionId) {
      return res.status(400).json({ message: "Position ID is required" });
    }

    if (!req.body) {
      return res.status(400).json({ message: "Content cannot be empty!" });
    }

    try {
      // Find the position by ID
      const position = await positions.findOne({
        where: { id_job: positionId }
      });

      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }

      // Update the position with the new data
      await position.update({
        job_name: req.body.job_name,
        year_job: req.body.year_job,
        Job_degree: req.body.Job_degree,
        Job_level: req.body.Job_level,
        Job_title: req.body.Job_title,
        Job_code: req.body.Job_code,
        job_categories: req.body.job_categories,
        NBR_YEAR_FOR_JOB: req.body.NBR_YEAR_FOR_JOB
      });

      res.status(200).json({ message: "Position updated successfully" });
    } catch (err) {
      console.error('Update Position Error:', err);
      res.status(500).json({
        message: err.message || "Some error occurred while updating the position"
      });
    }
  });
};





exports.delete = async (req, res) => {


 
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const positionId = req.params.id_job;
    if (!positionId) {
      return res.status(400).json({ message: "Position ID is required" });
    }

    try {
      const position = await positions.findOne({
        where: { id_job: positionId }
      });

      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }

      await position.destroy();

      res.status(200).json({ message: "Position deleted successfully" });
    } catch (err) {
      console.error("Delete Position Error:", err);
      res.status(500).json({
        message: err.message || "Some error occurred while deleting the position"
      });
    }
  });
};
