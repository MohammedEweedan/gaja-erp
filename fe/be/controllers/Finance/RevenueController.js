const Revenue = require("../../models/Finance/Revenue"); // Adjust path and model name if needed
const jwt = require("jsonwebtoken");
const User = require("../../models/hr/user");
const Customer = require("../../models/sales/Customers");
const COAD = require("../../models/Finance/COA");
const COAC = require("../../models/Finance/COA");

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded; // pass decoded token data if needed
    next();
  });
}

// Set up associations
Revenue.belongsTo(Customer, { foreignKey: 'id_client' });
Customer.hasMany(Revenue, { foreignKey: 'id_client', useJunctionTable: false });

Revenue.belongsTo(User, { foreignKey: 'usr' });
User.hasMany(Revenue, { foreignKey: 'usr', useJunctionTable: false });

// Set up associations with alias for clarity
Revenue.belongsTo(COAD, { foreignKey: 'Debit', targetKey: 'Acc_No', as: 'DebitAccount' });
COAD.hasMany(Revenue, { foreignKey: 'Debit', targetKey: 'Acc_No', as: 'DebitAccountRevenues', useJunctionTable: false });

Revenue.belongsTo(COAC, { foreignKey: 'credit', targetKey: 'Acc_No', as: 'CreditAccount' });
COAC.hasMany(Revenue, { foreignKey: 'credit', targetKey: 'Acc_No', as: 'CreditAccountRevenues', useJunctionTable: false });


//Purchase.belongsTo(Supplier, { foreignKey: 'client', targetKey: 'id_client' });
//Supplier.hasMany(Purchase, { foreignKey: 'client', sourceKey: 'id_client' });

exports.find = [
  verifyToken,
  async (req, res) => {
    try {

      const { ps } = req.query;
      const whereCondition = {};

      if (ps) whereCondition.ps = ps;


      const includeConditions = [{
        model: Customer,
        attributes: ['client_name', 'tel_client']
      }];

      includeConditions.push({
        model: User,
        attributes: ['id_user', 'name_user', 'email']
      });



      includeConditions.push({
        model: COAD,
        as: 'DebitAccount',
        attributes: ['Acc_No', 'Name_M']
      });



      includeConditions.push({
        model: COAC,
        as: 'CreditAccount',
        attributes: ['Acc_No', 'Name_M']
      });



      const data = await Revenue.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['date', 'DESC']]
      });
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch AccountsClients Error:", dbErr);
      res.status(500).json({ message: "Error fetching records" });
    }
  }
];







exports.findClient = [
  verifyToken,
  async (req, res) => {
    try {
      const { id_client, is_watches } = req.query;
      const whereCondition = {};



      //if (ps) whereCondition.ps = ps;
      if (id_client) whereCondition.id_client = id_client;
      if (typeof is_watches !== 'undefined') {
        // Accept 'true'/'false' or 1/0 as boolean
        if (is_watches === 'true' || is_watches === '1' || is_watches === 1 || is_watches === true) {
          whereCondition.is_watches = true;
        } else if (is_watches === 'false' || is_watches === '0' || is_watches === 0 || is_watches === false) {
          whereCondition.is_watches = false;
        }
      }
      const includeConditions = [{
        model: Customer,
        attributes: ['client_name', 'tel_client']
      }];

      includeConditions.push({
        model: User,
        attributes: ['id_user', 'name_user', 'email']
      });



      includeConditions.push({
        model: COAD,
        as: 'DebitAccount',
        attributes: ['Acc_No', 'Name_M']
      });



      includeConditions.push({
        model: COAC,
        as: 'CreditAccount',
        attributes: ['Acc_No', 'Name_M']
      });


      const data = await Revenue.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['date', 'DESC']]
      });

      res.json(data);
    } catch (dbErr) {
      console.error("Fetch AccountsClients Error:", dbErr);
      res.status(500).json({ message: "Error fetching records" });
    }
  }
];


exports.create = [
  verifyToken,
  async (req, res) => {
    const {
      id_client,
      montant,
      date,
      comment,
      usr,
      id_commercial,
      commition,
      rate,
      Debit,
      IS_OK,
      ps,
      montant_currency,
      currency,
      credit,
      is_watches
    } = req.body;

    // Validate required fields (simple example)
    if (
      !date || usr == null ||
      rate == null || !Debit || ps == null ||
      montant_currency == null || !currency || !credit
    ) {
      console.log(montant, date, comment, usr,
        rate, Debit, ps, montant_currency, currency, credit

      );
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      const newRecord = await Revenue.create({
        id_client,
        montant: montant_currency * rate,
        date,
        comment,
        usr,
        id_commercial,
        commition,
        rate,
        Debit,
        IS_OK: true,
        ps,
        montant_currency,
        currency,
        credit,
        is_watches:true // optional, can be undefined
      });

      // Create journal entry in GLTran (General Ledger) - two rows: debit and credit
      const GLTran = require("../../models/Finance/GLTran");
      // Common values
      const glCommon = {
        Date: date,
        Acc_No: Debit,
        KidNoT: 'REV', // Fill as needed
        Note: comment || '',
        NUM_FACTURE: newRecord.id_acc_cli ? String(newRecord.id_acc_cli) : '',
        ENTETE: 'Revenue Transaction',
        SOURCE: 'Revenue',
        is_closed: false,
        check_number: '',
        usr,
        ref_emp: id_commercial || 0,
        num_sarf: 0,
        DATE_FACT: date,
        fl: false,
        rate: rate,
        date_effect: date,
        sor_1: 0,
        fll: false,
        original_value_cridt: 0,
        original_value_dibt: 0,
        Curr_riginal_value: currency,
        MrkzName: '',
        NUM_SARFF: '',
        CLIENT: id_client || 0,
        PS: ps || 0,
        Id_Cost_Center: 0,
        id_supp_cuss: id_client || 0,

        Cridt_Curr_A: 0,
        Dibt_Curr_A: 0,
        Cridt_Curr_B: 0,
        Dibt_Curr_B: 0
      };
      // Debit row
      await GLTran.create({
        ...glCommon,
        Acc_No: Debit,
        Dibt: montant_currency * rate,
        Cridt: 0,
        Cridt_Curr: 0,
        Dibt_Curr: montant_currency
      });
      // Credit row
      await GLTran.create({
        ...glCommon,
        Acc_No: credit,
        Dibt: 0,
        Cridt: montant_currency * rate,
        Cridt_Curr: montant_currency,
        Dibt_Curr: 0
      });

      res.status(201).json({ message: "Record created successfully", data: newRecord });
    } catch (error) {
      console.error("Create Record Error:", error);
      res.status(500).json({ message: error.message });
    }
  }
];

exports.update = [
  verifyToken,
  async (req, res) => {
    const id = req.params.id_acc_cli;
    if (!id) return res.status(400).json({ message: "ID param is required" });

    const {
      id_client,
      montant,
      date,
      comment,
      usr,
      id_commercial,
      commition,
      rate,
      Debit,
      IS_OK,
      ps,
      montant_currency,
      currency,
      credit,
      is_watches
    } = req.body;

    try {
      const record = await Revenue.findByPk(id);
      if (!record) return res.status(404).json({ message: "Record not found" });

      await record.update({
        id_client,
        montant,
        date,
        comment,
        usr,
        id_commercial,
        commition,
        rate,
        Debit,
        IS_OK,
        ps,
        montant_currency,
        currency,
        credit,
        is_watches:true
      });

      res.status(200).json({ message: "Record updated successfully", data: record });
    } catch (error) {
      console.error("Update Record Error:", error);
      res.status(500).json({ message: "Error updating record" });
    }
  }
];

exports.delete = [
  verifyToken,
  async (req, res) => {
    const id = req.params.id_acc_cli;
    if (!id) return res.status(400).json({ message: "ID param is required" });

    try {
      const record = await Revenue.findByPk(id);
      if (!record) return res.status(404).json({ message: "Record not found" });

      await record.destroy();
      res.status(200).json({ message: "Record deleted successfully" });
    } catch (error) {
      console.error("Delete Record Error:", error);
      res.status(500).json({ message: "Error deleting record" });
    }
  }
];
