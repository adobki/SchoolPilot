/* eslint-disable jest/require-hook */
/* eslint-disable import/no-extraneous-dependencies */
const mongoose = require('mongoose');

const password = 'schoolpilot';
const uri = `mongodb+srv://alxSE:${password}@schoolpilot.0zpvosm.mongodb.net/?retryWrites=true&w=majority`;

class DBClient {
  constructor() {
    this.init();
  }

  async init() {
    try {
      this.client = await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      // Access the Mongoose connection object only after it's returned by connect
      console.log('Connected to MongoDB established successfully!');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
    }
  }

  async isAlive() {
    // Check if the Mongoose connection state is open
    try {
      await this.client;
      return true;
    } catch (error) {
      return false;
    }
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
