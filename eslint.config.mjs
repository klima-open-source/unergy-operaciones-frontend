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
  // `DetalleLayout`/`ContactosPanel` sirven a `clientes` (migrado) y también a
  // `contratos`/`proyectos` (fuera de alcance) — tipar sus props de objeto/array
  // a fondo implicaría revisar cómo los llaman esos dos, que está fuera de
  // alcance. `PageHeader` ya salió: sus props son planas (`title`/`subtitle`),
  // sin ese riesgo.
  'app/components/blocks/DetalleLayout.vue',
  'app/components/blocks/ContactosPanel.vue',

  // Utilidades y datasets del legacy, ya dentro de su slice.
  'app/features/*/utils/**',
  'app/features/*/data/**',
  // Las vistas del legacy, ya repartidas en sus slices. Esta lista es la
  // métrica de avance de la fase 3: cuando un slice se migra, se borra su
  // línea y el linter empieza a exigirle.
  //
  // `clientes` va archivo por archivo: `clientesUi.js` sigue en JS porque lo
  // importa `ServiciosUnificadoView.vue` (fuera de alcance de esta migración,
  // sigue en `contratos`) — cambiarle la forma lo rompería.
  'app/features/clientes/components/clientesUi.js',
  'app/features/contratos/components/**',
  'app/features/finanzas/components/**',
  // `mem` migró Balance/Clima/Descubrimientos/PrecioBolsa/Gescon/CumplimientoV2
  // (roadmap §3.4) — quedan sus 3 utils JS exclusivos, que solo ella consume.
  'app/features/mem/components/cumplimientoAnualExport.js',
  'app/features/mem/components/cumplimientoMatrizExcel.js',
  'app/features/mem/components/cumplimientoRevision.js',
  'app/features/proyectos/components/**',
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
