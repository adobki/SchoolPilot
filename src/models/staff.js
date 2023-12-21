// Student class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums } = require('./base');
const { person, personMutableAttr } = require('./person');

const { titles, roles } = enums.staff;

// Staff properties
const staff = {
  staffId: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  title: { type: String, enum: titles, required: true },
  assignedCourses: [{ type: ObjectId, ref: 'Course' }],
};
const mutable = [...personMutableAttr];
const staffSchema = new mongoose.Schema(
  { ...person, ...staff }, { timestamps: true, collection: 'staff' },
);

// Class method for updating profile
staffSchema.methods.updateProfile = async function (attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    if (mutable.includes(key)) this[key] = val;
  }
  return this.save();
};

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  mutable,
  enums,
};
