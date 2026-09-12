import * as dotenv from 'dotenv';
import { resolve4 } from 'node:dns/promises';
import { isIPv4 } from 'node:net';
import { URL } from 'url';

dotenv.config({ path: '.env.test', override: true });

const ALLOWED_HOSTNAME = 'srv890.hstgr.io';
let validationPromise: Promise<string> | null = null;

export function validateTestEnv(): Promise<string> {
  if (!validationPromise) {
    validationPromise = (async (): Promise<string> => {
      console.log('[Test Setup] Validando ambiente de segurança...');

      const dbUrl = process.env.DATABASE_URL_TEST;
      if (!dbUrl) {
        console.error('ERRO FATAL: DATABASE_URL_TEST ausente em .env.test. Fallback proibido.');
        process.exit(1);
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(dbUrl);
      } catch (e) {
        console.error('ERRO FATAL: DATABASE_URL_TEST malformada.');
        process.exit(1);
      }

      const hostname = parsedUrl.hostname;
      let isHostValid = false;

      if (hostname === ALLOWED_HOSTNAME) {
        isHostValid = true;
      } else if (isIPv4(hostname)) {
        if (hostname === '127.0.0.1' || hostname === '0.0.0.0') {
          isHostValid = false;
        } else {
          try {
            const resolvedIps = await resolve4(ALLOWED_HOSTNAME);
            if (Array.isArray(resolvedIps) && resolvedIps.includes(hostname)) {
              isHostValid = true;
            }
          } catch (e) {
            console.error('ERRO FATAL: Não foi possível validar o host autorizado.');
            process.exit(1);
          }
        }
      }

      if (!isHostValid) {
        console.error('ERRO FATAL: Host do banco de testes não autorizado.');
        process.exit(1);
      }

      if (parsedUrl.pathname !== '/u223033896_ebd_test') {
        console.error('ERRO FATAL: Banco de testes não é /u223033896_ebd_test.');
        process.exit(1);
      }

      if (process.env.TEST_DATABASE_NAME !== 'u223033896_ebd_test') {
        console.error('ERRO FATAL: TEST_DATABASE_NAME não é u223033896_ebd_test.');
        process.exit(1);
      }

      if (parsedUrl.pathname.includes('ebd2026') || parsedUrl.pathname.includes('ebd_dev')) {
        console.error('ERRO FATAL: Detectado banco não autorizado (produção ou dev).');
        process.exit(1);
      }

      const nextAuthUrl = process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.trim().replace(/"/g, '') : '';
      if (nextAuthUrl !== 'http://localhost:3100') {
        console.error('ERRO FATAL: NEXTAUTH_URL deve ser http://localhost:3100.');
        process.exit(1);
      }

      process.env.DATABASE_URL = dbUrl;
      console.log('[Test Setup] Ambiente de testes perfeitamente validado.');
      return dbUrl;
    })();
  }
  return validationPromise;
}

await validateTestEnv();
