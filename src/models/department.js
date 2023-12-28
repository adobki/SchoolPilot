// Department class: Mongoose model for departments

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');

// Department properties
const department = {
  name: { type: String, unique: true, required: true },
  faculty: { type: ObjectId, ref: 'Faculty', required: true },
  availableCourses: [{
    level: { type: Number, enum: enums.courses.levels, required: true },
    semester: { type: Number, enum: enums.courses.semesters, required: true },
    courses: [{ type: ObjectId, ref: 'Course', required: true }],
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
const departmentSchema = new mongoose.Schema({ ...department }, { timestamps: true });

// Department class
const Department = mongoose.model('Department', departmentSchema);

// module.exports = { Department, Faculty, Course };
module.exports = { Department };
