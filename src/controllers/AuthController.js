const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');

// token key expiration 24hrs
const EXP = 60 * 60 * 24;

class AuthController {
  // create token base of user object credentials and store it in redis
  static async createXToken(userID) {
    const token = uuidv4();
    const key = `auth_${token}`;
    try {
      await redisClient.set(key, userID, 'EX', EXP);
      return token;
    } catch (err) {
      console.error('Error creating XToken:', err);
      throw new Error('Failed to create XToken');
    }
  }

  static async getUserID(xToken) {
    try {
      const userID = await redisClient.get(xToken);
      return userID || null;
    } catch (err) {
      console.error('Error getting UserID:', err);
      throw new Error('Failed to get UserID');
    }
  }

  static async deleteXToken(xToken) {
    try {
      await redisClient.del(xToken);
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
}

module.exports = AuthController;
