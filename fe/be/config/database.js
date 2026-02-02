const mongoose = require("mssql");

const { Sequelize, DataTypes } = require('sequelize');
const connectDB = async () => {


  try {
    // mongodb connection string
    let config = {
      type: 'mssql',
      server: '102.213.182.8',
      user: 'sa', password: '@Gaja2024',
      database: 'gj',
      Port: 1433,
      //instancename: 'NAG',
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
      ,

    }

    return mongoose.connect(config, {
      useNewUrlParser: true,
      useUnifiedTopology: true,

    }).then(() => {
      console.log(`sql connected : ${config.server}, database: ${config.database}`);
    }).catch((err) => {
      console.log(`sql NOT connected : ${config.server}`);
    });







  } catch (err) {
    console.log(err);
    process.exit(1);
  }



};







module.exports = connectDB;




