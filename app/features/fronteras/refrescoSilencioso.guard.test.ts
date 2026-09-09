/**
 * Guard de código fuente: refrescar la lista tras guardar o validar no puede
 * pasar por el spinner de carga.
 *
 * Bug real (2026-09-09): validar una frontera desde la pestaña "Historial"
 * recargaba el panel de detalle completo. `@actualizado` llamaba a
 * `cargarHistorial()` sin argumento, esa función ponía `loadingHistorial` en
 * true siempre, y el `.workspace` del Historial es justo el `v-else-if` de la
 * cadena que abre ese flag -- así que el subárbol se destruía y el detalle,
 * al recrearse, volvía a montar y relanzaba sus tres consultas
 * (`cargar()`, `cargarExclusiones()`, `cargarCurvaTipicaPreview()`).
 *
 * La misma acción en "Revisión de hoy" no lo hacía, porque ese handler sí
 * llamaba `cargarLista(true)`. Los dos paneles son gemelos y la diferencia no
 * se ve leyendo el template: hay que seguir el flag hasta el `v-else-if` para
 * entender que un refresco de fondo desmonta el detalle.
 *
 * Este guard fija la propiedad que importa: una recarga disparada por
 * `@actualizado` va en silencio. El botón "Ver" sigue libre de mostrar el
 * spinner -- ahí se está cambiando de día, y la carga sí es nueva.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..', '..', '..')
const VISTA = join(RAIZ, 'app/features/fronteras/components/ReporteEnergiaAutomatizacionView.vue')

const fuente = () => readFileSync(VISTA, 'utf8')

/** El contenido de cada `@actualizado="..."` del template. */
function handlersActualizado(): string[] {
  return [...fuente().matchAll(/@actualizado="([^"]*)"/g)].map((m) => m[1]!)
}

/** El cuerpo de una `async function <nombre>(...)`, hasta su `\n}` de cierre. */
function cuerpoDeFuncion(nombre: string): string {
  const src = fuente()
  const inicio = src.indexOf('async function ' + nombre + '(')
  expect(inicio, 'no se encontró ' + nombre + '()').toBeGreaterThan(-1)
  const fin = src.indexOf('\n}', inicio)
  return src.slice(inicio, fin)
}

/** Marca, línea por línea, si está cubierta por una guarda `if (!silent)`. */
function lineasProtegidas(cuerpo: string): { linea: string; protegida: boolean }[] {
  const salida: { linea: string; protegida: boolean }[] = []
  let nivel = 0
  let nivelDelBloque: number | null = null
  for (const linea of cuerpo.split('\n')) {
    // El bloque se cerró en cuanto volvemos a su nivel de apertura.
    if (nivelDelBloque !== null && nivel <= nivelDelBloque) nivelDelBloque = null
    const protegida = /if \(!silent\)/.test(linea) || nivelDelBloque !== null
    if (/if \(!silent\)\s*\{/.test(linea)) nivelDelBloque = nivel
    nivel += (linea.match(/\{/g) ?? []).length - (linea.match(/\}/g) ?? []).length
    salida.push({ linea, protegida })
  }
  return salida
}

describe('el refresco tras guardar/validar no muestra spinner', () => {
  it('los dos paneles (hoy e historial) escuchan @actualizado', () => {
    expect(handlersActualizado()).toHaveLength(2)
  })

  it('ningún @actualizado dispara una carga con spinner', () => {
    for (const handler of handlersActualizado()) {
      for (const m of handler.matchAll(/(cargarLista|cargarHistorial)\(([^)]*)\)/g)) {
        expect(
          m[2]!.trim(),
          m[1] +
            ' en @actualizado="' +
            handler +
            '" tiene que refrescar en silencio: sin el ' +
            'argumento, el flag de carga destruye el .workspace y remonta el detalle',
        ).toBe('true')
      }
    }
  })

  it('cargarLista y cargarHistorial aceptan el modo silencioso', () => {
    for (const nombre of ['cargarLista', 'cargarHistorial']) {
      expect(cuerpoDeFuncion(nombre)).toMatch(/^async function \w+\(silent = false\)/)
    }
  })

  it('ninguna de las dos toca su flag de carga sin consultar silent', () => {
    // Incluye el vaciado del `catch`: dejar la lista en [] durante un refresco
    // de fondo tumba el panel por un fallo de red pasajero, porque el
    // `v-else-if` de arriba mira precisamente su `.length`.
    //
    // La guarda vale en sus dos formas -- en la misma línea, o un bloque
    // `if (!silent) { ... }` que cubre varias -- y las dos funciones usan una
    // forma distinta, así que hay que seguir las llaves y no solo la línea.
    for (const nombre of ['cargarLista', 'cargarHistorial']) {
      for (const { linea, protegida } of lineasProtegidas(cuerpoDeFuncion(nombre))) {
        const esEfectoDeSpinner = /loading\w*\.value\s*=|fila\w*\.value\s*=\s*\[\]/.test(linea)
        if (!esEfectoDeSpinner) continue
        expect(
          protegida,
          'en ' +
            nombre +
            '(), esta línea corre también en un refresco silencioso: ' +
            linea.trim(),
        ).toBe(true)
      }
    }
  })
})
