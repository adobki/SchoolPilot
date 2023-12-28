// Projects class: Mongoose model for student projects/assignments from lecturers

const mongoose = require('mongoose');
const { ObjectId } = require('./base');

// Project properties
const project = {
  name: { type: String, required: true, select: true },
  info: { type: String, required: true, select: true },
  course: { type: ObjectId, ref: 'Course', required: true },
  year: { type: Number, required: true, select: true },
  deadline: { type: Date, required: true, select: true },
  submissions: [{
    student: { type: ObjectId, ref: 'Student', required: true },
    answer: { type: String, required: true },
    score: { type: Number },
    comment: { type: String },
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
  createdBy: { type: ObjectId, ref: 'Staff', required: true },
};
const projectSchema = new mongoose.Schema({ ...project }, { timestamps: true });

// Prevent creation of duplicate project name for same course and year
projectSchema.index({ name: 1, course: 1, year: 1 }, { unique: true });

// Validations and constraints for creating a new project
projectSchema.pre('validate', async function validateNewProject() {
  // Ensure new projects have no submissions
  if (this.isNew && this.submissions.length) this.submissions = [];
});

// Project class
const Project = mongoose.model('Project', projectSchema);

module.exports = { Project };
