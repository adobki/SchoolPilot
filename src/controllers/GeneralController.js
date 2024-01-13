const authClient = require('./AuthController');

class GeneralController {
  // check both redis and db health
  static async healthCheck(req, res) {
    // check both redis and db health
    const portal = ['studentportal', 'staffportal'];
    await authClient.genHealth(req, res, portal);
  }
}

module.exports = GeneralController;
