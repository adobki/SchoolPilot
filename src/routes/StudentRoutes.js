// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const studentRouter = express.Router();
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

module.exports = studentRouter;
