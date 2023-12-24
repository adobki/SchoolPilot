// Staff class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');
const { person, personMutableAttr, personMethods } = require('./person');

const { titles, roles } = enums.staff;

// Staff properties
const staff = {
  staffId: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  title: { type: String, enum: titles, required: true },
  assignedCourses: [{ type: ObjectId, ref: 'Course' }],
};

// Create staff schema from person + staff properties
const staffSchema = new mongoose.Schema(
  { ...person, ...staff }, { timestamps: true, collection: 'staff' },
);

// Add all imported person methods to staff schema
for (const [methodName, method] of Object.entries(personMethods)) {
  staffSchema.methods[methodName] = method;
}

// Getter for staff full name
staffSchema.virtual('name').get(personMethods.getFullName);
staffSchema.virtual('fullname').get(personMethods.getFullName);

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  mutable: personMutableAttr,
  enums,
};
