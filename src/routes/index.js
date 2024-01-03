/* eslint-disable object-curly-newline */

// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const router = express.Router();
// import the user controller
const userController = require('../controllers/UsersController');
const studentController = require('../controllers/StudentsController');

// router.post('/signup', userController.signup);
router.post('/login', userController.login);

// router.post('/signup', userController.signup);
router.post('/signup', userController.signup);

// router.get('/users', userController.allUsers);
router.get('/users', userController.getAllUser);

// router.get('/api/v1/studentportal/signup', userController.signup);
router.post('/api/v1/studentportal/signin', studentController.signin);

// router.get('/api/v1/studentportal/activateprofile', userController.activateProfile);
router.post('/api/v1/studentportal/activateprofile', studentController.activateProfile);

// router.get('/api/v1/studentportal/login', userController.login);
router.post('/api/v1/studentportal/login', studentController.login);

// router.get('/api/v1/studentportal/logout', userController.logout);
router.post('/api/v1/studentportal/logout', studentController.logout);

module.exports = router;
