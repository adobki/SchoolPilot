/* eslint-disable jest/require-hook */
// create the Express server:
const express = require('express');
const cors = require('cors');
// router are used to separate the routes from the main server file
const staffRouter = express.Router();
// import the controller
const staffController = require('../controllers/StaffController');

const corsOptions = {
  origin: '*', // allow all origins for now
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'X-Auth-Token', 'Authorization', 'X-Token'],
};

// use Cors
staffRouter.use(cors(corsOptions));

// swagger docs
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
staffRouter.post('/login', staffController.login);
staffRouter.post('/logout', staffController.logout);
staffRouter.post('/updateprofile', staffController.updateProfile);
staffRouter.post('/signin', staffController.signin);
staffRouter.post('/activateprofile', staffController.activateProfile);
staffRouter.post('/resetpassword', staffController.setResetPassword);
staffRouter.post('/newpassword', staffController.setNewPassword);
staffRouter.post('/changepassword', staffController.setChangePassword);
staffRouter.get('/dashboard', staffController.getDashboardData);
staffRouter.get('/collection', staffController.adminGetAll);
staffRouter.post('/create', staffController.adminCreateNew);
staffRouter.put('/update/:id', staffController.adminUpdate);
staffRouter.delete('/delete/:id', staffController.adminDelete);
staffRouter.put('/assigncourse/:id', staffController.adminAssignedCourse);
staffRouter.put('/approverecord/:id', staffController.adminApproveRecord);
staffRouter.get('/availablecourses/:id', staffController.adminGetAvailableCourses);
staffRouter.put('/setavailablecourse', staffController.adminSetAvailableCourse);
staffRouter.put('/unsetavailablecourse', staffController.adminUnSetAvailableCourse);
staffRouter.get('/getprojects', staffController.adminGetProjects);
staffRouter.put('/gradeproject/:id', staffController.adminGradeProject);

module.exports = staffRouter;
