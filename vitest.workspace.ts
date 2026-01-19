import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // API service tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'api',
      root: './services/api',
      environment: 'node',
    },
  },
  // UI package tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'ui',
      root: './packages/ui',
      environment: 'jsdom',
    },
  },
  // Desktop app tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'desktop',
      root: './apps/desktop',
      environment: 'jsdom',
    },
  },
  // ACP client tests
  {
    extends: './vitest.config.ts',
    test: {
      name: 'acp-client',
      root: './packages/acp-client',
      environment: 'node',
    },
  },
])
