#!/usr/bin/env node

/**
 * WearNOW Backend Pre-Deployment Checklist
 * Run this script before deploying to verify all prerequisites
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 WearNOW Backend Pre-Deployment Checklist\n');

let allChecksPassed = true;

// Check 1: Node.js version
console.log('✓ Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
    console.error('❌ Node.js 18+ required. Current version:', nodeVersion);
    allChecksPassed = false;
} else {
    console.log(`  ✅ Node.js ${nodeVersion} detected\n`);
}

// Check 2: npm installed
console.log('✓ Checking npm installation...');
try {
    const npmVersion = execSync('npm --version', {encoding: 'utf8'}).trim();
    console.log(`  ✅ npm ${npmVersion} installed\n`);
} catch (error) {
    console.error('❌ npm not found');
    allChecksPassed = false;
}

// Check 3: AWS CLI installed
console.log('✓ Checking AWS CLI...');
try {
    const awsVersion = execSync('aws --version', {encoding: 'utf8'}).trim();
    console.log(`  ✅ ${awsVersion}\n`);
} catch (error) {
    console.error('❌ AWS CLI not installed. Install from: https://aws.amazon.com/cli/');
    allChecksPassed = false;
}

// Check 4: AWS credentials configured
console.log('✓ Checking AWS credentials...');
try {
    execSync('aws sts get-caller-identity', {encoding: 'utf8', stdio: 'pipe'});
    console.log('  ✅ AWS credentials configured\n');
} catch (error) {
    console.error('❌ AWS credentials not configured. Run: aws configure');
    allChecksPassed = false;
}

// Check 5: Dependencies installed
console.log('✓ Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    console.log('  ✅ node_modules found\n');
} else {
    console.error('❌ Dependencies not installed. Run: npm install');
    allChecksPassed = false;
}

// Check 6: Required files exist
console.log('✓ Checking required files...');
const requiredFiles = [
    'amplify/backend.ts',
    'amplify/auth/resource.ts',
    'amplify/data/resource.ts',
    'amplify/storage/resource.ts',
    'amplify/functions/virtual-tryon/handler.ts',
    'amplify/functions/virtual-tryon/bedrock-client.ts',
    'amplify/functions/virtual-tryon/s3-utils.ts',
    'amplify/functions/virtual-tryon/resource.ts',
    'amplify/functions/image-processor/handler.ts',
    'amplify/functions/image-processor/resource.ts',
];

let allFilesExist = true;
requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.error(`  ❌ Missing file: ${file}`);
        allFilesExist = false;
        allChecksPassed = false;
    }
});

if (allFilesExist) {
    console.log('  ✅ All required files present\n');
}

// Check 7: Package.json scripts
console.log('✓ Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.scripts && packageJson.scripts.sandbox && packageJson.scripts.deploy) {
    console.log('  ✅ Deployment scripts configured\n');
} else {
    console.error('❌ Missing deployment scripts in package.json');
    allChecksPassed = false;
}

// Summary
console.log('\n' + '='.repeat(60));
if (allChecksPassed) {
    console.log('✅ All checks passed! You are ready to deploy.\n');
    console.log('Next steps:');
    console.log('  1. Request Bedrock access: AWS Console → Bedrock → Model Access');
    console.log('  2. Run: npm run sandbox (for development)');
    console.log('  3. Run: npm run deploy (for production)');
    console.log('\nFor detailed instructions, see DEPLOYMENT.md');
} else {
    console.log('❌ Some checks failed. Please fix the issues above before deploying.\n');
    process.exit(1);
}
console.log('='.repeat(60) + '\n');

