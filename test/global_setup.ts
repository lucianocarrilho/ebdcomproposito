import { spawn, ChildProcess, execSync } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import { validateTestEnv } from '../test_setup';

let serverProc: ChildProcess | undefined;

export async function setup() {
  console.log('[Global Setup] Validando ambiente de testes...');
  validateTestEnv();

  console.log('[Global Setup] Booting Next.js test server diretamente...');
  
  const nextBin = path.resolve(__dirname, '../node_modules/next/dist/bin/next');
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
    NEXTAUTH_URL: 'http://localhost:3100',
    PORT: '3100'
  };

  serverProc = spawn(process.execPath, [nextBin, 'dev', '-p', '3100'], {
    env,
    stdio: 'pipe',
    shell: false
  });

  if (serverProc.stdout) serverProc.stdout.pipe(process.stdout);
  if (serverProc.stderr) serverProc.stderr.pipe(process.stderr);

  let ready = false;
  const startTime = Date.now();
  const totalTimeoutMs = 60000;
  const deadline = startTime + totalTimeoutMs;

  while (Date.now() < deadline) {
    const remainingTime = deadline - Date.now();
    if (remainingTime <= 0) break;

    const probeTimeoutMs = Math.min(2000, remainingTime);

    const isReady = await new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        req.destroy();
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(false);
      }, probeTimeoutMs);

      const req = http.get('http://localhost:3100/api/auth/csrf', (res) => {
        const { statusCode, headers } = res;
        const contentType = headers['content-type'] || '';

        let rawData = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          if (statusCode !== 200 || !contentType.includes('application/json')) {
            finish(false);
            return;
          }

          try {
            const parsed: unknown = JSON.parse(rawData);
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'csrfToken' in parsed &&
              typeof parsed.csrfToken === 'string' &&
              parsed.csrfToken.trim().length > 0
            ) {
              finish(true);
            } else {
              finish(false);
            }
          } catch {
            finish(false);
          }
        });

        res.on('error', () => finish(false));
        res.on('close', () => {
          if (!settled) finish(false);
        });
      });

      req.on('error', () => finish(false));
    });

    if (isReady) {
      console.log(`[Global Setup] Servidor Next.js pronto na porta 3100 (PID real: ${serverProc.pid})!`);
      ready = true;
      break;
    }

    const currentRemaining = deadline - Date.now();
    if (currentRemaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(1000, currentRemaining)));
  }

  if (!ready) {
    if (serverProc && serverProc.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${serverProc.pid} /t /f`, { stdio: 'ignore' });
        } else {
          serverProc.kill('SIGKILL');
        }
      } catch (e) {
        // ignore
      }
    }
    throw new Error('Timeout: Next.js server failed to become ready in 60 seconds.');
  }
}

function checkPortAvailableByBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: unknown) {
    return (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      e.code === 'EPERM'
    );
  }
}

export async function teardown() {
  if (serverProc && serverProc.pid) {
    const realPid = serverProc.pid;
    console.log(`[Global Teardown] Shutting down Next.js test server (PID real ${realPid})...`);

    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${realPid} /t /f`, { stdio: 'ignore' });
      } else {
        serverProc.kill('SIGTERM');
      }
    } catch (e) {
      // ignore
    }

    await new Promise<void>((resolve) => {
      if (serverProc?.exitCode !== null || !isPidAlive(realPid)) {
        resolve();
        return;
      }
      serverProc.once('exit', () => resolve());
      serverProc.once('close', () => resolve());
      setTimeout(resolve, 5000);
    });

    let processDead = false;
    let portAvailable = false;

    for (let i = 0; i < 10; i++) {
      processDead = !isPidAlive(realPid);
      portAvailable = await checkPortAvailableByBind(3100);

      if (processDead && portAvailable) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!processDead || !portAvailable) {
      throw new Error(
        `TEARDOWN_FAIL: Falha ao encerrar servidor Next.js. (` +
        `PID ${realPid} ativo: ${!processDead}, Porta 3100 livre: ${portAvailable})`
      );
    }

    console.log(`[Global Teardown] Servidor Next.js (PID ${realPid}) encerrado e porta 3100 confirmada livre via socket bind.`);
  }
}
