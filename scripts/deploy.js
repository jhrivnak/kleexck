const Client = require('ftp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read FTP credentials from JSON file
const ftpConfig = JSON.parse(fs.readFileSync('./secret/ftp.json', 'utf8'));

function createClient() {
  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on('ready', () => {
      console.log('FTP CONNECTION: Established successfully');
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('FTP CONNECTION ERROR:', err);
      reject(err);
    });

    try {
      client.connect({
        host: ftpConfig.host,
        user: ftpConfig.user,
        password: ftpConfig.password,
        port: ftpConfig.port || 21
      });
    } catch (connectError) {
      console.error('CONNECTION ATTEMPT FAILED:', connectError);
      reject(connectError);
    }
  });
}

function uploadFile(client, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    // Convert Windows path to POSIX
    const normalizedLocalPath = localPath.replace(/\\/g, '/');
    console.log(`UPLOADING: ${normalizedLocalPath} -> ${remotePath}`);
    
    client.put(normalizedLocalPath, remotePath, (err) => {
      if (err) {
        console.error(`UPLOAD ERROR: ${err.message}`);
        reject(err);
      } else {
        console.log('UPLOAD SUCCESS');
        resolve();
      }
    });
  });
}

async function deploy() {
  let client;
  try {
    // Build the app - no need for base-href or deploy-url since main index.html handles that
    console.log('\nBuilding Angular app...');
    execSync('ng build --configuration=production', { stdio: 'inherit' });
    
    client = await createClient();
    console.log('\nConnected to FTP root (cursor directory)');

    const distPath = './dist/kleexck';
    const filesToUpload = fs.readdirSync(distPath)
      .filter(file => file !== 'index.html'); // Skip index.html

    console.log(`\nUploading ${filesToUpload.length} files to cursor directory:`);
    console.log(filesToUpload);

    // Upload each file to cursor directory
    for (const file of filesToUpload) {
      const localPath = path.join(distPath, file);
      const remotePath = `/${file}`; // Already in cursor directory
      await uploadFile(client, localPath, remotePath);
    }

    console.log('\nDeployment complete!');
  } catch (error) {
    console.error('DEPLOYMENT FAILED:', error.message);
    throw error;
  } finally {
    if (client) {
      client.end();
    }
  }
}

deploy()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 