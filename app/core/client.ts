/**
 * Cliente HTTP de la plataforma de operaciones, sobre `ofetch`. El transporte
 * por defecto de `BaseService` (`~/core/service.ts`) y por tanto de todo
 * service. El contrato de sesión vive en los hooks que `ofetch` ya ofrece
 * (`onRequest`, `onResponseError`), y el error sigue saliendo como `FetchError`
 * igual que con cualquier no-2xx.
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
 * plataforma) le pasa a `BaseService` una instancia de `ofetch` propia en vez
 * de esta — ver `OperacionesAuthService` y `XmAgenteLocalService`.
 */
import { ofetch, type $Fetch } from 'ofetch'
import { readDetail } from '~/core/errors'
import { clearTokens, getAccessToken, isPreviewToken } from '~/core/security'
import { toast } from 'vue-sonner'

/** Rutas del propio frontend a las que se devuelve una sesión caducada. */
const LOGIN_PATH = '/login'
const LOGIN_PATH_MOVIL = '/m/login'

export const apiClient: $Fetch = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  // `ofetch` reintenta un GET ante 408/409/425/429/5xx. Acá no: una llamada que
  // falla se reporta, no se repite a espaldas de la vista — y menos cuando
  // `completarPaginas` puede estar pidiendo veinte páginas seguidas.
  retry: false,
  onRequest({ options }) {
    const token = getAccessToken()
    if (token) options.headers.set('Authorization', `Bearer ${token}`)
  },
  // El cuerpo ya viene leído en `response._data`: no hay que clonar nada para
  // mirarlo. Se hace el efecto y se deja seguir — `ofetch` lanza el
  // `FetchError` igual.
  onResponseError({ response }) {
    if (response.status === 401) {
      if (isPreviewToken(getAccessToken())) return

      clearTokens()
      const enMovil =
        window.location.pathname.startsWith('/m/') || window.location.pathname === '/m'
      window.location.href = enMovil ? LOGIN_PATH_MOVIL : LOGIN_PATH
      return
    }

    if (response.status === 403) {
      toast.error('Acceso denegado', {
        description: readDetail(response._data) || 'No tienes permisos para esta acción',
        duration: 4000,
      })
    }
  },
})
