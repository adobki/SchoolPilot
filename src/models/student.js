// Student class: User accounts for students

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');
const { person, personMutableAttr } = require('./person');

const { levels, types, standings, roles } = enums.students;

// Student properties
const student = {
  matricNo: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  level: { type: Number, enum: levels, default: levels[0] },
  type: { type: String, enum: types, default: types[0] },
  standing: { type: String, enum: standings, default: standings[0] },
  major: { type: String, required: true },
  registeredCourses: [{
    level: { type: Number },
    courses: [{ type: ObjectId, ref: 'Course' }],
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
const mutable = [...personMutableAttr];
const studentSchema = new mongoose.Schema({ ...person, ...student }, { timestamps: true });

// Class method for updating profile
studentSchema.methods.updateProfile = async function (attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    if (mutable.includes(key)) this[key] = val;
  }
  return this.save();
};

// Class method for unregistering courses (for the student's current level)
studentSchema.methods.unregisterCourses = async function () {
  const i = this.registeredCourses.findIndex(course => course.level === this.level);
  if (i >= 0) {
    this.registeredCourses.pop(i); await this.save(); return true;
  } return false;
};

// Class method for registering courses (for the student's current level)
studentSchema.methods.registerCourses = async function (courseIDs) {
  if (!Array.isArray(courseIDs)) return { error: 'ValueError: `courseIDs` must be an array of courseIDs' };
  for (const id of courseIDs) {
    if (!ObjectId.isValid(id)) return { error: `ValueError: ${id} is not a valid ObjectId` };
  }
  await this.unregisterCourses(); // Delete previous record for current level if exists

  // Register selected courses (use Set to ignore duplicates in given list)
  this.registeredCourses.push({ level: this.level, courses: [...new Set(courseIDs)] });
  return this.save();
};

// Static method for retrieving registered courses
studentSchema.statics.getRegisteredCourses = async function (id) {
  if (!ObjectId.isValid(id)) return { error: `ValueError: ${id} is not a valid ObjectId` };
  return (await this.findById(id).populate('registeredCourses.courses')).registeredCourses;
};

// Student class
const Student = mongoose.model('Student', studentSchema);

module.exports = {
  Student,
  mutable,
  enums,
};
