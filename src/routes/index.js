const express = require('express');
const cors = require('cors')
// import the router for each controller
const studentRouter = require('./StudentRoutes');
const staffRouter = require('./StaffRoutes');

// it should enable CORS
const corsOptions = {
  origin: '*', // allow all origins for now
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "X-Auth-Token", "Authorization"],
};

// router are used to separate the routes from the main server file
const router = express.Router();

router.use(cors( corsOptions ));

router.use('/api/v1/studentportal', studentRouter);
router.use('/api/v1/staffportal', staffRouter);

module.exports = router;
