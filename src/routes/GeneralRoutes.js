/* eslint-disable jest/require-hook */
// create the Express server:
const express = require('express');
const cors = require('cors');
// router are used to separate the routes from the main server file
const genRouter = express.Router();

const corsOptions = {
  origin: '*', // allow all origins for now
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-Auth-Token', 'Authorization', 'X-Token'],
};
// use Cors
genRouter.use(cors(corsOptions));

// import the controller
const genController = require('../controllers/GeneralController');

// swagger docs

/** GETMethods */
/**
 * @openapi
 * /api/v1/healthcheck:
 *   get:
 *     summary: Genral Health Check Endpoint for both Staff Portal and Student Portal
 *     description: Endpoint to perform a general healthcheck on infrastructres.
 *     tags:
 *       - Staff Controller
 *     responses:
 *       200:
 *         description: Successful health check.
 *         content:
 *           application/json:
 *             example:
 *               - portal: "studentportal"
 *                 message: "Server is up and running"
 *                 redisStatus: true
 *                 dbStatus: true
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
genRouter.get('/', genController.healthCheck);

module.exports = genRouter;
