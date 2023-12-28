// Person: Base class and methods for all user account types

const { v4: uuid } = require('uuid');
const { ObjectId, enums, privileges } = require('./base');
const { Faculty } = require('./faculty');
const { Department } = require('./department');
const { Course } = require('./course');
const { Record } = require('./record');

const { genders, statuses } = enums.students;

// Person properties for all users
const person = {
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String },
  email: { type: String, required: true, unique: true },
  status: { type: String, enum: statuses, default: statuses[0] },
  department: { type: ObjectId, ref: 'Department', required: true },
  gender: { type: String, enum: genders, required: true },
  DOB: { type: Date, required: true },
  nationality: String,
  stateOfOrigin: String,
  LGA: String,
  phone: Number,
  picture: String,
  password: String,
  resetPwd: Boolean,
  resetTTL: Date,
  resetOTP: String,
};
const mutableAttr = [
  'email', 'nationality', 'stateOfOrigin', 'LGA', 'phone', 'picture',
];
const privateAttr = [
  'status', 'DOB', 'stateOfOrigin', 'LGA', 'phone', 'role', '__v', 'createdAt',
  'updatedAt', 'password', 'resetPwd', 'resetTTL', 'resetOTP',
];
const personPrivateAttr = privateAttr.slice(-4); // Password/reset fields
const staffPrivateAttr = [...privateAttr, 'privileges', 'assignedCourses'];
const studentPrivateAttr = [...privateAttr, 'registeredCourses', 'projects'];
const privateAttrStr = ['', ...privateAttr.slice(-7, -4)].join(' -').trim();
const personPrivateAttrStr = ['', ...personPrivateAttr].join(' -').trim();
const staffPrivateAttrStr = ['', ...staffPrivateAttr].join(' -').trim();
const studentPrivateAttrStr = ['', ...studentPrivateAttr].join(' -').trim();

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
  const { firstName, middleName, lastName } = this;
  if (middleName) return [firstName, middleName, lastName].join(' ');
  return [firstName, lastName].join(' ');
}

/**
 * Method for users to update their own profile. Includes security checks.
 * @param {object} attributes User's attributes to be updated.
 * @returns {promise.<mongoose.Model>} User object with valid updated attributes.
 */
async function updateProfile(attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    if (mutableAttr.includes(key)) this[key] = val;
  }
  return this.save();
}

/**
 * Method for initiating password reset when a user forgets their password
 * or doesn't have one yet (at account activation). This creates a time-
 * bound OTP/token for the current account, then stores and returns it.
 * @returns {promise.<String>} Password reset token/OTP.
 */
async function forgotPassword() {
  this.resetPwd = true;
  this.resetTTL = Date.now() + (1000 * 60 * 30); // 30 minutes validity
  this.resetOTP = uuid().slice(-7, -1); // random 6-character token
  await this.save();
  return this.resetOTP;
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
  if (this.resetPwd && this.resetOTP === String(OTP).toLowerCase()) { // Case insensitive token
    if (this.resetTTL < Date.now()) return { error: 'ValueError: OTP has expired' };
    this.password = newPassword;
    this.resetOTP = undefined; this.resetTTL = undefined; this.resetPwd = undefined;
    return this.save();
  }
  return { error: 'ValueError: Invalid OTP' };
}

module.exports = {
  person,
  methods: {
    validatePerson,
    getFullName,
    updateProfile,
    forgotPassword,
    resetPassword,
  },
  privateAttr: {
    all: personPrivateAttr.slice(-4),
    person: personPrivateAttr,
    staff: staffPrivateAttr,
    student: studentPrivateAttr,
  },
  privateAttrStr: {
    all: privateAttrStr,
    person: personPrivateAttrStr,
    staff: staffPrivateAttrStr,
    student: studentPrivateAttrStr,
  },
  mutableAttr,
  Faculty,
  Department,
  Course,
  Record,
};
