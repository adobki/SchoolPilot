// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const staffRouter = express.Router();
// import the controller
const staffController = require('../controllers/StaffController');

// allow cors
staffRouter.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
})
// get the health check for redis and db connection
staffRouter.get('/healthcheck', staffController.healthCheck);

module.exports = staffRouter;
