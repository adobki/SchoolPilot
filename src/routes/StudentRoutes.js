// create the Express server:
const express = require('express');
const cors = require('cors')
// router are used to separate the routes from the main server file
const studentRouter = express.Router();
// import the controller
const studentController = require('../controllers/StudentsController');

// preflight request
studentRouter.options('*', cors());

studentRouter.get('/healthcheck', cors(), studentController.healthCheck);
studentRouter.post('/login', cors(), studentController.login);
studentRouter.post('/logout', cors(), studentController.logout);
studentRouter.post('/updateprofile', cors(), studentController.updateProfile);
studentRouter.post('/signin', cors(), studentController.signin);
studentRouter.post('/activateprofile', cors(), studentController.activateProfile);

module.exports = studentRouter;
