/* eslint-disable func-names */
// test/user.test.js
/* eslint-disable jest/require-hook */
/* eslint-disable jest/no-hooks */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable object-curly-newline */
const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const dbClient = require('../utils/db'); // Make sure to import your DB client
const User = require('../models/user');

describe('user Model', () => {
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
    await dbClient.closeConnection();
  });

  it('should create a new user', async () => {
    const userData = {
      username: 'SuperAdmin',
      email: 'sadmin@sadmin.com',
      password: 'sadmin123',
    };

    const newUser = await User.createUser(userData);

    expect(newUser).to.be.an('object');
    expect(newUser.username).to.equal(userData.username);
    expect(newUser.email).to.equal(userData.email);
    // Add more assertions as needed
  });

  // Add more tests as needed
});
