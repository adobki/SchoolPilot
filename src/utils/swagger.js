// implementing swagger docs
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'School Portal API',
      version: '1.0.0',
      description: 'Documentation for School Portal API',
    },
  },
  servers: [
    {
      url: 'https://schoolpilot-8zfm.onrender.com/',
      description: 'Production server',
    },
    {
      url: 'http://localhost:4000/',
      description: 'local server',
    }
  ],
  apis: ['../src/routes/*.js'],
};

const specs = swaggerJsDoc(options);

module.exports = { specs, swaggerUi };

