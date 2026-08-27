import * as dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config({ path: '.env.test', override: true });

export function setup() {
  console.log('[Test Setup] Validando ambiente de segurança...');

  const dbUrl = process.env.DATABASE_URL_TEST;
  if (!dbUrl) {
    console.error('ERRO FATAL: DATABASE_URL_TEST não encontrada em .env.test');
    process.exit(1);
  }

  // 1. Interpretar DATABASE_URL_TEST com URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch (e) {
    console.error('ERRO FATAL: DATABASE_URL_TEST inválida');
    process.exit(1);
  }

  // 2. Confirmar pathname exatamente /u223033896_ebd_test
  if (parsedUrl.pathname !== '/u223033896_ebd_test') {
    console.error('ERRO FATAL: pathname não é exatamente /u223033896_ebd_test. Ocultando valores reais por segurança.');
    process.exit(1);
  }

  // 3. Confirmar TEST_DATABASE_NAME exatamente u223033896_ebd_test
  if (process.env.TEST_DATABASE_NAME !== 'u223033896_ebd_test') {
    console.error('ERRO FATAL: TEST_DATABASE_NAME incorreto');
    process.exit(1);
  }

  // 4. Negar explicitamente ebd2026 e ebd_dev
  if (parsedUrl.pathname.includes('ebd2026') || parsedUrl.pathname.includes('ebd_dev')) {
    console.error('ERRO FATAL: Conexão detectou ambiente não autorizado (dev ou prod)');
    process.exit(1);
  }

  // 5. Confirmar NEXTAUTH_URL localhost:3100
  const nextAuthUrl = process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.trim().replace(/"/g, '') : '';
  if (nextAuthUrl !== 'http://localhost:3100') {
    console.error(`ERRO FATAL: NEXTAUTH_URL deve ser http://localhost:3100. Recebido: "${nextAuthUrl}"`);
    process.exit(1);
  }

  // Substitui a variável global do Prisma para forçar o uso deste DB.
  process.env.DATABASE_URL = dbUrl;

  console.log('[Test Setup] Ambiente de testes perfeitamente validado.');
}

setup();
