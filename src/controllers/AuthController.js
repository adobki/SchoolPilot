/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
const { Staff } = require('../models/staff');

const models = ['Faculty', 'Department', 'Course', 'Project', 'Record', 'Staff', 'Student', 'Schedule', 'Record'];
// const { Student } = require('../models/student');

// token key expiration 24hrs
const EXP = 60 * 60 * 24;

/**
 * AuthController class responsible for handling authentication-related operations.
 */
class AuthController {
  /**
   * Check the health status of the server.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The health status of the server.
   */
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
    const portal = req.originalUrl.split('/')[3];
    return res.status(200).json({
      portal,
      message: 'Server is up and running',
      redisStatus,
      dbStatus,
    });
  }

  /**
   * Generate health status for multiple portals.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @param {Array} portals - The list of portals to check.
   * @returns {Object} - The health status of each portal.
   */
  static async genHealth(req, res, portals) {
    // loop through each url in the list
    const data = [];
    for (const portal of portals) {
      // check both redis and db health
      const dbStatus = await dbClient.isAlive();
      const redisStatus = await redisClient.isAlive();
      if (!dbStatus) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      if (!redisStatus) {
        return res.status(500).json({ error: 'Redis connection failed' });
      }
      data.push({
        portal,
        message: 'Server is up and running',
        redisStatus,
        dbStatus,
      });
    }
    return res.status(200).json(data);
  }

  /**
   * Create a token based on user ID and store it in Redis.
   * @param {string} userID - The user ID.
   * @returns {string|Object} - The generated token or an error object.
   */
  // create token base of user object credentials and store it in redis
  static async createXToken(userID) {
    const token = uuidv4();
    const key = `auth_${token}`;
    try {
      await redisClient.set(key, userID, EXP);
      return token;
    } catch (err) {
      console.error('Error creating XToken:', err);
      return ({ error: 'Failed to create XToken' });
    }
  }

  /**
   * Get the user ID associated with the given token from Redis.
   * @param {string} xToken - The token.
   * @returns {string|Object} - The user ID or an error object.
   */
  static async getUserID(xToken) {
    const key = `auth_${xToken}`;
    const userID = await redisClient.get(key);
    if (!userID) {
      return ({ error: 'Failed to get UserID' });
    }
    return userID;
  }

  /**
   * Delete the token from Redis.
   * @param {string} xToken - The token to delete.
   * @returns {Object} - The result of the deletion operation.
   */
  static async deleteXToken(xToken) {
    try {
      const key = `auth_${xToken}`;
      await redisClient.del(key);
      return { success: true };
    } catch (err) {
      console.error('Error deleting XToken:', err);
      return ({ error: 'Failed to delete XToken' });
    }
  }

  /**
   * Verify the validity of the given token.
   * @param {string} xToken - The token to verify.
   * @returns {boolean} - True if the token is valid, false otherwise.
   * @throws {Error} - If there is an error verifying the token.
   */
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

  /**
   * Check the authorization header for basic authentication.
   * @param {Object} req - The request object.
   * @returns {string|Object} - The encrypted token or an error object.
   */
  static async checkConn(req) {
    // check authorization header
    if (!req.headers.authorization) {
      return { error: 'Basic Authorization header is required' };
    }
    // check if Authorization header starts with Basic + space
    if (!req.headers.authorization.startsWith('Basic ')) {
      return { error: 'Authorization Header encryption improperly formatted' };
    }
    // get the token
    const encryptToken = req.headers.authorization.split(' ')[1];
    if (!encryptToken) {
      return { error: 'Encrypted information not found' };
    }
    return encryptToken;
  }

  /**
   * Check the current connection for valid X-Token.
   * @param {Object} req - The request object.
   * @returns {Object} - The user ID and X-Token or an error object.
   */
  static async checkCurrConn(req) {
    // retrive the user token, if not found raise 401
    const xToken = req.get('X-Token');
    if (!xToken) {
      return ({ error: 'X-Token is required in the header' });
    }
    // retriee the basicAuthToken from reids
    const ID = await this.getUserID(xToken);
    if (ID.error) {
      return ({ error: 'X-Token credentials is not associted with any object' });
    }
    return { ID, xToken };
  }

  /**
   * Decode the login token to get the matricNo and password.
   * @param {string} token - The login token.
   * @returns {Object} - The decoded matricNo and password or an error object.
   */
  static async decodeLoginToken(token) {
    // decode the token to get the matricNo and password
    const decodedToken = (Buffer.from(token, 'base64').toString().split(':'));
    if (decodedToken.length !== 2) {
      return ({ error: 'Inconsistent Encryption Algorithm, ensure Base64 encryption' });
    }
    const matricNo = decodedToken[0];
    const password = decodedToken[1];
    return { matricNo, password };
  }

  /**
   * Decode the staff login token to get the staffId and password.
   * @param {string} token - The staff login token.
   * @returns {Object} - The decoded staffId and password or an error object.
   */
  static async staffDecodeLoginToken(token) {
    // decode the token to get the matricNo and password
    const decodedToken = (Buffer.from(token, 'base64').toString().split(':'));
    if (decodedToken.length !== 2) {
      return ({ error: 'Inconsistent Encryption Algorithm, ensure Base64 encryption' });
    }
    const staffId = decodedToken[0];
    const password = decodedToken[1];
    return { staffId, password };
  }

  /**
   * Decode the activation profile token to get the email and password.
   * @param {string} token - The activation profile token.
   * @returns {Object} - The decoded email and password or an error object.
   */
  static async decodeActivateProfileToken(token) {
    // decode the token to get the email and password
    const decodedToken = (Buffer.from(token, 'base64').toString().split(':'));
    if (decodedToken.length !== 2) {
      return ({ error: 'Inconsistent Encryption Algorithm, ensure Base64 encryption' });
    }
    const email = decodedToken[0];
    const password = decodedToken[1];
    return ({ email, password });
  }

  /**
   * Verifies if the token passed is linked to an active user and
   *  performs pre-checks for staff authorization.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {string} req.get - The function to retrieve header values.
   * @returns {Promise<Object>} The result of the staff pre-check.
   * @throws {Error} If there is an error during the pre-check process.
   */
  static async staffPreCheck(req) {
    // verify token passed is linked to an active user
    // extract the token from the header X-Token
    const token = req.get('X-Token');
    if (!token) {
      return ({ error: 'Missing X-Token in the Authorization header' });
    }
    const staffId = await this.getUserID(token);
    if (staffId.error) {
      return ({ error: 'Unauthorized', msg: staffId.error });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return ({ error: 'Internal Database Server Error' });
    }
    // validate if the token and object from the request are same
    const staff = await Staff.findById({ _id: staffId });
    if (!staff) {
      return ({ error: 'Unauthorized', msg: 'Token is not linked to any staff account' });
    }
    return { staff, token };
  }

  /**
   * Performs attribute checks on the staff request data.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} req.body - The body of the request.
   * @returns {Promise<Object>} The result of the attribute checks.
   * @throws {Error} If there is an error during the attribute checks.
   */
  static async staffAttrCheck(req) {
    const data = req.body;
    if (!data) {
      return ({ error: 'Missing data for the request' });
    }
    // ensure data is an object type
    if (typeof data !== 'object') {
      return ({ error: 'Ensure the request data is an object type (JSON)' });
    }
    // check if collection is in model
    if (!data.collection) {
      return ({
        error: 'Missing collection in the request data',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    // check if collection is not in model
    if (!models.includes(data.collection)) {
      return ({ error: 'Invalid collection in the request data' });
    }
    return data;
  }
  // static async DashboardData(obj) {
  //   const userObj = obj.toObject();
  //   const stdData = {};
  //   const facData = {};
  //   const dptData = {};
  //   const courseData = [];
  //   const regCourseData = {};

  //   for (const key in userObj) {
  //     if (!exclude.includes(key)) {
  //       stdData[key] = userObj[key];
  //     }
  //   }
  //   const dpt = await Department.findById(obj.department);
  //   if (!dpt) {
  //     throw new Error('Department not found');
  //   }
  //   const dptObj = dpt.toObject();
  //   for (const key in dptObj) {
  //     if (!exclude.includes(key)) {
  //       dptData[key] = dptObj[key];
  //     }
  //   }

  //   const fac = await Faculty.findById(dpt.faculty);
  //   if (!fac) {
  //     throw new Error('Faculty not found');
  //   }
  //   const factObj = fac.toObject();
  //   for (const key in factObj) {
  //     if (!exclude.includes(key)) {
  //       facData[key] = factObj[key];
  //     }
  //   }

  //   const arrRegCourses = obj.registeredCourses;
  //   if (!arrRegCourses) {
  //     return { stdData, dptData, facData, courseData };
  //   }
  //   for (const courseObjects of arrRegCourses) {
  //     const { courses } = courseObjects;
  //     for (const objID of courses) {
  //       const course = await Course.findById(objID);
  //       if (!course) {
  //         throw new Error('Course not found');
  //       }
  //       const courseObj = course.toObject();
  //       for (const key in courseObj) {
  //         if (!exclude.includes(key)) {
  //           regCourseData[key] = courseObj[key];
  //         }
  //       }
  //       courseData.push(regCourseData);
  //     }
  //   }
  //   return { stdData, dptData, facData, courseData };
  // }
}

module.exports = AuthController;
