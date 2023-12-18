/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const bcrypt = require('bcrypt');
// import the user model
const User = require('../models/user');
const dbClient = require('../utils/db'); // Make sure to import your DB client
// create a clsss UserController

class UserController {
  static async signup(req, res) {
    // signup a new user
    const { username, email, password } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const hashedPwd = await bcrypt.hash(password, 10);
    const userData = {
      username,
      email,
      password: hashedPwd,
    };
    try {
      await dbClient.isAlive();
      // check if the user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }
      const user = await User.createUser(userData);
      res.status(201).json({ id: user._id, email: user.email });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    try {
      const userData = {
        email,
        password,
      };
      await dbClient.isAlive();
      const user = await User.loginUser(userData);
      res.status(200).json({
        message: 'Login successful',
        id: user._id,
        email: user.email,
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

  // get all the user document in the DB
  static async getAllUser(req, res) {
    // db connection is active
    await dbClient.isAlive();
    try {
      const allUser = await User.find();
      res.status(200).json({ data: allUser });
    } catch (err) {
      res.status(500).json({ error: 'Operation Failed' });
    }
  }
}

// export the class
module.exports = UserController;
