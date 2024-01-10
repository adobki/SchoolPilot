// Staff class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums, privileges, immutables } = require('./base');
const { person, methods: personMethods } = require('./person');
const methods = require('./methods/staff_methods');

const { titles, roles } = enums.staff;
const { HOD, Dean, Admin, SuperAdmin } = privileges;

// Staff properties
const staff = {
  staffId: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  title: { type: String, enum: titles, required: true },
  assignedCourses: [{ type: ObjectId, ref: 'Course' }],
  privileges: Object.fromEntries(Object.entries({ ...HOD, ...Dean, ...Admin, ...SuperAdmin })
    .map(([key]) => [key, Boolean])), // Casts `privileges` to Mongoose schema type
};

// Create staff schema from person + staff properties
const staffSchema = new mongoose.Schema(
  { ...person, ...staff }, { timestamps: true, collection: 'staff' },
);

// Add all imported person methods to staff schema
for (const [methodName, method] of Object.entries(personMethods)) {
  staffSchema.methods[methodName] = method;
}

// Validations and constraints for creating and updating a staff
staffSchema.pre('validate', personMethods.validatePerson);

// Getter for staff full name
staffSchema.virtual('name').get(personMethods.getFullName);
staffSchema.virtual('fullname').get(personMethods.getFullName);

// Add all imported staff methods to staff schema
staffSchema.methods.createNew = methods.createNew;
staffSchema.methods.updateExisting = methods.updateExisting;
staffSchema.methods.deleteExisting = methods.deleteExisting;
staffSchema.methods.createMany = methods.createMany;
staffSchema.methods.assignCourses = methods.assignCourses;
staffSchema.methods.getAvailableCourses = methods.getAvailableCourses;
staffSchema.methods.setAvailableCourses = methods.setAvailableCourses;
staffSchema.methods.unsetAvailableCourses = methods.unsetAvailableCourses;
staffSchema.methods.getProjects = methods.getProjects;
staffSchema.methods.gradeProject = methods.gradeProject;

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  immutables,
  enums,
};
