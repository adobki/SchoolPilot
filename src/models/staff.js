// Staff class: User accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums, privileges, immutables } = require('./base');
const { person, methods, privateAttr, privateAttrStr } = require('./person');

const { titles, roles, models } = enums.staff;
const { statuses, levels } = enums.courses;
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
for (const [methodName, method] of Object.entries(methods)) {
  staffSchema.methods[methodName] = method;
}

// Validations and constraints for creating and updating a staff
staffSchema.pre('validate', methods.validatePerson);

// Getter for staff full name
staffSchema.virtual('name').get(methods.getFullName);
staffSchema.virtual('fullname').get(methods.getFullName);

/**
 * Class method for creating a new object/document in the database. All types require a specific
 * priviledge to create them, except `Project` and `Record`, which require that the associated
 * course must be assigned to the staff. Therefore, only the lecturer(s) for a specific course
 * can post students' results and projects for same, and only admins can create the other types.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @param {Object} attributes Attributes to be assigned to the new object/document.
 * @returns {Promise.<mongoose.Model>}
 */
staffSchema.methods.createNew = async function createNew(type, attributes) {
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Prevent setting user-immutable attributes on current model type
  for (const key of immutables[type]) { delete attributes[key]; }

  if (type === 'Project' || type === 'Record') {
    // Check if specified course is assigned to this staff
    if (this.assignedCourses.map(obj => String(obj._id)).includes(String(attributes.course))) {
      attributes.createdBy = this.id; // Permanently link the new document to the current staff
      return mongoose.model(type)(attributes).save();
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
 * Class method for updating an existing object/document in the database. All types require
 * a specific priviledge to update them, except `Project` and `Record`, which can only be
 * updated by the staff who created them. Therefore, only the creator of a project or record
 * can edit it, and only admins can edit the other types.
 * @param {ObjectId} id ID of object to be updated.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @param {Object} attributes Attributes to be assigned to the object/document.
 * @returns {Promise.<mongoose.model>}
 */
staffSchema.methods.updateExisting = async function updateExisting(id, type, attributes) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Retrieve object/document from database
  const obj = await mongoose.model(type).findById(id).exec();
  if (!obj) return { error: `ValueError: ${type} with id=${id} not found` };

  if (type === 'Project' || type === 'Record') {
    // Check if project or record is owned by this staff
    if (String(obj.createdBy) !== this.id) return { error: 'Access denied' };
    // Prevent updating approved records
    if (obj.status === statuses.slice(-1)[0]
    ) return { error: 'Access denied! Approved records can not be updated' };

    // Check staff privileges before proceeeding with other types
  } else if (!this.privileges.createNew) return { error: 'Access denied' };

  if (type === 'Staff') {
    // Prevent updating own account with this method (must use updateProfile method)
    if (obj.id === this.id) return { error: 'Access denied! Use `updateProfile` for self' };
    // Prevent assigning user account a higher privilege level than own
    if (attributes.role) {
      const validRoles = roles.slice(0, roles.findIndex(role => role === this.role) + 1);
      const valid = validRoles.includes(attributes.role);
      if (!valid) return { error: `ValueError: role must be your level (${this.role}) or lower` };
    }
  }

  // Prevent updating user-immutable attributes on current model type
  for (const key of immutables[type]) { delete attributes[key]; }

  // Apply given attributes updates to object/document
  for (const [key, value] of Object.entries(attributes)) { obj[key] = value; }
  return obj.save();
};

/**
 * Class method for creating multiple objects/documents in the database simultaneously. Uses the
 * Mongoose `insertMany` method to optimise insertion. However, insertions are done in batches
 * of 500 objects to reduce memory/buffer issues.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @param {Object[]} attributes Array of attributes to be assigned per object/document.
 * @returns {Promise.<Object>} Object with 2 properties: `inserted` docs & `failed` objects arrays.
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

    doc.createdBy = this.id; // Permanently link project or record to current staff

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

/**
 * Class method for assigning courses to a lecturer (staff).
 * Unassign courses by sending a slice or an empty array.
 * @param {ObjectId} id ID of lecturer to be assigned the courses.
 * @param {ObjectId[]} courses Array of courses to be assigned.
 * @returns {Promise.<mongoose.model>}
 */
staffSchema.methods.assignCourses = async function assignCourses(id, courses) {
  if (!this.privileges.assignCourse) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!Array.isArray(courses)) return { error: 'ValueError: courses must be an array' };
  if (courses.map(course => ObjectId.isValid(course)).includes(false)
  ) return { error: 'ValueError: courses must be an array of ObjectIds' };

  // Retrieve staff from database
  const staff = await mongoose.model('Staff').findById(id).exec();
  if (!staff) return { error: `ValueError: Staff with id=${id} not found` };

  // Assign courses to staff (overwrites previous assignment)
  staff.assignedCourses = courses;
  return staff.save();
};

/**
 * Class method for retrieving all projects for a lecturer's assigned courses.
 * @returns {promise.<mongoose.model[]>}
 */
staffSchema.methods.getProjects = async function getProjects() {
  if (!this.assignedCourses.length) return [];

  // Strip students' private information and return results
  return mongoose.model('Project')
    .find({ course: { $in: this.assignedCourses } })
    .populate('course submissions.student', privateAttrStr.student);
};

/**
 * Class method for creating a new project for a course assigned to lecturer.
 * @param {object[]} attributes Attributes to be assigned to the new project.
 * @returns {promise.<mongoose.model>}
 */
staffSchema.methods.createProject = async function createProject(attributes) {
  if (typeof attributes !== 'object') return { error: 'ValueError: attributes must be an object' };

  // Check if specified course is assigned to this staff
  if (!this.assignedCourses.map(obj => String(obj._id)).includes(String(attributes.course))
  ) return { error: 'Access denied' };

  // Prevent setting user-immutable attributes on new project
  for (const key of immutables.Project) { delete attributes[key]; }
  attributes.createdBy = this.id; // Permanently link the new project to the current staff

  // Create and return the project
  return mongoose.model('Project')(attributes).save();
};

/**
 * Class method for adding comments and students' scores to projects.
 * @example
 * gradeProjects(id, { student : { score: 8, comment: 'Well done!' }})
 * @param {ObjectId} id ID of project to be graded.
 * @param {Object[]} scores Object with `student` ids that have a `score` and optional `comment`.
 * @returns {promise.<mongoose.model>}
 */
staffSchema.methods.gradeProject = async function gradeProject(id, scores) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (typeof scores !== 'object') return { error: 'ValueError: courses must be an object' };
  if (Object.keys(scores).map(key => ObjectId.isValid(key)).includes(false)
  ) return { error: 'ValueError: Invalid id! All student IDs must be ObjectIds' };

  // Retrieve project from database
  const project = await mongoose.model('Project').findById(id)
    .populate('course submissions.student', privateAttrStr.student);
  if (!project) return { error: `ValueError: Project with id=${id} not found` };

  // Check if project is owned by this staff
  if (String(project.createdBy) !== this.id) return { error: 'Access denied' };

  // Prevent grading a project before its deadline
  if (project.deadline > Date.now()) return { error: 'Projects can only be graded after their deadline' };

  // Store scores and comments of students with submissions for the project in the database
  project.submissions.map(submission => {
    const grade = scores[String(submission.student)];
    if (grade) submission.score = grade.score; submission.comment = grade.comment;
    return submission;
  });
  return project.save();
};

// Staff class
const Staff = mongoose.model('Staff', staffSchema);

module.exports = {
  Staff,
  immutables,
  enums,
};
