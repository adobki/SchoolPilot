// Faculty class: Mongoose model for faculties

const mongoose = require('mongoose');

// Faculty properties
const faculty = {
  name: { type: String, unique: true, required: true },
};
const facultySchema = new mongoose.Schema({ ...faculty }, { timestamps: true });

// Faculty class
const Faculty = mongoose.model('Faculty', facultySchema);

module.exports = { Faculty };
