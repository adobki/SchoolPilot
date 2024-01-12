/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const bcrypt = require('bcrypt');
// import the staff model
const { enums } = require('../models/base');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { Staff } = require('../models/staff');
const { Student } = require('../models/student');

const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

const { statuses } = enums.staff;

class StaffController {
  // check both redis and db health
  static async healthCheck(req, res) {
    // check both redis and db health
    await authClient.isHealth(req, res);
  }

  // signin a new staff
  static async signin(req, res) {
    // signup a new student
    const { firstName, email } = req.body;
    if (!firstName) {
      return res.status(400).json({ error: 'Missing firstname' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    try {
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      // check if the staff already exists
      const existingStaff = await Staff.findOne({ email });
      if (!existingStaff) {
        return res.status(400).json({ error: 'Staff account doesn\'t exist, please contact admin' });
      }
      // check if staff object profile is already activated, if true redirect to login instead
      if (existingStaff.status !== statuses[0]) {
        return res.status(400).json({ error: 'Staff already verified\nPlease login' });
      }
      // generate the token
      const token = await existingStaff.generateOTP();
      if (!token) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: 'Failed to generate activation token',
        });
      }
      // send mail to the staff object base on the token
      await mailClient.sendToken(existingStaff);
      return res.status(201).json({
        message: 'Activaton token sent successfully',
        email: existingStaff.email,
        activationToken: token,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to signup staff account' });
    }
  }

  static async activateProfile(req, res) {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing activation token' });
    }
    const encryptToken = await authClient.checkConn(req, res);
    if (encryptToken.error) {
      return res.status(400).json({ error: encryptToken.error });
    }
    const fchk = await authClient.decodeActivateProfileToken(encryptToken);
    if (fchk.error) {
      return res.status(400).json({ error: fchk.error });
    }
    const { email, password } = fchk;
    if (!email) {
      return res.status(400).json({ error: 'Missing email from the encryption' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password from the encryption' });
    }
    try {
      // check if server is up before verifying
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      const existingStaff = await Staff.findOne({ email });
      if (!existingStaff) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      // check if staff object profile is already activated, if true redirect to login instead
      if (existingStaff.status !== statuses[0]) {
        return res.status(400).json({ error: 'Staff already verified\nPlease login' });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      let staff = await existingStaff.validateOTP(token);
      if (staff.error) {
        return res.status(404).json({ error: staff.error });
      }
      staff = await staff.changePassword(hashedPwd);
      if (!staff) {
        return res.status(400).json({ error: 'Failed to activate staff profile' });
      }
      // return dashboard data
      const Dashboard = await staff.getDashboardData();
      if (!Dashboard) {
        res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(staff.id);
      if (!xToken) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      return res.status(201).json({
        message: 'Account activated successfully',
        email: existingStaff.email,
        xToken,
        Dashboard,
      });
      // needed for the staff profile activation
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }

  static async login(req, res) {
    const encryptToken = await authClient.checkConn(req, res);
    if (encryptToken.error) {
      return res.status(400).json({ error: encryptToken.error });
    }
    const decodeLogin = await authClient.staffDecodeLoginToken(encryptToken);
    if (decodeLogin.error) {
      return res.status(400).json({ error: decodeLogin.error });
    }
    const { staffId, password } = decodeLogin;
    if (!staffId) {
      return res.status(400).json({ error: 'Missing Staff ID' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    try {
      if (!dbClient.isAlive()) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      const staff = await Staff.findOne({ staffId });
      if (!staff) {
        return res.status(400).json({ error: 'Staff not found' });
      }
      if (staff.status !== statuses[1]) {
        return res.status(400).json({ error: 'Staff not authorized\nPlease activate account first' });
      }
      const isMatch = await bcrypt.compare(password, staff.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      // set up Token based on the staff authentication using this credentials
      const xToken = await authClient.createXToken(staff.id);
      if (xToken.error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: xToken.error,
        });
      }
      const Dashboard = await staff.getDashboardData();
      if (!Dashboard) {
        res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Login successful',
        email: staff.email,
        xToken,
        Dashboard,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to login' });
    }
  }

  static async updateProfile(req, res) {
    // verify token passed is linked to an active staff
    // extract the token from the header X-Token
    const token = req.get('X-Token');
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // get the staff id from the redis client
    const staffId = await authClient.getUserID(token);
    if (!staffId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // check if server is up before verifying
    try {
      await dbClient.isAlive();
    } catch (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    // validate if the token and object from the request are same
    const staff = await Staff.findById({ _id: staffId });
    if (!staff) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // update the staff profile
    // Get the updated attributes from the request body
    const staffData = {};
    // extract all the attributes from the request body
    for (const [key, value] of Object.entries(req.body)) {
      staffData[key] = value;
    }
    // update the staff profile
    try {
      const updatedObj = await staff.updateProfile(staffData);
      if (!updatedObj) {
        return res.status(400).json({ error: 'Failed to update staff profile' });
      }
      return res.status(201).json({
        message: 'Staff profile updated successfully',
        email: updatedObj.email,
        xToken: token,
        Data: updatedObj,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update staff profile' });
    }
  }

  static async logout(req, res) {
    let rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.staus(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const staff = await Staff.findById(ID);
    if (!staff) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }
    rdfxn = await authClient.deleteXToken(xToken);
    if (rdfxn.success) {
      return res.status(201).json({
        message: 'Logout successful',
      });
    }
    if (rdfxn.error) {
      return res.status(500).json({
        status: 'Redis is not alive',
        error: rdfxn.error,
      });
    }
  }

  static async setResetPassword(req, res) {
    // check if the email is valid
    const { email, staffId } = req.body;
    if (!email && !staffId) {
      return res.status(400).json({
        error: 'Missing email or staffId',
      });
    }
    // Code to handle when either email or staffId is provided
    if (email && staffId) {
      // Both email and staffId are provided
      const staff = await Staff.findOne({ email, staffId });
      if (!staff) {
        return res.status(404).json({
          error: 'Staff not found',
        });
      }
      if (staff.status !== statuses[1]) {
        return res.status(400).json({
          error: 'Staff not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await staff.generateOTP();
      if (!resetToken) {
        return res.status(500).json({
          error: 'Internal Server Error',
        });
      }
      try {
        await mailClient.sendToken(staff);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: staff.email,
        resetToken,
      });
    }
    if (email) {
      // Only email is provided
      const staff = await Staff.findOne({ email });
      if (!staff) {
        return res.status(404).json({
          error: 'Staff not found',
        });
      }
      if (staff.status !== statuses[1]) {
        return res.status(400).json({
          error: 'Staff not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await staff.generateOTP();
      try {
        await mailClient.sendToken(staff);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: staff.email,
        resetToken,
      });
    }
    if (staffId) {
      // Only matricNo is provided
      const staff = await Staff.findOne({ staffId });
      if (!staff) {
        return res.status(404).json({
          error: 'Staff not found',
        });
      }
      if (staff.status !== statuses[1]) {
        return res.status(400).json({
          error: 'Staff not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await staff.generateOTP();
      try {
        await mailClient.sendToken(staff);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(200).json({
        message: 'Password reset token sent',
        email: staff.email,
        resetToken,
      });
    }
  }

  static async setNewPassword(req, res) {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    const encryptToken = await authClient.checkConn(req, res);
    if (encryptToken.error) {
      return res.status(400).json({ error: encryptToken.error });
    }
    const authFxn = await authClient.decodeActivateProfileToken(encryptToken);
    if (authFxn.error) {
      return res.status(400).json({ error: authFxn.error });
    }
    const { email, password } = authFxn;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    try {
      // check if server is up before verifying
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      const existingStaff = await Staff.findOne({ email });
      if (!existingStaff) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      // check if staff object profile is already activated, if true redirect to login instead
      if (existingStaff.status !== statuses[1]) {
        return res.status(400).json({ error: 'Staff not verified\nPlease signin' });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      let staff = await existingStaff.validateOTP(token);
      if (staff.error) {
        return res.status(404).json({ error: staff.error });
      }
      staff = await staff.changePassword(hashedPwd);
      if (!staff) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      // check if server is up before verifying
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      const DashBoard = await staff.getDashboardData();
      if (!DashBoard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(staff.id);
      return res.status(201).json({
        message: 'Password reset successfully',
        email: staff.email,
        xToken,
        DashBoard,
      });
      // needed for the staff profile activation
    } catch (err) {
      console.log(err);
      return res.status(400).json({ error: err });
    }
  }

  static async setChangePassword(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.staus(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const staff = await Staff.findById(ID);
    if (!staff) {
      return res.status(404).json({ error: 'Staff Object not found' });
    }
    const { email, oldPassword, newPassword } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!oldPassword) {
      return res.status(400).json({ error: 'Missing old password' });
    }
    if (!newPassword) {
      return res.status(400).json({ error: 'Missing new password' });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    // check if staff object profile is already activated, if true redirect to login instead
    if (staff.status !== statuses[1]) {
      return res.status(400).json({ error: 'Staff not verified\nPlease signin' });
    }
    // compare old password to the hashed password in the database
    const isMatch = await bcrypt.compare(oldPassword, staff.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid old password' });
    }
    // hash the password using bcrypt
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    try {
      const updatedStaff = await staff.changePassword(hashedPwd);
      if (updatedStaff.error) {
        return res.status(400).json({ error: updatedStaff.error });
      }
      const DashBoard = await updatedStaff.getDashboardData();
      if (!DashBoard) {
        return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Password changed successfully',
        email: updatedStaff.email,
        xToken,
        DashBoard,
      });
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
}

module.exports = StaffController;
