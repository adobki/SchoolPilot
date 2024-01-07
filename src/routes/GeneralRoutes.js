// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const genRouter = express.Router();
// import the controller
const genController = require('../controllers/GeneralController');

// swagger docs

/** GETMethods */
/**
 * @openapi
 * '/api/v1/healthcheck':
 *  get:
 *     tags:
 *     - General Controller
 *     summary: check the health of the redis server and the database-
 *     responses:
 *      200:
 *        description: Health Check Successful
 *      500:
 *        description: Health Check Failed
 *     404:
 *        description: Not Found
 * 
 */
// get the health check for redis and db connection
genRouter.get('/', genController.healthCheck);

module.exports = genRouter;
