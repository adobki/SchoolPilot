const mongoose = require('mongoose');

const uri = process.env.MONGODB_URL;
console.log(uri);

class DBClient {
  constructor() {
    this.client = this.init();
  }

  async init() {
    delete this.client; // Forces this.client state update once init has been called
    try {
      // Access the Mongoose connection object only after it's returned by connect
      const client = await mongoose.connect(uri);
      console.log('Connection to MongoDB established successfully!');
      return client;
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      return undefined;
    }
  }

  async isAlive() {
    // Check if the Mongoose connection state is open
    // Check if the Mongoose connection state is open
    if (await this.client) {
      return true;
    }
    return false;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
