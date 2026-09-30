import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['test/contracts/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/contracts/anvil.global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
