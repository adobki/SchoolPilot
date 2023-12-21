// School classes: Mongoose models for faculties, courses, etc.

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');

// Faculty class
const faculty = { name: { type: String, unique: true, required: true } };
const facultySchema = new mongoose.Schema({ ...faculty }, { timestamps: true });
const Faculty = mongoose.model('Faculty', facultySchema);

// Department class
const department = {
  name: { type: String, unique: true, required: true },
  faculty: { type: ObjectId, ref: 'Faculty', required: true },
  availableCourses: [{
    level: { type: Number },
    courses: [{ type: ObjectId, ref: 'Course' }],
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
const departmentSchema = new mongoose.Schema({ ...department }, { timestamps: true });
const Department = mongoose.model('Department', departmentSchema);

// Course class
const course = {
  department: { type: ObjectId, ref: 'Department', required: true },
  courseCode: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  level: { type: Number, enum: enums.courses.levels, required: true },
  semester: { type: Number, enum: enums.courses.semesters, required: true },
  units: { type: Number, required: true },
};
const courseSchema = new mongoose.Schema({ ...course }, { timestamps: true });
const Course = mongoose.model('Course', courseSchema);

// Record class
const record = {
  courseCode: { type: String, unique: true, required: true },
  year: { type: Number, required: true },
  data: [{
    student: { type: ObjectId, ref: 'Student', required: true },
    ca: { type: Number, required: true },
    exam: { type: Number, required: true },
  }],
};
const recordSchema = new mongoose.Schema({ ...record }, { timestamps: true });
const Record = mongoose.model('Record', recordSchema);

module.exports = {
  Faculty,
  Department,
  Course,
  Record,
};
