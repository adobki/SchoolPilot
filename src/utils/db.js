const mongoose = require('mongoose');

// MongoDB connection parameters
const username = process.env.SP_USERNAME ? process.env.SP_USERNAME : 'SchoolPilot';
const password = process.env.SP_PASSWORD ? process.env.SP_PASSWORD : 'SchoolPilot';
const database = process.env.SP_DATABASE ? process.env.SP_DATABASE : 'SchoolPilot';
const host = process.env.SP_HOST ? process.env.SP_HOST : 'schoolpilot.0zpvosm.mongodb.net';
const options = 'retryWrites=true&w=majority';
const uri = `mongodb+srv://${username}:${password}@${host}/${database}?${options}`;

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
    if (await this.client) return true;
    return false;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
