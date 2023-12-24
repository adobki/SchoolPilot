// Student class: User accounts for students

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');
const { person, personMutableAttr, personMethods } = require('./person');

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
    level: { type: Number, enum: enums.courses.levels, required: true },
    semester: { type: Number, enum: enums.courses.semesters, required: true },
    courses: [{ type: ObjectId, ref: 'Course', required: true }],
    _id: { type: ObjectId }, // This hides _id in the embedded object
  }],
};
// Create student schema from person + student properties
const studentSchema = new mongoose.Schema({ ...person, ...student }, { timestamps: true });

// Add all imported person methods to student schema
for (const [methodName, method] of Object.entries(personMethods)) {
  studentSchema.methods[methodName] = method;
}

// Validations and constraints for creating a student
studentSchema.pre('validate', personMethods.validateNewPerson);

// Getter for student's full name
studentSchema.virtual('name').get(personMethods.getFullName);
studentSchema.virtual('fullname').get(personMethods.getFullName);

/**
 * Class method for unregistering courses (for the student's current level and semester).
 * @param {number} semester Current semester.
 * @returns {Promise.<boolean>} `true` on success, `false` otherwise.
 */
studentSchema.methods.unregisterCourses = async function unregisterCourses(semester) {
  const i = this.registeredCourses
    .findIndex(course => course.level === this.level && course.semester === semester);
  if (i >= 0) {
    this.registeredCourses.pop(i); await this.save(); return true;
  } return false;
};

/**
 * Class method for unregistering courses (for the student's current level and semester).
 * @param {ObjectId[]} courseIDs Array of ObjectIds for courses to be registered.
 * @param {number} semester Current semester.
 * @returns {promise.<mongoose.Model.<Student>>} User object with registered courses.
 */
studentSchema.methods.registerCourses = async function registerCourses(courseIDs, semester) {
  if (!Array.isArray(courseIDs)) return { error: 'ValueError: `courseIDs` must be an array of courseIDs' };
  for (const id of courseIDs) {
    if (!ObjectId.isValid(id)) return { error: `ValueError: ${id} is not a valid ObjectId` };
  }
  if (semester === undefined) [semester] = enums.courses.semesters; // #ROADMAP: Track this globally
  if (!enums.courses.semesters.includes(semester)) {
    return { error: `ValueError: ${semester}. Semester must be one of these: ${enums.courses.semesters}` };
  }
  await this.unregisterCourses(semester); // Delete previous record for current level if exists

  // Register selected courses (use Set to ignore duplicates in given list)
  this.registeredCourses.push({
    level: this.level,
    semester,
    courses: [...new Set(courseIDs)],
  });
  return this.save();
};

/**
 * Static method for retrieving registered courses for a student by their id.
 * @param {ObjectId} id Student's id (ObjectId).
 * @returns {promise.<Student.registeredCourses>} Array of all courses registered by the user.
 */
studentSchema.statics.getRegisteredCourses = async function getRegisteredCourses(id) {
  if (!ObjectId.isValid(id)) return { error: `ValueError: ${id} is not a valid ObjectId` };
  return (await this.findById(id).populate('registeredCourses.courses')).registeredCourses;
};

// Student class
const Student = mongoose.model('Student', studentSchema);

module.exports = {
  Student,
  mutable: personMutableAttr,
  enums,
};
