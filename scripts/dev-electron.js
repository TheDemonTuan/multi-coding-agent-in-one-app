#!/usr/bin/env node

import { spawn } from 'child_process';
import { createServer } from 'vite';

async function main() {
  // Start Vite dev server
  const server = await createServer({
    configFile: 'vite.config.ts',
  });
  await server.listen();

  console.log('Vite dev server started on http://localhost:5173');

  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start Electron
  const electron = spawn('electron', ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_IS_DEV: '1',
    },
    shell: true,
  });

  electron.on('close', (code) => {
    server.close();
    process.exit(code || 0);
  });
}

main().catch(console.error);
