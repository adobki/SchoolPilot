// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const staffRouter = express.Router();
// import the controller
const staffController = require('../controllers/StaffController');

/** GETMethods */
/**
 * @openapi
 * '/api/v1/staffportal/healthcheck':
 *  get:
 *     tags:
 *     - Staff Controller
 *     responses:
 *      200:
 *        description: Successful
 *      500:
 *        description: Internal Server Error
 */
// get the health check for redis and db connection
staffRouter.get('/healthcheck', staffController.healthCheck);

module.exports = staffRouter;
