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
studentRouter.post('/logout', studentController.logout);
studentRouter.post('/updateprofile', studentController.updateProfile);
studentRouter.post('/signin', studentController.signin);
studentRouter.post('/activateprofile', studentController.activateProfile);
studentRouter.post('/resetpassword', studentController.setResetPassword);
studentRouter.post('/newpassword', studentController.setNewPassword);
studentRouter.post('/changepassword', studentController.setChangePassword);
studentRouter.get('/dashboard', studentController.getDashboardData);

module.exports = studentRouter;
