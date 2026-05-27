// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'url'
import path from 'path'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  // @electron-toolkit/eslint-config-ts の依存プラグインはネストされた node_modules に存在するため
  // FlatCompat がルートから解決しようとするのを防ぐために、プラグイン解決パスを指定する
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
  ),
  {
    // react-hooks と jsx-a11y プラグインをフラット形式で追加
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    rules: {
      // react-hooks ルール
      'react-hooks/rules-of-hooks': 'error', // React Hooks の基本ルール（条件分岐・ループ内呼び出し禁止）
      'react-hooks/exhaustive-deps': 'warn',
      // jsx-a11y: プラグインを登録してインライン eslint-disable コメントを有効にする
      // 既存コードへの影響を抑えるため、推奨ルールは段階的に有効化する
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      // Zustandストア・テストのコールバック関数・高階関数では戻り値型を省略可能にする
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true
        }
      ],
      // _プレフィックスの変数は未使用でも許可する
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    // テストファイルでは戻り値型の省略を許可する
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
]
