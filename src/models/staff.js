// Staff class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums, privileges, immutables } = require('./base');
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
 * @param {string} type Model: `Record`, `Course`, `Student`, `Staff`, `Department`, or `Faculty`.
 * @param {object} attributes Attributes to be assigned to the new object/document.
 * @returns {mongoose.model}
 */
staffSchema.methods.createNew = async function createNew(type, attributes) {
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  if (type === 'Record') {
    // Check if specified course is assigned to this staff
    if (this.assignedCourses.map(obj => String(obj._id)).includes(String(attributes.course))) {
      return mongoose.model(type)({
        ...attributes,
        status: enums.courses.statuses[0], // Enforces default status on new records
        createdBy: this.id, // Permanently links the new record to the current staff
      }).save();
    } return { error: 'Access denied' };
  }

  // Check staff privileges before proceeeding with other types
  if (!this.privileges.createNew) return { error: 'Access denied' };

  // Prevent creating user account with higher privilege level than own
  if (type === 'Staff' && attributes.role) {
    const validRoles = roles.slice(0, roles.findIndex(role => role === this.role) + 1);
    const valid = validRoles.includes(attributes.role);
    if (!valid) return { error: `ValueError: role must be your level (${this.role}) or lower` };
  }
  return mongoose.model(type)(attributes).save();
};

/**
 * Class method for updating an existing object/document in the database. All types require staff
 * to have a specific priviledge to update them, except `Record`, which can only be updated by the
 * the staff that created it. Therefore, only the creator of a record can edit it, and only admins
 * can edit the other types.
 * @param {ObjectId} id ID of object to be updated.
 * @param {string} type Model: `Record`, `Course`, `Student`, `Staff`, `Department`, or `Faculty`.
 * @param {object} attributes Attributes to be assigned to the object/document.
 * @returns {mongoose.model}
 */
staffSchema.methods.updateExisting = async function updateExisting(id, type, attributes) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Retrieve object/document from database
  const obj = await mongoose.model(type).findById(id).exec();
  if (!obj) return { error: `ValueError: ${type} with id=${id} not found` };

  if (type === 'Record') {
    // Check if record is owned by this staff
    if (String(obj.createdBy) !== String(this.id)) return { error: 'Access denied' };
    // Prevent updating approved records
    if (obj.status === enums.courses.statuses.slice(-1)[0]
    ) return { error: 'Access denied! Approved records can not be updated' };
  }

  // Check staff privileges before proceeeding with other types
  if (type !== 'Record' && !this.privileges.createNew) return { error: 'Access denied' };

  if (type === 'Staff') {
    // Prevent updating own account with this method (must use updateProfile method)
    if (String(obj.id) === String(this.id)) return { error: 'Access denied! Use `updateProfile` for self' };
    // Prevent assigning user account a higher privilege level than own
    if (attributes.role) {
      const validRoles = roles.slice(0, roles.findIndex(role => role === this.role) + 1);
      const valid = validRoles.includes(attributes.role);
      if (!valid) return { error: `ValueError: role must be your level (${this.role}) or lower` };
    }
  }

  // Prevent updating user-immutable attributes on current model type
  for (const key of immutables[type]) {
    delete attributes[key];
  }

  // Apply given attributes updates to object/document
  for (const [key, value] of Object.entries(attributes)) {
    obj[key] = value;
  }
  return obj.save();
};

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  mutable: personMutableAttr,
  immutables,
  enums,
};
