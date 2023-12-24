// Base model for all Mongoose models/classes in School Pilot

const mongoose = require('mongoose');
const dbClient = require('../utils/db');

// Enums for all Mongoose classes
const genders = ['Male', 'Female'];
const statuses = ['init', 'active', 'deactivated'];
const levels = [100, 200, 300, 400, 500, 600];
const semesters = [1, 2];
const types = ['UG', 'PG'];
const standings = ['good', 'withdrawn', 'graduated', 'suspended', 'rusticated'];
const titles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Emeritus'];
const roles = ['Lecturer', 'HOD', 'Dean', 'Admin', 'SuperAdmin'];
const approvals = ['pending', 'HOD', 'approved'];
const models = ['Faculty', 'Department', 'Course', 'Record', 'Staff', 'Student'];

const enums = {
  courses: { levels, semesters, statuses: approvals },
  staff: { genders, statuses, titles, roles, models },
  students: { genders, statuses, levels, types, standings, roles: ['Student'] },
};

// Privileges for staff accounts by role
const HOD = {
  approveResult: true,
};
const Dean = {
  approveResult: true,
  assignCourse: true,
};
const Admin = {
  createNew: true,
  updateExisting: true,
  assignCourse: true,
};
const SuperAdmin = {
  deleteExisting: true,
};

const privileges = {
  HOD,
  Dean: { ...HOD, ...Dean },
  Admin,
  SuperAdmin: { ...Admin, ...SuperAdmin },
};

module.exports = {
  dbClient,
  ObjectId: mongoose.Types.ObjectId,
  enums,
  privileges,
};
