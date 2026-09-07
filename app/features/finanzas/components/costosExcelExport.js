/**
 * Generación del Excel mensual consolidado de Costos.
 *
 * Combina, para un período (YYYY-MM):
 *  - Mantenimiento  → /om/calculo/{periodo} (incluido + valor_a_facturar)   [mainteinance]
 *  - Arriendos      → /arriendos/calculo/{periodo} (incluido + canon_a_facturar) [lease]
 *  - Internet       → /starlink/factura/{periodo} (lineas.sin_iva, resueltas por proyecto) [public_services]
 *
 * Universo de proyectos = CATÁLOGO MAESTRO (MASTER_PKS), en su orden exacto.
 * Cada proyecto genera SIEMPRE sus 7 filas (una por payment_type); los payment_type
 * sin registro guardado ese mes quedan en value = 0. Genera y descarga el .xlsx.
 */
import { OmService } from '~/features/finanzas/services/om'
import { ArriendosCalculoService } from '~/features/finanzas/services/arriendos-calculo'
import { StarlinkService } from '~/features/finanzas/services/starlink'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Orden fijo de payment_type (strings exactos del spec, incluidos los typos)
const PAYMENT_TYPES = ['mainteinance', 'adjustment', 'polizas', 'discounts',
                       'interests', 'public_services', 'lease']

// Catálogo maestro de project_pk — lista y ORDEN EXACTO (nombres, mayúsculas y
// tildes tal cual). Es la fuente de verdad del universo de proyectos del export:
// SIEMPRE se generan estos 53, cada uno con sus 7 payment_type. Los que aún no
// tengan puente nombre→pk en PROJECT_PK saldrán en value = 0 (no tienen registro).
const MASTER_PKS = [
  'uruaco_gd', 'baraya', 'gandalf', 'cañahuate', 'vallenata', 'naos1', 'perija',
  'elmolino', 'mgs0011', 'verso', 'esmeralda', 'jerico_merengue', 'jerico_el_son',
  'puya', 'naos2', 'MGS 0012 La Reserva', 'villanueva', 'joropo', 'chima',
  'copey_occidente', 'mapale', 'ibirico', 'mgs18', 'naos3', 'bayunca', 'polaris_1',
  'delta_1', 'olimpo', 'san_onofre', 'lamesa', 'delta_2', 'polaris_2', 'agustin_1',
  'marimonda', 'san_diego_sur', 'yuan_solar', 'yurbaqua', 'cedillanosexc', 'piloneras',
  'valenciaoriente', 'valencia_oriente_2', 'sirius', 'catedral', 'cacica', 'bongos',
  'astrolumen', 'biosolar', 'cienaga', 'cumbia', 'chiriguana_norte_2',
  'chiriguana_norte_4', 'san_pelayo', 'agustin_2',
]

// ── Normalización y emparejamiento de nombres ─────────────────────────────────
function normName(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toUpperCase().replace(/\s+/g, ' ')
}
function stripCode(s) {
  return normName(s).replace(/^MGS\s*\d+\s*-?\s*/, '')
    .replace('MINIGRANJA SOLAR', ' ').replace('MINIGRANJA', ' ').trim()
}
const GENERIC = new Set(['LA', 'EL', 'LOS', 'LAS', 'DE', 'DEL', 'SAN', 'SUR', 'NORTE', 'SOLAR', 'MINIGRANJA', 'VALLE'])
function tokensSig(name) {
  const toks = stripCode(name).split(/\s+/).filter(Boolean)
  const sig = toks.filter(t => /^\d+$/.test(t) || (t.length > 3 && !GENERIC.has(t)))
  return sig.length ? sig : toks.filter(t => !GENERIC.has(t))
}

// Nombre panel → project_pk ("Nombre api")
const PROJECT_PK = {
  'Minigranja Solar Uruaco':             'uruaco_gd',
  'Minigranja Solar Baraya':             'baraya',
  'Minigranja Solar Gandalf':            'gandalf',
  'Minigranja Solar Cañahuate':          'cañahuate',
  'Minigranja Solar La Paz Vallenata':   'vallenata',
  'Minigranja Solar Perijá':             'perija',
  'Minigranja Solar El Molino':          'elmolino',
  'Minigranja Solar La Paz Verso':       'verso',
  'Minigranja Solar Esmeralda':          'esmeralda',
  'MGS 0019 El Merengue':                'jerico_merengue',
  'Minigranja Solar El Son':             'jerico_el_son',
  'Minigranja Solar La Puya':            'puya',
  'MGS 0012 La Reserva':                 'MGS 0012 La Reserva',
  'Minigranja Solar Villanueva':         'villanueva',
  'Minigranja Solar Joropo':             'joropo',
  'Minigranja Solar Copey':              'copey_occidente',
  'Minigranja Solar Mapalé':             'mapale',
  'Minigranja Solar Ibirico':            'ibirico',
  'Minigranja Solar La Paz Leyenda':     'mgs18',
  'Minigranja Solar El Olimpo':          'olimpo',
  'Minigranja Solar La Mesa':            'lamesa',
  'Minigranja Solar San Diego Sur':      'san_diego_sur',
  'Minigranja Solar Las Piloneras':      'piloneras',
  'Minigranja Solar Valencia Oriente 1': 'valenciaoriente',
  'Minigranja Solar Valencia Oriente 2': 'valencia_oriente_2',
  'Minigranja Solar La Cacica':          'cacica',
  'Minigranja Solar Cumbia':             'cumbia',
  'Minigranja Solar Chiriguana 2':       'chiriguana_norte_2',
  'Minigranja Solar Chiriguana 4':       'chiriguana_norte_4',
}
const PK_ENTRIES = Object.entries(PROJECT_PK).map(([nombre, pk]) => ({ pk, keys: tokensSig(nombre) }))

// Devuelve project_pk para cualquier nombre (OM "MGS 00XX X", panel, etc.).
// Si no hay match único → devuelve el nombre tal cual (fallback solicitado).
function resolvePk(name) {
  const toks = new Set(stripCode(name).split(/\s+/).filter(Boolean))
  const m = PK_ENTRIES.filter(e => e.keys.length && e.keys.every(k => toks.has(k)))
  if (m.length === 1) return m[0].pk
  return name
}

// Nombre Starlink → nombre panel (subset con equivalencia; el resto se deja igual)
const STARLINK_TO_PANEL = {
  'BARAYA': 'Minigranja Solar Baraya', 'CUMBIA': 'Minigranja Solar Cumbia',
  'EL COPEY OCCIDENTE': 'Minigranja Solar Copey', 'EL MOLINO': 'Minigranja Solar El Molino',
  'EL OLIMPO': 'Minigranja Solar El Olimpo', 'EL SON': 'Minigranja Solar El Son',
  'GANDALF': 'Minigranja Solar Gandalf', 'CANAHUATE': 'Minigranja Solar Cañahuate',
  'IBIRICO': 'Minigranja Solar Ibirico', 'MAPALE': 'Minigranja Solar Mapalé',
  'LA ESMERALDA': 'Minigranja Solar Esmeralda', 'LA MESA': 'Minigranja Solar La Mesa',
  'VALLENATA': 'Minigranja Solar La Paz Vallenata', 'LEYENDA': 'Minigranja Solar La Paz Leyenda',
  'LA RESERVA': 'MGS 0012 La Reserva', 'PUYA': 'Minigranja Solar La Puya',
  'MGS LA PAZ VERSO': 'Minigranja Solar La Paz Verso', 'PERUA': 'Minigranja Solar Perijá',
  'SAN DIEGO SUR': 'Minigranja Solar San Diego Sur', 'URUACO': 'Minigranja Solar Uruaco',
  'VILLANUEVA': 'Minigranja Solar Villanueva', 'CACICA': 'Minigranja Solar La Cacica',
  'PILONERAS': 'Minigranja Solar Las Piloneras', 'VALENCIA 1': 'Minigranja Solar Valencia Oriente 1',
  'VALENCIA 2': 'Minigranja Solar Valencia Oriente 2', 'CHIRIGUANA N2': 'Minigranja Solar Chiriguana 2',
  'CHIRIGUANA N4': 'Minigranja Solar Chiriguana 4', 'NESTLE': 'Nestle', 'OFICINA UNERGY': 'Oficina Unergy',
}
function starlinkPanel(desc) {
  return STARLINK_TO_PANEL[normName(desc)] || desc
}

// ── Generación principal ──────────────────────────────────────────────────────
export async function generarExcelCostos(periodo) {
  const omService = new OmService()
  const arriendosCalculoService = new ArriendosCalculoService()
  const starlinkService = new StarlinkService()

  const [yyyy, mm] = periodo.split('-').map(Number)

  // Mantenimiento (backend)
  let omFilas = []
  try { omFilas = (await omService.obtenerCalculo(periodo)).filas || [] } catch { omFilas = [] }

  // Internet (backend) — líneas ya resueltas a proyecto (proyecto_id + nombre_comercial)
  let starlinkData = { lineas: [], agrupado: [] }
  try { starlinkData = await starlinkService.obtenerFactura(periodo) } catch { /* sin datos */ }

  // public_services por pk. Fuente primaria: lineas resueltas (nombre_comercial).
  // Fallback (datos aún sin backfill): agrupado + mapeo de nombre en el front.
  const pubByPk = {}
  const lineas = starlinkData.lineas || []
  if (lineas.length) {
    lineas.forEach(l => {
      const pk = resolvePk(l.nombre_comercial || l.descripcion)
      pubByPk[pk] = (pubByPk[pk] || 0) + (l.sin_iva || 0)
    })
  } else {
    (starlinkData.agrupado || []).forEach(it => {
      const pk = resolvePk(starlinkPanel(it.descripcion))
      pubByPk[pk] = (pubByPk[pk] || 0) + (it.sin_iva || 0)
    })
  }

  // Valores guardados por el usuario, indexados por project_pk.
  // Mismos criterios de siempre (solo ✓ incluido && habilitado); NO se recalcula
  // ni se sobrescribe ningún valor guardado — solo se indexa para consultarlo.
  const mantByPk = {}
  omFilas.forEach(f => {
    if (f.incluido && f.habilitado) mantByPk[resolvePk(f.nombre_proyecto)] = f.valor_a_facturar || 0
  })

  // Arriendos (backend)
  let arrFilas = []
  try { arrFilas = (await arriendosCalculoService.obtenerCalculo(periodo)).filas || [] } catch { arrFilas = [] }
  const leaseByPk = {}
  arrFilas.forEach(f => {
    if (f.incluido && f.habilitado) leaseByPk[resolvePk(f.proyecto)] = f.canon_a_facturar || 0
  })

  // Fechas del período
  const ultimo = new Date(yyyy, mm, 0).getDate()
  const fromDate = `${yyyy}-${String(mm).padStart(2, '0')}-01`
  const toDate   = `${yyyy}-${String(mm).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`

  // Filas: se itera el CATÁLOGO MAESTRO (MASTER_PKS) en su orden exacto.
  // Cada proyecto genera SIEMPRE sus 7 payment_type; value real si hay registro
  // guardado ese mes, 0 si no existe. No se incluye ningún pk fuera del maestro.
  const rows = []
  for (const pk of MASTER_PKS) {
    const valorDe = {
      mainteinance:    mantByPk[pk]  ?? 0,
      public_services: pubByPk[pk]   ?? 0,
      lease:           leaseByPk[pk] ?? 0,
    }
    for (const pt of PAYMENT_TYPES) {
      rows.push({
        project_pk:        pk,
        payment_type:      pt,
        value:             valorDe[pt] ?? 0,
        from_date:         fromDate,
        to_date:           toDate,
        payment_frecuency: 'monthly',
      })
    }
  }

  // Hoja .xlsx plana
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['project_pk', 'payment_type', 'value', 'from_date', 'to_date', 'payment_frecuency'],
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Costos')
  const filename = `proyectos_con_payment_type_${MESES[mm - 1]}_${yyyy}.xlsx`
  XLSX.writeFile(wb, filename)

  return { proyectos: MASTER_PKS.length, filas: rows.length }
}
