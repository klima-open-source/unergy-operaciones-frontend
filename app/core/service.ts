/**
 * BaseService — la base que extiende todo service del cliente.
 *
 * Por defecto usa la instancia compartida de la plataforma (`~/core/client.ts`),
 * que lleva el interceptor de sesión: un 401 limpia la sesión y redirige al
 * login, un 403 avisa con un toast. Eso es lo correcto para casi todo — la
 * excepción es una llamada donde un 401/403 es una respuesta normal y no un
 * síntoma de sesión rota (un intento de login: ver
 * `OperacionesAuthService`), o un destino que no debe llevar el token de la
 * plataforma en absoluto (el agente local de XM: ver `XmAgenteLocalService`).
 * Para esos casos, pásale al constructor una instancia de `air` propia.
 *
 * @example
 * class ProyeccionesService extends BaseService {
 *   listar() { return this.get<Proyeccion[]>('/garantias/proyecciones') }
 * }
 */
import type { AirClient, AirOptions, Fetch } from '@korastd/air'
import { airClient } from '~/core/client'

export class BaseService {
  protected api: AirClient

  constructor(instancia: AirClient = airClient) {
    this.api = instancia
  }

  /** Devuelve el cuerpo de la respuesta, que es lo único que quiere quien llama. */
  protected get<T>(url: string, options?: AirOptions): Promise<T> {
    return this.api.get<T>(url, options)
  }

  protected post<T>(url: string, body?: unknown, options?: AirOptions): Promise<T> {
    return this.api.post<T>(url, { ...options, body })
  }

  protected put<T>(url: string, body?: unknown, options?: AirOptions): Promise<T> {
    return this.api.put<T>(url, { ...options, body })
  }

  protected patch<T>(url: string, body?: unknown, options?: AirOptions): Promise<T> {
    return this.api.patch<T>(url, { ...options, body })
  }

  protected delete<T>(url: string, options?: AirOptions): Promise<T> {
    return this.api.delete<T>(url, options)
  }

  /**
   * Sube archivos como `multipart/form-data` informando del avance. La subida de
   * facturas y de Excel son lo bastante lentas como para que el porcentaje no
   * sea un adorno.
   *
   * `air` no ofrece progreso de subida sin transmitir el cuerpo como stream, y
   * un `FormData` no se puede recodificar a mano sin perder el boundary del
   * multipart que pone el navegador (ver `subidaConProgreso`). XHR sí lo expone
   * de fábrica, así que solo cuando hay `onProgreso` se le pasa a `air` un
   * `fetch` a medida que envuelve uno.
   */
  protected postFormData<T>(
    url: string,
    form: FormData,
    onProgreso?: (porcentaje: number) => void,
  ): Promise<T> {
    if (!onProgreso) return this.post<T>(url, form)
    return this.api.post<T>(url, { body: form, fetch: subidaConProgreso(onProgreso) })
  }
}

function subidaConProgreso(onProgreso: (porcentaje: number) => void): Fetch {
  return (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(init.method ?? 'POST', url)

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

/** `XMLHttpRequest.getAllResponseHeaders()` devuelve texto crudo, `air` espera un `Headers`. */
function parsearCabecerasXhr(crudo: string): Headers {
  const cabeceras = new Headers()
  for (const linea of crudo.trim().split(/\r?\n/)) {
    const separador = linea.indexOf(':')
    if (separador === -1) continue
    cabeceras.append(linea.slice(0, separador).trim(), linea.slice(separador + 1).trim())
  }
  return cabeceras
}
