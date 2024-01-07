// create the Express server:
const express = require('express');
const cors = require('cors')
// router are used to separate the routes from the main server file
const staffRouter = express.Router();
// import the controller
const staffController = require('../controllers/StaffController');

// preflight request
staffRouter.options('*', cors());

// get the health check for redis and db connection
staffRouter.get('/healthcheck', cors(), staffController.healthCheck);

module.exports = staffRouter;
