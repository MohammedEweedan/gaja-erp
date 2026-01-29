
const employee = require("../models/employee");
const jsi = require("../models/jsi");
const Sequelize = require('sequelize')
 

var Op = Sequelize.Op


exports.find = (req, res) => {
  const { year, month } = req.body
   




  jsi.belongsTo(employee, { foreignKey: 'id_emp' });
  employee.hasMany(jsi, { foreignKey: 'ID_EMP', useJunctionTable: false });


  try {

    jsi
      .findAll({

       
        order: [[  Sequelize.cast(Sequelize.col('employee.ref_emp'), 'BIGINT'), "ASC"]],
        include: [{
          model: employee,
          attributes: ['NAME', 'ref_emp', 'COST_CENTER', 'investissement']
        }]

        ,
        // Take this and modify it to work with my timesheetController.js
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('DATE_JS')), month),
            Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('DATE_JS')), year),
          ],







        }

      })
      .then((data) => {

        res.json(data);


      })
      .catch((err) => {
        res.status(500).json("NOTexist");
      });


  }
  catch (e) {
    res.json(e + "  /fail")
  }


};