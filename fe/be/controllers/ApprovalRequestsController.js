// Get pending approval requests, messageCount, and playGoldSound flag



const ApprovalRequests = require('../models/Outils/ApprovalRequests');
const { Op } = require('sequelize');


function ensureAuthenticated(req, res) {
  if (req.user) {
    return req.user;
  }
  res.status(401).json({ message: "Unauthorized" });
  return null;
}

exports.find = async (req, res) => {


  try {
    // Only fetch requests with status 'pending'
    const data = await ApprovalRequests.findAll({
      where: { status: 'pending' }
    });
    res.json({
      messageCount: data.length,
      data
    });

  } catch (dbErr) {
    res.status(500).json({ message: "Error fetching Approval Requests" });
  }
};


exports.findNotification = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;


  try {
    // Only fetch requests with status 'pending'
    const data = await ApprovalRequests.findAll({
      where: {
        status: { [Op.ne]: 'pending' },
        Is_view: false,
        usr: user.id // Assuming the user ID is stored in the token
      }
    });
    res.json({
      messageCount: data.length,
      data
    });

  } catch (dbErr) {
    res.status(500).json({ message: "Error fetching Approval Requests" });
  }
};


exports.create = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;
  const {
    request_by,
    date_request,
    type_request,
    status,
    approuved_by,
    date_approval,
    Notes,
    AutoComment,
    time_request, Refrences_Number, usr
  } = req.body;

  if (!request_by || !date_request || !type_request) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await ApprovalRequests.create({
      request_by,
      date_request,
      type_request,
      status,
      approuved_by,
      date_approval,
      Notes,
      AutoComment,
      time_request,
      Refrences_Number,
      // Ensure notifications can be retrieved by the same authenticated user.
      usr: (usr !== undefined && usr !== null && usr !== "") ? usr : user.id,
      Is_view: false
    });
    res.status(201).json({ message: "Approval request created successfully" });
  } catch (error) {
    console.error("Create ApprovalRequest Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get latest approval request for a given reference number (Invoice) for the authenticated user.
exports.findLatestByReference = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;
  const ref = req.params.ref;
  const type = req.query.type || 'Invoice';
  if (!ref) return res.status(400).json({ message: 'Missing reference number' });
  try {
    const data = await ApprovalRequests.findAll({
      where: {
        Refrences_Number: ref,
        type_request: type,
        usr: user.id,
      },
      order: [['IDApprovalRequests', 'DESC']],
      limit: 1,
    });
    res.json({ data: data && data.length ? data[0] : null });
  } catch (dbErr) {
    res.status(500).json({ message: 'Error fetching Approval Request by reference' });
  }
};

exports.update = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;
  const id = req.params.id; // Assuming IDApprovalRequests is your primary key
  const {
    request_by,
    date_request,
    type_request,
    status,
    approuved_by,
    date_approval,
    Notes,
    AutoComment,
    time_request, Refrences_Number, usr, Is_view
  } = req.body;
  console.log("Update ApprovalRequest Request Body:", req.body);
  try {
    const approvalRequest = await ApprovalRequests.findByPk(id);
    if (!approvalRequest) return res.status(404).json({ message: "Approval request not found" });

    await approvalRequest.update({
      request_by,
      date_request,
      type_request,
      status,
      approuved_by,
      date_approval,
      Notes,
      AutoComment,
      time_request, Refrences_Number, usr, Is_view
    });

    // If type_request is 'Watch Purchase', update the related watch
    if ((type_request || approvalRequest.type_request) === 'Watch Purchase' && (Refrences_Number || approvalRequest.Refrences_Number)) {
      try {
        const WachtchesOriginalAchat = require("../models/Purchase/WachtchesOriginalAchat");
        const id_achat = Refrences_Number || approvalRequest.Refrences_Number;
        const watchUpdate = {
          IsApprouved: status === 'accepted' ? 'Accepted' : (status === 'refused' ? 'Refused' : status),
          Approval_Date: date_approval || new Date(),
          ApprouvedBy: approuved_by || null,
        };
        const [affected] = await WachtchesOriginalAchat.update(watchUpdate, { where: { id_achat } });
        if (affected === 0) {
          console.warn('No Watch record updated for id_achat:', id_achat);
        }
      } catch (err) {
        console.error('Error updating related Watch Purchase:', err);
      }
    }

    res.status(200).json({ message: "Approval request updated successfully" });
  } catch (error) {
    console.error("Update ApprovalRequest Error:", error);
    res.status(500).json({ message: "Error updating approval request" });
  }
};
