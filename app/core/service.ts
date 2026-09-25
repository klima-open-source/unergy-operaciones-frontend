/**
 * BaseService — la base que extiende todo service del cliente.
 *
 * Por defecto usa la instancia compartida de la plataforma (`~/core/client.ts`),
 * que lleva el contrato de sesión: un 401 limpia la sesión y redirige al
 * login, un 403 avisa con un toast. Eso es lo correcto para casi todo — la
 * excepción es una llamada donde un 401/403 es una respuesta normal y no un
 * síntoma de sesión rota (un intento de login: ver
 * `OperacionesAuthService`), o un destino que no debe llevar el token de la
 * plataforma en absoluto (el agente local de XM: ver `XmAgenteLocalService`).
 * Para esos casos, pásale al constructor una instancia de `ofetch` propia.
 *
 * @example
 * class ProyeccionesService extends BaseService {
 *   listar() { return this.get<Proyeccion[]>('/garantias/proyecciones') }
 * }
 */
import type { $Fetch, FetchOptions, MappedResponseType, ResponseType } from 'ofetch'
import { apiClient } from '~/core/client'
import { completarPaginas } from '~/core/paginacion'

/**
 * Lo que un service puede pasarle a una llamada: las opciones de `ofetch` menos
 * lo que fija el propio método. `R` es el modo de lectura de la respuesta
 * (`responseType`), y por eso una descarga se escribe
 * `this.get<Blob>(url, { responseType: 'blob' })` y sigue devolviendo un `Blob`.
 */
export type ApiOptions<R extends ResponseType = 'json'> = Omit<FetchOptions<R>, 'method' | 'body'>

/** Un valor que puede viajar en el querystring. */
export type ValorQuery = string | number | boolean | null | undefined

export class BaseService {
  protected api: $Fetch

  constructor(instancia: $Fetch = apiClient) {
    this.api = instancia
  }

  /**
   * Devuelve el cuerpo de la respuesta, que es lo único que quiere quien llama.
   *
   * Pasa por `completarPaginas`: si se pidieron más filas y el servidor las
   * recortó (100 por respuesta en los listados de DRF, ver `api/pagination.py`),
   * pide las páginas que falten y las junta. Si el endpoint las sirvió todas de
   * una, no hace nada. Va acá y no en cada service porque son 52
   * llamadas de este frontend las que piden más de 100, y todas fueron
   * escritas para recibir la lista completa -- filtran y cuentan en el
   * navegador. Con el recorte silencioso del servidor, cada una mostraba las
   * primeras 100 filas como si fueran todas (ver el docstring de
   * paginacion.ts: el caso de Sabana de Torres).
   *
   * Una petición que no pide más de 100, o cuya respuesta no es una lista,
   * pasa de largo sin una sola llamada extra.
   */
  protected get<T, R extends ResponseType = 'json'>(
    url: string,
    options?: ApiOptions<R>,
  ): Promise<MappedResponseType<R, T>> {
    return completarPaginas(
      (query) => this.api<T, R>(url, { ...options, method: 'GET', query }),
      options?.query,
    )
  }

  protected post<T, R extends ResponseType = 'json'>(
    url: string,
    body?: unknown,
    options?: ApiOptions<R>,
  ): Promise<MappedResponseType<R, T>> {
    return this.pedirConCuerpo<T, R>('POST', url, body, options)
  }

  protected put<T, R extends ResponseType = 'json'>(
    url: string,
    body?: unknown,
    options?: ApiOptions<R>,
  ): Promise<MappedResponseType<R, T>> {
    return this.pedirConCuerpo<T, R>('PUT', url, body, options)
  }

  protected patch<T, R extends ResponseType = 'json'>(
    url: string,
    body?: unknown,
    options?: ApiOptions<R>,
  ): Promise<MappedResponseType<R, T>> {
    return this.pedirConCuerpo<T, R>('PATCH', url, body, options)
  }

  /** `DELETE` admite cuerpo (lo usa `PanelContableService.quitarFuenteIngreso`). */
  protected delete<T, R extends ResponseType = 'json'>(
    url: string,
    options: ApiOptions<R> & { body?: unknown } = {},
  ): Promise<MappedResponseType<R, T>> {
    const { body, ...resto } = options
    return this.pedirConCuerpo<T, R>('DELETE', url, body, resto)
  }

  /**
   * El cuerpo se le entrega a `ofetch` tal cual. Acá se declara `unknown` y no
   * el tipo de `ofetch` porque los payloads del dominio son `interface`s, y una
   * `interface` no satisface un `Record<string, any>`: no tiene firma de
   * índice. La conversión la hace `ofetch` igual — JSON para un objeto plano,
   * crudo para un `FormData` o un `URLSearchParams`.
   */
  private pedirConCuerpo<T, R extends ResponseType>(
    metodo: string,
    url: string,
    body: unknown,
    options?: ApiOptions<R>,
  ): Promise<MappedResponseType<R, T>> {
    return this.api<T, R>(url, {
      ...options,
      method: metodo,
      body: body as FetchOptions['body'],
    })
  }

  /**
   * Sube archivos como `multipart/form-data` informando del avance. La subida de
   * facturas y de Excel son lo bastante lentas como para que el porcentaje no
   * sea un adorno.
   *
   * `ofetch` no ofrece progreso de subida sin transmitir el cuerpo como stream,
   * y un `FormData` no se puede recodificar a mano sin perder el boundary del
   * multipart que pone el navegador (ver `subidaConProgreso`). XHR sí lo expone
   * de fábrica, así que solo cuando hay `onProgreso` se deriva un cliente con
   * ese transporte: `create` conserva los defaults del original (baseURL y el
   * contrato de sesión) y solo cambia el `fetch`.
   */
  protected postFormData<T>(
    url: string,
    form: FormData,
    onProgreso?: (porcentaje: number) => void,
  ): Promise<T> {
    if (!onProgreso) return this.post<T>(url, form)

    const conProgreso = this.api.create({}, { fetch: subidaConProgreso(onProgreso) })
    return conProgreso<T>(url, { method: 'POST', body: form })
  }
}

/**
 * Un `fetch` que sube por XHR para poder informar del avance. Solo lo usa
 * `postFormData`, que siempre pasa la URL ya resuelta como string.
 */
function subidaConProgreso(onProgreso: (porcentaje: number) => void): typeof globalThis.fetch {
  return (input, init = {}) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(init.method ?? 'POST', input instanceof Request ? input.url : String(input))

      new Headers(init.headers).forEach((valor, clave) => xhr.setRequestHeader(clave, valor))

      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable) onProgreso(Math.round((evento.loaded / evento.total) * 100))
      }

      xhr.responseType = 'blob'
      xhr.onload = () => {
        resolve(
          new Response(xhr.response as Blob, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parsearCabecerasXhr(xhr.getAllResponseHeaders()),
          }),
        )
      }
      xhr.onerror = () => reject(new TypeError('La subida falló: error de red.'))

      xhr.send(init.body as XMLHttpRequestBodyInit)
    })
}

/** `XMLHttpRequest.getAllResponseHeaders()` devuelve texto crudo, `ofetch` espera un `Headers`. */
function parsearCabecerasXhr(crudo: string): Headers {
  const cabeceras = new Headers()
  for (const linea of crudo.trim().split(/\r?\n/)) {
    const separador = linea.indexOf(':')
    if (separador === -1) continue
    cabeceras.append(linea.slice(0, separador).trim(), linea.slice(separador + 1).trim())
  }
  return cabeceras
}
