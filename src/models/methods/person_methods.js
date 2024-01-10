// Methods for person/all user account types

const { v4: uuid } = require('uuid');
const { enums, privileges } = require('../base');

const { statuses } = enums.students;

/**
 * Validations and constraints for user accounts. Enforces some
 * default values for account creation/updating for compliance
 * with the business logic, security, or both in some cases.
 */
function validatePerson() {
  // Ensure new person has defaults where applicable
  if (this.isNew) {
    [this.status] = statuses;
    this.password = undefined;
    this.resetPwd = undefined; this.resetTTL = undefined; this.resetOTP = undefined;
  } else {
    // Activate a new user account when the user sets a password
    this.status = this.password && this.status === statuses[0] ? statuses[1] : this.status;
  }
  // Set staff privileges based on assigned role (and prevent manual reassignment)
  this.privileges = privileges[this.role];
}

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
  const mutableAttr = ['email', 'nationality', 'stateOfOrigin', 'LGA', 'phone', 'picture'];
  for (const [key, val] of Object.entries(attributes)) {
    if (mutableAttr.includes(key)) this[key] = val;
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

module.exports = {
  validatePerson,
  getFullName,
  updateProfile,
  generateOTP,
  validateOTP,
  resetPassword,
  changePassword,
};
