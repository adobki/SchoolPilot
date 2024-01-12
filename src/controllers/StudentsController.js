/* eslint-disable max-len */
/* eslint-disable import/newline-after-import */
/* eslint-disable no-useless-return */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const bcrypt = require('bcrypt');
// import the user model
const { Student } = require('../models/student');
// const { Department } = require('../models/department');
// const { Faculty } = require('../models/faculty');
const { enums, ObjectId } = require('../models/base');
const dbClient = require('../utils/db');
const { statuses } = enums.students;
const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

class StudentController {
  // check both redis and db health
  static async healthCheck(req, res) {
    // check both redis and db health
    await authClient.isHealth(req, res);
  }

  // signin a new student
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
      // check if the user already exists
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({ error: 'User account doesn\'t exist, please contact admin' });
      }
      // check if user object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[0]) {
        return res.status(400).json({ error: 'User already verified\nPlease login' });
      }
      // generate the token
      const token = await existingUser.generateOTP();
      if (!token) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: 'Failed to generate activation token',
        });
      }
      // send mail to the user object base on the token
      await mailClient.sendToken(existingUser);
      return res.status(201).json({
        message: 'Activaton token sent successfully',
        email: existingUser.email,
        activationToken: token,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to signup user account' });
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
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({ error: 'Invalid token for user credentials' });
      }
      // check if user object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[0]) {
        return res.status(400).json({ error: 'User already verified\nPlease login' });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      let user = await existingUser.validateOTP(token);
      if (user.error) {
        return res.status(404).json({ error: user.error });
      }
      user = await user.changePassword(hashedPwd);
      if (!user) {
        return res.status(400).json({ error: 'Failed to activate user profile' });
      }
      // return dashboard data
      const Dashboard = await user.getDashboardData();
      if (!Dashboard) {
        res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(user.id);
      if (!xToken) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      return res.status(201).json({
        message: 'Account activated successfully',
        email: existingUser.email,
        xToken,
        Dashboard,
      });
      // needed for the user profile activation
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }

  static async updateProfile(req, res) {
    // verify token passed is linked to an active user
    // extract the token from the header X-Token
    const token = req.get('X-Token');
    if (!token) {
      return res.status(401).json({
        error: 'Token credential is Unauthorized',
      });
    }
    // get the user id from the redis client
    const userID = await authClient.getUserID(token);
    if (userID.error) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: userID.error,
      });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    // validate if the token and object from the request are same
    const userObj = await Student.findById({ _id: userID });
    if (!userObj) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: 'Token is not linked to any user account',
      });
    }
    // update the user profile
    // Get the updated attributes from the request body
    const userData = {};
    // extract all the attributes from the request body
    for (const [key, value] of Object.entries(req.body)) {
      userData[key] = value;
    }
    // update the user profile
    try {
      const updatedObj = await userObj.updateProfile(userData);
      if (!updatedObj) {
        return res.status(400).json({ error: 'Failed to update user profile' });
      }
      const DashBoard = await updatedObj.getDashboardData();
      if (!DashBoard) {
        res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'User profile updated successfully',
        email: updatedObj.email,
        xToken: token,
        DashBoard,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update user profile' });
    }
  }

  static async login(req, res) {
    const encryptToken = await authClient.checkConn(req, res);
    if (encryptToken.error) {
      return res.status(400).json({ error: encryptToken.error });
    }
    const decodeLogin = await authClient.decodeLoginToken(encryptToken);
    if (decodeLogin.error) {
      return res.status(400).json({ error: decodeLogin.error });
    }
    const { matricNo, password } = decodeLogin;
    if (!matricNo) {
      return res.status(400).json({ error: 'Missing Matric Number' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    try {
      if (!dbClient.isAlive()) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      const user = await Student.findOne({ matricNo });
      if (!user) {
        return res.status(400).json({ error: 'MatricNo not linked to any user' });
      }
      if (user.status !== statuses[1]) {
        return res.status(400).json({ error: 'User not authorized\nPlease activate account' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      // set up Token based on the user authentication using this credentials
      const xToken = await authClient.createXToken(user.id);
      if (xToken.error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: xToken.error,
        });
      }
      // const { stdData, dptData, facData, courseData } = await authClient.DashboardData(user);
      const Dashboard = await user.getDashboardData();
      if (!Dashboard) {
        res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Login successful',
        email: user.email,
        xToken,
        Dashboard,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to login' });
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
    const user = await Student.findById(ID);
    if (!user) {
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
    const { email, matricNo } = req.body;
    if (!email && !matricNo) {
      return res.status(400).json({
        error: 'Missing email or matricNo',
      });
    }
    // Code to handle when either email or matricNo is provided
    if (email && matricNo) {
      // Both email and matricNo are provided
      const user = await Student.findOne({ email, matricNo });
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (user.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await user.generateOTP();
      if (!resetToken) {
        return res.status(500).json({
          error: 'Internal Server Error',
        });
      }
      try {
        await mailClient.sendToken(user);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: user.email,
        resetToken,
      });
    } if (email) {
      // Only email is provided
      const user = await Student.findOne({ email });
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (user.status !== statuses[1]) {
        res.status(400).json({
          error: 'User not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await user.generateOTP();
      try {
        await mailClient.sendToken(user);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: user.email,
        resetToken,
      });
    } if (matricNo) {
      // Only matricNo is provided
      const user = await Student.findOne({ matricNo });
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (user.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
        });
      }
      // Generate and send password reset token
      const resetToken = await user.generateOTP();
      try {
        await mailClient.sendToken(user);
      } catch (err) {
        res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(200).json({
        message: 'Password reset token sent',
        email: user.email,
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
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      // check if user object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[1]) {
        return res.status(400).json({ error: 'User not verified\nPlease signin' });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      let user = await existingUser.validateOTP(token);
      if (user.error) {
        return res.status(404).json({ error: user.error });
      }
      user = await user.changePassword(hashedPwd);
      if (!user) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      // check if server is up before verifying
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      const DashBoard = await user.getDashboardData();
      if (!DashBoard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(user.id);
      return res.status(201).json({
        message: 'Password reset successfully',
        email: user.email,
        xToken,
        DashBoard,
      });
      // needed for the user profile activation
    } catch (err) {
      console.error(err);
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
    const user = await Student.findById(ID);
    if (!user) {
      return res.status(404).json({ error: 'User Object not found' });
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
    // check if user object profile is already activated, if true redirect to login instead
    if (user.status !== statuses[1]) {
      return res.status(400).json({ error: 'User not verified\nPlease signin' });
    }
    // compare old password to the hashed password in the database
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid old password' });
    }
    // hash the password using bcrypt
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    try {
      const updatedUser = await user.changePassword(hashedPwd);
      if (updatedUser.error) {
        return res.status(400).json({ error: updatedUser.error });
      }
      const DashBoard = await updatedUser.getDashboardData();
      if (!DashBoard) {
        return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Password changed successfully',
        email: updatedUser.email,
        xToken,
        DashBoard,
      });
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
}

module.exports = StudentController;
