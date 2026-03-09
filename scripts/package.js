/**
 * Cross-platform packaging script for TDT Space
 * Supports: Windows, macOS, Linux
 *
 * On Windows: manually assembles portable directory (avoids electron-builder for flexibility)
 * On macOS/Linux: delegates to electron-builder which handles platform-specific packaging
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const platform = process.platform; // 'win32' | 'darwin' | 'linux'

console.log(
  `📦 Building TDT Space for ${platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux"}...\n`,
);

try {
  // Step 1: Build both React app and Electron
  console.log("🔨 Building application (client + electron)...");
  execSync("bun run build", { cwd: rootDir, stdio: "inherit" });

  if (platform === "win32") {
    await buildWindows();
  } else {
    await buildUnix();
  }
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}

/**
 * Windows packaging: manual portable directory assembly (avoids needing elevated privileges for NSIS)
 */
async function buildWindows() {
  console.log("\n📦 Creating Windows portable build...\n");

  const timestamp = Date.now();
  const releaseDir = path.join(rootDir, "release", `win-unpacked-${timestamp}`);
  const legacyReleaseDir = path.join(rootDir, "release", "win-unpacked");

  // Try to clean up legacy folder (may be locked by a running process)
  if (fs.existsSync(legacyReleaseDir)) {
    try {
      fs.rmSync(legacyReleaseDir, { recursive: true, force: true });
    } catch {
      console.log("  ⚠ Could not clean legacy win-unpacked folder (locked by another process)");
      console.log(`     Using timestamped folder instead: win-unpacked-${timestamp}`);
    }
  }

  fs.mkdirSync(releaseDir, { recursive: true });

  // Clean up any previous temp directory
  const appTempDir = path.join(rootDir, "release", "app-temp");
  if (fs.existsSync(appTempDir)) {
    fs.rmSync(appTempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appTempDir, { recursive: true });

  console.log("  ✓ Preparing app files for ASAR...");
  const filesToCopy = ["dist", "dist-electron", "public", "package.json"];

  for (const file of filesToCopy) {
    const src = path.join(rootDir, file);
    const dest = path.join(appTempDir, file);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }

  // Copy only production node_modules
  console.log("  ✓ Copying production dependencies...");
  const tempNodeModules = path.join(appTempDir, "node_modules");
  fs.mkdirSync(tempNodeModules, { recursive: true });

  const prodDeps = ["@xterm", "electron-store", "node-pty", "react", "react-dom", "react-resizable-panels", "zustand"];

  for (const pkg of prodDeps) {
    const src = path.join(rootDir, "node_modules", pkg);
    if (fs.existsSync(src)) {
      const dest = path.join(tempNodeModules, pkg);
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  }

  // Create asar archive — output OUTSIDE appTempDir to avoid recursive packing
  console.log("  ✓ Creating app.asar bundle...");
  const resourcesDir = path.join(releaseDir, "resources");
  fs.mkdirSync(resourcesDir, { recursive: true });
  const asarPath = path.join(resourcesDir, "app.asar");
  const asarUnpackedDir = path.join(resourcesDir, "app.asar.unpacked");

  try {
    console.log("    Packing app.asar using bunx...");
    // Use --unpack to extract native .node binaries (they cannot run from inside ASAR)
    execSync(`bunx --bun asar pack "${appTempDir}" "${asarPath}" --unpack "*.node"`, {
      stdio: "pipe",
      maxBuffer: 50 * 1024 * 1024,
      encoding: "utf-8",
    });
    console.log("    ✓ ASAR pack completed successfully");
  } catch (e) {
    console.log("    ⚠ ASAR creation failed:", e.message);
    console.log("    Falling back to unpacked app directory...");

    // Fallback: copy app files directly to resources/app instead of using ASAR
    const appDir = path.join(resourcesDir, "app");
    fs.cpSync(appTempDir, appDir, { recursive: true, force: true });
    console.log("    ✓ Copied app files directly to resources/app");
  }

  // Clean up temp directory
  try {
    fs.rmSync(appTempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Copy Electron runtime (Windows-specific files)
  console.log("  ✓ Copying Electron runtime...");
  const electronDist = path.join(rootDir, "node_modules", "electron", "dist");

  const electronFiles = [
    "electron.exe",
    "d3dcompiler_47.dll",
    "ffmpeg.dll",
    "libEGL.dll",
    "libGLESv2.dll",
    "vk_swiftshader.dll",
    "vulkan-1.dll",
    "icudtl.dat",
    "chrome_100_percent.pak",
    "chrome_200_percent.pak",
    "resources.pak",
    "snapshot_blob.bin",
    "v8_context_snapshot.bin",
    "version",
    "LICENSE",
    "LICENSES.chromium.html",
  ];

  for (const file of electronFiles) {
    const src = path.join(electronDist, file);
    const dest = path.join(releaseDir, file);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest);
    }
  }

  const localesSrc = path.join(electronDist, "locales");
  const localesDest = path.join(releaseDir, "locales");
  if (fs.existsSync(localesSrc)) {
    fs.cpSync(localesSrc, localesDest, { recursive: true, force: true });
  }

  const resourcesSrc = path.join(electronDist, "resources");
  const resourcesDest = path.join(releaseDir, "resources");
  if (fs.existsSync(resourcesSrc)) {
    fs.cpSync(resourcesSrc, resourcesDest, { recursive: true, force: true });
  }

  // Rename executable
  const oldExe = path.join(releaseDir, "electron.exe");
  const newExe = path.join(releaseDir, "TDT Space.exe");
  if (fs.existsSync(oldExe) && !fs.existsSync(newExe)) {
    fs.renameSync(oldExe, newExe);
    console.log('  ✓ Renamed to "TDT Space.exe"');
  }

  // Create/update symbolic link 'win-unpacked' -> latest build (cross-platform junction)
  const linkPath = path.join(rootDir, "release", "win-unpacked");
  try {
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
    // Use junction on Windows (doesn't require admin rights unlike symlinks)
    execSync(`cmd /c mklink /J "${linkPath}" "${releaseDir}"`, { stdio: "pipe" });
  } catch {
    // Ignore link creation errors — user can still find build in timestamped folder
  }

  // Cleanup old timestamped folders (keep only 2 most recent)
  try {
    const releaseFiles = fs
      .readdirSync(path.join(rootDir, "release"))
      .filter((name) => name.startsWith("win-unpacked-") && /\d+$/.test(name))
      .sort()
      .reverse();

    for (let i = 2; i < releaseFiles.length; i++) {
      const oldFolder = path.join(rootDir, "release", releaseFiles[i]);
      try {
        fs.rmSync(oldFolder, { recursive: true, force: true });
        console.log(`  ✓ Cleaned up old build: ${releaseFiles[i]}`);
      } catch {
        // Ignore cleanup errors for old folders
      }
    }
  } catch {
    // Ignore cleanup errors
  }

  console.log("\n✅ Windows build completed!");
  console.log(`\n📁 Release folder: release\\${path.basename(releaseDir)}\\`);
  console.log("🚀 Executable: TDT Space.exe");
  console.log("   (Linked from: release\\win-unpacked\\)");

  if (fs.existsSync(path.join(releaseDir, "resources", "app.asar"))) {
    console.log("✅ ASAR bundle: resources\\app.asar (node_modules bundled)");
  } else {
    console.log("⚠️  ASAR bundle not created (files in root folder)");
  }
}

/**
 * macOS/Linux packaging: use electron-builder which handles .app/.dmg on macOS and AppImage on Linux
 */
async function buildUnix() {
  const platformFlag = platform === "darwin" ? "--mac" : "--linux";
  const platformName = platform === "darwin" ? "macOS" : "Linux";

  console.log(`\n📦 Creating ${platformName} build using electron-builder...\n`);

  try {
    execSync(`bunx electron-builder ${platformFlag}`, {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        // Ensure electron-builder uses the correct node_modules
        npm_config_cache: path.join(os.tmpdir(), ".npm"),
      },
    });

    console.log(`\n✅ ${platformName} build completed!`);
    console.log("\n📁 Release folder: release/");

    if (platform === "darwin") {
      console.log("🚀 App bundle: release/*.dmg or release/*.app");
    } else {
      console.log("🚀 App bundle: release/*.AppImage or release/*.deb");
    }
  } catch (err) {
    throw new Error(`electron-builder failed: ${err.message}`);
  }
}
