// Methods for Staff class/user accounts for staff

const mongoose = require('mongoose');
const { ObjectId, enums, immutables, privateAttr: { privateAttr, privateAttrStr } } = require('../base');

const { roles, models } = enums.staff;
const { statuses, levels } = enums.courses;

/**
 * Class method for creating a new object/document in the database. All types require a specific
 * privilege to create them, except `Project` and `Record`, which require that the associated
 * course must be assigned to the staff. Therefore, only the lecturer(s) for a specific course
 * can post students' results and projects for same, and only admins can create the other types.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @param {Object} attributes Attributes to be assigned to the new object/document.
 * @returns {Promise.<mongoose.Model>}
 */
async function createNew(type, attributes) {
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
}

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
async function updateExisting(id, type, attributes) {
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
}

/**
 * Class method for deleting an existing object/document in the database. All types require
 * a specific priviledge to delete them, except `Project`, which can also be deleted by the
 * staff who created it.
 * @param {ObjectId} id ID of object to be deleted.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @returns {Promise.<mongoose.model>}
 */
async function deleteExisting(id, type) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!models.includes(type)) return { error: `ValueError: Invalid type. Valid types are: ${models}` };

  // Check staff privileges
  if (!this.privileges.deleteExisting) {
    if (type === 'Project') {
      // Find and delete project from database then return it if owned by this staff
      const deleted = await mongoose.model(type)
        .findOneAndDelete({ _id: id, createdBy: this.id }).exec();
      if (deleted) return deleted;
    }
    return { error: 'Access denied' };
  }

  // Find and delete object/document from database if it exists
  const deleted = await mongoose.model(type).findByIdAndDelete(id).exec();
  if (!deleted) return { error: `ValueError: ${type} with id=${id} not found` };

  // Return deleted object
  return deleted;
}

/**
 * Class method for creating multiple objects/documents in the database simultaneously. Uses the
 * Mongoose `insertMany` method to optimise insertion. However, insertions are done in batches
 * of 500 objects to reduce memory/buffer issues.
 * @param {String} type `Project`|`Record`|`Course`|`Student`|`Staff`|`Department`|`Faculty`.
 * @param {Object[]} attributes Array of attributes to be assigned per object/document.
 * @returns {Promise.<Object>} Object with 2 properties: `inserted` docs & `failed` objects arrays.
*/
async function createMany(type, attributes) {
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
}

/**
 * Class method for assigning courses to a lecturer (staff).
 * Unassign courses by sending a slice or an empty array.
 * @param {ObjectId} id ID of lecturer to be assigned the courses.
 * @param {ObjectId[]} courses Array of courses to be assigned.
 * @returns {Promise.<mongoose.model>}
 */
async function assignCourses(id, courses) {
  if (!this.privileges.assignCourse) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!Array.isArray(courses)) return { error: 'ValueError: courses must be an array' };
  if (courses.map(course => ObjectId.isValid(course)).includes(false)
  ) return { error: 'ValueError: courses must be an array of ObjectIds' };

  // Retrieve staff from database
  const staff = await mongoose.model('Staff').findById(id)
    .select(privateAttr.all)
    .populate('department', `${privateAttrStr.all} -availableCourses`).exec();
  if (!staff) return { error: `ValueError: Staff with id=${id} not found` };

  // Check for courses unassignment on empty courses array
  if (!courses.length) {
    staff.assignedCourses = [];
    return staff.save();
  }

  // Retrieve courses from database to validate them
  courses = await mongoose.model('Course').find({ _id: { $in: courses } })
    .select(privateAttr.all)
    .populate('department', `${privateAttrStr.all} -availableCourses`);
  if (!courses.length) return { error: 'ValueError: None of the courses exists' };

  // Filter valid courses from departments in the lecturer's faculty
  const results = courses.reduce((results, course, index) => {
    if (String(course.department.faculty) === String(staff.department.faculty)
    ) results.registered.push(course);
    else results.failed.push({ index, course, reason: "Not from lecturer's faculty" });
    return results;
  }, { staff: {}, registered: [], failed: [] });

  // Assign valid courses to staff (overwrites previous assignment)
  if (results.registered) {
    staff.assignedCourses = results.registered;
    await staff.save();
  }

  // Return staff object if all courses were valid or results object otherwise
  if (!results.failed.length) return staff;
  return { ...results, staff };
}

/**
 * Class method for approving a record (result) submitted for a course by a lecturer.
 * Records go through two stages of approval: HOD first, then Dean. In that order.
 * @param {ObjectId} id ID of record to be approved.
 * @returns {Promise.<mongoose.model>}
 */
async function approveRecord(id) {
  if (!this.privileges.approveResult) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };

  // Retrieve record from database
  const record = await mongoose.model('Record').findById(id)
    .populate('data.student createdBy', `${privateAttrStr.student} ${privateAttrStr.staff}`);
  if (!record) return { error: `ValueError: Record with id=${id} not found` };

  // Check approval status
  const { status } = record;
  if (status === statuses.at(-1)) return { error: 'Record has already been approved' };
  if (status === this.role) return { error: 'Record has already been approved by you' };
  if (status === statuses[0] && this.role !== roles[1]
  ) return { error: 'Record needs to be approved by the HOD first' };

  // Approve record and return it
  record.status = statuses[statuses.findIndex(status) + 1];
  return record.save();
}

/**
 * Class method for getting all available courses by level in a faculty/department.
 * This data is used by students for course registration, and is available to all staff.
 * @param {ObjectId} _id ID of department or faculty.
 * @param {String} type Database model: `Faculty` | `Department`.
 * @param {number} level Level to retrieve courses for.
 */
async function getAvailableCourses(_id, type, level = undefined) {
  if (!ObjectId.isValid(_id)) return { error: 'ValueError: Invalid id' };
  if (type !== 'Faculty' && type !== 'Department'
  ) return { error: 'ValueError: Invalid type. Valid types are: Faculty, Department' };
  if (level !== undefined && !levels.includes(level)
  ) return { error: `ValueError: ${level}. Level must be one of these: undefined,${levels}` };

  // Query helpers
  const filter = level ? { $elemMatch: { level } } : 1;
  const select = { name: 1, availableCourses: filter };
  if (type === 'Department') select.faculty = 1;

  // Retrieve available courses from database for given department or faculty
  return mongoose.model(type).findOne({ _id }).select(select)
    .populate('availableCourses.courses', privateAttrStr.all);
}

/**
 * Class method for setting all available courses by level and semester in a faculty/department.
 * Can unset some courses by sending a slice of the array for a particular level and semester.
 * This data is used by students for course registration.
 * @param {ObjectId} id ID of lecturer to be assigned the courses.
 * @param {String} type Model: `Faculty` | `Department`.
 * @param {Object[]} courses Array of courses to be assigned.
 * @returns {promise.<mongoose.model>}
 */
async function setAvailableCourses(id, type, courses) {
  if (!this.privileges.setCourses) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (type !== 'Faculty' && type !== 'Department'
  ) return { error: 'ValueError: Invalid type. Valid types are: Faculty, Department' };
  if (!Array.isArray(courses)) return { error: 'ValueError: courses must be an array' };

  // Retrieve faculty or department from database
  const obj = await mongoose.model(type).findById(id).select(privateAttr.all).exec();
  if (!obj) return { error: `ValueError: ${type} with id=${id} not found` };

  // Retrieve courses from database to validate them
  courses = await mongoose.model('Course').find({ _id: { $in: courses } })
    .select(privateAttr.all); // .populate('faculty', 'name availableCourses');
  if (!courses.length) return { error: 'ValueError: None of the courses exist' };

  // Parse courses for database schema: Group by level and semester in an object
  const groupedCourses = courses.reduce((results, course) => {
    const { level, semester } = course;
    if (!results[level]) results[level] = {}; // Create slot for current level
    if (!results[level][semester]) results[level][semester] = []; // Create slot for semester
    results[level][semester].push(course);
    return results;
  }, {});

  // Create hash table for the original availableCourses array
  const available = obj.availableCourses.reduce((results, course, index) => {
    results[`${course.level}-${course.semester}`] = index;
    return results;
  }, {});

  // Update availableCourses array in given department/faculty
  for (const [level, data] of Object.entries(groupedCourses)) {
    for (const [semester, courses] of Object.entries(data)) {
      // Replace previous record for level/semester if any or add new entry otherwise
      const i = available[`${level}-${semester}`];
      if (i !== undefined) obj.availableCourses[i] = { level, semester, courses };
      else obj.availableCourses.push({ level, semester, courses });
    }
  }

  // Save courses and return updated department/faculty
  return obj.save();
}

/**
 * Class method for un-setting available courses by level and semester in a faculty/department.
 * This data is used by students for course registration.
 * @example
 * unsetAvailableCourses(new ObjectId, 'Faculty', [{ level: 100, semester: 1 }])
 * @param {ObjectId} id ID of lecturer to be assigned the courses.
 * @param {String} type Model: `Faculty` | `Department`.
 * @param {Object[]} data Array of available courses data to be unset.
 * @returns {promise.<mongoose.model>}
 */
async function unsetAvailableCourses(id, type, data) {
  if (!this.privileges.setCourses) return { error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (type !== 'Faculty' && type !== 'Department'
  ) return { error: 'ValueError: Invalid type. Valid types are: Faculty, Department' };
  if (!Array.isArray(data) || !data.length
  ) return { error: 'ValueError: data must be an array of objects like { level: <val>, semester <val> }' };

  // Retrieve faculty or department from database
  const obj = await mongoose.model(type).findById(id).select(privateAttr.all).exec();
  if (!obj) return { error: `ValueError: ${type} with id=${id} not found` };

  // Create hash table for the original availableCourses array
  const available = obj.availableCourses.reduce((results, course, index) => {
    results[`${course.level}-${course.semester}`] = index;
    return results;
  }, {});

  // Map data to indexes of the current availableCourses array
  data = data.map(datum => available[`${datum.level}-${datum.semester}`]);
  data.sort((a, b) => b - a); // Sort in descending order for array splicing

  // Splice availableCourses array to unset the specified available courses
  const results = data.map(index => {
    if (index === undefined) return false; // No previous record for level and semester
    obj.availableCourses.splice(index, 1); // Remove previous record for level and semester
    return true;
  });

  // Save and return updated department/faculty if one or more records were updated
  if (results.includes(true)) return obj.save();
  // Return error as no records were updated
  return { error: 'No action occurred' };
}

/**
 * Class method for retrieving some or all projects for a lecturer's assigned courses.
 * @param {ObjectId[]} courses Array of lecturer's courses to be checked for projects.
 * @returns {promise.<mongoose.model[]>}
 */
async function getProjects(courses = undefined) {
  if (!this.assignedCourses.length) return [];
  if (!courses) courses = this.assignedCourses;
  if (!Array.isArray(courses)) return { error: 'ValueError: courses must be an array' };
  if (courses.map(course => ObjectId.isValid(course)).includes(false)
  ) return { error: 'ValueError: courses must be an array of ObjectIds' };

  // Find project(s), populate students' data without private information, return results
  return mongoose.model('Project').find({ course: { $in: courses } })
    .populate('course submissions.student', privateAttrStr.student);
}

/**
 * Class method for adding comments and students' scores to projects.
 * @example
 * gradeProjects(id, { student : { score: 8, comment: 'Well done!' }})
 * @param {ObjectId} id ID of project to be graded.
 * @param {Object[]} scores Object with `student` ids that have a `score` and optional `comment`.
 * @returns {promise.<mongoose.model>}
 */
async function gradeProject(id, scores) {
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

  // Add scores of students and comments to submissions for the project in the database
  let graded = false;
  project.submissions.map(submission => {
    const grade = submission.student ? scores[submission.student.id] : undefined;
    if (grade) {
      submission.score = grade.score;
      submission.comment = grade.comment;
      graded = true;
    }
    return submission;
  });

  // Return results
  if (graded) return project.save();
  return { error: 'No action occurred' };
}

module.exports = {
  createNew,
  updateExisting,
  deleteExisting,
  createMany,
  assignCourses,
  approveRecord,
  getAvailableCourses,
  setAvailableCourses,
  unsetAvailableCourses,
  getProjects,
  gradeProject,
};
