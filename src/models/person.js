// Person: Base class and methods for all user account types

const {
  ObjectId, enums, privileges, privateAttr: { privateAttr, privateAttrStr },
} = require('./base');
const { Faculty } = require('./faculty');
const { Department } = require('./department');
const { Course } = require('./course');
const { Project } = require('./project');
const { Record } = require('./record');
const { Schedule } = require('./schedule');
const methods = require('./methods/person_methods');

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

module.exports = {
  person,
  validatePerson,
  methods,
  privateAttr,
  privateAttrStr,
  Faculty,
  Department,
  Course,
  Project,
  Record,
  Schedule,
};
