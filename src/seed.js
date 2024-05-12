/* eslint-disable */
const { Student } = require('./models/student');
const { Faculty } = require('./models/faculty');
const { Department } = require('./models/department');
const { Course } = require('./models/course');
const { Staff } = require('./models/staff');
const { dbClient } = require('./models/base');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const firstNames = [
  "Ade", "Bola", "Carolina", "Doug", "Emmanuel", "Felicia", "George", "Hansel", "Isaac", "Jamiu",
  "Khalid", "Lanre", "Moni", "Nifemi", "Opeyemi", "Pascal", "Queeneth", "Raphael", "Sola", "Tinu",
  "Uvie", "Vivian", "William", "Yomi", "Zainab", "Emma", "Liam", "Olivia", "Noah", "Ava", "William",
  "Sophia", "Benjamin", "Isabella", "James", "Mia", "Ethan", "Charlotte", "Alexander", "Amelia",
  "Michael", "Harper", "Elijah", "Abigail", "Daniel"
];

const lastNames = [
  "Arnold", "Basit", "Constance", "Darasimi", "Emmanuel", "Felix", "Ganduse", "Helen", "Ijeoma",
  "Jorge", "Kemi", "Lola", "Mani", "Oludare", "Pamilerin", "Tolani", "Wisdom", "Yemi", "Smith",
  "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson",
  "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson"
];

const faculties = [
  {
    'Biological Science': [
      {"Biochemistry": "BC"},
      {"Microbiology": "MB"},
      {"Botany": "BT"},
      {"Zoology": "ZL"}
    ]
  },
  {
    'Physical Science': [
      {"Computer Science": "CS"},
      {"Physics": "PH"},
      {"Chemistry": "CH"},
      {"Mathematics": "MA"}
    ]
  },
  {
    'Engineering': [
      {"Mechanical Engineering": "ME"},
      {"Electrical Engineering": "EE"},
      {"Civil Engineering": "CE"}
    ]
  },
  {
    'Food Science': [
      {"Food Science and Technology": "FST"},
      {"Home Science": "HS"},
      {"Hospitality": "HOSP"}
    ]
  },
  {
    'Animal Science': [
      {"Pasture Management": "PM"},
      {"Animal Health": "AH"},
      {"Animal Production": "AP"}
    ]
  }
];

const courseCodes = [
  101, 102, 103, 104, 105, 106, 107, 108, 109,
  201, 202, 203, 204, 205, 206, 207, 208, 209,
  301, 302, 303, 304, 305, 306, 307, 308, 309,
  401, 402, 403, 404, 405, 406, 407, 408, 409
];

const setLevel = (code) => {
  if (code < 200) return 100;
  else if (code < 300) return 200;
  else if (code < 400) return 300;
  return 400;
};

const setSemester = (code) => {
  if ((code % 2) === 1) return 1;
  return 2;
};

const generateCourseUnit = () => Math.floor(Math.random() * 3) + 1;

const generateRandomIndex = (length, min = 0) => Math.floor(Math.random() * length) + min;

function getDepartment() {
  const faculty = Object.values(faculties[generateRandomIndex(faculties.length)])[0];
  return Object.keys(faculty[generateRandomIndex(faculty.length)])[0];
}

function getTimeSensitiveData() {
  /** DOB, matricNo, entryYear, level */

  const currentYear = new Date().getFullYear();
  const OLDEST = 35;
  const YOUNGEST = 16;
  const ageFactor = (OLDEST - YOUNGEST) + 1;
  const minimumYear = currentYear - OLDEST;

  // (0 to 11) + 1 = 1 to 12
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  // This would put the oldest age at 35 years and youngest at 16 years
  const birthYear = Math.floor(Math.random() * ageFactor) + minimumYear;
  const DOB = `${birthYear}-${birthMonth}-${birthDay}`;
  console.log("DOB utc:", new Date(DOB).toDateString())
  const levels = [100, 200, 300, 400];
  const age = currentYear - birthYear;

  let level;
  if (age === YOUNGEST) level = 100;
  else if (age === (YOUNGEST + 1)) level = levels[generateRandomIndex(2)];
  else if (age === (YOUNGEST + 2)) level = levels[generateRandomIndex(3)];
  else level = levels[generateRandomIndex(4)];
  const entryYear = (currentYear - (level / 100)) + 1;

  let extras = '';
  for (let i = 0; i < 4; i++) {
    const value = Math.floor(Math.random() * 10)
    extras += `${value}`;
  }
  const matricNo = `${entryYear}${extras}`;

  return { DOB, matricNo, entryYear, level };
}

Promise.resolve((async () => {
  for (let faculty of faculties) {
    const name = Object.keys(faculty)[0];
    const isExisting = await Faculty.findOne({ name })
    const savedFaculty = isExisting || await Faculty.create({ name: name })
    const departmentsInFaculty = faculty[name];
    for (let department of departmentsInFaculty) {
      const departmentName = Object.keys(department)[0];
      const isExisting = await Department.findOne({ name: departmentName })
      const dept  = isExisting || await Department.create({
        name: departmentName,
        faculty: savedFaculty._id
      })
      const courses = courseCodes.map((code) => {
        return {
          name: `${departmentName} ${code}`,
          courseCode: `${department[departmentName]}${code}`,
          level: setLevel(code),
          semester: setSemester(code),
          units: generateCourseUnit()
        }
      })
      for (let course of courses) {
        const isExisting = await Course.findOne({ name: course.name })
        const newCourse = isExisting || await Course.create({ ...course, department: dept._id });

        // Update the department's available courses
        const filter = { _id: dept._id };
        const levelToFind = course.level;
        const semesterToFind = course.semester;
        const courseIdToAdd = newCourse._id;
        console.log("filter:", filter)
        console.log("This course is:", course)

        // Use findOne to find the document
        const document = await Department.findOne(filter)
        try {
          if (document) {
            // Find the index of the level in availableCourses array
            const levelIndex = document.availableCourses.findIndex(
              // Adding plus for type conversion for the enum field "level" to a number
              course => +course.level === levelToFind && +course.semester === semesterToFind
            );

            if (levelIndex !== -1) {
              // check if course has been added
              const courseIndex = document.availableCourses[levelIndex].courses.findIndex(
                courseId => courseId.equals(courseIdToAdd)
              );
              console.log("index:", courseIndex, courseIdToAdd)
              if (courseIndex !== -1) continue;

              // Push the courseIdToAdd into the courses array of the found level and semester
              document.availableCourses[levelIndex].courses.push(courseIdToAdd);
            } else {
              // Level and semester not found, create them
              document.availableCourses.push({
                level: levelToFind,
                semester: semesterToFind,
                courses: [courseIdToAdd],
                // _id: new ObjectId()
              });
            }
          } else {
            console.log('Document not found.');
            break;
          }
          const updatedDocument = await document.save();
          if (updatedDocument) {
            console.log('Course added successfully:', updatedDocument);
          }
        } catch (error) {
          console.error('Error updating document:', error);
        }
      }
      console.log("Are you done?")
    }
  }
  console.log("I am done seeding courses and faculties!!")
})())
  .then(async (_) => {
    console.log('Create Students...');
    const MAX = await question("How many students do you want to generate? ")
    rl.close()
    for (let i = 0; i < MAX; i++) {
      const firstName = firstNames[generateRandomIndex(firstNames.length)];
      const lastName = lastNames[generateRandomIndex(lastNames.length)];
      const department = getDepartment();
      const student = {
        firstName,
        lastName,
        department: (await Department.findOne({ name: department }))._id,
        major: department,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@schoolpilotmail.com`,
        ...getTimeSensitiveData()
      }
      console.log("student:", student);
      console.log("i:", i);
      try {
        await Student.create(student);
      } catch (error) {
        // for the cases of duplicate key errors from colliding emails
        if (error.message.split(' ').includes('E11000')) i -= 1;
        else throw new Error(error.message);
      }
    }
  })
  .then(async (_) => {
    console.log('Done');
  })
  .catch((err) => console.error("Error:", err))
  .finally(async () => await dbClient.close())
