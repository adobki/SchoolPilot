/* eslint-disable no-unused-vars */
/* eslint-disable jest/require-hook */
/* eslint-disable import/newline-after-import */
//  create the Express server:
// it should listen on the port set by the environment variable PORT or by default 5000
// it should load all routes from the file routes/index.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3500;
const router = require('./routes/index');
const dbClient = require('./utils/db'); // Make sure to import your DB client

// it should parse the body of the request as a JSON object for all HTTP requests
app.use(express.json());

// it should load all routes from the file routes/index.js
app.use(router);

// Initialize the database connection when the application starts
async function startServer() {
  try {
    // ensure the connection is oppened before starting the server
    await dbClient.isAlive();
    app.listen(port, () => {
      console.log(`Server running on port ${port}: http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize the database:', error);
  }
}

startServer();
