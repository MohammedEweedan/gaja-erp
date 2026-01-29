const ww = require("../models/W_W");
 
 exports.find = (req, res) => {

  try {
  ww
            .findAll({  })  .then((data) => { res.json(data);  })
            .catch((err) => {
                res.status(500).json("NOTexist");
            });
    }
    catch (e) {
        res.json(e + "  /fail")
    }
};