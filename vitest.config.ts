import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test_setup.ts'],
    testTimeout: 30000,
    pool: 'forks',
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});