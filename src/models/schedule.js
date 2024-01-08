// Schedule class: Mongoose model for schedules created by users (students)

const mongoose = require('mongoose');
const { ObjectId } = require('./base');

// Schedule properties
const schedule = {
  title: { type: String, required: true },
  time: { type: Date, required: true },
  description: { type: String },
  color: { type: String },
  createdBy: { type: ObjectId, ref: 'Student', required: true },
};
const scheduleSchema = new mongoose.Schema({ ...schedule }, { timestamps: true });

// Prevent creation of duplicate schedule with same title and time for same user
scheduleSchema.index({ title: 1, time: 1, createdBy: 1 }, { unique: true });

// Schedule class
const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = { Schedule };
