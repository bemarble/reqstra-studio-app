// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname
})

export default [
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', '.superpowers/**']
  },
  ...compat.extends(
    '@electron-toolkit/eslint-config-ts',
    '@electron-toolkit/eslint-config-ts/eslint-recommended',
    '@electron-toolkit/eslint-config-prettier'
  )
]
