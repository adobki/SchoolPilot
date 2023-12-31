// Course class: Mongoose model for courses

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');

// Course properties
const course = {
  department: { type: ObjectId, ref: 'Department', required: true },
  courseCode: { type: String, required: true },
  name: { type: String, required: true },
  level: { type: Number, enum: enums.courses.levels, required: true },
  semester: { type: Number, enum: enums.courses.semesters, required: true },
  units: { type: Number, required: true },
};
const courseSchema = new mongoose.Schema({ ...course }, { timestamps: true });

// Prevent duplicate course codes in same department
courseSchema.index({ department: 1, courseCode: 1 }, { unique: true });

// Course class
const Course = mongoose.model('Course', courseSchema);

module.exports = { Course };
