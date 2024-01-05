const express = require('express');

// import the router for each controller
const studentRouter = require('./StudentRoutes');
const staffRouter = require('./StaffRoutes');

// router are used to separate the routes from the main server file
const router = express.Router();

router.use('/api/v1/studentportal', studentRouter);
router.use('/api/v1/staffportal', staffRouter);

module.exports = router;
