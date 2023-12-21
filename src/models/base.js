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

const enums = {
  courses: { levels, semesters },
  staff: { genders, statuses, titles, roles },
  students: { genders, statuses, levels, types, standings, roles: ['Student'] },
};

module.exports = {
  dbClient,
  ObjectId: mongoose.Types.ObjectId,
  enums,
};
