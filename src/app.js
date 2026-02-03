const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Load routes dynamically
const loadRoutes = async () => {
  const routesPath = path.join(__dirname, 'routes');
  const files = fs.readdirSync(routesPath);

  for (const file of files) {
    if (file.endsWith('Routes.js') && file !== 'authRoutes.js') {
      const route = require(`./routes/${file}`);
      const routeName = file.replace('Routes.js', '').toLowerCase();
      
      // Map route names to proper endpoints
      const routeMap = {
        'category': 'categories',
        'customer': 'customers', 
        'vendor': 'vendors',
        'location': 'locations',
        'product': 'products',
        'inward': 'inward',
        'outward': 'outward',
        'inventory': 'inventory',
        'dashboard': 'dashboard',
        'bulkupload': 'bulk-upload'
      };
      
      const endpoint = routeMap[routeName] || routeName;
      app.use(`/api/v1/${endpoint}`, route);
    }
  }
};

module.exports = { app, loadRoutes };