/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
const Redis = require('ioredis');
const util = require('util');

const url = process.env.REDIS_URL;

class RedisClient {
  constructor() {
    this.client = new Redis(url);
    this.client.on('error', (error) => {
      console.error(error);
    });
    this.client.on('connect', () => {
      console.log('Redis client connected to the server');
    });
  }

  async isAlive() {
    try {
      await this.client.isReady();
      return true;
    } catch (error) {
      return false;
    }
  }

  async get(key) {
    const getAsync = util.promisify(this.client.get).bind(this.client);
    try {
      await this.client.isAlive();
      const value = await getAsync(key);
      return value;
    } catch (error) {
      throw new Error(error);
    }
  }

  async set(key, value, duration) {
    try {
      await this.client.isAlive();
      await this.client.set(key, value, 'EX', duration);
    } catch (error) {
      throw new Error(error);
    }
  }

  async del(key) {
    try {
      await this.client.isAlive();
      await this.client.del(key);
    } catch (error) {
      throw new Error(error);
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
