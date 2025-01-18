const { decryptCredentials } = require('../config/deploy.config');
const storedCredentials = require('../config/credentials');

const decrypted = decryptCredentials(storedCredentials.ftp);
// Output in format that PowerShell can parse
console.log(decrypted); 