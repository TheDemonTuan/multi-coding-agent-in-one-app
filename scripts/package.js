import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const releaseDir = path.join(rootDir, 'release', 'win-unpacked');
const resourcesDir = path.join(releaseDir, 'resources', 'app');

// Clean release directory
if (fs.existsSync(path.join(rootDir, 'release'))) {
  fs.rmSync(path.join(rootDir, 'release'), { recursive: true });
}

// Create directories
fs.mkdirSync(resourcesDir, { recursive: true });

// Copy dist
fs.cpSync(path.join(rootDir, 'dist'), path.join(resourcesDir, 'dist'), { recursive: true });

// Copy dist-electron
fs.cpSync(path.join(rootDir, 'dist-electron'), path.join(resourcesDir, 'dist-electron'), { recursive: true });

// Copy public files
fs.cpSync(path.join(rootDir, 'public'), path.join(resourcesDir, 'public'), { recursive: true });

// Copy package.json
fs.cpSync(path.join(rootDir, 'package.json'), path.join(resourcesDir, 'package.json'));

// Copy all node_modules
const nodeModulesSrc = path.join(rootDir, 'node_modules');
const nodeModulesDest = path.join(resourcesDir, 'node_modules');
fs.cpSync(nodeModulesSrc, nodeModulesDest, { recursive: true });
console.log('✓ Copied node_modules');

// Copy Electron executable
const electronDir = path.join(rootDir, 'node_modules', 'electron', 'dist');
if (fs.existsSync(electronDir)) {
  fs.cpSync(electronDir, releaseDir, { recursive: true });
  console.log('✓ Copied Electron runtime');
  
  // Rename electron.exe to app name
  const oldExe = path.join(releaseDir, 'electron.exe');
  const newExe = path.join(releaseDir, 'TDT Space.exe');
  if (fs.existsSync(oldExe)) {
    fs.renameSync(oldExe, newExe);
    console.log('✓ Renamed executable to TDT Space.exe');
  }
}

console.log('✓ Package created successfully!');
console.log(`Output: ${releaseDir}`);
