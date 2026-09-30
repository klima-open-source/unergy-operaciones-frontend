// @ts-check
// Auditoría de consistencia con el sistema de diseño (@shadcn/lint). No forma parte de `bun run lint`.
import { plugin as shadcn } from '@shadcn/lint'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    ignores: ['app/components/ui/**', 'app/components/gandalf/**'],
  },
  {
    files: ['app/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser },
    },
    plugins: { shadcn, '@typescript-eslint': tsPlugin },
    settings: { shadcn: { componentImports: ['components/(ui|gandalf)(/|$)'] } },
    rules: {
      // Patrones del sidebar de shadcn (SiteHeader, SidebarInset) sin equivalente en la escala.
      'shadcn/no-arbitrary-values': [
        'error',
        {
          allow: [
            'transition-[width,height]',
            'h-[calc(100%-1rem)]',
            // Grids que reparten el ancho por contenido (auto-fit/minmax): ui/ ya usa grid-cols-[minmax(...)].
            'md:grid-cols-[minmax(18rem,22rem)_1fr]',
            'grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]',
            'grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]',
            'grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]',
            // Alturas máximas relativas al viewport (scroll interno de tableros y matrices).
            'max-h-[calc(100dvh-14rem)]',
            'lg:max-h-[calc(100dvh-20rem)]',
            'max-h-[calc(100vh-21.25rem)]',
          ],
        },
      ],
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/no-restyle': ['error', { allow: ['layout'] }],
    },
  },
  {
    // Ganchos de CSS scoped o de librería (vuedraggable), no utilidades de Tailwind.
    files: [
      'app/features/liquidaciones/components/LiquidacionPdfView.vue',
      'app/features/liquidaciones/components/panels/FacturacionPanel.vue',
      'app/features/retos/components/SemanaDrawer.vue',
      'app/features/solar/components/SolarLiveView.vue',
    ],
    rules: { 'shadcn/no-unknown-classes': 'off' },
  },
])
