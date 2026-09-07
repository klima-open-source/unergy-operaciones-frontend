/**
 * Guard de código fuente: el template del Resumen histórico no puede leer
 * campos que el backend no manda.
 *
 * Bug real (2026-09-03): el backend quitó las secciones "Intervención manual
 * recurrente" y "Recuperación activa de medidores" de
 * `GET /reporte-energia/resumen-historico` el 2026-08-26, pero el template
 * siguió renderizándolas. `<p v-if="!resumenHistorico.intervencion_manual.length">`
 * lee `.length` de `undefined`, eso lanza un TypeError durante el render, y
 * Vue tumba todo el subárbol -- la pestaña "Resumen" quedó **en blanco** una
 * semana entera, sin ningún mensaje de error visible.
 *
 * El typecheck no lo agarró porque la interfaz `ResumenHistoricoReporteEnergia`
 * seguía declarando esos cuatro campos: el tipo mentía, así que TypeScript
 * estaba conforme. Este test no verifica que el tipo coincida con el backend
 * (eso no se puede desde acá) -- verifica lo que sí se puede: que el template
 * y el tipo no se separen, de modo que mantener el tipo honesto alcance para
 * que el template no lea aire.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..', '..', '..')
const VISTA = join(RAIZ, 'app/features/fronteras/components/ReporteEnergiaAutomatizacionView.vue')
const TIPOS = join(RAIZ, 'app/features/fronteras/types.ts')

// `resumenHistorico` es un ref: en el <script> se lo accede como
// `resumenHistorico.value`, que no es un campo de la respuesta.
const NO_SON_CAMPOS = new Set(['value'])

/** Los `resumenHistorico.<campo>` que aparecen en el archivo de la vista. */
function camposLeidosEnLaVista(): Set<string> {
  const fuente = readFileSync(VISTA, 'utf8')
  const campos = new Set<string>()
  for (const m of fuente.matchAll(/resumenHistorico\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    if (!NO_SON_CAMPOS.has(m[1]!)) campos.add(m[1]!)
  }
  return campos
}

/** Los campos declarados en la interfaz ResumenHistoricoReporteEnergia. */
function camposDeclaradosEnElTipo(): Set<string> {
  const fuente = readFileSync(TIPOS, 'utf8')
  const i = fuente.indexOf('interface ResumenHistoricoReporteEnergia')
  expect(i, 'no se encontró la interfaz ResumenHistoricoReporteEnergia').toBeGreaterThan(-1)
  const cuerpo = fuente.slice(fuente.indexOf('{', i), fuente.indexOf('\n}', i))
  const campos = new Set<string>()
  // Solo las claves al primer nivel de indentación (2 espacios) -- las de los
  // objetos anidados van más adentro y no se leen como resumenHistorico.X.
  for (const m of cuerpo.matchAll(/^ {2}([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)) {
    campos.add(m[1]!)
  }
  return campos
}

describe('Resumen histórico: template vs tipo', () => {
  it('el tipo declara campos (sanity: los regex siguen encontrando algo)', () => {
    expect(camposDeclaradosEnElTipo().size).toBeGreaterThan(3)
    expect(camposLeidosEnLaVista().size).toBeGreaterThan(0)
  })

  it('la vista no lee ningún campo que el tipo no declare', () => {
    const declarados = camposDeclaradosEnElTipo()
    const huerfanos = [...camposLeidosEnLaVista()].filter((c) => !declarados.has(c))

    expect(
      huerfanos,
      `El template lee campos que ResumenHistoricoReporteEnergia no declara: ${huerfanos.join(', ')}. ` +
        'Si el backend dejó de mandarlos, hay que quitar la sección del template ' +
        '(leer .length de undefined deja la pestaña en blanco, sin error visible).',
    ).toEqual([])
  })
})
