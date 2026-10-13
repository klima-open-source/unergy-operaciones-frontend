/**
 * Cliente HTTP de la plataforma de operaciones, sobre `ofetch`. El transporte
 * por defecto de `BaseService` (`~/core/service.ts`) y por tanto de todo
 * service. El contrato de sesión vive en los hooks que `ofetch` ya ofrece
 * (`onRequest`, `onResponseError`), y el error sigue saliendo como `FetchError`
 * igual que con cualquier no-2xx.
 *
 * El contrato de sesión:
 *
 *   - adjunta el Bearer desde `~/core/security` en cada petición, renovándolo
 *     antes si es de Unergy Auth y está por vencer (`tokenVigente`);
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
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isPreviewToken,
  isTokenExpired,
  setAccessToken,
  setRefreshToken,
} from '~/core/security'
import { toast } from 'vue-sonner'

/** Rutas del propio frontend a las que se devuelve una sesión caducada. */
const LOGIN_PATH = '/login'
const LOGIN_PATH_MOVIL = '/m/login'

/** Ruta de Nitro que cambia el refresh de Unergy Auth por un access nuevo. */
const RUTA_REFRESCO = '/unergy-auth/refresh'
/** Se renueva un poco antes del vencimiento, no con el token ya caducado. */
const MARGEN_REFRESCO_SEGUNDOS = 30

interface TokensRefrescados {
  access: string
  refresh: string | null
}

/**
 * Un solo refresco a la vez: una página que dispara diez peticiones con el token
 * por vencer haría diez refrescos, y si Unergy Auth rota el refresh, todos
 * menos el primero fallarían con un refresh ya usado.
 *
 * De módulo, pero solo existe en el navegador: `getRefreshToken()` devuelve null
 * en el servidor (`~/core/security` solo resuelve el storage en cliente), así que
 * en SSR nunca se asigna y no puede cruzar sesiones entre usuarios.
 */
let refrescoEnCurso: Promise<string | null> | null = null

/**
 * El access token a mandar. Solo las sesiones de Unergy Auth tienen refresh
 * token; para el login propio esto devuelve el token tal cual.
 *
 * Si el refresco falla se manda el token viejo: el backend responde 401 y
 * `onResponseError` hace lo de siempre (limpiar la sesión y volver al login).
 */
async function tokenVigente(): Promise<string | null> {
  const token = getAccessToken()
  const refresh = getRefreshToken()
  if (!token || !refresh || !isTokenExpired(token, MARGEN_REFRESCO_SEGUNDOS)) return token

  refrescoEnCurso ??= ofetch<TokensRefrescados>(RUTA_REFRESCO, {
    method: 'POST',
    body: { refresh },
    retry: false,
  })
    .then(({ access, refresh: nuevoRefresh }) => {
      setAccessToken(access)
      if (nuevoRefresh) setRefreshToken(nuevoRefresh)
      return access
    })
    .catch(() => null)
    .finally(() => {
      refrescoEnCurso = null
    })

  return (await refrescoEnCurso) ?? token
}

export const apiClient: $Fetch = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  // `ofetch` reintenta un GET ante 408/409/425/429/5xx. Acá no: una llamada que
  // falla se reporta, no se repite a espaldas de la vista — y menos cuando
  // `completarPaginas` puede estar pidiendo veinte páginas seguidas.
  retry: false,
  async onRequest({ options }) {
    const token = await tokenVigente()
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
