/**
 * Completa una lista que el servidor entrego recortada.
 *
 * Los listados que pasan por la paginacion de DRF recortan a 100 filas
 * (`TOPE_FILAS` en `api/pagination.py`), y lo hacen en silencio: `?size=500`
 * devuelve 100 filas con un 200, sin error. Se puso por una razon real -- 500
 * filas del serializer de fallas son varios MB y mataban al Worker de
 * Cloudflare que sirve operaciones.unergy.io con un 1102 (exceeded resource
 * limits).
 *
 * **Pero no es TODA la API, y creer eso costo un bug.** Cuatro endpoints tienen
 * su propio tope de 500 y lo sirven completo en una sola respuesta
 * (`/informes`, `/informes/envios`, `/contratos-servicio`, `/ppa`), y ninguno
 * entiende `skip`. Ver el docstring de `completarPaginas`.
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
 * `/fronteras` es tambien el unico de los que paginan a mano que SI implementa
 * `skip` (ver `api/v1/fronteras/views.py`), y por eso fue el caso que guio esto.
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

/** La identidad de una fila, para reconocerla si vuelve a llegar. `null` cuando
 *  la fila no trae `id`: ahi no se puede deduplicar sin riesgo de tirar una
 *  fila legitima identica a otra, y la repeticion se detecta comparando la
 *  pagina entera. */
function identidad(fila: unknown): string | null {
  if (!esObjeto(fila)) return null
  const id = fila.id ?? fila.pk
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null
}

/** Dos paginas con exactamente el mismo contenido. Es la firma de un endpoint
 *  que ignora el parametro de desplazamiento: pedirle la pagina 2 devuelve la 1. */
function mismasFilas(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Envuelve un GET para que devuelva la lista completa cuando el servidor la
 * recorta.
 *
 * **Se mide, no se supone.** La primera version daba por hecho que el servidor
 * recorta TODA lista a 100 filas, asi que reescribia a 100 el `limit` pedido y
 * se ponia a pedir paginas. Eso rompio a los cuatro endpoints que sirven hasta
 * 500 filas de una y NO entienden `skip` (`/informes`, `/informes/envios`,
 * `/contratos-servicio`, `/ppa`): cada pagina devolvia las mismas 100 filas y
 * esto las apilaba. El historial del Reporte CGM mostraba "500 envios" que eran
 * 100 repetidos cinco veces, con cada destinatario cinco veces en su lote.
 *
 * Ahora la primera llamada va con el `limit`/`size` que pidio quien llama, tal
 * cual. Solo se piden mas paginas si esa respuesta vuelve EXACTAMENTE en el
 * tope, que es la unica senal real de que el servidor recorto. Y si una pagina
 * no trae nada nuevo, se corta y se avisa: ese endpoint ignora el
 * desplazamiento, y apilar copias es peor que quedarse corto -- una lista con
 * filas repetidas se ve igual de bien que una correcta.
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

  // Las paginas siguientes van de a `TOPE_FILAS_SERVIDOR`, que es lo que la
  // primera respuesta demostro que el servidor entrega -- y por eso el
  // desplazamiento se cuenta en filas RECIBIDAS, no en las pedidas.
  const pagina = (indice: number): AirOptions => ({
    ...opciones,
    query: {
      ...query,
      [claveTamano]: TOPE_FILAS_SERVIDOR,
      [clavePagina]: porSalto ? saltoInicial + indice * TOPE_FILAS_SERVIDOR : saltoInicial + indice,
    } as QueryPlana,
  })

  // La primera llamada va TAL COMO la pidio quien llama: si el endpoint puede
  // servir las 500 de una, las sirve y aca no se gasta ni una llamada mas.
  const primera = await pedir(opciones)
  const filas = filasDe(primera)
  // No es una lista (un detalle, un resumen): se devuelve tal cual.
  if (filas === null) return primera

  // Volvio con menos filas que el tope: no hubo recorte, esto es todo lo que
  // hay. Volver EXACTAMENTE en el tope es la senal de recorte, y es la unica.
  if (filas.length !== TOPE_FILAS_SERVIDOR) return primera

  const total = totalDe(primera)
  // Cuantas filas tiene sentido juntar: lo que se pidio, y nunca mas de lo que
  // el servidor dice que hay.
  const objetivo = total === null ? pedidas : Math.min(pedidas, total)
  const acumuladas = [...filas]
  const vistas = new Set(filas.map(identidad).filter((k): k is string => k !== null))
  let anterior = filas

  for (let i = 1; acumuladas.length < objetivo; i++) {
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

    const nuevas = lote.filter((fila) => {
      const k = identidad(fila)
      if (k === null) return true
      if (vistas.has(k)) return false
      vistas.add(k)
      return true
    })
    // Nada nuevo, o la pagina identica a la anterior: el endpoint ignora el
    // desplazamiento. Cortar y avisar -- apilar copias da una lista con filas
    // repetidas, que se ve igual de bien que una correcta.
    if (nuevas.length === 0 || mismasFilas(lote, anterior)) {
      logger.error(
        'completarPaginas',
        new Error(
          `el endpoint devolvio la misma pagina con "${clavePagina}" distinto: no ` +
            `soporta desplazamiento. Se devuelven las ${acumuladas.length} filas de ` +
            'la primera respuesta, sin repetir. Si esa vista necesita mas, el ' +
            `endpoint tiene que aceptar "${clavePagina}" o servir el total de una.`,
        ),
      )
      break
    }
    acumuladas.push(...nuevas)
    anterior = lote
    // Una pagina que llego a medias es la ultima: no hay para que pedir otra.
    if (lote.length < TOPE_FILAS_SERVIDOR) break
  }

  return conFilas(primera, acumuladas.slice(0, objetivo)) as T
}
