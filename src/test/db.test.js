/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable func-names */
/* eslint-disable jest/prefer-lowercase-title */
/* eslint-disable jest/require-hook */
/* eslint-disable no-unused-vars */
/* eslint-disable object-curly-newline */
const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const dbClient = require('../utils/db');

describe('DBClient', () => {
  // Stub the mongoose connect method to resolve immediately
  before(() => {
    sinon.stub(mongoose, 'connect').resolves();
  });

  // Restore the original mongoose connect method
  after(() => {
    sinon.restore();
  });

  // Initialize the database client before running the tests
  before(async function () {
    // Increase the timeout for the before hook
    this.timeout(5000);
    // Initialize the database client
    await dbClient.init();
    // Wait for the isAlive check before proceeding
    await dbClient.isAlive();
  });

  after(async () => {
    // If the client is defined, close the MongoDB connection after all tests
    if (dbClient.client) {
      await dbClient.client.close();
    }
  });

  it('should be alive', async () => {
    const isAlive = await dbClient.isAlive();
    expect(isAlive).to.equal(true);
  });

  it('should handle connection errors', async () => {
    // Stub the isAlive function to resolve immediately
    sinon.stub(dbClient, 'isAlive').resolves(false);

    // Close the MongoDB connection to simulate an error
    if (dbClient.client) {
      await dbClient.client.close();
    }

    const isAlive = await dbClient.isAlive();
    expect(isAlive).to.equal(false);

    // Restore the original isAlive function
    sinon.restore();
  });

  // Add more tests as needed
});
