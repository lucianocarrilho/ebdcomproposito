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
    include: ['test/e2e/multi_tenant/s2_backfill.test.ts'],
    setupFiles: ['./test_setup.ts'],
    testTimeout: 30000,
    pool: 'forks'
  }
});
