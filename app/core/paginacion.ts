/**
 * Completa una lista que el servidor entrego recortada.
 *
 * El backend recorta TODA respuesta de lista a 100 filas (`TOPE_FILAS` en
 * `api/pagination.py`), y lo hace en silencio: `?size=500` devuelve 100 filas
 * con un 200, sin error. Se puso por una razon real -- 500 filas del
 * serializer de fallas son varios MB y mataban al Worker de Cloudflare que
 * sirve operaciones.unergy.io con un 1102 (exceeded resource limits).
 *
 * El problema es que 52 llamadas de este frontend piden mas de 100 filas y
 * fueron escritas para recibirlas TODAS: filtran, ordenan y cuentan en el
 * navegador. Con el recorte, cada una de esas vistas muestra las primeras 100
 * filas como si fueran todas. El sintoma que lo saco a la luz: la vista de
 * Fronteras decia "100 fronteras registradas", y el desplegable de Proyecto
 * --que se arma recorriendo las fronteras cargadas-- no ofrecia
 * "Sabana de Torres", porque sus fronteras (`frt98004`/`frt98005`) caen al
 * final del orden por codigo y quedaban fuera del corte. En la ficha del
 * proyecto SI aparecian, porque esa pestaña no pasa por el listado.
 *
 * La salida no es subir el tope: eso reintroduce la caida de Cloudflare. Es
 * pedir las paginas que falten y juntarlas. Cada respuesta sigue pesando 100
 * filas -- exactamente lo que el tope protege -- y quien llamo recibe la lista
 * completa, en la MISMA forma en que llego, asi que ninguna vista cambia.
 *
 * Esto es una red de seguridad, no la solucion definitiva: un listado que de
 * verdad tenga miles de filas no se arregla con 30 llamadas, se arregla
 * filtrando en el servidor. Por eso hay un tope de paginas que avisa en vez de
 * dispararse en silencio.
 */
import type { AirOptions } from '@korastd/air'

import { logger } from '~/core/logger'

/** Lo que el servidor devuelve como maximo por respuesta. */
export const TOPE_FILAS_SERVIDOR = 100

/**
 * Cuantas paginas se piden como maximo para completar una lista.
 *
 * 20 x 100 = 2.000 filas. Mas que eso deja de ser "completar una lista
 * recortada" y es un listado que necesita filtrarse en el servidor; el aviso
 * existe para que se sepa cual, en vez de que la vista quede a medias en
 * silencio otra vez.
 */
export const MAX_PAGINAS = 20

type Cuerpo = Record<string, unknown>

/** El tipo que `air` acepta como query. Puede ser un objeto, un
 *  `URLSearchParams` o pares clave/valor -- solo el objeto se puede inspeccionar. */
type QueryAir = NonNullable<AirOptions['query']>
type QueryPlana = QueryAir & Record<string, unknown>

/** Una query que se puede leer por clave. Un `URLSearchParams` o una lista de
 *  tuplas no se inspeccionan: esas peticiones pasan de largo sin tocarse. */
function esQueryPlana(q: QueryAir | undefined): q is QueryPlana {
  return typeof q === 'object' && q !== null && !Array.isArray(q) && !(q instanceof URLSearchParams)
}

/** Las claves con que la API envuelve una lista. `items` es el contrato de
 *  FastAPI que DRF conserva (ver api/pagination.py); `results` lo usan los
 *  listados que pasan por el proxy de liquidaciones. */
const CLAVES_LISTA = ['items', 'results'] as const

function esObjeto(v: unknown): v is Cuerpo {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** La clave bajo la que viene la lista, o null si el cuerpo ES la lista. */
function claveDeLista(cuerpo: unknown): string | null {
  if (!esObjeto(cuerpo)) return null
  for (const clave of CLAVES_LISTA) {
    if (Array.isArray(cuerpo[clave])) return clave
  }
  return null
}

/** Las filas del cuerpo, venga como lista pelada o envuelta. null si no es una lista. */
function filasDe(cuerpo: unknown): unknown[] | null {
  if (Array.isArray(cuerpo)) return cuerpo
  const clave = claveDeLista(cuerpo)
  return clave ? ((cuerpo as Cuerpo)[clave] as unknown[]) : null
}

/** Cuantas filas hay en total, si el cuerpo lo dice. Los listados que paginan
 *  a mano (skip/limit) devuelven la lista pelada y no lo dicen. */
function totalDe(cuerpo: unknown): number | null {
  if (!esObjeto(cuerpo)) return null
  for (const clave of ['total', 'count']) {
    const v = cuerpo[clave]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

/** El mismo cuerpo con las filas reemplazadas -- preserva `total`, `page` y lo
 *  demas, para que quien lee `.total` siga viendo el total real del servidor. */
function conFilas(cuerpo: unknown, filas: unknown[]): unknown {
  if (Array.isArray(cuerpo)) return filas
  const clave = claveDeLista(cuerpo)
  if (!clave) return cuerpo
  return { ...(cuerpo as Cuerpo), [clave]: filas }
}

function comoEntero(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

/**
 * Envuelve un GET para que devuelva la lista completa cuando el servidor la
 * recorta.
 *
 * No hace nada -- ni una llamada de mas -- salvo que se cumplan las tres
 * condiciones: que se hayan pedido mas filas de las que el servidor entrega,
 * que la respuesta sea una lista, y que haya llegado justo llena (senal de que
 * hay mas). Cualquier otra peticion pasa de largo intacta.
 */
export async function completarPaginas<T>(
  pedir: (options: AirOptions) => Promise<T>,
  options: AirOptions | undefined,
): Promise<T> {
  const opciones: AirOptions = options ?? {}
  const query = options?.query
  if (!esQueryPlana(query)) return pedir(opciones)

  const pedidas = comoEntero(query.limit) ?? comoEntero(query.size)
  // Nadie pidio mas de lo que cabe en una respuesta: no hay nada que completar.
  if (pedidas === null || pedidas <= TOPE_FILAS_SERVIDOR) return pedir(opciones)

  // `skip`/`limit` lo usan los listados que paginan a mano; `page`/`size`, los
  // que pasan por DRF. Se conserva el estilo con que llamo quien llama.
  const porSalto = 'limit' in query || 'skip' in query
  const clavePagina = porSalto ? 'skip' : 'page'
  const claveTamano = porSalto ? 'limit' : 'size'
  const saltoInicial = porSalto ? (comoEntero(query.skip) ?? 0) : (comoEntero(query.page) ?? 1)

  const pagina = (indice: number): AirOptions => ({
    ...opciones,
    query: {
      ...query,
      [claveTamano]: TOPE_FILAS_SERVIDOR,
      [clavePagina]: porSalto ? saltoInicial + indice * TOPE_FILAS_SERVIDOR : saltoInicial + indice,
    } as QueryPlana,
  })

  const primera = await pedir(pagina(0))
  const filas = filasDe(primera)
  // No es una lista (un detalle, un resumen): se devuelve tal cual.
  if (filas === null) return primera

  const total = totalDe(primera)
  // Cuantas filas tiene sentido juntar: lo que se pidio, y nunca mas de lo que
  // el servidor dice que hay.
  const objetivo = total === null ? pedidas : Math.min(pedidas, total)
  const acumuladas = [...filas]
  let ultimoLote = filas.length

  // Una pagina que llego a medias es la ultima: no hay para que pedir otra.
  for (let i = 1; acumuladas.length < objetivo && ultimoLote === TOPE_FILAS_SERVIDOR; i++) {
    if (i >= MAX_PAGINAS) {
      logger.error(
        'completarPaginas',
        new Error(
          `se alcanzo el tope de ${MAX_PAGINAS} paginas con ${acumuladas.length} de ` +
            `${total ?? '?'} filas (se pidieron ${pedidas}). Este listado necesita ` +
            'filtrarse en el servidor, no traerse entero: la vista se queda incompleta.',
        ),
      )
      break
    }
    const lote = filasDe(await pedir(pagina(i)))
    if (lote === null || lote.length === 0) break
    acumuladas.push(...lote)
    ultimoLote = lote.length
  }

  return conFilas(primera, acumuladas.slice(0, objetivo)) as T
}
