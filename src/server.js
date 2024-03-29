/* eslint-disable jest/require-hook */
/* eslint-disable no-unused-vars */
/* eslint-disable import/newline-after-import */
//  create the Express server:
require('./utils/config'); // Make sure this is at the top
const express = require('express');
const app = express();
const port = process.env.EXPRESS_PORT || 3500;
const router = require('./routes/index');
const dbClient = require('./utils/db'); // Make sure to import your DB client
const redisClient = require('./utils/redis');
const { swaggerUi, specs } = require('./utils/swagger');

// it should parse the body of the request as a JSON object for all HTTP requests
app.use(express.json());

// it should load all routes from the file routes/index.js
app.use(router);

// Serve Swagger UI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Initialize the database connection when the application starts
async function startServer() {
  // ensure Redis Conn is ready
  const redisStatus = await redisClient.isAlive();
  if (!redisStatus) {
    console.error('Failed to initialize Redis');
    process.exit(1);
  }
  try {
    // ensure DB Conn is ready
    await dbClient.isAlive();
  } catch (error) {
    console.error('Failed to initialize the database:', error);
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`Server running on port ${port}: http://localhost:${port}`);
  });
}

startServer();
