const Expenses = require("../../models/Finance/Expenses"); // Use Expenses model
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

// Associations (adjust as needed for Expenses model)
Expenses.belongsTo(Customer, { foreignKey: 'client' });
Customer.hasMany(Expenses, { foreignKey: 'client', useJunctionTable: false });

Expenses.belongsTo(User, { foreignKey: 'usr' });
User.hasMany(Expenses, { foreignKey: 'usr', useJunctionTable: false });

Expenses.belongsTo(COAD, { foreignKey: 'Account_number1', targetKey: 'Acc_No' });
COAD.hasMany(Expenses, { foreignKey: 'Account_number1', sourceKey: 'Acc_No', useJunctionTable: false });

Expenses.belongsTo(COAC, { foreignKey: 'Account_number2', targetKey: 'Acc_No' });
COAC.hasMany(Expenses, { foreignKey: 'Account_number2', sourceKey: 'Acc_No', useJunctionTable: false });

exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const { ps } = req.query;

      const whereCondition = {};
      if (ps) whereCondition.PS = ps;
      const includeConditions = [
        { model: Customer, attributes: ['client_name', 'tel_client'] },
        { model: User, attributes: ['id_user', 'name_user', 'email'] },
        { model: COAD, attributes: ['Acc_No', 'Name_M'] },
        { model: COAC, attributes: ['Acc_No', 'Name_M'] }
      ];
      const data = await Expenses.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['date_trandsaction', 'DESC']]
      });
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Expenses Error:", dbErr);
      res.status(500).json({ message: "Error fetching records" });
    }
  }
];

exports.create = [
  verifyToken,
  async (req, res) => {
    let {
      date_trandsaction,
      Note,
      Project,
      Account_number1,
      Account_number2,
      montant,
      num_sarf,
      NUM_FACTURE,
      En_tete,
      NUM_CHECK,
      IS_OK,
      ref_emp,
      usr,
      id_supp_cuss,
      Cost_center,
      Note_en,
      sor,
      Elements,
      rate,
      montant_net,
      client,
      ps
    } = req.body;
    // Ensure date_trandsaction is a valid date string
    if (!date_trandsaction || isNaN(Date.parse(date_trandsaction))) {
      date_trandsaction = new Date().toISOString().split('T')[0];
    }
    if (!date_trandsaction || usr == null || rate == null || !Account_number1 || ps == null || montant == null || client == null) {
      console.log(date_trandsaction, usr, rate, Account_number1, ps, montant, client);
      return res.status(400).json({ message: "Missing required fields" });
    }
    try {
      const newRecord = await Expenses.create({
        date_trandsaction,
        Note,
        Project,
        Account_number1,
        Account_number2,
        montant,
        num_sarf,
        NUM_FACTURE,
        En_tete,
        NUM_CHECK,
        IS_OK: true,
        ref_emp,
        usr,
        id_supp_cuss,
        Cost_center,
        Note_en,
        sor,
        Elements,
        rate,
        montant_net,
        client,
        PS: ps
      });

      // Create journal entry in GLTran (General Ledger) - two rows: debit and credit
      const GLTran = require("../../models/Finance/GLTran");
      // Common values
      const glCommon = {
        Date: date_trandsaction,
        Acc_No: Account_number1,
        KidNoT: '', // Fill as needed
        Note: Note || '',
        NUM_FACTURE: NUM_FACTURE || '',
        ENTETE: En_tete || '',
        SOURCE: 'Expense',
        is_closed: false,
        check_number: NUM_CHECK || '',
        usr,
        ref_emp: ref_emp || 0,
        num_sarf: num_sarf || 0,
        DATE_FACT: date_trandsaction,
        fl: false,
        rate: rate || 1,
        date_effect: date_trandsaction,
        sor_1: sor || 0,
        fll: false,
        original_value_cridt: 0,
        original_value_dibt: 0,
        Curr_riginal_value: '',
        MrkzName: '',
        NUM_SARFF: '',
        CLIENT: client || 0,
        PS: ps || 0,
        Id_Cost_Center: Cost_center || 0,
        id_supp_cuss: id_supp_cuss || 0,
        Cridt_Curr: 0,
        Dibt_Curr: 0,
        Cridt_Curr_A: 0,
        Dibt_Curr_A: 0,
        Cridt_Curr_B: 0,
        Dibt_Curr_B: 0
      };
      // Debit row
      await GLTran.create({
        ...glCommon,
        Acc_No: Account_number1,
        Dibt: montant_net,
        Cridt: 0,
        Cridt_Curr: 0,
        Dibt_Curr: montant 
      });
      // Credit row
      await GLTran.create({
        ...glCommon,
        Acc_No: Account_number2,
        Dibt: 0,
        Cridt: montant_net,

        Cridt_Curr: montant,
        Dibt_Curr: 0
      });

      res.status(201).json({ message: "Expense created successfully", data: newRecord });
    } catch (error) {
      console.error("Create Expense Error:", error);
      res.status(500).json({ message: error.message });
    }
  }
];

exports.update = [
  verifyToken,
  async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "ID param is required" });
    let {
      date_trandsaction,
      Note,
      Project,
      Account_number1,
      Account_number2,
      montant,
      num_sarf,
      NUM_FACTURE,
      En_tete,
      NUM_CHECK,
      IS_OK,
      ref_emp,
      usr,
      id_supp_cuss,
      Cost_center,
      Note_en,
      sor,
      Elements,
      rate,
      montant_net,
      client,
      ps
    } = req.body;
    // Ensure date_trandsaction is a valid date string
    if (!date_trandsaction || isNaN(Date.parse(date_trandsaction))) {
      date_trandsaction = new Date().toISOString().split('T')[0];
    }
    try {
      const record = await Expenses.findByPk(id);
      if (!record) return res.status(404).json({ message: "Expense not found" });
      await record.update({
        date_trandsaction,
        Note,
        Project,
        Account_number1,
        Account_number2,
        montant,
        num_sarf,
        NUM_FACTURE,
        En_tete,
        NUM_CHECK,
        IS_OK,
        ref_emp,
        usr,
        id_supp_cuss,
        Cost_center,
        Note_en,
        sor,
        Elements,
        rate,
        montant_net,
        client,
        ps
      });
      res.status(200).json({ message: "Expense updated successfully", data: record });
    } catch (error) {
      console.error("Update Expense Error:", error);
      res.status(500).json({ message: "Error updating expense" });
    }
  }
];

exports.delete = [
  verifyToken,
  async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "ID param is required" });
    try {
      const record = await Expenses.findByPk(id);
      if (!record) return res.status(404).json({ message: "Expense not found" });
      await record.destroy();
      res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete Expense Error:", error);
      res.status(500).json({ message: "Error deleting expense" });
    }
  }
];
