import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // graphql-request は pure ESM のため CJS require() できない。
    // バンドルに含めることで Rollup が ESM→CJS 変換を担う。
    plugins: [externalizeDepsPlugin({ exclude: ['graphql-request'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        path: 'path-browserify',
      },
    },
    optimizeDeps: {
      // graphql を明示的にプリバンドルし、環境差異による解決失敗を防ぐ
      include: ['graphql'],
    },
  },
})
