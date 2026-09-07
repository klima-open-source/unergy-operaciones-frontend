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
 */
import type { RespuestaToken } from '~/features/auth/services/operaciones-auth'
import type { Permission } from '~/config/permissions'
import type { User } from '~/types/user'
import { ROLE_PERMISSIONS } from '~/config/permissions'
import { AppError } from '~/core/errors'
import {
  clearTokens,
  decodeJwtPayload,
  getAccessToken,
  getStoredUser,
  isTokenExpired,
  setAccessToken,
  setStoredUser,
} from '~/core/security'
import { hasPermission } from '~/core/permissions'
import { OperacionesAuthService } from '~/features/auth/services/operaciones-auth'

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

/**
 * El estado inicial, leído de `localStorage`. En el servidor `getAccessToken()`
 * devuelve `null` (`~/core/security` resuelve el storage solo en cliente), así
 * que esto es un no-op ahí y se hidrata de verdad en el primer acceso del
 * cliente.
 */
function initialAuthState(): AuthState {
  const token = getAccessToken()
  if (!token || isTokenExpired(token)) {
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
    setStoredUser(user)
  }

  async function signIn(credentials: { email: string; password: string }): Promise<void> {
    const token = await new OperacionesAuthService().login(credentials.email, credentials.password)
    aplicarToken(token)
  }

  /** Login de la app móvil: mismo usuario, token de larga duración (30 días). */
  async function signInMobile(credentials: { email: string; password: string }): Promise<void> {
    const token = await new OperacionesAuthService().loginMovil(
      credentials.email,
      credentials.password,
    )
    aplicarToken(token)
  }

  function signOut(): void {
    state.value = { user: null, accessToken: null }
    clearTokens()
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
