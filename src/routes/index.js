const express = require('express');
const cors = require('cors')
// import the router for each controller
const studentRouter = require('./StudentRoutes');
const staffRouter = require('./StaffRoutes');

// router are used to separate the routes from the main server file
const router = express.Router();

// pre-flight request
router.options('*', cors());

router.use('/api/v1/studentportal', cors(), studentRouter);
router.use('/api/v1/staffportal', cors(), staffRouter);

module.exports = router;
