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

// Validations and constraints for creating and updating a staff
staffSchema.pre('validate', personMethods.validatePerson);

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
 * @returns {mongoose.Model}
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

/**
 * Class method for creating multiple objects/documents in the database simultaneously. Uses the
 * Mongoose `insertMany` method to optimise insertion. However, insertions are done in batches
 * of 500 objects to reduce memory/buffer issues.
 * @param {string} type Model: `Record`, `Course`, `Student`, `Staff`, `Department`, or `Faculty`.
 * @param {object[]} attributes Array of attributes to be assigned per object/document.
 * @returns {object} Object with two properties: `inserted` docs array and `failed` objects array.
*/
staffSchema.methods.createMany = async function createMany(type, attributes) {
  if (!this.privileges.createMany) return { error: 'Access denied' }; // Check staff privileges
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };
  if (!Array.isArray(attributes)) return { error: 'ValueError: attributes must be an array' };

  // Perform security checks and apply business logic to objects/documents before insertion
  const invalid = [];
  attributes = attributes.map((doc, index) => {
    if (typeof doc !== 'object') { // Validate document type
      invalid.push({ index, error: 'ValueError: Document must be an object' }); return undefined;
    }

    for (const key of immutables[type]) delete doc[key]; // Remove user-immutable attributes

    if (type === 'Record') doc.createdBy = this.id; // Permanently links record to current staff

    if (type === 'Staff') { // Prevent assigning user account a higher privilege level than own
      const validRoles = roles.slice(0, roles.findIndex(role => role === this.role) + 1);
      if (doc.role && !validRoles.includes(doc.role)) {
        invalid.push({ index, error: `ValueError: role must be your level (${this.role}) or lower` });
        return undefined;
      }
    }

    return doc;
  });

  // Insert processed documents into the database and handle duplicate key error
  let inserted;
  try {
    inserted = await mongoose.model(type).insertMany(attributes, {
      ordered: false, // Caches all insert errors and reports them only after processing all items
      rawResult: true, // Returns object with successful inserts and cached errors
      limit: 500, // Batch processing for memory management
    });
  } catch (error) {
    if (error.code === 11000) inserted = { mongoose: { results: error.mongoose.results } };
    else throw error;
  }
  let { results } = inserted.mongoose; if (!results) results = inserted.mongoose.validationErrors;

  // Return results if all inserts were successful
  if (inserted.insertedCount === attributes.length) return { inserted: results };

  // Replace Mongoose error objects with custom ones from invalidated documents
  if (invalid.length) for (const { index, error } of invalid) { results[index] = new Error(error); }

  // Separate and return successful and failed inserts
  inserted = []; const failed = [];
  for (let index = 0; index < results.length; index += 1) {
    const obj = results[index];
    if (obj.stack && obj.message) failed.push({ index, error: obj.message }); // Custom error object
    else if (obj.err && obj.err.errmsg) { // Mongoose error object
      const val = obj.err.errmsg.match(/{\s([^{}]+)\s}/);
      failed.push({ index, error: val ? `Duplicate! ${type} with ${val[1]} already exists` : obj.err.errmsg });
    } else inserted.push(obj);
  }
  return { inserted, failed };
};

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  mutable: personMutableAttr,
  immutables,
  enums,
};
