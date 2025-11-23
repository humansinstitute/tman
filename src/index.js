require('dotenv').config();
const { TmanServer } = require('./server');

console.log('🚀 Starting tman server...');

const webServer = new TmanServer(process.env.PORT || 3000);
webServer.start();
