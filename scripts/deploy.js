const Client = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure logs directory exists
const logsDir = path.resolve('./logs');
fs.mkdirSync(logsDir, { recursive: true });

// Constants for remote directories
const REMOTE_DIRS = {
  BASE: '',  // Base directory is already /dev.kleexck.com/cursor/
  DIST: '',  // Files go directly in /cursor/
  CURRENT: '',  // No current subdirectory
  ROLLBACK: '/rollback',
  VERSIONS: '/versions'
};

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

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

async function createClient(ftpConfig) {
  const client = new Client.Client();
  
  try {
    log('CONNECTING TO FTP', {
      host: ftpConfig.host,
      user: ftpConfig.user
    });
    
    await client.access({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      port: ftpConfig.port || 21
    });
    
    log('FTP CONNECTION: Established successfully', {
      host: ftpConfig.host,
      user: ftpConfig.user
    });
    
    return client;
  } catch (err) {
    log('FTP CONNECTION ERROR:', { 
      error: err.message,
      host: ftpConfig.host,
      user: ftpConfig.user
    });
    throw err;
  }
}

async function listFiles(client, path = '/') {
  try {
    const list = await client.list(path);
    return list;
  } catch (err) {
    log('LIST ERROR', { error: err.message, path });
    throw err;
  }
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

async function deleteFile(client, filename) {
  try {
    // Try to delete both with and without leading slash
    const paths = [filename, `/${filename}`];
    for (const path of paths) {
      log('ATTEMPTING DELETE', { path });
      try {
        await client.remove(path);
        log('DELETE SUCCESS', { path });
        return; // Exit after first successful delete
      } catch (err) {
        log('DELETE ATTEMPT FAILED', { path, error: err.message });
      }
    }
  } catch (err) {
    log('DELETE ERROR', { error: err.message, filename });
  }
}

async function uploadFile(client, localPath, remotePath) {
  try {
    const normalizedLocalPath = localPath.replace(/\\/g, '/');
    log('UPLOADING FILE', { localPath: normalizedLocalPath, remotePath });
    
    await client.uploadFrom(normalizedLocalPath, remotePath);
    
    log('UPLOAD SUCCESS', { 
      localPath: normalizedLocalPath, 
      remotePath 
    });
  } catch (err) {
    log('UPLOAD ERROR', { 
      localPath: normalizedLocalPath, 
      remotePath, 
      error: err.message 
    });
    throw err;
  }
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

async function ensureRemoteDirectories(client) {
  const dirs = Object.values(REMOTE_DIRS);
  for (const dir of dirs) {
    if (!dir) continue;  // Skip empty directory paths
    try {
      await client.ensureDir(dir);
      log('MKDIR SUCCESS', { dir });
    } catch (err) {
      log('MKDIR WARNING', { dir, error: err.message });
    }
  }
}

async function backupCurrentVersion(client) {
  try {
    // First, check if there's a current version
    const currentFiles = await listFiles(client, '');  // Look in root /cursor/
    if (currentFiles.length === 0) {
      log('NO CURRENT VERSION TO BACKUP');
      return;
    }

    const timestamp = getTimestamp();
    const versionDir = `${REMOTE_DIRS.VERSIONS}/${timestamp}`;
    const rollbackDir = REMOTE_DIRS.ROLLBACK;

    // Create version directory
    await new Promise((resolve) => {
      client.mkdir(versionDir, true, () => resolve());
    });

    // Copy current files to both rollback and versions
    for (const file of currentFiles) {
      if (file.name === '.' || file.name === '..' || file.name === 'TARGET.TXT' || file.name === 'rollback' || file.name === 'versions') continue;
      
      const currentPath = `/${file.name}`;  // Root of /cursor/
      const versionPath = `${versionDir}/${file.name}`;
      const rollbackPath = `${rollbackDir}/${file.name}`;

      // Copy to version directory
      await new Promise((resolve) => {
        client.get(currentPath, (err, stream) => {
          if (err) {
            log('BACKUP ERROR', { error: err.message });
            resolve();
            return;
          }
          stream.once('close', resolve);
          client.put(stream, versionPath);
        });
      });

      // Copy to rollback directory
      await new Promise((resolve) => {
        client.get(currentPath, (err, stream) => {
          if (err) {
            log('BACKUP ERROR', { error: err.message });
            resolve();
            return;
          }
          stream.once('close', resolve);
          client.put(stream, rollbackPath);
        });
      });
    }
    
    log('BACKUP COMPLETE', { version: timestamp });
    return timestamp;
  } catch (error) {
    log('BACKUP ERROR', { error: error.message });
    throw error;
  }
}

async function verifyDeploymentTarget(client) {
  try {
    // First verify the file exists
    const files = await listFiles(client, '');
    const targetFile = files.find(file => file.name === 'TARGET.TXT');
    if (!targetFile) {
      throw new Error('TARGET.TXT not found in deployment directory. Deployment aborted for safety.');
    }

    // Now verify its contents
    const expectedContent = '4d43f11d-0bf6-471e-90c9-e0387f925b05';
    const content = await new Promise((resolve, reject) => {
      let data = '';
      client.get('TARGET.TXT', (err, stream) => {
        if (err) {
          reject(new Error('Could not read TARGET.TXT'));
          return;
        }
        stream.on('data', chunk => data += chunk);
        stream.on('end', () => resolve(data.trim()));
        stream.on('error', err => reject(err));
      });
    });

    if (content !== expectedContent) {
      throw new Error('TARGET.TXT content does not match expected value. Deployment aborted for safety.');
    }

    log('TARGET.TXT verified', { path: '/dev.kleexck.com/cursor/', content: expectedContent });
  } catch (error) {
    log('TARGET VERIFICATION FAILED', { error: error.message });
    throw error;
  }
}

async function deploy() {
  let client = null;
  try {
    // Build the project
    log('STARTING DEPLOYMENT');
    execSync('ng build --configuration=development', { stdio: 'inherit' });
    log('BUILD COMPLETE');

    // Load FTP configuration
    const ftpConfig = JSON.parse(fs.readFileSync('./secret/ftp.json', 'utf8'));

    // Create FTP client
    client = new Client.Client();
    await client.access({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      port: ftpConfig.port || 21
    });
    log('FTP CONNECTION: Established successfully');

    // Ensure rollback directory exists
    await client.ensureDir(REMOTE_DIRS.ROLLBACK);

    // Specify the local and remote paths
    const localDistPath = path.resolve('./dist/kleexck');
    const remoteDistPath = '/';

    // Get list of files to upload
    const filesToUpload = fs.readdirSync(localDistPath)
      .filter(file => {
        const fullPath = path.join(localDistPath, file);
        return fs.statSync(fullPath).isFile();
      });

    // First, backup current files to rollback directory
    const currentFiles = await listFiles(client, remoteDistPath);
    for (const file of currentFiles) {
      if (file.name === '.' || file.name === '..' || file.name === 'rollback' || file.name === 'versions') continue;
      
      const currentPath = `/${file.name}`;
      const rollbackPath = `${REMOTE_DIRS.ROLLBACK}/${file.name}`;
      
      log(`BACKING UP: ${file.name} to rollback`);
      try {
        // Use FTP download and upload to copy file
        const downloadStream = await client.downloadTo(Buffer.alloc(0), currentPath);
        await client.uploadFrom(downloadStream, rollbackPath);
      } catch (backupError) {
        log(`BACKUP FAILED: ${file.name}`, { error: backupError.message });
      }
    }

    // Upload new files
    for (const file of filesToUpload) {
      const localFilePath = path.join(localDistPath, file);
      const remoteFilePath = path.posix.join(remoteDistPath, file);
      
      log(`UPLOADING: ${file}`);
      await client.uploadFrom(localFilePath, remoteFilePath);
    }

    log('DEPLOYMENT COMPLETE');
  } catch (error) {
    log('DEPLOYMENT FAILED', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  } finally {
    // Ensure client is closed if it was opened
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        log('FTP CLIENT CLOSE ERROR', { error: closeError.message });
      }
    }
  }
}

async function rollback() {
  let client;
  try {
    log('ROLLBACK START');
    
    const ftpConfig = loadFtpConfig();
    client = await createClient(ftpConfig);
    
    // Check if rollback exists
    const rollbackFiles = await listFiles(client, REMOTE_DIRS.ROLLBACK);
    if (rollbackFiles.length === 0) {
      throw new Error('No rollback version available');
    }
    
    // Move current to versions as backup
    const timestamp = await backupCurrentVersion(client);
    log('CURRENT VERSION BACKED UP', { version: timestamp });
    
    // Move rollback to current
    for (const file of rollbackFiles) {
      if (file.name === '.' || file.name === '..') continue;
      
      const rollbackPath = `${REMOTE_DIRS.ROLLBACK}/${file.name}`;
      const currentPath = `/${file.name}`;  // Root of /cursor/
      
      // Copy rollback file to current directory
      await new Promise((resolve) => {
        client.get(rollbackPath, (err, stream) => {
          if (err) {
            log('ROLLBACK ERROR', { error: err.message });
            resolve();
            return;
          }
          stream.once('close', resolve);
          client.put(stream, currentPath);
        });
      });
    }
    
    log('ROLLBACK SUCCESS');
  } catch (error) {
    log('ROLLBACK ERROR', { error: error.message });
    throw error;
  } finally {
    if (client) {
      client.close();
    }
  }
}

async function listVersions() {
  let client;
  try {
    const ftpConfig = loadFtpConfig();
    client = await createClient(ftpConfig);
    
    const versions = await listFiles(client, REMOTE_DIRS.VERSIONS);
    const versionList = versions
      .filter(v => v.name !== '.' && v.name !== '..')
      .map(v => v.name)
      .sort()
      .reverse();
    
    console.log('\nAvailable versions:');
    versionList.forEach(v => console.log(`- ${v}`));
    
    return versionList;
  } catch (error) {
    log('LIST VERSIONS ERROR', { error: error.message });
    throw error;
  } finally {
    if (client) {
      client.close();
    }
  }
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'deploy') {
  deploy();
} else if (command === 'rollback') {
  rollback();
} else if (command === 'list-versions') {
  listVersions();
} else {
  console.log('Usage: node deploy.js [deploy|rollback|list-versions]');
  process.exit(1);
}

// Export commands for potential module usage
module.exports = {
  deploy,
  rollback,
  listVersions
}; 

