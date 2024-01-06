/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const bcrypt = require('bcrypt');
// import the user model
const { enums } = require('../models/base');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

class StaffController {
  // check both redis and db health
  static async healthCheck(req, res) {
    // check both redis and db health
    await authClient.isHealth(req, res);
  }
}

module.exports = StaffController;
