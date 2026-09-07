/**
 * Guard de código fuente: nadie puede leer del detalle de monitoreo un campo
 * que el backend no manda.
 *
 * Bugs reales (2026-09-05). Al migrar la lectura del medidor, el detalle de
 * `GET /generacion-solar/monitoring/{id}` dejó de mandar `gaia_snapshot`,
 * `gaia_snapshot_principal` y `gaia_snapshot_respaldo`, y pasó a mandar
 * `medidor` ya resuelto. Tres consumidores siguieron leyendo los campos
 * viejos, y los tres quedaron rotos en producción sin que nada fallara:
 *
 *   · serieSolar.js         -> la gráfica de medidores de la app móvil, vacía
 *   · FasorialButton.vue    -> el diagrama fasorial, sin datos
 *   · SolarLiveView.vue     -> este se corrigió a tiempo, los otros dos no
 *
 * Por qué no lo agarró el typecheck: `DetalleMonitoreoSolar` declara
 * `[clave: string]: unknown`, o sea que acepta CUALQUIER nombre de campo.
 * Mientras esa firma de índice esté ahí, TypeScript no puede ver la
 * diferencia entre un campo que existe y uno que se borró hace tres días.
 *
 * Este test cubre ese hueco con una lista explícita de lo que el backend
 * devuelve hoy. Es mantenimiento manual a propósito: si alguien cambia la
 * forma de la respuesta, tiene que tocar esta lista, y ahí ve de una quiénes
 * la leen. Es justamente el paso que faltó.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..', '..', '..')

/**
 * Campos de `GET /generacion-solar/monitoring/{id}`, tomados del `return` de
 * `project_monitoring_detail` en app/api/v1/generacion_solar.py.
 */
const CAMPOS_DEL_DETALLE = new Set([
  'gaia_node_id',
  'gaia_node_principal',
  'gaia_node_respaldo',
  'capacity_kwp',
  'inverters',
  'power_curve',
  'generation_today_kwh',
  'generation_today_hasta',
  'generation_30d',
  'total_30d_kwh',
  'has_strings',
  'medidor',
  'medidor_tipo',
  'medidor_principal',
  'medidor_respaldo',
  // Solo llegan con ?incluir_snapshot=true -- los usa el diagrama fasorial.
  'gaia_snapshot',
  'gaia_snapshot_principal',
  'gaia_snapshot_respaldo',
])

/** Archivos que consumen el detalle, con el nombre que le dan a la variable. */
const CONSUMIDORES: { archivo: string; variables: string[] }[] = [
  { archivo: 'app/features/solar/serieSolar.js', variables: ['detail'] },
  {
    archivo: 'app/features/solar/components/SolarLiveView.vue',
    variables: ['detailMap\\[id\\]', 'detailMap\\[proy\\.proyecto_id\\]'],
  },
]

function camposLeidos(archivo: string, variables: string[]): string[] {
  const fuente = readFileSync(join(RAIZ, archivo), 'utf8')
  const encontrados: string[] = []
  for (const v of variables) {
    for (const m of fuente.matchAll(new RegExp(`${v}\\??\\.([a-z_][a-zA-Z0-9_]*)`, 'g'))) {
      encontrados.push(m[1]!)
    }
  }
  return encontrados
}

describe('Detalle de monitoreo: consumidores vs respuesta del backend', () => {
  it('la lista de campos no quedó vacía (sanity: los regex siguen sirviendo)', () => {
    expect(CAMPOS_DEL_DETALLE.size).toBeGreaterThan(10)
    const total = CONSUMIDORES.flatMap((c) => camposLeidos(c.archivo, c.variables))
    expect(total.length, 'ningún consumidor leyó nada: revisar los patrones').toBeGreaterThan(0)
  })

  for (const { archivo, variables } of CONSUMIDORES) {
    it(`${archivo} no lee campos que el backend no manda`, () => {
      const huerfanos = [...new Set(camposLeidos(archivo, variables))].filter(
        (c) => !CAMPOS_DEL_DETALLE.has(c),
      )

      expect(
        huerfanos,
        `Lee del detalle campos que no existen: ${huerfanos.join(', ')}. ` +
          'Si el backend cambió la forma de la respuesta, hay que actualizar este ' +
          'consumidor Y la lista CAMPOS_DEL_DETALLE de este test. Leer un campo ' +
          'inexistente no lanza ningún error: deja la vista vacía en silencio.',
      ).toEqual([])
    })
  }
})
