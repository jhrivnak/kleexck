const { encryptCredentials } = require('../config/deploy.config');
const fs = require('fs');

// Read credentials from JSON file
const ftpCreds = fs.readFileSync('./secret/ftp.json', 'utf8');
const credentials = JSON.parse(ftpCreds);

const encrypted = encryptCredentials(JSON.stringify(credentials));
console.log('Store these values in config/credentials.js:');
console.log(encrypted); 