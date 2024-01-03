/* eslint-disable no-unused-vars */
/* eslint-disable import/newline-after-import */
//  create the Express server:
require('./utils/config'); // Make sure this is at the top
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.EXPRESS_PORT || 3500;
const router = require('./routes/index');
const dbClient = require('./utils/db'); // Make sure to import your DB client
const redisClient = require('./utils/redis');

// it should parse the body of the request as a JSON object for all HTTP requests
app.use(express.json());

// it should load all routes from the file routes/index.js
app.use(router);
// it should enable CORS
app.use(cors());
// Initialize the database connection when the application starts
async function startServer() {
  try {
    // ensure the connection is oppened before starting the server
    await dbClient.isAlive();
    app.listen(port, () => {
      console.log(`Server running on port ${port}: http://localhost:${port}`);
    });
    await redisClient.isAlive();
  } catch (error) {
    console.error('Failed to initialize the database:', error);
  }
}

startServer();
