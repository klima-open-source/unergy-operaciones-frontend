/**
 * Datos abiertos del SIMEM (XM), consultados desde el navegador.
 *
 * No pasa por nuestro backend a propósito: el SIMEM responde
 * `Access-Control-Allow-Origin: *`, así que el navegador puede llamarlo directo
 * —verificado el 2026-10-07— y un proxy solo agregaría un salto y una caché que
 * mantener. Si algún día cierran el CORS, lo que hay que cambiar es este archivo
 * y nada más.
 *
 * OJO con el precio de bolsa: ese ya lo calcula el backend
 * (`apps/mercado_xm/services/simem.py`, con la regla de tomar el PTB cuando no
 * hay PB_Nal). Si alguna vez se trae a esta vista, debe leerse de allá y no
 * recalcularse acá, o los dos números se separan.
 */

const BASE = 'https://www.simem.co/backend-files/api/PublicData'

/** Registro de agentes del mercado: código SIC, razón social y actividades. */
const DATASET_AGENTES = '972263'

/**
 * Es un dataset DIARIO y el día de hoy puede no estar publicado todavía, así
 * que se retrocede día a día hasta encontrar uno con datos.
 */
const DIAS_ATRAS_MAXIMO = 10

export interface AgenteSimemApi {
  nombre: string
  actividades: string[]
}

export interface RegistroAgentes {
  agentes: Record<string, AgenteSimemApi>
  /** Día del que salieron los datos, para poder mostrarlo. */
  fecha: string | null
}

function unDiaAntes(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

async function registrosDelDia(fecha: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const url = `${BASE}?startdate=${fecha}&enddate=${fecha}&datasetId=${DATASET_AGENTES}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const json = await res.json() as { result?: { records?: Record<string, unknown>[] } }
  return json?.result?.records ?? []
}

/**
 * El registro de agentes del día publicado más reciente.
 *
 * Los nombres de columna del SIMEM no son estables entre datasets, así que se
 * detectan por patrón en vez de fijarlos: un cambio de nombre allá dejaría la
 * tabla vacía sin decir por qué.
 */
export async function obtenerRegistroAgentes(signal?: AbortSignal): Promise<RegistroAgentes> {
  for (let dias = 1; dias <= DIAS_ATRAS_MAXIMO; dias++) {
    const fecha = unDiaAntes(dias)
    let filas: Record<string, unknown>[]
    try {
      filas = await registrosDelDia(fecha, signal)
    } catch {
      continue
    }
    if (!filas.length) continue

    const columnas = Object.keys(filas[0]!)
    const colCodigo = columnas.find((c) => /codigosic|codigoagente/i.test(c)) || columnas[0]!
    const colNombre = columnas.find((c) => /nombre|razon/i.test(c)) || columnas[1]!
    const colActividad = columnas.find((c) => /actividad|tipo/i.test(c))

    const agentes: Record<string, AgenteSimemApi> = {}
    for (const f of filas) {
      const codigo = String(f[colCodigo] ?? '').trim().toUpperCase()
      if (!codigo) continue
      const actividad = colActividad ? String(f[colActividad] ?? '').trim() : ''
      const previo = agentes[codigo]
      if (previo) {
        // Un agente aparece una vez por actividad: se acumulan sin repetir.
        if (actividad && !previo.actividades.includes(actividad)) previo.actividades.push(actividad)
      } else {
        agentes[codigo] = {
          nombre: String(f[colNombre] ?? '').trim() || '—',
          actividades: actividad ? [actividad] : [],
        }
      }
    }
    return { agentes, fecha }
  }
  return { agentes: {}, fecha: null }
}
