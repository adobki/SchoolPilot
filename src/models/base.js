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
const models = ['Faculty', 'Department', 'Course', 'Project', 'Record', 'Staff', 'Student'];

const enums = {
  courses: { levels, semesters, statuses: approvals },
  staff: { genders, statuses, titles, roles, models },
  students: { genders, statuses, levels, types, standings, roles: ['Student'] },
};

// Privileges for staff accounts by role
const HOD = {
  approveResult: true,
  assignCourse: true,
};
const Dean = {
  setCourses: true,
};
const Admin = {
  assignCourse: true,
  setCourses: true,
  createNew: true,
  updateExisting: true,
};
const SuperAdmin = {
  createMany: true,
  deleteExisting: true,
};

const privileges = {
  HOD,
  Dean: { ...HOD, ...Dean },
  Admin,
  SuperAdmin: { ...Admin, ...SuperAdmin },
};

// System attributes (user-immutable attributes that can only be set automatically)
const immutableGlobal = ['id', '_id', 'createdAt', 'updatedAt'];
const immutableDepartment = [...immutableGlobal, 'availableCourses'];
const immutableProject = [...immutableGlobal, 'createdBy', 'submissions'];
const immutableRecord = [...immutableGlobal, 'createdBy', 'status'];
const immutablePerson = [...immutableGlobal, 'status', 'password', 'resetPwd', 'resetTTL', 'resetOTP'];
const immutableStudent = [...immutablePerson, 'registeredCourses'];
const immutableStaff = [...immutablePerson, 'assignedCourses'];
const immutable = [...new Set([
  ...immutableDepartment, ...immutableProject, ...immutableRecord,
  ...immutableStaff, ...immutableStudent,
])];

const immutables = {
  all: immutable,
  Course: immutableGlobal,
  Project: immutableProject,
  Faculty: immutableDepartment,
  Department: immutableDepartment,
  Record: immutableRecord,
  Staff: immutableStaff,
  Student: immutableStudent,
};

// Private attributes to be omitted from returned models in staff/student methods
const allPrivateAttr = { __v: 0, updatedAt: 0 };
const passwordAttr = { password: 0, resetPwd: 0, resetTTL: 0, resetOTP: 0 };
const personPrivateAttr = {
  ...allPrivateAttr,
  ...passwordAttr,
  status: 0,
  DOB: 0,
  stateOfOrigin: 0,
  LGA: 0,
  phone: 0,
  role: 0,
};
const staffPrivateAttr = { ...personPrivateAttr, privileges: 0, assignedCourses: 0 };
const studentPrivateAttr = { ...personPrivateAttr, registeredCourses: 0 };

// Concatenated version of private attribues for use in Mongoose project() method
const allPrivateAttrStr = ['', ...Object.keys(allPrivateAttr)].join(' -').trim();
const personPrivateAttrStr = ['', ...Object.keys(personPrivateAttr)].join(' -').trim();
const staffPrivateAttrStr = ['', ...Object.keys(staffPrivateAttr)].join(' -').trim();
const studentPrivateAttrStr = ['', ...Object.keys(studentPrivateAttr)].join(' -').trim();

const privateAttr = {
  privateAttr: {
    all: allPrivateAttr,
    person: passwordAttr,
    staff: staffPrivateAttr,
    student: studentPrivateAttr,
  },
  privateAttrStr: {
    all: allPrivateAttrStr,
    person: personPrivateAttrStr,
    staff: staffPrivateAttrStr,
    student: studentPrivateAttrStr,
  },
};

module.exports = {
  dbClient,
  ObjectId: mongoose.Types.ObjectId,
  enums,
  privileges,
  immutables,
  privateAttr,
};
