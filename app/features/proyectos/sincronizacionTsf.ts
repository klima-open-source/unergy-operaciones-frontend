/**
 * «Sincronizar con TSF» desde la ficha del proyecto: qué cambiaría.
 *
 * Compara lo que TSF dice de la planta (minigranja, pre-simulación de PVsyst,
 * validación eléctrica y ECS) con lo que tiene Operaciones, y propone SOLO lo
 * que difiere. La persona elige en un modal qué aplicar; nada se escribe solo.
 *
 * Los valores se traducen al formato que ya usan los campos de Operaciones:
 * marcas con solo el fabricante («Huawei», «Longi»), potencia del panel en kW
 * («0.655»), potencias de inversores como lista («300, 50 y 40»). El voltaje se
 * guarda «MT/BT» («13.8/800») y TSF solo da la media tensión: se propone solo si
 * la media tensión cambia, para no perder la baja.
 */
import { prellenadoDesdeTsf, type OperadorRedCatalogo } from '~/features/proyectos/prellenadoTsf'
import type { EquipoTsf, ProyectoTsf, TecnicoTsf } from '~/features/proyectos/types'

export type DestinoCambio = 'proyecto' | 'info_tecnica'

export interface CambioTsf {
  /** Nombre del campo en el payload de su destino. */
  clave: string
  etiqueta: string
  destino: DestinoCambio
  actualTexto: string
  propuestoTexto: string
  /** El valor tal como se manda al API. */
  valor: unknown
}

/** Lo que la ficha ya tiene: el proyecto (con su `info_tecnica` anidada). */
export interface ProyectoActual {
  [campo: string]: unknown
  info_tecnica?: Record<string, unknown> | null
}

const VACIO = '—'

function texto(v: unknown): string {
  if (v === null || v === undefined || v === '') return VACIO
  if (Array.isArray(v)) return resumenMensual(v)
  return String(v)
}

function resumenMensual(meses: unknown[]): string {
  const nums = meses.map(Number).filter(Number.isFinite)
  if (!nums.length) return VACIO
  const total = nums.reduce((a, b) => a + b, 0)
  return `12 meses · ${Math.round(total).toLocaleString('es-CO')} kWh/año`
}

/** Mismo valor aunque uno sea «1320.480» (DecimalField) y el otro 1320.48. */
function iguales(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => iguales(x, b[i]))
  }
  const na = typeof a === 'number' ? a : typeof a === 'string' && a.trim() !== '' ? Number(a) : NaN
  const nb = typeof b === 'number' ? b : typeof b === 'string' && b.trim() !== '' ? Number(b) : NaN
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-6
  return String(a ?? '').trim() === String(b ?? '').trim()
}

/** «Huawei Technologies» → «Huawei»; «Jinkosolar 2025» → «Jinkosolar». */
export function marca(equipos: EquipoTsf[]): string | null {
  const nombres = [
    ...new Set(equipos.map((e) => e.fabricante?.trim().split(/\s+/)[0]).filter(Boolean)),
  ]
  return nombres.length ? nombres.join(' / ') : null
}

/** [300, 50, 40] → «300, 50 y 40». */
export function listaEs(valores: string[]): string | null {
  if (!valores.length) return null
  if (valores.length === 1) return valores[0]!
  return `${valores.slice(0, -1).join(', ')} y ${valores.at(-1)}`
}

const num = (n: number) => String(Math.round(n * 1000) / 1000)

/** «Tracker Zentrack 1P» → `1P`; mesa fija → null. */
export function tipoTracker(sistema: string | null): '1P' | '2P' | null {
  const m = sistema?.match(/\b([12])P\b/i)
  return m ? (`${m[1]}P` as '1P' | '2P') : null
}

/** «Tracker Zentrack 1P» → «Zentrack». Sin tracker en el nombre, null. */
export function marcaSeguidor(sistema: string | null): string | null {
  if (!sistema || !/tracker/i.test(sistema)) return null
  const resto = sistema
    .replace(/tracker/gi, '')
    .replace(/\b[12]P\b/gi, '')
    .trim()
  return resto || null
}

function tecnicos(t: TecnicoTsf): [string, string, unknown][] {
  const potenciasPanel = [
    ...new Set(t.paneles.map((p) => p.potencia).filter((p): p is number => p !== null)),
  ]
  const potenciasInv = [
    ...new Set(t.equiposInversor.map((i) => i.potencia).filter((p): p is number => p !== null)),
  ]
  return [
    ['capacidad_instalada_kwp', 'Capacidad instalada (kWp)', t.kwpDc],
    ['cantidad_total_paneles', 'Cantidad de paneles', t.modulos || null],
    [
      'potencia_panel_kwp',
      'Potencia panel (kWp)',
      potenciasPanel.map((w) => num(w / 1000)).join(', ') || null,
    ],
    ['marca_paneles', 'Marca paneles', marca(t.paneles)],
    ['cantidad_inversores', 'Cantidad inversores', t.inversores || null],
    ['potencia_inversores_kwp', 'Potencia inversores (kW)', listaEs(potenciasInv.map(num))],
    ['marca_inversores', 'Marca inversores', marca(t.equiposInversor)],
    ['cantidad_strings', 'Cantidad de strings', t.strings || null],
    ['tipo_tracker', 'Tipo tracker', tipoTracker(t.sistema)],
    ['marca_seguidor_solar', 'Seguidor solar', marcaSeguidor(t.sistema)],
  ]
}

export function cambiosDesdeTsf(
  tsf: ProyectoTsf,
  actual: ProyectoActual,
  divipola: Record<string, string[]>,
  operadores: OperadorRedCatalogo[],
): CambioTsf[] {
  const it = actual.info_tecnica ?? {}
  const { valores, simulacion } = prellenadoDesdeTsf(tsf, divipola, operadores)
  const nombreOperador = (id: unknown) =>
    operadores.find((o) => o.id === id)?.nombre_comercial ?? (id == null ? null : `#${id}`)

  const candidatos: [DestinoCambio, string, string, unknown, ((v: unknown) => string)?][] = [
    ['proyecto', 'codigo_tsf', 'Código TSF', valores.codigo_tsf],
    ['proyecto', 'origina_code', 'Código en TSF (completo)', valores.origina_code],
    ['proyecto', 'originabot_minifarm_id', 'Minigranja en TSF', tsf.minigranjaId],
    // En TSF todo proyecto es `minifarm`: no distingue `gd` de `minigranja`. Solo
    // llena un tipo vacío; nunca reemplaza el que una persona eligió.
    [
      'proyecto',
      'tipo_proyecto',
      'Tipo de proyecto',
      actual.tipo_proyecto ? null : valores.tipo_proyecto,
    ],
    ['proyecto', 'departamento', 'Departamento', valores.departamento],
    ['proyecto', 'municipio', 'Municipio', valores.municipio],
    ['proyecto', 'latitud', 'Latitud', valores.latitud],
    ['proyecto', 'longitud', 'Longitud', valores.longitud],
    [
      'proyecto',
      'operador_red_id',
      'Operador de red',
      valores.operador_red_id,
      nombreOperador as (v: unknown) => string,
    ],
    ['proyecto', 'p50_mensual_kwh', 'Generación simulada P50', simulacion.p50],
    ['proyecto', 'p90_mensual_kwh', 'Generación simulada P90', simulacion.p90],
    ['proyecto', 'potencia_ac_kw', 'Potencia AC (kW)', tsf.tecnico?.kwAc ?? null],
    ['proyecto', 'ecs_estado', 'ECS: estado', tsf.ecs?.estado ?? null],
    ['proyecto', 'ecs_codigo_insumo', 'ECS: código de insumo', tsf.ecs?.codigoInsumo ?? null],
    ['proyecto', 'ecs_vencimiento', 'ECS: vencimiento', tsf.ecs?.vencimiento ?? null],
    ['proyecto', 'ecs_archivo_url', 'ECS: archivo', tsf.ecs?.archivoUrl ?? null],
    ['proyecto', 'ecs_conformidad_url', 'ECS: conformidad', tsf.ecs?.conformidadUrl ?? null],
    ...(tsf.tecnico ? tecnicos(tsf.tecnico) : []).map(
      ([clave, etiqueta, v]) =>
        ['info_tecnica', clave, etiqueta, v] as [DestinoCambio, string, string, unknown],
    ),
  ]

  const cambios: CambioTsf[] = []
  for (const [destino, clave, etiqueta, valor, mostrar] of candidatos) {
    if (valor === null || valor === undefined || valor === '') continue
    const actualValor = destino === 'proyecto' ? actual[clave] : it[clave]
    if (iguales(actualValor, valor)) continue
    const fmt = mostrar ?? texto
    cambios.push({
      clave,
      etiqueta,
      destino,
      actualTexto: actualValor == null || actualValor === '' ? VACIO : fmt(actualValor),
      propuestoTexto: fmt(valor),
      valor,
    })
  }

  // Voltaje: TSF da la media tensión («13.8»); Operaciones guarda «13.8/800».
  if (tsf.voltajeRed) {
    const actualVoltaje = typeof it.voltaje_red === 'string' ? it.voltaje_red : null
    const mt = actualVoltaje?.split('/')[0]?.trim()
    if (!iguales(mt, tsf.voltajeRed)) {
      const bt = actualVoltaje?.includes('/') ? actualVoltaje.slice(actualVoltaje.indexOf('/')) : ''
      const nuevo = `${tsf.voltajeRed}${bt}`
      cambios.push({
        clave: 'voltaje_red',
        etiqueta: 'Voltaje red (MT/BT)',
        destino: 'info_tecnica',
        actualTexto: actualVoltaje ?? VACIO,
        propuestoTexto: nuevo,
        valor: nuevo,
      })
    }
  }
  return cambios
}

/** Los cambios elegidos, agrupados por el endpoint que los recibe. */
export function payloadsDe(cambios: CambioTsf[]): {
  proyecto: Record<string, unknown>
  infoTecnica: Record<string, unknown>
} {
  const proyecto: Record<string, unknown> = {}
  const infoTecnica: Record<string, unknown> = {}
  for (const c of cambios) (c.destino === 'proyecto' ? proyecto : infoTecnica)[c.clave] = c.valor
  return { proyecto, infoTecnica }
}
