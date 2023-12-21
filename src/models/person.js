// Person: Base class and methods for all user account types

const { ObjectId, enums } = require('./base');
const { Department, Course } = require('./school');

const { genders, statuses } = enums.students;

// Person properties for all users
const person = {
  name: { type: String, required: true },
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
  OTP: String,
};
const personMutableAttr = [
  'email', 'password', 'nationality', 'stateOfOrigin', 'LGA', 'phone', 'picture',
];

module.exports = {
  person,
  personMutableAttr,
  Department,
  Course,
};
