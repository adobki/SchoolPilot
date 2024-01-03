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
      await dbClient.isAlive();
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

  // static async completeReg(req, res) {

  // };

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
      await dbClient.isAlive();
      const user = await Student.findOne({ matricNo });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
      if (user.status !== statuses[1]) {
        return res.status(400).json({ error: 'User not verified' });
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
      if (err.message === 'User not found') {
        res.status(404).json({ error: 'User not found' });
      } else if (err.message === 'Incorrect password') {
        res.status(401).json({ error: 'Incorrect password' });
      } else {
        res.status(500).json({ error: 'Failed to login' });
      }
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
    const key = `auth_${token}`;
    const userID = await redisClient.get(key);
    if (!userID) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // retreive the user object base on the token
    const user = await Student.findById(userID);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // continue with sign-out logic
    // delete the user token in redis
    try {
      await redisClient.del(`auth_${token}`);
      res.sendStatus(204).json({
        message: 'Logout successful',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Redis is not alive',
      });
    }
  }
}

module.exports = StudentController;
