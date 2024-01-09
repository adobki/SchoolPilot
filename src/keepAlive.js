const axios = require('axios');

// Replace 'YOUR_SERVER_URL' with the actual URL of your deployed server
const serverUrl = 'https://schoolpilot-8zfm.onrender.com/api/v1/healthcheck';
// const serverUrl = 'http://localhost:4000/api/v1/healthcheck';

async function keepAlive() {
  try {
    const response = await axios.get(`${serverUrl}`);
    console.log(`Ping sent to ${serverUrl}`);
    // log the response gotten
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`Error sending ping to ${serverUrl}: ${error.message}`);
  } finally {
    // Set the next timeout
    setTimeout(keepAlive, 10 * 60 * 1000);
  }
}

// Initial delay of 15 seconds before the first ping
setTimeout(keepAlive, 15 * 1000);
