// Methods for person/all user account types

const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
const { ObjectId, immutables, privateAttr: attr } = require('../base');

const { privateAttr, privateAttrStr } = attr;

/**
 * Getter for `name` and `fullname` virtual properties. Returns full name
 * by concatenating the user's `firstName`, `middleName`, and `lastName`.
 * @returns {String} "`firstName` + [`middleName` + ]`lastName`"
 */
function getFullName() {
  return [this.firstName, this.middleName, this.lastName].join(' ');
}

/**
 * Method for users to update their own profile. Includes security checks.
 * @param {object} attributes User's attributes to be updated.
 * @returns {promise.<mongoose.Model>} User object with valid updated attributes.
 */
async function updateProfile(attributes) {
  const mutableAttr = ['phone', 'picture'];
  const mutableIfNull = ['middleName', 'gender', 'nationality', 'stateOfOrigin', 'LGA'];
  for (const [key, val] of Object.entries(attributes)) {
    if (mutableAttr.includes(key)) this[key] = val;
    // Allow a user to set these only if they haven't already been set
    if (mutableIfNull.includes(key) && !this[key]) this[key] = val;
  }
  return this.save();
}

/**
 * Method for creating a time-bound, single-use token/OTP for account validation.
 * @returns {promise.<String>} A time-bound, single-use token/OTP.
 */
async function generateOTP() {
  this.resetPwd = true;
  this.resetTTL = Date.now() + (1000 * 60 * 5); // 5 minutes validity
  this.resetOTP = uuid().slice(-7, -1); // random 6-character token
  await this.save();
  return this.resetOTP;
}

/**
 * Method for validating an OTP/token received from a user. Checks that given OTP is
 * valid (exists and not expired).
 * @param {string} OTP One-Time Password/token for validation.
 * @returns {promise.<mongoose.Model>} User object.
 */
async function validateOTP(OTP) {
  if (this.resetPwd && this.resetOTP === String(OTP).toLowerCase()) { // Case-insensitive token
    if (this.resetTTL < Date.now()) return { error: 'ValueError: OTP has expired' };
    this.resetOTP = undefined; this.resetTTL = undefined; this.resetPwd = undefined;
    return this.save();
  }
  return { error: 'ValueError: Invalid OTP' };
}

/**
 * Method for resetting a user's password after they have initiated a password
 * reset. This checks that given OTP is valid (exists and not expired), then
 * updates the user's password to the new one and ends the password reset cycle.
 * @param {string} OTP One-Time Password/token for resetting the user's password.
 * @param {string} newPassword New password provided by the user.
 * @returns {promise.<mongoose.Model>} User object with updated password.
 */
async function resetPassword(OTP, newPassword) {
  const { error } = await this.validateOTP(OTP); // Validate OTP
  if (error) return { error };

  // Update password and return user object with updated password
  this.password = newPassword;
  return this.save();
}

/**
 * Method for changing a user's password.
 * @param {string} newPassword New password provided by the user.
 * @returns {promise.<mongoose.Model>} User object with updated password.
 */
async function changePassword(newPassword) {
  this.password = newPassword;
  this.resetOTP = undefined; this.resetTTL = undefined; this.resetPwd = undefined;
  return this.save();
}

/**
 * Class method for retrieving schedules for a student by date. Result is sorted by `time` field.
 * @param {Date} startDate Lower bound of date range.
 * @param {Date} endDate Upper bound of date range.
 * @returns {Promise.<mongoose.Model[]>}
 */
// async function getSchedules(startDate = '1900-01-01', endDate = Date.now()) {
async function getSchedules(startDate = '1900-01-01', endDate = '2999-12-31') {
  if (new Date(startDate).toString() === 'Invalid Date') return { error: 'ValueError: Invalid startDate' };
  if (new Date(endDate).toString() === 'Invalid Date') return { error: 'ValueError: Invalid endDate' };

  // Retrieve schedules from database
  return mongoose.model('Schedule').find({
    createdBy: this.id,
    time: { $gte: startDate, $lte: endDate },
  }).sort({ time: 1 }).select({ ...privateAttr.all, createdBy: 0 });
}

/**
 * Class method for creating a new schedule for a student
 * @param {Object} attributes Attributes to be assigned to the new schedule.
 * @returns {Promise.<mongoose.Model>}
 */
async function createSchedule(attributes) {
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Prevent setting user-immutable attributes on this schedule
  for (const key of immutables.Project) { delete attributes[key]; }

  attributes.createdBy = this.id; // Permanently link the new schedule to this student

  return mongoose.model('Schedule')(attributes).save();
}

/**
 * Class method for updating an existing student's schedule.
 * @param {ObjectId} id ID of schedule to be updated.
 * @param {Object} attributes New attributes to be assigned to the schedule.
 * @returns {Promise.<mongoose.Model>}
 */
async function updateSchedule(id, attributes) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Retrieve schedule from database
  const schedule = await mongoose.model('Schedule').findById(id).exec();
  if (!schedule) return { error: `ValueError: Schedule with id=${id} not found` };

  // Check if schedule is owned by this student
  if (String(schedule.createdBy) !== this.id) return { error: 'Access denied' };

  // Prevent updating user-immutable attributes on this schedule
  for (const key of immutables.Project) { delete attributes[key]; }

  // Apply given attributes updates to schedule
  for (const [key, value] of Object.entries(attributes)) {
    schedule[key] = value;
  }

  return schedule.save();
}

/**
 * Class method for deleting a student's schedule.
 * @param {ObjectId} id ID of schedule to be deleted.
 * @returns {Promise.<Boolean>}
 */
async function deleteSchedule(id) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };

  // Retrieve schedule from database
  const schedule = await mongoose.model('Schedule').findById(id).exec();
  if (!schedule) return { error: `ValueError: Schedule with id=${id} not found` };

  // Check if schedule is owned by this student
  if (String(schedule.createdBy) !== this.id) return { error: 'Access denied' };

  // Delete schedule from database and return result
  if ((await schedule.deleteOne()).deletedCount >= 1) return true;
  return false;
}

/**
 * Class method for retrieving schedules by date for a user's dashboard. Result is a parsed object.
 * @param {Date} startDate Lower bound of date range.
 * @param {Date} endDate Upper bound of date range.
 * @returns {Promise.<Object>}
 */
async function getParsedSchedules(startDate = '1900-01-01', endDate = '2999-12-31') {
  // Retrieve schedules from database
  const schedules = await this.getSchedules(startDate, endDate);
  if (schedules.error) return { error: schedules.error };
  if (!schedules || !schedules.length) return {};

  // Parse and return schedules data
  return schedules.reduce((results, schedule) => {
    const [day, month, year] = schedule.time
      .toLocaleDateString('en-gb', { day: 'numeric', month: 'long', year: 'numeric' }).split(' ');
    if (!results[`${month}-${year}`]) results[`${month}-${year}`] = {}; // Add slot for month and year
    if (!results[`${month}-${year}`][day]) results[`${month}-${year}`][day] = []; // Add slot for day
    results[`${month}-${year}`][day].push(schedule);
    return results;
  }, {});
}

/**
 * Class method for retrieving projects by date for a user's dashboard. Result is a parsed object.
 * @returns {Promise.<Object>}
 */
async function getParsedProjects() {
  // Retrieve projects from database
  const projects = await this.getProjects();
  if (projects.error) return { error: projects.error };
  if (!projects || !projects.length) return {};

  // Parse and return projectss data
  return projects.reduce((results, project) => {
    const [day, month, year] = project.deadline
      .toLocaleDateString('en-gb', { day: 'numeric', month: 'long', year: 'numeric' }).split(' ');
    if (!results[`${month}-${year}`]) results[`${month}-${year}`] = {}; // Add slot for month and year
    if (!results[`${month}-${year}`][day]) results[`${month}-${year}`][day] = []; // Add slot for day
    results[`${month}-${year}`][day].push(project);
    return results;
  }, {});
}

/**
 * Method for getting data for populating a user's dashboard.
 * @returns {promise.<mongoose.Model[]>}
 */
async function getDashboardData() {
  // Fetch department and faculty data from database
  this.department = await mongoose.model('Department').findById(this.department._id)
    .select(privateAttrStr.department).populate('faculty', privateAttrStr.department);

  // Cast user to object without private attributes
  const privateAttributes = Object.keys({ ...privateAttr.all, ...privateAttr.person });
  const user = Object.entries(this.toObject()).reduce((results, entry) => {
    const [key, value] = entry;
    if (!privateAttributes.includes(key)) results[key] = value;
    return results;
  }, {});

  // Add dashboard data to user object and return it
  user.faculty = user.department.faculty; delete user.department.faculty;
  user.schedules = await this.getParsedSchedules();
  user.projects = await this.getParsedProjects();
  return user;
}

module.exports = {
  getFullName,
  updateProfile,
  generateOTP,
  validateOTP,
  resetPassword,
  changePassword,
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getParsedSchedules,
  getParsedProjects,
  getDashboardData,
};
