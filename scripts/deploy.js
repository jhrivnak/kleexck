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

function listFiles(client, path = '/') {
  return new Promise((resolve, reject) => {
    client.list(path, (err, list) => {
      if (err) {
        log('LIST ERROR', { error: err.message, path });
        reject(err);
        return;
      }
      resolve(list || []);
    });
  });
}

async function getAllFiles(client) {
  try {
    // Get files from both root and with leading slash
    const [rootFiles, slashFiles] = await Promise.all([
      listFiles(client, '/'),
      listFiles(client, '/*')
    ]);

    // Combine and deduplicate files
    const allFiles = new Map();
    [...rootFiles, ...slashFiles].forEach(file => {
      // Remove leading slash for consistency
      const name = file.name.replace(/^\//, '');
      if (!allFiles.has(name)) {
        allFiles.set(name, file);
      }
    });

    return Array.from(allFiles.values());
  } catch (error) {
    log('GET_ALL_FILES ERROR', { error: error.message });
    throw error;
  }
}

function deleteFile(client, filename) {
  return new Promise((resolve) => {
    // Try to delete both with and without leading slash
    const paths = [filename, `/${filename}`];
    let completed = 0;
    let successes = 0;

    paths.forEach(path => {
      log('ATTEMPTING DELETE', { path });
      client.delete(path, (err) => {
        completed++;
        if (err) {
          log('DELETE ATTEMPT FAILED', { path, error: err.message });
        } else {
          log('DELETE SUCCESS', { path });
          successes++;
        }

        // Resolve if either path succeeds or both attempts are done
        if (successes > 0 || completed === paths.length) {
          resolve();
        }
      });
    });
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

async function cleanupOldFiles(client, newFiles) {
  try {
    // Get a complete list of files
    const existingFiles = await getAllFiles(client);
    
    log('EXISTING FILES', { 
      files: existingFiles.map(f => f.name.replace(/^\//, '')),
      count: existingFiles.length
    });

    // Group new files by type (e.g., main.*.js, polyfills.*.js)
    const newFileTypes = new Set(newFiles.map(file => {
      const match = file.match(/^([^.]+).*\.(js|css|txt)$/);
      return match ? match[1] : null;
    }).filter(Boolean));

    log('FILE TYPES TO CLEAN', { types: Array.from(newFileTypes) });

    // Delete old versions of files
    const deletePromises = [];
    for (const file of existingFiles) {
      const name = file.name.replace(/^\//, '');
      if (name === '.' || name === '..' || name === '.ftpquota' || name === 'TARGET.TXT') {
        continue;
      }
      
      const match = name.match(/^([^.]+).*\.(js|css|txt)$/);
      if (match && newFileTypes.has(match[1])) {
        log('QUEUING DELETE', { filename: name, type: match[1] });
        deletePromises.push(deleteFile(client, name));
      }
    }

    // Wait for all deletes to complete
    if (deletePromises.length > 0) {
      log('STARTING CLEANUP', { filesToDelete: deletePromises.length });
      await Promise.all(deletePromises);
      log('CLEANUP COMPLETE');
    } else {
      log('NO FILES TO CLEAN');
    }
  } catch (error) {
    log('CLEANUP ERROR', { error: error.message, stack: error.stack });
    throw error;
  }
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

    // Clean up old files first
    await cleanupOldFiles(client, filesToUpload);

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