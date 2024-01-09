// create the Express server:
const express = require('express');
// router are used to separate the routes from the main server file
const staffRouter = express.Router();
// import the controller
const staffController = require('../controllers/StaffController');

/** GETMethods */
/**
 * @openapi
 * /api/v1/staffportal/healthcheck:
 *   get:
 *     summary: Health Check Endpoint for Staff Portal
 *     description: Endpoint to perform a health check for the staff portal.
 *     tags:
 *       - Staff Controller
 *     responses:
 *       200:
 *         description: Successful health check.
 *         content:
 *           application/json:
 *             example:
 *               - portal: "staffportal"
 *                 message: "Server is up and running"
 *                 redisStatus: true
 *                 dbStatus: true
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             example:
 *               status: 'error'
 *               message: 'Internal Server Error.'
 */
// get the health check for redis and db connection
staffRouter.get('/healthcheck', staffController.healthCheck);

module.exports = staffRouter;
