const Client = require('ftp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure logs directory exists
const logsDir = path.resolve('./logs');
fs.mkdirSync(logsDir, { recursive: true });

function log(message, details = null) {
  const logFile = path.join(logsDir, 'deploymentLog.json');
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, details };
  
  let logs = [];
  try {
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading log file:', err);
  }
  
  logs.unshift(logEntry);
  try {
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
  console.log(`[${timestamp}] ${message}`, details || '');
}

function loadFtpConfig() {
  try {
    const ftpConfig = JSON.parse(fs.readFileSync('./secret/ftp.json', 'utf8'));
    if (!ftpConfig.host || !ftpConfig.user || !ftpConfig.password) {
      throw new Error('Missing required FTP configuration');
    }
    return ftpConfig;
  } catch (err) {
    log('FTP CONFIG ERROR', { error: err.message });
    throw err;
  }
}

function createClient(ftpConfig) {
  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on('ready', () => {
      log('FTP CONNECTION: Established successfully', {
        host: ftpConfig.host,
        user: ftpConfig.user
      });
      resolve(client);
    });

    client.on('error', (err) => {
      log('FTP CONNECTION ERROR:', { 
        error: err.message,
        host: ftpConfig.host,
        user: ftpConfig.user
      });
      reject(err);
    });

    try {
      log('CONNECTING TO FTP', {
        host: ftpConfig.host,
        user: ftpConfig.user
      });
      
      client.connect({
        host: ftpConfig.host,
        user: ftpConfig.user,
        password: ftpConfig.password,
        port: ftpConfig.port || 21
      });
    } catch (connectError) {
      log('CONNECTION ATTEMPT FAILED:', { 
        error: connectError.message,
        host: ftpConfig.host,
        user: ftpConfig.user
      });
      reject(connectError);
    }
  });
}

function uploadFile(client, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const normalizedLocalPath = localPath.replace(/\\/g, '/');
    log('UPLOADING FILE', { localPath: normalizedLocalPath, remotePath });
    
    client.put(normalizedLocalPath, remotePath, (err) => {
      if (err) {
        log('UPLOAD ERROR', { 
          localPath: normalizedLocalPath, 
          remotePath, 
          error: err.message 
        });
        reject(err);
      } else {
        log('UPLOAD SUCCESS', { 
          localPath: normalizedLocalPath, 
          remotePath 
        });
        resolve();
      }
    });
  });
}

async function deploy() {
  let client;
  try {
    log('DEPLOYMENT START', { 
      description: 'Deploying updated game component' 
    });
    
    // Load FTP config first
    const ftpConfig = loadFtpConfig();
    log('FTP CONFIG LOADED');
    
    // Build the app
    log('BUILD START');
    execSync('ng build --configuration=production', { stdio: 'inherit' });
    log('BUILD SUCCESS');
    
    // Connect to FTP
    client = await createClient(ftpConfig);
    
    const distPath = './dist/kleexck';
    const filesToUpload = fs.readdirSync(distPath)
      .filter(file => file !== 'index.html'); // Skip index.html for now

    log('FILES TO UPLOAD', { files: filesToUpload });

    // Upload each file
    for (const file of filesToUpload) {
      const localPath = path.join(distPath, file);
      const remotePath = `/${file}`; // Upload to root of cursor directory
      await uploadFile(client, localPath, remotePath);
    }

    log('DEPLOYMENT SUCCESS');
  } catch (error) {
    log('DEPLOYMENT ERROR', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    if (client) {
      client.end();
      log('FTP DISCONNECTED');
    }
  }
}

// Run deployment
deploy()
  .then(() => {
    log('PROCESS COMPLETE');
    process.exit(0);
  })
  .catch((error) => {
    log('PROCESS FAILED', { error: error.message });
    process.exit(1);
  }); 