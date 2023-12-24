// Staff class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums, privileges } = require('./base');
const { person, personMutableAttr, personMethods } = require('./person');

const { titles, roles, models } = enums.staff;
const { HOD, Dean, Admin, SuperAdmin } = privileges;

// Staff properties
const staff = {
  staffId: { type: String, unique: true, required: true },
  role: { type: String, enum: roles, default: roles[0] },
  title: { type: String, enum: titles, required: true },
  privileges: Object.fromEntries(Object.entries({ ...HOD, ...Dean, ...Admin, ...SuperAdmin })
    .map(([key]) => [key, Boolean])), // Casts `privileges` to Mongoose schema type
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

// Validations and constraints for creating a staff
staffSchema.pre('validate', personMethods.validateNewPerson);

// Getter for staff full name
staffSchema.virtual('name').get(personMethods.getFullName);
staffSchema.virtual('fullname').get(personMethods.getFullName);

/**
 * Class method for creating a new object/document in the database. All types require staff to have
 * a specific priviledge to create them, except `Record`, which requires that the associated course
 * must be assigned to the staff. Therefore, only the lecturer(s) for a specific course can post
 * students' results for same, and only admins can create the other types.
 * @param {string} type `Record`, `Course`, `Student`, `Staff`, `Department`, or `Faculty`.
 * @param {object} attributes Attributes to be assigned to the new object.
 * @returns {mongoose.Model.<Staff>}
 */
staffSchema.methods.createNew = function createNew(type, attributes) {
  if (!models.includes(type)) return { error: 'ValueError: Invalid type' };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  if (type === 'Record') {
    // Check if specified course is assigned to this staff
    if (this.assignedCourses.map(obj => String(obj._id)).includes(String(attributes.course))) {
      return mongoose.model('Record')({
        ...attributes,
        status: enums.courses.statuses[0], // Enforces default status on new records
        createdBy: this.id, // Permanently links the new record to the current staff
      }).save();
    } return { error: 'Access denied' };
  }

  // Check staff privileges before proceeeding
  if (!this.privileges.createNew) return { error: 'Access denied' };

  // Prevent creating user account with higher privilege level than own
  if (type === 'Staff' && attributes.role) {
    const validRoles = roles.slice(0, roles.findIndex(role => role === this.role) + 1);
    const valid = validRoles.includes(attributes.role);
    if (!valid) return { error: `ValueError: role must be your level (${this.role}) or lower` };
  }
  return mongoose.model(type)(attributes).save();
};

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  mutable: personMutableAttr,
  enums,
};
