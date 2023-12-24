// Person: Base class and methods for all user account types

const { v4: uuid } = require('uuid');
const { ObjectId, enums } = require('./base');
const { Department, Course } = require('./school');

const { genders, statuses } = enums.students;

// Person properties for all users
const person = {
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String },
  email: { type: String, required: true },
  status: { type: String, enum: statuses, default: statuses[0] },
  department: { type: ObjectId, ref: 'Department', required: true },
  gender: { type: String, enum: genders, required: true },
  DOB: { type: Date, required: true },
  password: String,
  nationality: String,
  stateOfOrigin: String,
  LGA: String,
  phone: Number,
  picture: String,
  resetPwd: Boolean,
  resetTTL: Date,
  resetOTP: String,
};
const personMutableAttr = [
  'email', 'nationality', 'stateOfOrigin', 'LGA', 'phone', 'picture',
];

// Getter for `name` and `fullname`
function getFullName() {
  const { firstName, middleName, lastName } = this;
  if (middleName) return [firstName, middleName, lastName].join(' ');
  return [firstName, lastName].join(' ');
}

// Method for updating profile
async function updateProfile(attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    if (personMutableAttr.includes(key)) this[key] = val;
  }
  return this.save();
}

// Method for initiating password reset
async function forgotPassword() {
  this.resetPwd = true;
  this.resetTTL = Date.now() + (1000 * 60 * 30); // 30 minutes validity
  this.resetOTP = uuid().slice(-7, -1); // random 6-character token
  await this.save();
  return this.resetOTP;
}

// Method for resetting password
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
  personMethods: {
    getFullName,
    updateProfile,
    forgotPassword,
    resetPassword,
  },
  personMutableAttr,
  Department,
  Course,
};
