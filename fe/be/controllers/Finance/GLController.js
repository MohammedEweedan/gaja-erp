// Find balances for each account (dibt-cridt & dibt_curr-cridt_curr), grouped, with COA relation
exports.find_balances = async (req, res) => {

 

  const { acc_no, lenghtleft,usr,ps   } = req.query;
 

  if (!acc_no) {
    return res.status(400).json({ error: 'Missing acc_no' });
  }
  try {
    const GLTran = require('../../models/Finance/GLTran');
    const COA = require('../../models/Finance/COA');
    const { Op, fn, col, literal } = require('sequelize');

   

    // Build where clause for LEFT(Acc_No, lenghtleft) = acc_no
    // Use Sequelize.literal for LEFT
    let whereClause = { [Op.and]: [literal(`LEFT("Acc_No", ${Number(lenghtleft)}) = '${acc_no}'`)] };
    if (usr !== undefined && usr !== null && usr !== '') {
      whereClause[Op.and].push({ usr: usr });
    }


     if (ps !== undefined && ps !== null && ps !== '') {
      whereClause[Op.and].push({ PS: ps });
    }

    const results = await GLTran.findAll({
      attributes: [
        'Acc_No',
        [fn('SUM', literal('"Dibt" - "Cridt"')), 'balance'],
        [fn('SUM', literal('"Dibt_Curr" - "Cridt_Curr"')), 'balance_curr']
      ],
      where: whereClause,
      group: ['Acc_No'],
    });

    // Inject Name_M from COA after aggregation
    const accNos = results.map(r => r.Acc_No);
    const coaRecords = await COA.findAll({
      where: { Acc_No: accNos },
      attributes: ['Acc_No', 'Name_M']
    });
    const coaMap = Object.fromEntries(coaRecords.map(c => [c.Acc_No, c.Name_M]));
    const resultsWithName = results.map(r => ({
      ...r.dataValues,
      Name_M: coaMap[r.Acc_No] || ''
    }));
    res.json(resultsWithName);
  } catch (err) {
    console.error('Error fetching balances:', err);
    res.status(500).json({ error: 'Failed to fetch balances', details: err.message });
  }
};
// Find transactions by account and period



 

 


exports.findByAccountAndPeriod = async (req, res) => {
  const { acc_no, from, to, ps } = req.query;
  if (!acc_no || !from || !to) {
    return res.status(400).json({ error: 'Missing acc_no, from, or to' });
  }
  try {
    const GLTran = require('../../models/Finance/GLTran');
    const COA = require('../../models/Finance/COA');
    const User = require('../../models/hr/user');

    // Ensure associations are defined
    if (!GLTran.associations.coa) {
      GLTran.belongsTo(COA, { foreignKey: 'Acc_No', targetKey: 'Acc_No', as: 'coa' });
    }
    if (!GLTran.associations.user) {
      GLTran.belongsTo(User, { foreignKey: 'usr', targetKey: 'id_user', as: 'user' });
    }

    const whereClause = {
      Acc_No: acc_no,
      Date: {
        [require('sequelize').Op.between]: [new Date(from), new Date(to)]
      }
    };
    if (ps !== undefined && ps !== null && ps !== '') {
      // Try to convert to number if possible
      if (!isNaN(Number(ps))) {
        whereClause.PS = Number(ps);
      } else {
        whereClause.PS = ps;
      }
    }
    const results = await GLTran.findAll({
      where: whereClause,
      order: [['Date', 'ASC']],
      include: [
        {
          model: COA,
          as: 'coa',
          attributes: ['Acc_No', 'Name_M']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id_user', 'name_user']
        }
      ]
    });
    res.json(results);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
};



const GLTran = require("../../models/Finance/GLTran");
const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    req.user = decoded;
    next();
  });
};

exports.find = [
  authenticate,
  async (req, res) => {
    try {
      const data = await GLTran.findAll();
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch GLTran Error:", dbErr);
      res.status(500).json({ message: "Error fetching General Ledger Transactions" });
    }
  }
];

exports.create = [
  authenticate,
  async (req, res) => {
    const {
      Ind,
      Acc_No,
      KidNoT,
      Date,
      Cridt,
      Dibt,
      Note,
      NUM_FACTURE,
      ENTETE,
      SOURCE,
      is_closed,
      check_number,
      usr,
      ref_emp,
      num_sarf,
      DATE_FACT,
      fl,
      Cridt_Curr,
      Dibt_Curr,
      Id_Cost_Center,
      id_supp_cuss,
      Cridt_Curr_A,
      Dibt_Curr_A,
      Cridt_Curr_B,
      Dibt_Curr_B,
      rate,
      date_effect,
      sor_1,
      fll,
      original_value_cridt,
      original_value_dibt,
      Curr_riginal_value,
      MrkzName,
      NUM_SARFF,
      CLIENT,
      PS
    } = req.body;

    if (!Acc_No || !KidNoT || !Date) {
      return res.status(400).json({ message: "Account number, KidNoT, and Date are required" });
    }

    try {
      await GLTran.create({
        Ind,
        Acc_No,
        KidNoT,
        Date,
        Cridt,
        Dibt,
        Note,
        NUM_FACTURE,
        ENTETE,
        SOURCE,
        is_closed,
        check_number,
        usr,
        ref_emp,
        num_sarf,
        DATE_FACT,
        fl,
        Cridt_Curr,
        Dibt_Curr,
        Id_Cost_Center,
        id_supp_cuss,
        Cridt_Curr_A,
        Dibt_Curr_A,
        Cridt_Curr_B,
        Dibt_Curr_B,
        rate,
        date_effect,
        sor_1,
        fll,
        original_value_cridt,
        original_value_dibt,
        Curr_riginal_value,
        MrkzName,
        NUM_SARFF,
        CLIENT,
        PS
      });
      res.status(201).json({ message: "GL Transaction created successfully" });
    } catch (error) {
      console.error("Create GLTran Error:", error);
      res.status(500).json({ message: error.message });
    }
  }
];

exports.update = [
  authenticate,
  async (req, res) => {
    const id = req.params.id; // Assuming `Ind` is your primary key
    const {
      Ind,
      Acc_No,
      KidNoT,
      Date,
      Cridt,
      Dibt,
      Note,
      NUM_FACTURE,
      ENTETE,
      SOURCE,
      is_closed,
      check_number,
      usr,
      ref_emp,
      num_sarf,
      DATE_FACT,
      fl,
      Cridt_Curr,
      Dibt_Curr,
      Id_Cost_Center,
      id_supp_cuss,
      Cridt_Curr_A,
      Dibt_Curr_A,
      Cridt_Curr_B,
      Dibt_Curr_B,
      rate,
      date_effect,
      sor_1,
      fll,
      original_value_cridt,
      original_value_dibt,
      Curr_riginal_value,
      MrkzName,
      NUM_SARFF,
      CLIENT,
      PS
    } = req.body;

    try {
      const gltran = await GLTran.findByPk(id);
      if (!gltran) return res.status(404).json({ message: "GL Transaction not found" });

      await gltran.update({
        Ind,
        Acc_No,
        KidNoT,
        Date,
        Cridt,
        Dibt,
        Note,
        NUM_FACTURE,
        ENTETE,
        SOURCE,
        is_closed,
        check_number,
        usr,
        ref_emp,
        num_sarf,
        DATE_FACT,
        fl,
        Cridt_Curr,
        Dibt_Curr,
        Id_Cost_Center,
        id_supp_cuss,
        Cridt_Curr_A,
        Dibt_Curr_A,
        Cridt_Curr_B,
        Dibt_Curr_B,
        rate,
        date_effect,
        sor_1,
        fll,
        original_value_cridt,
        original_value_dibt,
        Curr_riginal_value,
        MrkzName,
        NUM_SARFF,
        CLIENT,
        PS
      });

      res.status(200).json({ message: "GL Transaction updated successfully" });
    } catch (error) {
      console.error("Update GLTran Error:", error);
      res.status(500).json({ message: "Error updating GL Transaction" });
    }
  }
];

exports.delete = [
  authenticate,
  async (req, res) => {
    const id = req.params.id;

    try {
      const gltran = await GLTran.findByPk(id);
      if (!gltran) return res.status(404).json({ message: "GL Transaction not found" });

      await gltran.destroy();
      res.status(200).json({ message: "GL Transaction deleted successfully" });
    } catch (error) {
      console.error("Delete GLTran Error:", error);
      res.status(500).json({ message: "Error deleting GL Transaction" });
    }
  }
];
