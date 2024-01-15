/* eslint-disable max-len */
/* eslint-disable import/newline-after-import */
/* eslint-disable no-useless-return */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */
/* eslint-disable import/no-extraneous-dependencies */
// bcrypt for password hashing
const bcrypt = require('bcrypt');
// import the student model
const { Student } = require('../models/student');
const { enums, ObjectId } = require('../models/base');
const dbClient = require('../utils/db');
const { statuses } = enums.students;
const mailClient = require('../utils/mailer');
const authClient = require('./AuthController');

/**
 * StudentController class responsible for handling student-related operations.
 */
class StudentController {
  // check both redis and db health
  /**
   * Check the health status of the server.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {void}
   */
  static async healthCheck(req, res) {
    // check both redis and db health
    await authClient.isHealth(req, res);
  }

  /**
   * Sign in a new student.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of the sign-in operation.
   */
  static async signin(req, res) {
    // signup a new student
    const { firstName, email } = req.body;
    if (!firstName) {
      return res.status(400).json({
        error: 'Missing firstname',
        resolve: 'Please provide your firstname',
        format: ' { firstName:  <string>, email: <string> }',
      });
    }
    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        resolve: 'Please provide your email',
        format: ' { firstName:  <string>, email: <string> }',
      });
    }
    try {
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      // check if the student already exists
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({
          error: 'User account doesn\'t exist',
          resolve: 'Please contact Admin',
        });
      }
      // check if student object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[0]) {
        return res.status(400).json({
          error: 'User already verified',
          resolve: 'Please login',
        });
      }
      // generate the token
      const token = await existingUser.generateOTP();
      if (!token) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: 'Failed to generate activation token',
        });
      }
      // send mail to the student object base on the token
      await mailClient.sendToken(existingUser);
      return res.status(201).json({
        message: 'Activaton token sent successfully',
        email: existingUser.email,
        activationToken: token,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to signup student account' });
    }
  }

  /**
   * Activate the student profile using the activation token.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of the profile activation.
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
      const existingUser = await Student.findOne({ email });
      if (!existingUser) {
        return res.status(400).json({ error: 'Invalid token for student credentials' });
      }
      // check if student object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[0]) {
        return res.status(400).json({
          error: 'User already verified',
          resolve: 'Please login',
        });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 12);
      let student = await existingUser.validateOTP(token);
      if (student.error) {
        return res.status(404).json({ error: student.error });
      }
      student = await student.changePassword(hashedPwd);
      if (!student) {
        return res.status(400).json({ error: 'Failed to activate student profile' });
      }
      // return dashboard data
      const Dashboard = await student.getDashboardData();
      if (!Dashboard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(student.id);
      if (xToken.error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: xToken.error,
        });
      }
      return res.status(201).json({
        message: 'Account activated successfully',
        email: existingUser.email,
        matricNo: existingUser.matricNo,
        xToken,
        Dashboard,
      });
      // needed for the student profile activation
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }

  /**
   * Update the student profile.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of the profile update.
   */
  static async updateProfile(req, res) {
    // verify token passed is linked to an active student
    // extract the token from the header X-Token
    const xToken = req.get('X-Token');
    if (!xToken) {
      return res.status(401).json({
        error: 'Token credential is Unauthorized',
      });
    }
    // get the student id from the redis client
    const studentID = await authClient.getUserID(xToken);
    if (studentID.error) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: studentID.error,
      });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    // validate if the token and object from the request are same
    const studentObj = await Student.findById({ _id: studentID });
    if (!studentObj) {
      return res.status(401).json({
        error: 'Unauthorized',
        msg: 'Token is not linked to any student account',
      });
    }
    // update the student profile
    // Get the updated attributes from the request body
    const studentData = {};
    // extract all the attributes from the request body
    for (const [key, value] of Object.entries(req.body)) {
      studentData[key] = value;
    }
    // update the student profile
    try {
      const updatedObj = await studentObj.updateProfile(studentData);
      if (!updatedObj) {
        return res.status(400).json({ error: 'Failed to update student profile' });
      }
      const DashBoard = await updatedObj.getDashboardData();
      if (!DashBoard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'User profile updated successfully',
        email: updatedObj.email,
        xToken,
        DashBoard,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update student profile' });
    }
  }

  /**
   * Login a student.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of the login operation.
   */
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
      return res.status(400).json({
        error: 'Missing Matric Number',
        resolve: 'Please provide your matric number',
        genFormat: 'EX: 2001/1/123456EE',
        reqFormat: ' { matricNo:  <string>, password:  <string> }',
      });
    }
    if (!password) {
      return res.status(400).json({
        error: 'Missing password',
        resolve: 'Please provide your password',
        reqFormat: ' { matricNo:  <string>, password:  <string> }',
      });
    }
    try {
      if (!dbClient.isAlive()) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      const student = await Student.findOne({ matricNo });
      if (!student) {
        return res.status(400).json({ error: 'MatricNo not linked to any student' });
      }
      if (student.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
          resolve: 'Please activate your account',
        });
      }
      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
      // set up Token based on the student authentication using this credentials
      const xToken = await authClient.createXToken(student.id);
      if (xToken.error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          msg: xToken.error,
        });
      }
      // const { stdData, dptData, facData, courseData } = await authClient.DashboardData(student);
      const Dashboard = await student.getDashboardData();
      if (!Dashboard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      return res.status(201).json({
        message: 'Login successful',
        email: student.email,
        xToken,
        Dashboard,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to login' });
    }
  }

  /**
   * Logout a student.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of the logout operation.
   */
  static async logout(req, res) {
    let rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
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
   * Set the reset password token for a student.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of setting the reset password token.
   */
  static async setResetPassword(req, res) {
    // check if the email is valid
    const { email, matricNo } = req.body;
    if (!email && !matricNo) {
      return res.status(400).json({
        error: 'Missing email and matricNo',
        resolve: 'Please provide your email and matricNo',
        reqFormat: ' { email:  <string>, matricNo:  <string> }',
      });
    }
    // Code to handle when either email or matricNo is provided
    if (email && matricNo) {
      // Both email and matricNo are provided
      const student = await Student.findOne({ email, matricNo });
      if (!student) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (student.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
          resolve: 'Please activate your account',
        });
      }
      // Generate and send password reset token
      const resetToken = await student.generateOTP();
      if (!resetToken) {
        return res.status(500).json({
          error: 'Internal Server Error',
        });
      }
      try {
        await mailClient.sendToken(student);
      } catch (err) {
        return res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: student.email,
        resetToken,
      });
    } if (email) {
      // Only email is provided
      const student = await Student.findOne({ email });
      if (!student) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (student.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
          resolve: 'Please activate your account',
        });
      }
      // Generate and send password reset token
      const resetToken = await student.generateOTP();
      try {
        await mailClient.sendToken(student);
      } catch (err) {
        return res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(201).json({
        message: 'Password reset token sent successfully',
        email: student.email,
        resetToken,
      });
    } if (matricNo) {
      // Only matricNo is provided
      const student = await Student.findOne({ matricNo });
      if (!student) {
        return res.status(404).json({
          error: 'User not found',
        });
      }
      if (student.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
          resolve: 'Please activate your account',
        });
      }
      // Generate and send password reset token
      const resetToken = await student.generateOTP();
      try {
        await mailClient.sendToken(student);
      } catch (err) {
        return res.status(500).json({
          error: 'Mail Client Error',
        });
      }
      return res.status(200).json({
        message: 'Password reset token sent',
        email: student.email,
        resetToken,
      });
    }
  }

  /**
   * Set a new password for a student using the reset password token.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of setting the new password.
   */
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
      // check if student object profile is already activated, if true redirect to login instead
      if (existingUser.status !== statuses[1]) {
        return res.status(400).json({
          error: 'User not authorized',
          resolve: 'Please activate your account',
        });
      }
      // hash the password using bcrypt
      const hashedPwd = await bcrypt.hash(password, 10);
      let student = await existingUser.validateOTP(token);
      if (student.error) {
        return res.status(404).json({ error: student.error });
      }
      student = await student.changePassword(hashedPwd);
      if (!student) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      // check if server is up before verifying
      if (!await dbClient.isAlive()) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
      const DashBoard = await student.getDashboardData();
      if (!DashBoard) {
        return res.status(500).json({ error: 'Internal Server Error fetching Dashboard' });
      }
      // setup basicAuth using token for this object
      const xToken = await authClient.createXToken(student.id);
      return res.status(201).json({
        message: 'Password reset successfully',
        email: student.email,
        xToken,
        DashBoard,
      });
      // needed for the student profile activation
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err });
    }
  }

  /**
   * Set a new password for a student using the current password.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Object} - The result of setting the new password.
   */
  static async setChangePassword(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Studet not authorized',
        resolve: 'Please activate your account',
      });
    }
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        reqFields: ['email', 'oldPassword', 'newPassword'],
        format: 'email: string, oldPassword: string, newPassword: string',
      });
    }
    // check if server is up before verifying
    if (!await dbClient.isAlive()) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not verified',
        resolve: 'Please signin to activate your profile',
      });
    }
    // compare old password to the hashed password in the database
    const isMatch = await bcrypt.compare(oldPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid old password' });
    }
    // hash the password using bcrypt
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    try {
      const updatedUser = await student.changePassword(hashedPwd);
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

  /**
   * Get the student's dashboard data.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {void}
   */
  static async getDashboardData(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    try {
      const DashBoard = await student.getDashboardData();
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
   * Retrieves all available courses for a specific semester for a student.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of retrieving the available courses.
   * @throws {Error} If there is an error during the retrieval process.
   */
  static async getAvailableCourses(req, res) {
    const { semester } = req.body;
    if (!semester) {
      return res.status(400).json({
        error: 'Missing semester',
        resolve: 'Please provide the semester in the request body',
        format: 'semester: <type = number>',
      });
    }
    // ensure that the semester is of type number
    if (typeof semester !== 'number') {
      return res.status(400).json({
        error: 'Invalid semester type',
        resolve: 'The value must be a number',
        format: 'semester: <type = number>',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const courses = await student.getAvailableCourses(semester);
    if (!courses) {
      return res.status(400).json({ error: 'Internal Server Error fetching courses' });
    }
    if (courses.error) {
      return res.status(400).json({ error: courses.error });
    }
    return res.status(201).json({
      message: 'Courses fetched successfully',
      xToken,
      courses,
    });
  }

  /**
   * Retrieves the unRegistereda vailable courses for a student in the specific semester.
   * @async
   * @static
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<Object>} The result of retrieving the available courses.
   * @throws {Error} If there is an error during the retrieval process.
   */
  static async unRegisterCourses(req, res) {
    const { semester } = req.body;
    if (!semester) {
      return res.status(400).json({
        error: 'Missing semester',
        resolve: 'Please provide the semester in the request body',
        format: 'semester: <type = number>',
      });
    }
    // ensure that the semester is of type number
    if (typeof semester !== 'number') {
      return res.status(400).json({
        error: 'Invalid semester type',
        resolve: 'The value must be a number',
        format: 'semester: <type = number>',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'Student Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const unRegCourses = await student.unregisterCourses(semester);
    if (!unRegCourses) {
      return res.status(400).json({
        error: 'Operation failed',
        reason: 'No registered courses found in the specified semester',
      });
    }
    if (unRegCourses.error) {
      return res.status(400).json({ error: unRegCourses.error });
    }
    return res.status(201).json({
      message: 'Courses unregistered successfully',
      xToken,
    });
  }

  static async registerCourses(req, res) {
    const { semester, coursesId } = req.body;
    if (!coursesId) {
      return res.status(400).json({
        error: 'Missing courses',
        resolve: 'Please provide courses in the request body as an array',
        format: 'courses: <type = array>',
        genFormat: '{ "coursesId": ["<type String: courseId>"], "semester": <type = number> }',
      });
    }
    if (!Array.isArray(coursesId)) {
      return res.status(400).json({
        error: 'Invalid type for courses',
        resolve: 'Courses must be an array of courseIds',
        genFormat: '{ "coursesId": ["<type String: courseId>"], "semester": <type = number> }',
      });
    }
    if (!semester) {
      return res.status(400).json({
        error: 'Missing semester',
        genFormat: '{ "coursesId": ["<type String: courseId>"], "semester": <type = number> }',
      });
    }
    // ensure that the semester is of type number
    if (typeof semester !== 'number') {
      return res.status(400).json({
        error: 'Invalid semester',
        resolve: 'Please provide a valid value (type number) for the semester',
        genFormat: '{ "coursesId": ["<type String: courseId>"], "semester": <type = number> }',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    const regCourses = await student.registerCourses(semester, coursesId);
    if (!regCourses) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    if (regCourses.error) {
      return res.status(400).json({ error: regCourses.error });
    }
    const dashBoard = regCourses.getDashboardData();
    if (!dashBoard) {
      return res.status(400).json({ error: 'Internal Server Error fetching Dashboard' });
    }
    if (dashBoard.error) {
      return res.status(400).json({ error: dashBoard.error });
    }
    return res.status(201).json({
      message: 'Courses registered successfully',
      xToken,
      DashBoard: dashBoard,
    });
  }

  static async getRegisteredCourses(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    const registeredCourses = await student.getRegisteredCourses();
    if (!registeredCourses) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    return res.status(201).json({
      message: 'All Registered courses fetched successfully',
      xToken,
      registeredCourses,
    });
  }

  static async getProjects(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    const projects = await student.getProjects();
    if (!projects) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    return res.status(201).json({
      message: 'All Projects fetched successfully',
      xToken,
      projects,
    });
  }

  static async submitProject(req, res) {
    const { projectId, answer } = req.body;
    if (!projectId) {
      return res.status(400).json({
        error: 'Missing projectId',
        resolve: 'Please provide a projectId in the request body',
        format: 'projectId: <string>',
        genFormat: '{ "projectId": "<type String: projectId>", "answer": "<type String: answer>" }',
      });
    }
    if (!answer) {
      return res.status(400).json({
        error: 'Missing answer',
        resolve: 'Please provide an answer in the request body',
        format: 'answer: <string>',
        genFormat: '{ "projectId": "<type String: projectId>", "answer": "<type String: answer>" }',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    const project = await student.submitProject(projectId, answer);
    if (!project) {
      return res.status(400).json({
        error: 'Operation failed',
        msg: 'Project Submission failed',
      });
    }
    if (project.error) {
      return res.status(400).json({ error: project.error });
    }
    return res.status(201).json({
      message: 'Project submitted successfully',
      xToken,
      project,
    });
  }

  static async getSchedules(req, res) {
    const { startDate, endDate } = req.body;
    // if (!startDate) {
    //   return res.status(400).json({
    //     error: 'Missing startDate',
    //     resolve: 'Please provide a startDate in the request body',
    //     format: 'startDate: <string> YYYY-MM-DD',
    //     genFormat: '{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }',
    //   });
    // }
    // if (!endDate) {
    //   return res.status(400).json({
    //     error: 'Missing endDate',
    //     resolve: 'Please provide an endDate in the request body',
    //     format: 'endDate: <string> YYYY-MM-DD',
    //     genFormat: '{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }',
    //   });
    // }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'User not authorized',
        resolve: 'Please activate your account',
      });
    }
    const schedules = await student.getSchedules(startDate, endDate);
    if (!schedules) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    return res.status(201).json({
      message: 'All Schedules fetched successfully',
      xToken,
      schedules,
    });
  }

  static async getParsedSchedules(req, res) {
    const { startDate, endDate } = req.body;
    // if (!startDate) {
    //   return res.status(400).json({
    //     error: 'Missing startDate',
    //     resolve: 'Please provide a startDate in the request body',
    //     format: 'startDate: <string> YYYY-MM-DD',
    //     genFormat: '{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }',
    //   });
    // }
    // if (!endDate) {
    //   return res.status(400).json({
    //     error: 'Missing endDate',
    //     resolve: 'Please provide an endDate in the request body',
    //     format: 'endDate: <string> YYYY-MM-DD',
    //     genFormat: '{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }',
    //   });
    // }
    // if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    //   return res.status(400).json({
    //     error: 'Invalid time format',
    //     format: 'time: <string> YYYY-MM-DD',
    //   });
    // }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const parsedSchedules = await student.getParsedSchedules(startDate, endDate);
    if (!parsedSchedules) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    return res.status(201).json({
      message: 'All Schedules fetched successfully',
      xToken,
      parsedSchedules,
    });
  }

  static async createSchedule(req, res) {
    if (!req.body) {
      return res.status(400).json({
        error: 'Missing parameters in the request body',
        mandatoryFormat: '{ title: <string>, time: <string> Example: "YYYY-MM-DD", }',
        genFomat: '{ "title": <"string">, "time": <string> Example: "YYYY-MM-DD", "description": "string", "color": "string" }',
        type: 'JSON',
      });
    }
    const { title, time } = req.body;
    if (!title || !time) {
      return res.status(400).json({
        error: 'Missing mandatory parameters',
        mandatoryFormat: '{ title: <string>, time: <string> YYYY-MM-DD, }',
        genFomat: '{ "title": "string", "time": "YYYY-MM-DD", "description": "string", "color": "string" }',
        type: 'JSON',
      });
    }
    const attributes = {
      title,
      time,
    };
    const optSchema = ['description', 'color'];
    // loop through the body and only extract the attributes in optSchea
    optSchema.forEach((attribute) => {
      if (req.body[attribute]) {
        attributes[attribute] = req.body[attribute];
      }
    });
    // check if the time is in the correct format
    // if (!time.match(/^\d{4}-\d{2}-\d{2}$/)) {
    //   return res.status(400).json({
    //     error: 'Invalid time format',
    //     format: 'time: <string> YYYY-MM-DD',
    //   });
    // }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const createdSchedule = await student.createSchedule(attributes);
    if (!createdSchedule) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    if (createdSchedule.error) {
      return res.status(400).json({ error: createdSchedule.error });
    }
    return res.status(201).json({
      message: 'Schedule created successfully',
      xToken,
      createdSchedule,
    });
  }

  static async updateSchedule(req, res) {
    const { scheduleId, attributes } = req.params;
    if (!scheduleId) {
      return res.status(400).json({
        error: 'Missing scheduleId',
        resolve: 'Please provide a scheduleId in the request params',
        format: 'scheduleId: <string>',
        genFormat: '{ scheduleId: <string>, attributes: <JSON> }',
      });
    }
    if (!attributes) {
      return res.status(400).json({
        error: 'Missing attributes',
        resolve: 'Please provide attributes in the request body',
        format: 'attributes: <JSON>',
        genFormat: '{ scheduleId: <string>, attributes: <JSON> }',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const updatedSchedule = await student.updateSchedule(scheduleId, attributes);
    if (!updatedSchedule) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    if (updatedSchedule.error) {
      return res.status(400).json({ error: updatedSchedule.error });
    }
    return res.status(201).json({
      message: 'Schedule updated successfully',
      xToken,
      updatedSchedule,
    });
  }

  static async deleteSchedule(req, res) {
    const { scheduleId } = req.params;
    if (!scheduleId) {
      return res.status(400).json({
        error: 'Missing scheduleId',
        resolve: 'Please provide a scheduleId in the request params',
        format: 'scheduleId: <string>',
        genFormat: '{ scheduleId: <string> }',
      });
    }
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const deletedSchedule = await student.deleteSchedule(scheduleId);
    if (deletedSchedule.error) {
      return res.status(400).json({ error: deletedSchedule.error });
    }
    if (!deletedSchedule) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    const msg = `Schedule with scheduleId: ${scheduleId} deleted successfully`;
    return res.status(201).json({
      message: msg,
      xToken,
    });
  }

  static async getParsedProjects(req, res) {
    const rdfxn = await authClient.checkCurrConn(req, res);
    if (rdfxn.error) {
      return res.status(401).json({
        error: rdfxn.error,
      });
    }
    const { ID, xToken } = rdfxn;
    const student = await Student.findById(ID);
    if (!student) {
      return res.status(404).json({ error: 'User Object not found' });
    }
    // check if student object profile is already activated, if true redirect to login instead
    if (student.status !== statuses[1]) {
      return res.status(400).json({
        error: 'Student not authorized',
        resolve: 'Please activate your account',
      });
    }
    const projects = await student.getParsedProjects();
    if (!projects) {
      return res.status(400).json({ error: 'Operation failed' });
    }
    return res.status(201).json({
      message: 'Projects fetched successfully',
      xToken,
      projects,
    });
  }
}

module.exports = StudentController;
