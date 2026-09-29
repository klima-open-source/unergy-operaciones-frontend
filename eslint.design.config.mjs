// @ts-check
// Auditoría de consistencia con el sistema de diseño (@shadcn/lint). No forma parte de `bun run lint`.
import { plugin as shadcn } from '@shadcn/lint'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  {
    ignores: ['app/components/ui/**', 'app/components/gandalf/**'],
  },
  {
    files: ['app/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser },
    },
    plugins: { shadcn },
    settings: { shadcn: { componentImports: ['components/(ui|gandalf)(/|$)'] } },
    rules: {
      'shadcn/no-arbitrary-values': 'error',
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/no-restyle': ['error', { allow: ['layout'] }],
    },
  },
])
