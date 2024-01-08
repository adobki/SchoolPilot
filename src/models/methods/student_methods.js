// Methods for Student class/user accounts for students

const mongoose = require('mongoose');
const { ObjectId, enums, immutables } = require('../base');
const { privateAttrStr } = require('../person');

const { semesters } = enums.courses;

/**
 * Class method for getting list of available courses for student's course registration.
 * @param {number} semester Current semester of the school year.
 */
async function getAvailableCourses(semester) {
  if (!semester) [semester] = semesters; // #ROADMAP: Track this globally
  if (!semesters.includes(semester)
  ) return { error: `ValueError: ${semester}. Semester must be one of these: ${semesters}` };

  // Query helpers
  const select = { name: 1, availableCourses: { $elemMatch: { level: this.level, semester } } };
  const populate = ['availableCourses.courses', privateAttrStr.all];

  // Retrieve available courses from database for student's department by level and semester
  const department = await mongoose.model('Department').findOne({ _id: this.department })
    .select({ ...select, faculty: 1 }).populate(...populate);
  if (!department) return { error: 'Invalid department. Contact an admin to fix it' };

  // Retrieve available courses from database for student's faculty by level and semester
  const faculty = await mongoose.model('Faculty').findOne({ _id: department.faculty })
    .select(select).populate(...populate);
  if (!faculty) return { error: 'Invalid faculty. Contact an admin to fix it' };

  // Parse and return results
  const courses = [department, faculty].map(obj => ({
    _id: obj._id,
    name: obj.name,
    courses: obj.availableCourses.length ? obj.availableCourses[0].courses : [],
  }));
  return { department: courses[0], faculty: courses[1] };
}

/**
 * Class method for unregistering courses (for the student's current level and semester).
 * @param {number} semester Current semester.
 * @returns {Promise.<boolean>} `true` on success, `false` otherwise.
 */
async function unregisterCourses(semester) {
  if (!semester) [semester] = semesters; // #ROADMAP: Track this globally
  if (!semesters.includes(semester)
  ) return { error: `ValueError: ${semester}. Semester must be one of these: ${semesters}` };

  const i = this.registeredCourses
    .findIndex(course => course.level === this.level && course.semester === semester);
  if (i >= 0) {
    this.registeredCourses.pop(i); await this.save(); return true;
  } return false;
}

/**
 * Class method for registering courses (for the student's current level and semester).
 * @param {ObjectId[]} courseIds Array of ObjectIds for courses to be registered.
 * @param {number} semester Current semester.
 * @returns {promise.<mongoose.Model.<Student>>} User object with registered courses.
 */
async function registerCourses(courseIds, semester) {
  if (!Array.isArray(courseIds)) return { error: 'ValueError: courseIDs must be an array of courseIDs' };
  if (!courseIds.length) return { error: 'ValueError: None of the given courses is available' };
  for (const id of courseIds) {
    if (!ObjectId.isValid(id)) return { error: `ValueError: ${id} is not a valid ObjectId` };
  }
  if (!semester) [semester] = semesters; // #ROADMAP: Track this globally
  if (!semesters.includes(semester)
  ) return { error: `ValueError: ${semester}. Semester must be one of these: ${semesters}` };

  // Check if courses are available for registration
  const courses = await this.getAvailableCourses(semester);
  if (courses.error) return { error: courses.error };
  const availableIds = [...courses.department.courses, ...courses.faculty.courses]
    .map(course => course.id);

  // Validate given course IDs against available IDs
  const validIds = [...new Set(courseIds)].reduce((results, id) => {
    id = String(id); if (availableIds.includes(id)) results.push(id);
    return results;
  }, []);

  if (!validIds.length) return { error: 'ValueError: None of the given courses is available' };

  // Delete previous record for current semester if exists, then register given courses
  await this.unregisterCourses(semester);
  this.registeredCourses.push({ level: this.level, semester, courses: validIds });
  return this.save();
}

/**
 * Class method for retrieving full details of a student's registered courses.
 * @returns {promise.<Student.registeredCourses>} Array of all courses registered by the user.
 */
async function getRegisteredCourses() {
  await this.populate('registeredCourses.courses', privateAttrStr.all);
  return this.registeredCourses;
}

/**
 * Class method for retrieving student's projects for this semester's registered courses.
 * @returns {promise.<mongoose.model[]>}
 */
async function getProjects() {
  if (!this.registeredCourses.length) return [];

  // Retrieve projects for current semester with students' submission and return it
  return mongoose.model('Project')
    .find({ course: { $in: this.registeredCourses.slice(-1)[0].courses } })
    .select({ submissions: { $elemMatch: { student: this.id } } })
    .populate('course createdBy', privateAttrStr.staff);
}

/**
 * Class method for submitting a student's answer for one of their active projects.
 * @param {ObjectId} id ID of a project for one of student's registered courses.
 * @param {String} answer Student's submission for the project.
 * @returns {promise.<mongoose.model>}
 */
async function submitProject(id, answer) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (typeof answer !== 'string') return { error: 'ValueError: answer must be a string' };

  // Retrieve project with given id from database if under one of student's courses
  const project = await mongoose.model('Project')
    .findOne({ _id: id, course: { $in: this.registeredCourses.slice(-1)[0].courses } })
    .populate('course createdBy', privateAttrStr.staff);
  if (!project) return { error: `ValueError: Student has no project with id=${id}` };

  // Prevent submitting answers after a project's deadline
  if (project.deadline < Date.now()) return { error: 'Project is past its deadline' };

  // Submit student's answer or update previous submission if any
  const submitted = project.submissions.findIndex(sub => sub.student === this.id);
  if (submitted > -1) project.submissions[submitted] = { student: this.id, answer };
  else project.submissions.push({ student: this.id, answer });
  await project.save();

  // Return project with only student's submission
  project.submissions = { student: this.id, answer };
  return project;
}

/**
 * Class method for retrieving schedules for a student by date.
 * @param {Date} startDate Lower bound of date range.
 * @param {Date} endDate Upper bound of date range.
 * @returns {Promise.<mongoose.Model[]>}
 */
async function getSchedules(startDate, endDate) {
  if (new Date(startDate).toString() === 'Invalid Date') return { error: 'ValueError: Invalid startDate' };
  if (new Date(endDate).toString() === 'Invalid Date') return { error: 'ValueError: Invalid endDate' };

  // Retrieve schedules from database
  return mongoose.model('Project').find({
    createdBy: this.id,
    time: { $gte: startDate, $lte: endDate },
  }).sort({ time: 1 }).select({ createdBy: 0 });
}

/**
 * Class method for creating a new schedule for a student
 * @param {Object} attributes Attributes to be assigned to the new schedule.
 * @returns {Promise.<mongoose.Model>}
 */
async function createSchedule(attributes) {
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Prevent setting user-immutable attributes on this schedule
  for (const key of immutables.Project) { delete attributes[key]; }

  attributes.createdBy = this.id; // Permanently link the new schedule to this student

  return mongoose.model('Schedule')(attributes).save();
}

/**
 * Class method for updating an existing student's schedule.
 * @param {ObjectId} id ID of schedule to be updated.
 * @param {Object} attributes New attributes to be assigned to the schedule.
 * @returns {Promise.<mongoose.Model>}
 */
async function updateSchedule(id, attributes) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };
  if (!attributes || typeof attributes !== 'object') return { error: 'ValueError: Invalid attributes' };

  // Retrieve schedule from database
  const schedule = await mongoose.model('Schedule').findById(id).exec();
  if (!schedule) return { error: `ValueError: Schedule with id=${id} not found` };

  // Check if schedule is owned by this student
  if (String(schedule.createdBy) !== this.id) return { error: 'Access denied' };

  // Prevent updating user-immutable attributes on this schedule
  for (const key of immutables.Project) { delete attributes[key]; }

  // Apply given attributes updates to schedule
  for (const [key, value] of Object.entries(attributes)) {
    schedule[key] = value;
  }

  return schedule.save();
}

/**
 * Class method for deleting a student's schedule.
 * @param {ObjectId} id ID of schedule to be deleted.
 * @returns {Promise.<Boolean>}
 */
async function deleteSchedule(id) {
  if (!ObjectId.isValid(id)) return { error: 'ValueError: Invalid id' };

  // Retrieve schedule from database
  const schedule = await mongoose.model('Schedule').findById(id).exec();
  if (!schedule) return { error: `ValueError: Schedule with id=${id} not found` };

  // Check if schedule is owned by this student
  if (String(schedule.createdBy) !== this.id) return { error: 'Access denied' };

  // Delete schedule from database and return result
  if ((await schedule.deleteOne()).deletedCount >= 1) return true;
  return false;
}

module.exports = {
  getAvailableCourses,
  unregisterCourses,
  registerCourses,
  getRegisteredCourses,
  getProjects,
  submitProject,
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
