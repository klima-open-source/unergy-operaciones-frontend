// @ts-check
import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

/**
 * MIGRACIÓN — Fase 1/2. El código del legacy vive ya en su sitio dentro de `app/`,
 * pero todavía no cumple las reglas del template: son ~95.000 líneas y 4.100
 * avisos, de los cuales 3.820 son formato puro. Pasarles `--fix` en la fase 1
 * produciría un diff cosmético enorme sobre 177 componentes y enterraría
 * cualquier cambio real — que es exactamente lo que la fase 1 no puede permitirse.
 *
 * Así que se quedan fuera del lint hasta que la fase 3 los toque de verdad.
 *
 * La lista está pensada para **vaciarse sola**. Donde el legacy y el template
 * comparten carpeta, los separa la extensión: el legacy es JavaScript y el
 * template TypeScript. Donde el legacy ocupa la carpeta entera —las vistas, ya
 * repartidas en `features/<slice>/components/`— va una línea por slice.
 *
 * En ambos casos, migrar (paso 4 de la receta de la fase 3) saca al archivo del
 * ignore y el linter empieza a exigirle. La lista encogiendo *es* la métrica de
 * avance.
 */
const LEGACY_PENDIENTE_DE_MIGRAR = [
  // Carpetas que son legacy al 100%
  'app/data/**',
  'app/assets/*.js', // datasets estáticos

  // Piezas del legacy que aterrizaron en capas del template. Van archivo a
  // archivo porque comparten carpeta con código que sí cumple.
  'app/components/layout/LegacyAppSidebar.vue',
  'app/components/blocks/PageHeader.vue',
  'app/components/blocks/InfoField.vue',
  'app/components/blocks/DetalleLayout.vue',
  'app/components/blocks/ContactosPanel.vue',

  // Utilidades y datasets del legacy, ya dentro de su slice.
  'app/features/*/utils/**',
  'app/features/*/data/**',
  // Las vistas del legacy, ya repartidas en sus slices. Esta lista es la
  // métrica de avance de la fase 3: cuando un slice se migra, se borra su
  // línea y el linter empieza a exigirle.
  //
  // `auth` y `solar` van archivo por archivo porque su carpeta está mezclada:
  // `LoginForm.vue` y las piezas de `SolarLiveView.vue` son del template y sí
  // cumplen las reglas; `SolarView.vue` todavía no se migró.
  'app/features/admin/components/**',
  'app/features/alertas/components/**',
  'app/features/auth/components/ForgotPasswordView.vue',
  'app/features/auth/components/LoginView.vue',
  'app/features/auth/components/ResetPasswordView.vue',
  'app/features/clientes/components/**',
  'app/features/comercial/components/**',
  'app/features/contratos/components/**',
  'app/features/fallas/components/**',
  'app/features/finanzas/components/**',
  'app/features/fronteras/components/**',
  'app/features/garantias/components/**',
  'app/features/liquidaciones/components/**',
  'app/features/mem/components/**',
  'app/features/mobile/components/**',
  'app/features/operaciones/components/**',
  'app/features/operadores-red/components/**',
  'app/features/panel-contable/components/**',
  'app/features/proyectos/components/**',
  'app/features/registros-cnd/components/**',
  'app/features/retos/components/**',
  'app/features/solar/components/SolarView.vue',
]

export default withNuxt(prettier, {
  ignores: [
    'template/**',
    'example/**',
    // Código vendido: shadcn-vue regenera el primero, Gandalf sincroniza el segundo
    'app/components/ui/**',
    'app/components/gandalf/**',
    ...LEGACY_PENDIENTE_DE_MIGRAR,
  ],
})
