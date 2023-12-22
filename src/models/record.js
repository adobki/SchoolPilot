// Record class: Mongoose model for records (students' scores)

const mongoose = require('mongoose');
const { ObjectId } = require('./base');

// Record properties
const record = {
  course: { type: ObjectId, ref: 'Course', required: true },
  year: { type: Number, required: true },
  data: [{
    student: { type: ObjectId, ref: 'Student', required: true },
    ca: { type: Number, required: true },
    exam: { type: Number, required: true },
  }],
};
const recordSchema = new mongoose.Schema({ ...record }, { timestamps: true });

// Record class
const Record = mongoose.model('Record', recordSchema);

module.exports = { Record };
