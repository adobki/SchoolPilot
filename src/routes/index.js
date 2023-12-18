/* eslint-disable jest/require-hook */
/* eslint-disable object-curly-newline */

// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const router = express.Router();
// import the user controller
const userController = require('../controllers/UsersController');

// router.post('/signup', userController.signup);
router.post('/login', userController.login);

// router.post('/signup', userController.signup);
router.post('/signup', userController.signup);

// router.get('/users', userController.allUsers);
router.get('/users', userController.getAllUser);

module.exports = router;
