const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const dbClient = require('../utils/db');

describe('DBClient', () => {

  before(async function () {
    // Increase the timeout for the before hook
    this.timeout(5000);
  
    // Initialize the database client
    await dbClient.init();
  
    // Wait for the isAlive check before proceeding
    await dbClient.isAlive();
  });
  
  after(async () => {
    // Close the MongoDB connection after all tests
    await dbClient.client.close();
  });
  
  it('should be alive', async () => {
    const isAlive = await dbClient.isAlive();
    expect(isAlive).to.equal(true);
  });

  it('should handle connection errors', async () => {
    // Close the MongoDB connection to simulate an error
    if (dbClient && dbClient.client) {
      await dbClient.client.close();
    }
    const isAlive = await dbClient.isAlive();
    expect(isAlive).to.equal(false);
  });

  

  // Add more tests as needed
});
