/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
// import the staff model
const { enums, privileges, ObjectId } = require('../models/base');
const dbClient = require('../utils/db');
const { Staff } = require('../models/staff');

const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

const { statuses } = enums.staff;

class StaffController {
  // check both redis and db health
  static async healthCheck(req, res) {
    // check both redis and db health
    await authClient.isHealth(req, res);
  }

  /**
   * Signs in a staff member by generating an activation token and sending it via email.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of the sign-in process.
   * @throws {Error} If there is an error during the sign-in process.
   */
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
        return res.status(400).json({
          error: 'Staff account doesn\'t exist',
          resolve: 'Please contact Admin',
        });
      }
      // check if staff object profile is already activated, if true redirect to login instead
      if (existingStaff.status !== statuses[0]) {
        return res.status(400).json({
          error: 'Staff already verified',
          resolve: 'Please login',
        });
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

  /**
 * Activates the staff profile by validating the activation token and updating the password.
 * @async
 * @static
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} The result of activating the staff profile.
 * @throws {Error} If there is an error during the activation process.
 */
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
        return res.status(400).json({
          error: 'Staff already verified',
          resolve: 'Please login',
        });
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
      if (xToken.error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: xToken.error,
        });
      }
      return res.status(201).json({
        message: 'Account activated successfully',
        email: existingStaff.email,
        staffId: existingStaff.staffId,
        xToken,
        Dashboard,
      });
      // needed for the staff profile activation
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }

  /**
 * Logs in a staff member by validating the login token and checking the password.
 * @async
 * @static
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} The result of the login process.
 * @throws {Error} If there is an error during the login process.
 */
  static async login(req, res) {
    const encryptToken = await authClient.checkConn(req);
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
        return res.status(400).json({
          error: 'Staff not authorized',
          resolve: 'Please activate your account',
        });
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

  /**
   * Updates the staff profile based on the provided token and request body.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of updating the staff profile.
   * @throws {Error} If there is an error during the update process.
   */
  static async updateProfile(req, res) {
    // verify token passed is linked to an active staff
    // extract the token from the header X-Token
    const token = req.get('X-Token');
    if (!token) {
      return res.status(401).json({
        error: 'Token credentials is Unauthorized',
      });
    }
    // get the staff id from the redis client
    const staffId = await authClient.getUserID(token);
    if (!staffId.error) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: staffId.error,
      });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    // validate if the token and object from the request are same
    const staff = await Staff.findById({ _id: staffId });
    if (!staff) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: 'Token is not linked to any staff account',
      });
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
      const DashBoard = await updatedObj.getDashboardData();
      if (!DashBoard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Staff profile updated successfully',
        email: updatedObj.email,
        xToken: token,
        DashBoard,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update staff profile' });
    }
  }

  /**
 * Logs out the staff member by deleting the associated token.
 * @async
 * @static
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} The result of the logout process.
 * @throws {Error} If there is an error during the logout process.
 */
  static async logout(req, res) {
    let rdfxn = await authClient.checkCurrConn(req);
    if (rdfxn.error) {
      return res.status(401).json({
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

  /**
 * Sets the password reset token and sends it to the staff member's email.
 * @async
 * @static
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} The result of setting the password reset token.
 * @throws {Error} If there is an error during the process.
 */
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
          resolve: 'Please activate your account',
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
        return res.status(500).json({
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
        return res.status(500).json({
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
      // Only staffId is provided
      const staff = await Staff.findOne({ staffId });
      if (!staff) {
        return res.status(404).json({
          error: 'Staff not found',
        });
      }
      if (staff.status !== statuses[1]) {
        return res.status(400).json({
          error: 'Staff not authorized',
          resolve: 'Please activate your account',
        });
      }
      // Generate and send password reset token
      const resetToken = await staff.generateOTP();
      try {
        await mailClient.sendToken(staff);
      } catch (err) {
        return res.status(500).json({
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

  /**
   * Sets the new password for the staff member.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of setting the new password.
   * @throws {Error} If there is an error during the process.
   */
  static async setNewPassword(req, res) {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    const encryptToken = await authClient.checkConn(req);
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
        return res.status(400).json({
          error: 'Staff not authorized',
          resolve: 'Please activate your account',
        });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 10);
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

  /**
  * Sets the new password for the staff member.
  * @async
  * @static
  * @param {Object} req - The request object.
  * @param {Object} res - The response object.
  * @returns {Promise<Object>} The result of setting the new password.
  * @throws {Error} If there is an error during the process.
  */
  static async setChangePassword(req, res) {
    const rdfxn = await authClient.checkCurrConn(req);
    if (rdfxn.error) {
      return res.status(401).json({
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
      return res.status(400).json({
        error: 'Staff not verified',
        resolve: 'Please signin to activate profile',
      });
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

  /**
   * Get the staff's dashboard data.
   * @param {Object} req - The request object.
   * @returns {void}
   */
  static async getDashboardData(req, res) {
    const rdfxn = await authClient.checkCurrConn(req);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const staff = await Staff.findById(ID);
    if (!staff) {
      return res.status(404).json({ error: 'Staff Object not found' });
    }
    // check if user object profile is already activated, if true, redirect to login instead
    if (staff.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Staff not authorized',
        resolve: 'Please activate your account',
      });
    }
    try {
      const DashBoard = await staff.getDashboardData();
      if (!DashBoard) {
        return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Dashboard data fetched successfully',
        xToken,
        DashBoard,
      });
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }

  /**
   * Retrieves all objects from the specified collection for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of retrieving all objects.
   * @throws {Error} If there is an error during the retrieval process.
   */
  static async adminGetAll(req, res) {
    let adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const data = await authClient.staffAttrCheck(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const typeCollection = data.collection;
    try {
      adminFxn = await mongoose.model(typeCollection).find({}).exec();
      if (adminFxn.error) {
        return res.status(401).json({
          error: adminFxn.error,
        });
      }
    } catch (err) {
      return res.status(400).json({ error: err });
    }
    if (!adminFxn) {
      return res.status(400).json({ error: 'Internal Server Error', msg: 'Failed to get all objects' });
    }
    return res.status(200).json({ adminFxn, token });
  }

  /**
   * Creates a new object in the specified collection for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of creating a new object.
   * @throws {Error} If there is an error during the creation process.
   */
  static async adminCreateNew(req, res) {
    // extract the content of the request
    const data = await authClient.staffAttrCheck(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    let newObjData;
    try {
      newObjData = await staff.createNew(typeCollection, data);
      if (newObjData.error) {
        return res.status(400).json({
          error: newObjData.error,
        });
      }
    } catch (err) {
      return res.status(400).json({ error: err });
    }
    if (!newObjData) {
      return res.status(400).json({ error: 'Internal Server Error', msg: 'Failed to create new object' });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Object created successfully',
      xToken: token,
      operatorData,
      newObjData,
    });
  }

  /**
   * Updates an object in the specified collection for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of updating an object.
   * @throws {Error} If there is an error during the update process.
   */
  static async adminUpdate(req, res) {
    // Extract the ID from the request parameters
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    // extract the content of the request
    const data = await authClient.staffAttrCheck(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    // ascertain if the tokenToObj matches the given ID
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    let verifyColl;
    try {
      verifyColl = await mongoose.model(typeCollection).findById(id).exec();
      if (!verifyColl) {
        return res.status(400).json({ error: 'Provided ID does not match to the collection Object', Acesss: 'Forbidden' });
      }
    } catch (err) {
      return res.status(400).json({ error: err, msg: 'Failed to get object' });
    }
    const updatedData = await staff.updateExisting(id, typeCollection, data);
    if (updatedData.error) {
      return res.status(400).json({
        error: updatedData.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Object updated successfully',
      xToken: token,
      updatedData,
      operatorData,
    });
  }

  /**
   * Deletes an object in the specified collection for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of deleting an object.
   * @throws {Error} If there is an error during the deletion process.
   */
  static async adminDelete(req, res) {
    // Extract the ID from the request parameters
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    // extract the content of the request
    const data = await authClient.staffAttrCheck(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    // ascertain ID matches the collection object
    let verifyColl;
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    try {
      verifyColl = await mongoose.model(typeCollection).findById(id).exec();
      if (!verifyColl) {
        return res.status(400).json({ error: 'Provided ID does not match to the collection Object', Acesss: 'Forbidden' });
      }
    } catch (err) {
      return res.status(400).json({ error: err, msg: 'Failed to get object' });
    }
    const delData = await staff.deleteExisting(id, data.collection);
    if (delData.error) {
      return res.status(400).json({
        error: delData.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Object deleted successfully',
      xToken: token,
      deletedData: delData,
      operatorData,
    });
  }

  /**
   * Assigns courses to an Lecturer.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of assigning courses.
   * @throws {Error} If there is an error during the assignment process.
   */
  static async adminAssignedCourse(req, res) {
    // Extract the ID from the request parameters
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    // extract the content of the request
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data for the request' });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const assignedData = await staff.assignCourses(id, data);
    if (assignedData.error) {
      return res.status(400).json({
        error: assignedData.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Course assigned successfully',
      xToken: token,
      assignedData,
      operatorData,
    });
  }

  /**
   * Approves an object in the specified collection for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of approving an object.
   * @throws {Error} If there is an error during the approval process.
   */
  static async adminApproveRecord(req, res) {
    // Extract the ID from the request parameters
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const recordUpdate = await staff.approveRecord(id);
    if (recordUpdate.error) {
      return res.status(400).json({
        error: recordUpdate.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Record approved successfully',
      xToken: token,
      recordUpdate,
      operatorData,
    });
  }

  /**
   * Fetches available courses for the specified collection.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of fetching available courses.
   * @throws {Error} If there is an error during the fetch process.
   */
  static async adminGetAvailableCourses(req, res) {
    // Extract the ID from the request parameters
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data for the request' });
    }
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    const validCollectionTypes = ['Department', 'Faculty'];
    if (!validCollectionTypes.includes(typeCollection)) {
      return res.status(400).json({
        error: 'Invalid collection type for the request',
        msg: 'Only "Department" OR "Faculty" is allowed',
      });
    }
    const { level } = data;
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const availableCourses = await staff.getAvailableCourses(id, typeCollection, level);
    if (availableCourses.error) {
      return res.status(400).json({
        error: availableCourses.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Available courses fetched successfully',
      xToken: token,
      availableCourses,
      operatorData,
    });
  }

  /**
   * Sets available courses for the specified collection.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of setting available courses.
   * @throws {Error} If there is an error during the set process.
   */
  static async adminSetAvailableCourse(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data for the request' });
    }
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    const validCollectionTypes = ['Department', 'Faculty'];
    if (!validCollectionTypes.includes(typeCollection)) {
      return res.status(400).json({
        error: 'Invalid collection type for the request',
        msg: 'Only "Department" OR "Faculty" is allowed',
      });
    }
    const arrCourses = data.courses;
    // ensure arrCourses is an array
    if (!Array.isArray(arrCourses)) {
      return res.status(400).json({
        error: 'Ensure the course is an array of data',
        msg: 'Ensure the key is defined as \'courses\' and the value is an array []',
      });
    }
    if (!arrCourses.length) {
      return res.status(400).json({ error: 'No courses provided' });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const setAvailableCourse = await staff.setAvailableCourse(id, typeCollection, arrCourses);
    if (setAvailableCourse.error) {
      return res.status(400).json({
        error: setAvailableCourse.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Available course set successfully',
      xToken: token,
      setAvailableCourse,
      operatorData,
    });
  }

  /**
   * Unsets available courses for the specified collection.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of unsetting available courses.
   * @throws {Error} If there is an error during the unset process.
   */
  static async adminUnSetAvailableCourse(res, req) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data for the request' });
    }
    const typeCollection = data.collection;
    if (!typeCollection) {
      return res.status(400).json({
        error: 'Missing collection type for the request',
        msg: 'Ensure the key is defined as \'collection\'',
      });
    }
    const validCollectionTypes = ['Department', 'Faculty'];
    if (!validCollectionTypes.includes(typeCollection)) {
      return res.status(400).json({
        error: 'Invalid collection type for the request',
        msg: 'Only "Department" OR "Faculty" is allowed',
      });
    }
    const arrCourses = data.courses;
    // ensure arrCourses is an array
    if (!Array.isArray(arrCourses)) {
      return res.status(400).json({
        error: 'Ensure the course is an array of data',
        msg: 'Ensure the key is defined as \'courses\' and the value is an array []',
      });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const setAvailableCourse = await staff.unsetAvailableCourses(id, typeCollection, arrCourses);
    if (setAvailableCourse.error) {
      return res.status(400).json({
        error: setAvailableCourse.error,
      });
    }
    const operatorData = await staff.getDashboardData();
    if (!operatorData) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    return res.status(200).json({
      operation: 'Available course set successfully',
      xToken: token,
      setAvailableCourse,
      operatorData,
    });
  }

  /**
 * Retrieves projects based on the provided course array for admin access.
 * @async
 * @static
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} The result of retrieving the projects.
 * @throws {Error} If there is an error during the retrieval process.
 */
  static async adminGetProjects(req, res) {
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const arrCourses = req.body;
    const projects = await staff.getProjects(arrCourses);
    if (projects.error) {
      return res.status(400).json({
        error: projects.error,
      });
    }
    return res.status(200).json({
      operation: 'Projects fetched successfully',
      xToken: token,
      projects,
    });
  }

  /**
   * Grades a project based on the provided ID and data for admin access.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of grading the project.
   * @throws {Error} If there is an error during the grading process.
   */
  static async adminGradeProject(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing ID' });
    }
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data for the request' });
    }
    const adminFxn = await authClient.staffPreCheck(req);
    if (adminFxn.error) {
      return res.status(401).json({
        error: adminFxn.error,
        msg: 'Staff is not authorized to perform this action',
      });
    }
    const { staff, token } = adminFxn;
    const gradedProject = await staff.gradeProject(id, data);
    if (gradedProject.error) {
      return res.status(400).json({
        error: gradedProject.error,
      });
    }
    return res.status(200).json({
      operation: 'Project graded successfully',
      xToken: token,
      gradedProject,
    });
  }
}

module.exports = StaffController;
