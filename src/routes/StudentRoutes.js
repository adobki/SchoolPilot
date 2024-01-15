/* eslint-disable jest/require-hook */
// create the Express server:
const express = require('express');
const cors = require('cors');
// router are used to separate the routes from the main server file
const studentRouter = express.Router();

const corsOptions = {
  origin: '*', // allow all origins for now
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-Auth-Token', 'Authorization', 'X-Token'],
};

// use Cors
studentRouter.use(cors(corsOptions));
// import the controller
const studentController = require('../controllers/StudentsController');

studentRouter.get('/healthcheck', studentController.healthCheck);
studentRouter.post('/login', studentController.login);
studentRouter.get('/logout', studentController.logout);
studentRouter.post('/updateprofile', studentController.updateProfile);
studentRouter.post('/signin', studentController.signin);
studentRouter.post('/activateprofile', studentController.activateProfile);
studentRouter.post('/resetpassword', studentController.setResetPassword);
studentRouter.post('/newpassword', studentController.setNewPassword);
studentRouter.post('/changepassword', studentController.setChangePassword);
studentRouter.get('/dashboard', studentController.getDashboardData);
studentRouter.get('/availablecourses', studentController.getAvailableCourses);
studentRouter.get('/unregistercourses', studentController.unRegisterCourses);
studentRouter.get('/registercourses', studentController.registerCourses);
studentRouter.get('/getregisteredcourses', studentController.getRegisteredCourses);
studentRouter.get('/getprojects', studentController.getProjects);
studentRouter.post('/submitproject', studentController.submitProject);
studentRouter.get('/getschedules', studentController.getSchedules);
studentRouter.post('/createschedule', studentController.createSchedule);
studentRouter.post('/updateschedule', studentController.updateSchedule);
studentRouter.delete('/deleteschedule/:id', studentController.deleteSchedule);
studentRouter.get('/getParsedSchedules', studentController.getParsedSchedules);
studentRouter.get('/getParsedProjects', studentController.getParsedProjects);

module.exports = studentRouter;
