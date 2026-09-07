/**
 * Cliente HTTP de la plataforma de operaciones, sobre `air`. El transporte por
 * defecto de `BaseService` (`~/core/service.ts`) y por tanto de todo service.
 * `air` no tiene interceptores — la forma de replicar el contrato de sesión
 * (Bearer, 401, 403) es envolver `fetch` (ver "Refreshing on a 401" en el
 * README de `air`) y dejar que siga lanzando `AirError` como con cualquier
 * no-2xx.
 *
 * El contrato de sesión:
 *
 *   - adjunta el Bearer desde `~/core/security` en cada petición;
 *   - un 401 limpia la sesión y devuelve al login que corresponde (la app móvil
 *     tiene el suyo);
 *   - un 403 avisa con un toast sin cerrar la sesión.
 *
 * Un service que no quiera este contrato (un login, donde un 401 es una
 * respuesta normal; el agente local de XM, que no lleva token de la
 * plataforma) le pasa a `BaseService` una instancia de `air` propia en vez de
 * esta — ver `OperacionesAuthService` y `XmAgenteLocalService`.
 */
import air, { type AirClient } from '@korastd/air'
import { clearTokens, getAccessToken, isPreviewToken } from '~/core/security'
import { toast } from 'vue-sonner'

/** Rutas del propio frontend a las que se devuelve una sesión caducada. */
const LOGIN_PATH = '/login'
const LOGIN_PATH_MOVIL = '/m/login'

/**
 * Envuelve `fetch` para aplicar el contrato de sesión: un 401 limpia la sesión
 * y redirige (salvo token de preview), un 403 avisa con un toast. En los dos
 * casos se devuelve la respuesta tal cual — `air` la sigue leyendo, y al no
 * ser 2xx la convierte en `AirError`.
 */
async function conSesion(url: string, init: RequestInit): Promise<Response> {
  const respuesta = await fetch(url, init)

  if (respuesta.status === 401) {
    if (isPreviewToken(getAccessToken())) return respuesta

    clearTokens()
    const enMovil = window.location.pathname.startsWith('/m/') || window.location.pathname === '/m'
    window.location.href = enMovil ? LOGIN_PATH_MOVIL : LOGIN_PATH
    return respuesta
  }

  if (respuesta.status === 403) {
    // `.clone()`: el cuerpo original lo sigue leyendo `air` para construir el
    // `AirError`; consumirlo aquí sin clonar lo dejaría vacío para ese lector.
    const detalle = (await respuesta
      .clone()
      .json()
      .catch(() => undefined)) as { detail?: string } | undefined

    toast.error('Acceso denegado', {
      description: detalle?.detail || 'No tienes permisos para esta acción',
      duration: 4000,
    })
  }

  return respuesta
}

export const airClient: AirClient = air.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: () => {
    const token = getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
  fetch: conSesion,
})
