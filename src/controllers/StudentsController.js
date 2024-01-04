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
const { Staff } = require('../models/staff');
const { enums } = require('../models/base');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { statuses } = enums.students;
const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

class StudentController {
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
    const userData = {
      firstName,
      email,
    };
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
      const token = await existingUser.forgotPassword();
      if (!token) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      // send mail to the user object base on the token
      await mailClient.sendToken(existingUser);
      res.status(201).json({
        message: 'Activaton token sent successfully',
        email: existingUser.email,
        token,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to signup user account' });
    }
  }

  static async activateProfile(req, res) {
    // verify token
    const { token, email, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    // check if server is up before verifying
    try {
      await dbClient.isAlive();
    } catch (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    try {
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      // check if user object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[0]) {
        return res.status(400).json({ error: 'User already verified\nPlease login' });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      const user = await existingUser.resetPassword(token, hashedPwd);
      if (user.error) {
        return res.status(404).json({ error: user.error });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(user._id.toString());
      res.status(201).json({
        message: 'Account activated successfully',
        email: existingUser.email,
        xToken,
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
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: 'update unsuccessful',
        message: 'Mandatory field emial is missing',
      });
    }
    // get the user id from the token
    const userID = await authClient.getUserID(token);
    if (!userID) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // check if server is up before verifying
    try {
      await dbClient.isAlive();
    } catch (err) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    // validate if the token and object from the request are same
    const userObj = await Student.findById({ _id: userID });
    if (!userObj) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (userObj.email !== email) {
      return res.status(401).json({ error: 'Unauthorized' });
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
      const updatedObj = Staff.updateExisting(userID, 'Student', userData);
      if (!updatedObj) {
        return res.status(400).json({ error: 'Failed to update user profile' });
      }
      res.status(201).json({
        message: 'User profile updated successfully',
        email: updatedObj.email,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  }

  static async login(req, res) {
    const { matricNo, password } = req.body;
    if (!matricNo) {
      return res.status(400).json({ error: 'Missing Matric Number' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    try {
      const userData = {
        matricNo,
        password,
      };
      if (!dbClient.isAlive()) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      const user = await Student.findOne({ matricNo });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
      if (user.status !== statuses[1]) {
        return res.status(400).json({ error: 'User not authorized' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      // set up Token based on the user authentication using this credentials
      const xToken = await authClient.createXToken(user._id.toString());
      if (!xToken) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      console.log(xToken);
      res.status(201).json({
        message: 'Login successful',
        id: user._id,
        email: user.email,
        xToken,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'Failed to login' });
    }
  }

  static async logout(req, res) {
    // logout the user
    // retrive the user token, if not found raise 401
    const token = req.get('X-Token');
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // retriee the basicAuthToken from reids
    const userID = await authClient.getUserID(token);
    if (!userID) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // retreive the user object base on the token
    if (!dbClient.isAlive()) {
      res.status(500).json({
        error: 'Database is not alive',
      });
    }
    const user = await Student.findById(userID);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // continue with sign-out logic
    // delete the user token in redis
    try {
      await authClient.deleteXToken(token);
      res.sendStatus(204).json({
        message: 'Logout successful',
      });
    } catch (error) {
      res.status(500).json({
        status: 'Redis is not alive',
        error: error.message,
      });
    }
  }
}

module.exports = StudentController;
