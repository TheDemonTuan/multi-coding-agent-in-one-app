// Get app version from package.json or Wails backend
import { backendAPI, isWailsAvailable } from '../services/wails-bridge';

let cachedVersion = '';

export async function getAppVersion(): Promise<string> {
  if (cachedVersion) {
    return cachedVersion;
  }

  let version: string;

  // Try to get version from Wails backend first
  try {
    if (isWailsAvailable()) {
      version = await backendAPI.getAppVersion();
      cachedVersion = version;
      return version;
    }
  } catch {
    // Not in Wails environment
  }

  // Fallback to reading from package.json
  try {
    // Vite will replace this with the actual version at build time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkg = require('../../package.json') as { version: string };
    version = pkg.version;
    cachedVersion = version;
    return version;
  } catch {
    // Last resort fallback
    version = '0.0.0';
    cachedVersion = version;
    return version;
  }
}
