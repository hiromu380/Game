// ESLint フラット設定（モノレポ全体で共通）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.wrangler/**', 'legacy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // シミュレーションは完全決定論。非決定的なAPIの使用を禁止する
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'シード付きPRNG (core/prng.ts) を使うこと' },
        { object: 'Date', property: 'now', message: 'シミュレーションは時刻に依存させない' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'シミュレーションは時刻に依存させない' },
      ],
    },
  },
  // クライアント（ブラウザ + React）
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // ビルド用のスクリプト（Node で動く）
  {
    files: ['apps/client/build/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
);
