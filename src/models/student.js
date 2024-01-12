// Student class: User accounts for students

const mongoose = require('mongoose');
const { ObjectId, enums, immutables } = require('./base');
const { person, validatePerson, methods: personMethods } = require('./person');
const studentMethods = require('./methods/student_methods');

const { levels, types, standings, roles, entryMode } = enums.students;
const { semesters } = enums.courses;

// Student properties
const student = {
  matricNo: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  level: { type: Number, enum: levels, default: levels[0] },
  type: { type: String, enum: types, default: types[0] },
  standing: { type: String, enum: standings, default: standings[0] },
  major: { type: String, required: true },
  entryMode: { type: String, required: true, default: entryMode[0] },
  registeredCourses: [{
    level: { type: Number, enum: levels, required: true },
    semester: { type: Number, enum: semesters, required: true },
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

// Validations and constraints for creating and updating a student
studentSchema.pre('validate', validatePerson);

// Getter for student's full name
studentSchema.virtual('name').get(personMethods.getFullName);
studentSchema.virtual('fullname').get(personMethods.getFullName);

// Add all imported student methods to student schema
studentSchema.methods.getAvailableCourses = studentMethods.getAvailableCourses;
studentSchema.methods.unregisterCourses = studentMethods.unregisterCourses;
studentSchema.methods.registerCourses = studentMethods.registerCourses;
studentSchema.methods.getRegisteredCourses = studentMethods.getRegisteredCourses;
studentSchema.methods.getProjects = studentMethods.getProjects;
studentSchema.methods.submitProject = studentMethods.submitProject;

// Student class
const Student = mongoose.model('Student', studentSchema);

module.exports = {
  Student,
  immutables,
  enums,
};
