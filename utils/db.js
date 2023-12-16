/* eslint-disable max-len */
const password = 'schoolpilot';
const { MongoClient } = require('mongodb');

const uri = `mongodb+srv://alxSE:${password}@schoolpilot.0zpvosm.mongodb.net/?retryWrites=true&w=majority`;

class DBClient {
  constructor() {
    // Create a MongoClient with the connection URI
    this.client = new MongoClient(uri, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    // initialize the client with the connection to the database
    this.init();
  }

  async init() {
    try {
      // Connect the client to the server (optional starting in v4.7)
      await this.client.connect();
      console.log('Connected to MongoDB!');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
    }
  }

  // a function isAlive that returns true when the connection to MongoDB is a success otherwise, false
  async isAlive() {
    try {
      // Check if MongoDB is connected
      if (await this.client.isConnected()) {
        // Send a ping to confirm a successful connection
        await this.client.db('admin').command({ ping: 1 });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error pinging MongoDB:', error);
      return false;
    }
  }
}

// Export the instance directly
module.exports = new DBClient();
