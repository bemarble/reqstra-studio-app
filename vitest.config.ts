import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          include: ['tests/main/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'renderer',
          include: ['tests/renderer/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['tests/setup.ts'],
          resolve: {
            alias: {
              path: 'path-browserify',
            },
          },
        },
      },
    ],
  },
})
