import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('📦 Building TDT Space with ASAR bundling...\n');

try {
  // Step 1: Build React app
  console.log('🔨 Building React application...');
  execSync('bun run build', { cwd: rootDir, stdio: 'inherit' });
  
  // Step 2: Build Electron main process
  console.log('\n🔨 Building Electron main process...');
  execSync('bun run build:electron', { cwd: rootDir, stdio: 'inherit' });
  
  // Step 3: Manual packaging with ASAR
  console.log('\n📦 Creating ASAR bundle...\n');
  
  const releaseDir = path.join(rootDir, 'release', 'win-unpacked');
  
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(releaseDir, { recursive: true });
  
  // Copy app files to temp directory for asar
  const appTempDir = path.join(rootDir, 'release', 'app-temp');
  if (fs.existsSync(appTempDir)) {
    fs.rmSync(appTempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appTempDir, { recursive: true });
  
  console.log('  ✓ Preparing app files for ASAR...');
  const filesToCopy = ['dist', 'dist-electron', 'public', 'package.json'];
  
  for (const file of filesToCopy) {
    const src = path.join(rootDir, file);
    const dest = path.join(appTempDir, file);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }
  
  // Copy only production node_modules
  console.log('  ✓ Copying production dependencies...');
  const tempNodeModules = path.join(appTempDir, 'node_modules');
  fs.mkdirSync(tempNodeModules, { recursive: true });
  
  const prodDeps = ['@xterm', 'electron-store', 'node-pty', 'react', 'react-dom', 'react-resizable-panels', 'zustand'];
  
  for (const pkg of prodDeps) {
    const src = path.join(rootDir, 'node_modules', pkg);
    if (fs.existsSync(src)) {
      const dest = path.join(tempNodeModules, pkg);
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }
  
  // Create asar archive
  console.log('  ✓ Creating app.asar bundle...');
  const asarPath = path.join(appTempDir, 'app.asar');
  
  // Install asar globally if not exists
  try {
    execSync('npx --yes asar p . app.asar', {
      cwd: appTempDir,
      stdio: 'pipe'
    });
  } catch (e) {
    console.log('    ⚠ ASAR creation failed, continuing without bundling...');
  }
  
  // Copy Electron runtime
  console.log('  ✓ Copying Electron runtime...');
  const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');
  
  const electronFiles = [
    'electron.exe', 'd3dcompiler_47.dll', 'ffmpeg.dll', 'libEGL.dll',
    'libGLESv2.dll', 'vk_swiftshader.dll', 'vulkan-1.dll', 'icudtl.dat',
    'chrome_100_percent.pak', 'chrome_200_percent.pak', 'resources.pak',
    'snapshot_blob.bin', 'v8_context_snapshot.bin', 'version', 'LICENSE', 'LICENSES.chromium.html'
  ];
  
  for (const file of electronFiles) {
    const src = path.join(electronDist, file);
    const dest = path.join(releaseDir, file);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest);
    }
  }
  
  const localesSrc = path.join(electronDist, 'locales');
  const localesDest = path.join(releaseDir, 'locales');
  if (fs.existsSync(localesSrc)) {
    fs.cpSync(localesSrc, localesDest, { recursive: true, force: true });
  }
  
  const resourcesSrc = path.join(electronDist, 'resources');
  const resourcesDest = path.join(releaseDir, 'resources');
  if (fs.existsSync(resourcesSrc)) {
    fs.cpSync(resourcesSrc, resourcesDest, { recursive: true, force: true });
  }
  
  // Copy asar file if created
  if (fs.existsSync(asarPath)) {
    console.log('  ✓ Copying ASAR bundle to resources...');
    const resourcesAppDir = path.join(releaseDir, 'resources');
    fs.mkdirSync(resourcesAppDir, { recursive: true });
    fs.cpSync(asarPath, path.join(resourcesAppDir, 'app.asar'));
    
    // Clean up temp
    fs.rmSync(appTempDir, { recursive: true, force: true });
  }
  
  // Rename executable
  const oldExe = path.join(releaseDir, 'electron.exe');
  const newExe = path.join(releaseDir, 'TDT Space.exe');
  if (fs.existsSync(oldExe) && !fs.existsSync(newExe)) {
    fs.renameSync(oldExe, newExe);
    console.log('  ✓ Renamed to "TDT Space.exe"');
  }
  
  console.log('\n✅ Production build completed!');
  console.log('\n📁 Release folder: release\\win-unpacked\\');
  console.log('🚀 Executable: TDT Space.exe');
  
  if (fs.existsSync(path.join(releaseDir, 'resources', 'app.asar'))) {
    console.log('✅ ASAR bundle: resources\\app.asar (node_modules bundled)');
    console.log('\n💡 Benefits: Smaller, more secure, harder to reverse-engineer');
  } else {
    console.log('⚠️  ASAR bundle not created (files in root folder)');
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
