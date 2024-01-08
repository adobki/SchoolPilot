// Person: Base class and methods for all user account types

const {
  ObjectId, enums, privateAttr: { privateAttr, privateAttrStr },
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


module.exports = {
  person,
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
