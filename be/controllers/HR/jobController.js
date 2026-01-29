// controllers/HR/jobController.js
const Job = require('../../models/hr/Job');
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Unauthorized" });
    req.user = decoded;
    next();
  });
};

exports.createJob = [
  verifyToken,
  async (req, res) => {
    try {
      const payload = {
        job_name: req.body.job_name,
        year_job: req.body.year_job,
        Job_degree: req.body.job_degree ?? req.body.Job_degree,
        Job_level: req.body.job_level ?? req.body.Job_level,
        Job_title: req.body.job_title ?? req.body.Job_title,
        Job_code: req.body.job_code ?? req.body.Job_code,
        job_categories: req.body.job_categories,
      };
      const job = await Job.create(payload);
      res.status(201).json({ message: 'Job created', job });
    } catch (err) {
      console.error('createJob error:', err);
      res.status(500).json({ message: 'Error creating job' });
    }
  },
];

exports.getJobs = [
  verifyToken,
  async (_req, res) => {
    try {
      const jobs = await Job.findAll();
      res.json(jobs);
    } catch (err) {
      console.error('getJobs error:', err);
      res.status(500).json({ message: 'Error fetching jobs' });
    }
  },
];
