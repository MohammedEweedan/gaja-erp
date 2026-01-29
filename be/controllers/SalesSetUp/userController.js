
const user = require("../../models/hr/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require('dotenv').config();
const employee = require("../../models/hr/employee");
// Login
exports.login = async (req, res) => {

  const { email, password } = req.body;
  user.belongsTo(employee, { foreignKey: 'ref_emp' });
  employee.hasMany(user, { foreignKey: 'ref_emp', useJunctionTable: false });

console.log(email,password)

  try {
    const data = await user.findOne({
      include: [{
        model: employee,
        attributes: ['ID_EMP', 'NAME', 'Ref_emp', 'Picture', 'investissement']
      }],

      where: { email: email }
    }) ;

    if (!data) {
      return res.status(404).json({ message: "User not found" });
    }




 


    // const isMatch = await bcrypt.compare(password, data.password);

    if (password === data.password) {
      isMatch = true;
    }
    else {
      isMatch = false;
    }


    if (!isMatch) {



      return res.status(401).json({ message: "Invalid password" });
    }

    else {



      // Create JWT token
      const token = jwt.sign(
        {
          id: data.id_user,
          email: data.email,
          name: data.name_user,
          roles: data.Roles,
          actived: data.actived,
          Action_user: data.Action_user
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
 
      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id_user: data.id_user,
          name_user: data.name_user,
          name: data.name,
          email: data.email,  // Changed from login_user to email
          job: data.job,
          actived: data.actived,
          Roles: data.Roles,
          ref_emp: data.ref_emp,
          InventoryCode: data.InventoryCode,
          LinkP: data.LinkP,
          ps: data.ps,
          Action_user: data.Action_user
        },
        employee: data.EMPLOYEE // Pass the associated employee object at the top level
      });
    }





  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });

    console.log(error.message);
  }
};







exports.loginMobile = (req, res) => {
  const { email, password } = req.body

  user.belongsTo(employee, { foreignKey: 'ref_emp' });
  employee.hasMany(user, { foreignKey: 'ref_emp', useJunctionTable: false });

  try {
    user
      .findOne({
        include: [{
          model: employee,
          attributes: ['ID_EMP', 'NAME', 'Ref_emp', 'Picture', 'investissement']
        }],
        where: { name: email, password: password }
      })
      .then((data) => {
        if (!data) {
          res.status(404).json({ message: `NOTexist` });
        } else {
          // Create JWT token
          const token = jwt.sign(
            {
              id: data.id_user,
              email: data.email,
              name: data.name_user,
              roles: data.Roles,
              actived: data.actived,
              Action_user: data.Action_user
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
          );
          res.status(200).json({
            message: "Login successful",
            token,
            user: {
              id_user: data.id_user,
              name_user: data.name_user,
              name: data.name,
              email: data.email,
              job: data.job,
              actived: data.actived,
              Roles: data.Roles,
              ref_emp: data.ref_emp,
              InventoryCode: data.InventoryCode,
              LinkP: data.LinkP,
              ps: data.ps,
              Action_user: data.Action_user
            },
            employee: data.EMPLOYEE
          });
        }
      })
      .catch((err) => {
        res.status(500).json("NOTexist");
      });
  }
  catch (e) {
    res.json("fail")
  }


};





 



const User = require("../../models/hr/user");
exports.updateUserProfile = async (req, res) => {
  try {
    const { id_employee, name, name_user, password } = req.body;
    if (!id_employee) {
      return res.status(400).json({ message: 'id_employee is required' });
    }
    // Find the user by ref_emp
    const user = await User.findOne({ where: { ref_emp: id_employee } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (name_user !== undefined) user.name_user = name_user;
    if (password !== undefined) user.password = password;
    await user.save();
    return res.status(200).json({ success: true, message: 'User profile updated', user });
  } catch (e) {
    console.error('Error updating user profile:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};


exports.getUserList = async (req, res) => {



  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    try {
      const data = await User.findAll({
      attributes: ["id_user", "name_user","ps"]
    });

      res.json(data);
    } catch (dbErr) {
      console.error("Fetch Vendors Error:", dbErr);
      res.status(500).json({ message: "Error fetching vendors" });
    }
  });




  
};

