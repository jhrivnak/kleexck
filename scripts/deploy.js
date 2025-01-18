const ftp = require('ftp');
const { decryptCredentials } = require('../config/deploy.config');
const storedCredentials = require('../config/credentials');
const fs = require('fs');
const path = require('path');

async function uploadFile(client, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    client.put(localPath, remotePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function deploy() {
  try {
    // Decrypt credentials
    const ftpConfig = JSON.parse(decryptCredentials(storedCredentials.ftp));
    
    const client = new ftp();
    
    client.connect({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      port: ftpConfig.port || 21
    });

    client.on('ready', async () => {
      console.log('FTP Connection established');
      
      const distPath = './dist/kleexck';
      const files = fs.readdirSync(distPath);
      
      for (const file of files) {
        const localPath = path.join(distPath, file);
        const remotePath = '/' + file;
        
        try {
          await uploadFile(client, localPath, remotePath);
          console.log(`Successfully uploaded ${file}`);
        } catch (err) {
          console.error(`Failed to upload ${file}:`, err);
        }
      }
      
      client.end();
      console.log('Deployment complete!');
    });

  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploy(); 