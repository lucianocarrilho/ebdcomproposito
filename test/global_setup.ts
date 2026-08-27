import { spawn, ChildProcess, execSync } from 'child_process';
import http from 'http';

let serverProc: ChildProcess;

export async function setup() {
  console.log('[Global Setup] Booting Next.js test server...');
  
  // Reusing the existing start_server.js
  serverProc = spawn('node', ['test/start_server.js'], { stdio: 'pipe' });
  
  if (serverProc.stdout) serverProc.stdout.pipe(process.stdout);
  if (serverProc.stderr) serverProc.stderr.pipe(process.stderr);

  // Poll for readiness
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const isReady = await new Promise((resolve) => {
      const req = http.get('http://localhost:3100', (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 404);
      });
      req.on('error', () => resolve(false));
    });

    if (isReady) {
      console.log('[Global Setup] Server is ready on port 3100!');
      ready = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!ready) {
    throw new Error('Timeout: Next.js server failed to become ready in 60 seconds.');
  }
}

export async function teardown() {
  if (serverProc) {
    console.log('[Global Teardown] Shutting down Next.js test server...');
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        process.kill(-serverProc.pid!);
      }
    } catch (e) {
      // ignore
    }
  }
}
