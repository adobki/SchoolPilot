// Faculty class: Mongoose model for faculties

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');

// Faculty properties
const faculty = {
  name: { type: String, unique: true, required: true },
  availableCourses: [{
    level: { type: Number, enum: enums.courses.levels, required: true },
    semester: { type: Number, enum: enums.courses.semesters, required: true },
    courses: [{ type: ObjectId, ref: 'Course', required: true }],
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
const facultySchema = new mongoose.Schema({ ...faculty }, { timestamps: true });

// Faculty class
const Faculty = mongoose.model('Faculty', facultySchema);

module.exports = { Faculty };
