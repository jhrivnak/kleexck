const { execSync } = require('child_process');

function runCommand(command, errorMessage) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error: ${errorMessage}`);
    console.error(error);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'start':
    // Start development server
    runCommand('ng serve', 'Failed to start development server');
    break;

  case 'test':
    // Run tests
    runCommand('ng test', 'Tests failed');
    break;

  case 'deploy':
    // Deploy to dev
    console.log('Building and deploying to dev...');
    runCommand('node scripts/deploy.js', 'Deployment failed');
    console.log('\nDeployment complete! Check https://dev.kleexck.com/');
    break;

  case 'verify':
    // Quick verification of dev environment
    console.log('Verifying dev deployment...');
    runCommand('curl -I https://dev.kleexck.com/', 'Could not reach dev site');
    console.log('Dev site is responding');
    break;

  default:
    console.log(`
Development Commands:
  node scripts/dev.js start   - Start local development server
  node scripts/dev.js test    - Run tests
  node scripts/dev.js deploy  - Deploy to dev site
  node scripts/dev.js verify  - Check dev site status
    `);
} 