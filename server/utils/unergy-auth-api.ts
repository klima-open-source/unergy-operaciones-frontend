/**
 * Unergy Auth (authentication-system, `auth.unergy.io`): el único archivo que
 * conoce su forma.
 *
 * Es dj-rest-auth con JWT: `POST /auth/login/` acepta `username` o `email` más
 * `password` y devuelve el par de tokens; `POST /auth/token/refresh/` cambia un
 * refresh por un access nuevo (y, si el servicio rota, un refresh nuevo). Los
 * nombres de las claves cambiaron entre versiones de dj-rest-auth
 * (`access_token` → `access`), así que se aceptan las dos.
 *
 * El navegador nunca habla con el servicio: pasa por `server/routes/unergy-auth/*`,
 * que es lo que evita el CORS y deja la URL del servicio fuera del bundle.
 *
 * Quién es el usuario en Operaciones (su rol) NO sale de aquí: lo decide el
 * backend de operaciones por email (`GET /api/v1/auth/me`).
 */
import type { H3Event } from 'h3'
import { FetchError } from 'ofetch'

const RUTAS = {
  login: '/auth/login/',
  refresh: '/auth/token/refresh/',
} as const

/** Lo que el cable trae. Todo opcional: no se afirma lo que no se comprueba. */
export interface ExternalUnergyTokens {
  access?: unknown
  refresh?: unknown
  access_token?: unknown
  refresh_token?: unknown
}

/** El par de tokens tal como lo usa la app. `refresh` es null si el servicio no rotó. */
export interface UnergyTokens {
  access: string
  refresh: string | null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

export function toUnergyTokens(respuesta: ExternalUnergyTokens): UnergyTokens {
  const access = texto(respuesta.access) ?? texto(respuesta.access_token)
  if (!access) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Unergy Auth respondió sin token de acceso.',
    })
  }
  return { access, refresh: texto(respuesta.refresh) ?? texto(respuesta.refresh_token) }
}

/**
 * El cuerpo de login que espera dj-rest-auth: un correo va como `email` y
 * cualquier otra cosa como `username`. Mandar los dos hace que allauth elija
 * según su configuración y puede rechazar un login válido.
 */
export function toLoginBody(usuario: string, password: string) {
  return usuario.includes('@') ? { email: usuario, password } : { username: usuario, password }
}

/**
 * Traduce un error del servicio al que ve el navegador. dj-rest-auth responde
 * 400 (no 401) a credenciales malas, y 401 a un refresh vencido: los dos son
 * "vuelve a iniciar sesión". Lo demás es una caída del servicio, no del usuario.
 */
function errorDeUnergy(err: unknown, mensaje401: string) {
  if (err instanceof FetchError && (err.status === 400 || err.status === 401)) {
    return createError({ statusCode: 401, statusMessage: mensaje401, data: { detail: mensaje401 } })
  }
  const detail = 'No se pudo contactar el servicio de autenticación de Unergy.'
  return createError({ statusCode: 502, statusMessage: detail, data: { detail } })
}

function baseURL(event: H3Event): string {
  return useRuntimeConfig(event).unergyAuthUrl
}

export async function loginUnergy(
  event: H3Event,
  credenciales: { email: string; password: string },
): Promise<UnergyTokens> {
  try {
    const respuesta = await $fetch<ExternalUnergyTokens>(RUTAS.login, {
      baseURL: baseURL(event),
      method: 'POST',
      body: toLoginBody(credenciales.email, credenciales.password),
      retry: false,
    })
    return toUnergyTokens(respuesta)
  } catch (err) {
    throw errorDeUnergy(err, 'Usuario o contraseña incorrectos.')
  }
}

export async function refreshUnergy(event: H3Event, refresh: string): Promise<UnergyTokens> {
  try {
    const respuesta = await $fetch<ExternalUnergyTokens>(RUTAS.refresh, {
      baseURL: baseURL(event),
      method: 'POST',
      body: { refresh },
      retry: false,
    })
    return toUnergyTokens(respuesta)
  } catch (err) {
    throw errorDeUnergy(err, 'La sesión de Unergy venció. Inicia sesión de nuevo.')
  }
}
