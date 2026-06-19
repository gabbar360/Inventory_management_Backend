const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Load routes dynamically
const loadRoutes = async () => {
  const routesPath = path.join(__dirname, 'routes');
  const files = fs.readdirSync(routesPath);
  const { authenticateToken } = require('./middleware/auth');
  const { dynamicAuthorize } = require('./middleware/authorize');

  for (const file of files) {
    if (
      file.endsWith('Route.js') &&
      file !== 'basicAuthRoute.js' &&
      file !== 'invitationRoute.js' &&
      file !== 'authRoute.js'
    ) {
      const route = require(`./routes/${file}`);
      app.use('/api/v1', authenticateToken, dynamicAuthorize, route);
    }
  }
};

module.exports = { app, loadRoutes };