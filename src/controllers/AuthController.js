const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

// token key expiration 24hrs
const EXP = 60 * 60 * 24;

class AuthController {
  static async isHealth(req, res) {
    // check both redis and db health
    const dbStatus = await dbClient.isAlive();
    const redisStatus = await redisClient.isAlive();
    if (!dbStatus) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    if (!redisStatus) {
      return res.status(500).json({ error: 'Redis connection failed' });
    }
    return res.status(200).json({
      message: 'Server is up and running',
      redisStatus,
      dbStatus,
    });
  }

  // create token base of user object credentials and store it in redis
  static async createXToken(userID) {
    const token = uuidv4();
    const key = `auth_${token}`;
    try {
      await redisClient.set(key, userID, EXP);
      return token;
    } catch (err) {
      console.error('Error creating XToken:', err);
      throw new Error('Failed to create XToken');
    }
  }

  static async getUserID(xToken) {
    try {
      const key = `auth_${xToken}`;
      const userID = await redisClient.get(key);
      return userID || null;
    } catch (err) {
      console.error('Error getting UserID:', err);
      throw new Error('Failed to get UserID');
    }
  }

  static async deleteXToken(xToken) {
    try {
      const key = `auth_${xToken}`;
      await redisClient.del(key);
      return;
    } catch (err) {
      console.error('Error deleting XToken:', err);
      throw new Error('Failed to delete XToken');
    }
  }

  static async verifyXToken(xToken) {
    try {
      const userID = await this.getUserID(xToken);
      if (!userID) {
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error verifying XToken:', err);
      throw new Error('Failed to verify XToken');
    }
  }

  static async checkConn(req, res) {
    // check authorization header
    if (!req.headers.authorization) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // check if Authorization header starts with Baic + space
    if (!req.headers.authorization.startsWith('Basic ')) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    // get the token
    const encryptToken = req.headers.authorization.split(' ')[1];
    if (!encryptToken) {
      res.status(401).json({
        error: 'Unauthorized',
      });
    }
    return encryptToken;
  }

  static async decodeLoginToken(token) {
    // decode the token to get the matricNo and password
    try {
      const decodedToken = (Buffer.from(token, 'base64').toString().split(':'));
      if (decodedToken.length !== 2) {
        return null;
      }
      const matricNo = decodedToken[0];
      const password = decodedToken[1];
      return { matricNo, password };
    } catch (err) {
      return null;
    }
  }

  static async decodeActivateProfileToken(token) {
    // decode the token to get the email and password
    try {
      const decodedToken = (Buffer.from(token, 'base64').toString().split(':'));
      if (decodedToken.length !== 2) {
        return null;
      }
      const email = decodedToken[0];
      const password = decodedToken[1];
      return { email, password };
    } catch (err) {
      return null;
    }
  }
}

module.exports = AuthController;
