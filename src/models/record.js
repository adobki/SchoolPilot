// Record class: Mongoose model for records (students' scores)

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');

// Record properties
const record = {
  course: { type: ObjectId, ref: 'Course', required: true },
  year: { type: Number, required: true },
  status: { type: String, enum: enums.courses.statuses },
  createdBy: { type: ObjectId, ref: 'Staff', required: true },
  data: [{
    student: { type: ObjectId, ref: 'Student', required: true },
    ca: { type: Number, required: true },
    exam: { type: Number, required: true },
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
const recordSchema = new mongoose.Schema({ ...record }, { timestamps: true });

// Prevent creation of duplicate records for same course and year
recordSchema.index({ course: 1, year: 1 }, { unique: true });

// Validations and constraints for creating a new record
recordSchema.pre('validate', async function validateNewRecord() {
  // Ensure new record has default status
  if (this.isNew) [this.status] = enums.courses.statuses;
  // Ensure data field is not empty
  if (!this.data.length) this.invalidate('data', 'Path `data` is required.');
});

// Record class
const Record = mongoose.model('Record', recordSchema);

module.exports = { Record };
