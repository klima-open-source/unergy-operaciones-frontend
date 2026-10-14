/**
 * La sesión de la app, en `useState` — es decir, por request.
 *
 * Nunca un `ref` de módulo: en el servidor los módulos son singletons por
 * proceso, así que eso filtraría la sesión de un usuario a la página de otro.
 * `useState` se crea por instancia y viaja serializado en el payload.
 *
 * El transporte es JWT en `localStorage` (`~/core/security`), no las cookies
 * httpOnly que trae montadas el template (`server/utils/auth-api.ts` +
 * `server/middleware/auth.ts`): esas asumen un `/auth/me` que el backend real no
 * expone, así que no hay forma de resolver la sesión en cada request desde el
 * servidor. En cuanto ese endpoint exista, el transporte cambia aquí — el resto
 * de la app (`access.ts`, `auth.global.ts`, `~/config/permissions`) ya trabaja
 * sobre `User`/`Permission` y no se entera.
 *
 * Dos orígenes de sesión mientras dura la migración a Unergy Auth
 * (`public.unergyAuthEnabled`):
 *   - login propio: el JWT del backend trae el usuario en sus claims;
 *   - Unergy Auth: el JWT es de authentication-system y no sabe nada de
 *     Operaciones, así que el usuario sale de `GET /api/v1/auth/me` y la sesión
 *     guarda además un refresh token (`~/core/client.ts` lo usa).
 */
import type { RespuestaToken } from '~/features/auth/services/operaciones-auth'
import type { UsuarioOperaciones } from '~/features/auth/services/unergy-auth'
import type { Permission } from '~/config/permissions'
import type { User } from '~/types/user'
import { ROLE_PERMISSIONS } from '~/config/permissions'
import { AppError } from '~/core/errors'
import {
  clearTokens,
  salirAlLogin,
  decodeJwtPayload,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  isTokenExpired,
  setAccessToken,
  setRefreshToken,
  setStoredUser,
} from '~/core/security'
import { hasPermission } from '~/core/permissions'
import { OperacionesAuthService } from '~/features/auth/services/operaciones-auth'
import { UnergyAuthService } from '~/features/auth/services/unergy-auth'

export interface AuthState {
  user: User | null
  /** Enviado como Bearer por los services del cliente. */
  accessToken: string | null
}

/** Reconstruye el usuario desde los claims del JWT (`sub`, `rol`, `nombre`, `email`). */
function userFromToken(jwt: string): User | null {
  const payload = decodeJwtPayload(jwt)
  if (!payload?.sub || !payload?.rol) return null

  return {
    id: payload.sub,
    email: payload.email ?? '',
    name: payload.nombre ?? '',
    // Sin estrechar a `UserRole`: un rol que el backend invente mañana tiene que
    // llegar verbatim para que `ROLE_PERMISSIONS` no lo reconozca y deniegue.
    role: payload.rol as User['role'],
    avatar: null,
    created_at: '',
    updated_at: '',
  }
}

/** El usuario de Operaciones que el backend resolvió para un token de Unergy Auth. */
function userFromOperaciones(usuario: UsuarioOperaciones): User {
  return {
    id: String(usuario.id),
    email: usuario.email,
    name: usuario.nombre,
    // Verbatim, igual que en `userFromToken`: un rol desconocido debe denegar.
    role: usuario.rol as User['role'],
    avatar: null,
    created_at: usuario.created_at,
    updated_at: usuario.updated_at,
  }
}

/**
 * El estado inicial, leído de `localStorage`. En el servidor `getAccessToken()`
 * devuelve `null` (`~/core/security` resuelve el storage solo en cliente), así
 * que esto es un no-op ahí y se hidrata de verdad en el primer acceso del
 * cliente.
 */
function initialAuthState(): AuthState {
  const token = getAccessToken()
  // Una sesión de Unergy Auth con el access vencido sigue viva si tiene refresh:
  // la primera petición lo renueva (`~/core/client.ts`). Si el refresh también
  // venció, esa petición recibe 401 y vuelve al login como cualquier otra.
  const renovable = !!getRefreshToken() && !!getStoredUser()
  if (!token || (isTokenExpired(token) && !renovable)) {
    if (token) clearTokens()
    return { user: null, accessToken: null }
  }

  // Fuente de verdad: el usuario en caché. Respaldo: decodificar el JWT — cubre
  // el caso de que la caché se borrara mientras el token sigue vivo.
  const user = getStoredUser() ?? userFromToken(token)
  if (!user) {
    clearTokens()
    return { user: null, accessToken: null }
  }
  if (!getStoredUser()) setStoredUser(user)

  return { user, accessToken: token }
}

export function useAuthState() {
  return useState<AuthState>('auth', initialAuthState)
}

export function useAuth() {
  const state = useAuthState()

  const user = computed(() => state.value.user)
  const accessToken = computed(() => state.value.accessToken)
  const isAuthenticated = computed(() => state.value.user !== null && !!state.value.accessToken)

  /**
   * Presentation only — hiding a link is not access control. The route
   * middleware enforces pages and each endpoint enforces itself.
   */
  function can(permission: Permission): boolean {
    return hasPermission(ROLE_PERMISSIONS, state.value.user?.role, permission)
  }

  function aplicarToken(token: RespuestaToken): void {
    const user = userFromToken(token.access_token)
    if (!user) throw new AppError('SERVER_ERROR', 'El token recibido no trae un usuario válido.')

    state.value = { user, accessToken: token.access_token }
    setAccessToken(token.access_token)
    // El login propio no tiene refresh: uno que quedara de una sesión de Unergy
    // anterior haría que `~/core/client.ts` intentara renovar este token.
    setRefreshToken(null)
    setStoredUser(user)
  }

  async function signIn(credentials: { email: string; password: string }): Promise<void> {
    if (useRuntimeConfig().public.unergyAuthEnabled) {
      await signInUnergy(credentials)
      return
    }
    const token = await new OperacionesAuthService().login(credentials.email, credentials.password)
    aplicarToken(token)
  }

  async function signInUnergy(credentials: { email: string; password: string }): Promise<void> {
    const servicio = new UnergyAuthService()
    const tokens = await servicio.login(credentials.email, credentials.password)
    // Si el backend no reconoce el email (403) esto lanza y no queda nada
    // guardado: un token de Unergy sin usuario de Operaciones no es una sesión.
    const user = userFromOperaciones(await servicio.usuarioActual(tokens.access))

    state.value = { user, accessToken: tokens.access }
    setAccessToken(tokens.access)
    setRefreshToken(tokens.refresh)
    setStoredUser(user)
  }

  /** Login de la app móvil: mismo usuario, token de larga duración (30 días). */
  async function signInMobile(credentials: { email: string; password: string }): Promise<void> {
    const token = await new OperacionesAuthService().loginMovil(
      credentials.email,
      credentials.password,
    )
    aplicarToken(token)
  }

  /**
   * Cierra la sesión y saca de la vista actual al login (el de escritorio o el
   * móvil, según dónde se esté): sin eso la página seguía mostrando los datos
   * ya cargados, porque la guarda de rutas solo corre al navegar.
   */
  function signOut(): void {
    state.value = { user: null, accessToken: null }
    clearTokens()
    salirAlLogin()
  }

  /** Solo en desarrollo: simula una sesión sin backend para previsualizar vistas por rol. */
  function previewLogin(role: string): void {
    if (!import.meta.dev) return

    const base64url = (valor: string) =>
      btoa(valor).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const header = base64url('{"alg":"HS256","typ":"JWT"}')
    const payload = base64url(
      `{"sub":"99","rol":"${role}","nombre":"Preview ${role}","email":"preview@unergy.io","exp":9999999999}`,
    )
    aplicarToken({ access_token: `${header}.${payload}.preview` })
  }

  return {
    state,
    user,
    accessToken,
    isAuthenticated,
    can,
    signIn,
    signInMobile,
    signOut,
    previewLogin,
  }
}
