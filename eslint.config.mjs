// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  // @electron-toolkit/eslint-config-ts の依存プラグインはネストされた node_modules に存在するため
  // プラグイン解決パスを指定する
  resolvePluginsRelativeTo: path.join(
    __dirname,
    'node_modules/@electron-toolkit/eslint-config-ts'
  )
})

export default [
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', '.superpowers/**']
  },
  ...compat.extends(
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-prettier'
  )
]
