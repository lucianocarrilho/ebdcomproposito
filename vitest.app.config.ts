import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'test/e2e/multi_tenant/isolation.test.ts',
      'test/e2e/multi_tenant/s1_isolation.test.ts',
      'test/e2e/multi_tenant/s3a_csa_reads.test.ts',
      'test/e2e/multi_tenant/s3a2_legacy_reads.test.ts',
      'test/e2e/multi_tenant/s3b1_operational_writes.test.ts'
    ],
    exclude: ['test/e2e/multi_tenant/s2_backfill.test.ts'],
    globalSetup: ['./test/global_setup.ts'],
    setupFiles: ['./test_setup.ts'],
    testTimeout: 30000,
    pool: 'forks'
  }
});
