/* eslint-disable jest/require-hook */
/* eslint-disable jest/no-hooks */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable object-curly-newline */
const { describe, it, beforeEach, afterEach } = require('mocha');
const { assert } = require('chai');
const sinon = require('sinon');
const redisClient = require('../utils/redis');

// Define testConnection within the test file
const testConnection = async () => {
  try {
    const isAlive = await redisClient.isAlive();
    console.log(`Connection is alive: ${isAlive}`);
  } catch (error) {
    console.error(error);
  }
};

// Define stubs outside the test cases
let isAliveStub;
let getStub;
let setStub;
let delStub;

// Create stubs before each test
beforeEach(() => {
  isAliveStub = sinon.stub(redisClient, 'isAlive').resolves(true);
  getStub = sinon.stub(redisClient, 'get');
  setStub = sinon.stub(redisClient, 'set');
  delStub = sinon.stub(redisClient, 'del');
});

// Restore stubs after each test
afterEach(() => {
  isAliveStub.restore();
  getStub.restore();
  setStub.restore();
  delStub.restore();
});

describe('redis Client', () => {
  it('test redis connection', async () => {
    // Run the test
    await testConnection();

    // Assert the stub was called
    sinon.assert.calledOnce(isAliveStub);
  });

  it('test: Null for a random key', async () => {
    // Configure stub behavior for this test
    getStub.resolves(null);

    // Run the test
    const value = await redisClient.get('randomKey');

    // Assert the stub was called
    sinon.assert.calledOnce(getStub);

    // Assert the result
    assert.equal(value, null);
  });

  it('test: set and get', async () => {
    const key = 'key';
    const value = 'value';

    // Configure stub behavior for this test
    setStub.resolves('OK');
    getStub.resolves(value);

    // Run the test
    await redisClient.set(key, value, 60);
    const result = await redisClient.get(key);

    // Assert the stubs were called
    sinon.assert.calledOnce(setStub);
    sinon.assert.calledOnce(getStub);

    // Assert the result
    assert.equal(result, value);
  });

  it('test: del', async () => {
    const key = 'key';

    // Configure stub behavior for this test
    setStub.resolves('OK');
    delStub.resolves(1);
    getStub.resolves(null);

    // Run the test
    await redisClient.set(key, 'value', 60);
    await redisClient.del(key);
    const result = await redisClient.get(key);

    // Assert the stubs were called
    sinon.assert.calledOnce(setStub);
    sinon.assert.calledOnce(delStub);
    sinon.assert.calledOnce(getStub);

    // Assert the result
    assert.equal(result, null);
  });
});
