// create the Express server:
const express = require('express');
const cors = require('cors')
// router are used to separate the routes from the main server file
const studentRouter = express.Router();
// import the controller
const studentController = require('../controllers/StudentsController');

// preflight request
studentRouter.options('*', cors());

studentRouter.get('/healthcheck', studentController.healthCheck);
studentRouter.post('/login', studentController.login);
studentRouter.post('/logout', studentController.logout);
studentRouter.post('/updateprofile', studentController.updateProfile);
studentRouter.post('/signin', studentController.signin);
studentRouter.post('/activateprofile', studentController.activateProfile);

module.exports = studentRouter;
