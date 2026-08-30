import * as dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config({ path: '.env.test', override: true });

export function validateTestEnv(): string {
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

  if (parsedUrl.hostname !== 'srv890.hstgr.io') {
    console.error('ERRO FATAL: Host de testes não é srv890.hstgr.io.');
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
}

validateTestEnv();
