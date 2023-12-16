/* eslint-disable max-len */
/* eslint-disable no-else-return */
// After the class definition, create and export an instance of RedisClient called redisClient
const { createClient } = require('redis');
const util = require('util');
// set uuid v4
const { v4: uuidv4 } = require('uuid');

const userName = 'red-clue7kocmk4c738915k0';
const password = 'EcT3vlVLShamVqKYdi0iy4BJY55zzwQ8';
const host = 'oregon-redis.render.com';
const port = 6379;
const conString =  `rediss://${userName}:${password}@${host}:${port}`;

// create a class called RedisClient
class RedisClient {
  // the constructor that creates a client to Redis:
  constructor() {
    this.client = createClient({ url: conString });
    // Manually promisify the nedded functions in the client object
    this.client.getAsync = util.promisify(this.client.get).bind(this.client);
    this.client.setExAsync = util.promisify(this.client.setex).bind(this.client);
    this.client.delAsync = util.promisify(this.client.del).bind(this.client);
    // upon succesful connection
    this.client.on('connect', () => {
      console.log('Redis client connected to the server');
    });
    // upon any error of the redis client
    this.client.on('error', (err) => {
      console.error(`Redis client not connected to the server: ${err}`);
    });
  }

  // a function isAlive that returns true when the connection to Redis is a success otherwise, false
  async isAlive() {
    // check if redis is connected
    if (await this.client.connected) {
      return true;
    } else {
      return false;
    }
  }

  // an asynchronous function get that takes a string key as argument and returns the Redis value stored for this key
  async get(key) {
    try {
      const value = await this.client.getAsync(key);
      return value;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  // an asynchronous function set that takes two arguments (key, value) and sets the value in Redis for the given key
  async set(key, value, duration) {
    try {
      const result = await this.client.setExAsync(key, duration, value);
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  // an asynchronous function del that takes a string key as argument and deletes the Redis value stored for this key
  async del(key) {
    try {
      const result = await this.client.delAsync(key);
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

const redisClient = new RedisClient();
// export default redisClient;
// Test if the connection is alive
// Test if the connection is alive
// const testConnection = async () => {
//   try {
//     const isAlive = await redisClient.isAlive();
//     console.log(`Connection is alive: ${isAlive}`);
//   } catch (error) {
//     console.error(error);
//   } finally {
//     // Close the Redis connection only if it's still open
//     if (redisClient.client.connected) {
//       redisClient.client.quit();
//       console.log('Redis connection closed');
//     }
//   }
// };

// // test saving a key and reading it back
// // set timeout 20 secs
// setTimeout(() => {
//   testConnection();
// }, 20000);



// const value = uuidv4();
// const key = `sP_${value}`;

// async function testSetGet() {
//   await redisClient.set(key, value, 60);
//   const result = await redisClient.get(key);
//   console.log(result);
// }

// testSetGet();

module.exports = redisClient;