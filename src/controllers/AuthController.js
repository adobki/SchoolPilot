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
      await redisClient.set(key, userID, EXP);
      return token;
    } catch (err) {
      return null;
    }
  }
}

module.exports = AuthController;
