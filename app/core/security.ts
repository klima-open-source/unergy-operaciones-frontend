// ─────────────────────────────────────────────────────────────────────────────
// Punto único de manejo de credenciales del frontend.
//
// Centraliza el almacenamiento del token de acceso y del usuario, además de la
// decodificación del JWT, de modo que la estrategia de almacenamiento se pueda
// cambiar en un solo lugar (el store de auth, el cliente `air` de `~/core/client.ts`
// y las vistas consumen estas funciones).
//
// SEGURIDAD — léase antes de modificar:
//   • Hoy el token de acceso se guarda en localStorage por compatibilidad:
//     sobrevive recargas y se comparte entre pestañas, que es lo que la
//     operación diaria espera. localStorage es legible por JavaScript, así que
//     NO protege ante XSS.
//   • La protección real contra el robo de token por XSS es que el BACKEND
//     emita el refresh token en una cookie httpOnly + Secure + SameSite=Strict
//     y que el access token sea de vida corta. Eso no se puede lograr solo desde
//     el frontend. Ver SECURITY.md.
//   • El template ya trae ese esquema montado (`server/utils/auth-api.ts` +
//     cookies httpOnly), pero necesita un `/auth/me` que el backend real no
//     expone hoy — sin él no hay forma de resolver la sesión en cada request.
//     Este archivo se queda hasta que ese endpoint exista; ver `~/composables/useAuth.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from '~/types/user'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

/**
 * Backend de almacenamiento. Se resuelve al usarlo, no al importar el módulo:
 * un `window.localStorage` a nivel de módulo revienta en cuanto una página se
 * renderice en el servidor, y la fase 3 va a encender SSR página por página.
 * Cambiar esta función (p. ej. a memoria) ajusta toda la app sin más cambios.
 */
function almacen(): Storage | null {
  return import.meta.client ? window.localStorage : null
}

/** Los claims que el backend mete en el JWT. */
export interface JwtPayload {
  sub?: string
  rol?: string
  nombre?: string
  email?: string
  /** Expiración en segundos desde epoch, como manda el estándar. */
  exp?: number
}

// ── Token de acceso ──────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  try {
    return almacen()?.getItem(TOKEN_KEY) ?? null
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) almacen()?.setItem(TOKEN_KEY, token)
    else almacen()?.removeItem(TOKEN_KEY)
  } catch {
    /* almacenamiento no disponible (modo privado, etc.) */
  }
}

// ── Usuario en caché ─────────────────────────────────────────────────────────
export function getStoredUser(): User | null {
  try {
    const raw = almacen()?.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null): void {
  try {
    if (user) almacen()?.setItem(USER_KEY, JSON.stringify(user))
    else almacen()?.removeItem(USER_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

// ── Limpieza total (logout / 401) ────────────────────────────────────────────
export function clearTokens(): void {
  try {
    almacen()?.removeItem(TOKEN_KEY)
    almacen()?.removeItem(USER_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

// ── Helpers de JWT ───────────────────────────────────────────────────────────
// Decodifican el payload SIN verificar la firma. La verificación es
// responsabilidad del backend; el frontend solo lee claims (sub, rol, exp…).
export function decodeJwtPayload(jwt: string | null | undefined): JwtPayload | null {
  if (!jwt) return null
  try {
    const parte = jwt.split('.')[1]
    if (!parte) return null
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const relleno = (4 - (b64.length % 4)) % 4
    return JSON.parse(atob(b64.padEnd(b64.length + relleno, '='))) as JwtPayload
  } catch {
    return null
  }
}

/** Un token sin `exp` legible se considera vencido: no se confía en lo que no se puede comprobar. */
export function isTokenExpired(jwt: string | null | undefined): boolean {
  const payload = decodeJwtPayload(jwt)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}

/**
 * Token de preview, solo en DEV: no es un token real, así que un 401 del backend
 * no debe cerrar la sesión.
 */
export function isPreviewToken(jwt: string | null | undefined): boolean {
  return import.meta.dev && typeof jwt === 'string' && jwt.endsWith('.preview')
}
