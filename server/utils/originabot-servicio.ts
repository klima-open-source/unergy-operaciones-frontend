/**
 * Con quién habla Nitro con originabot: SIEMPRE el usuario de Operaciones.
 *
 * Igual que el backend (`apps/comun/integraciones/originabot.py`): el user
 * «operaciones» de Unergy Auth (`NUXT_ORIGINABOT_USER` / `NUXT_ORIGINABOT_PASSWORD`,
 * logueado contra `NUXT_ORIGINABOT_AUTH_URL`, del mismo entorno que
 * `NUXT_ORIGINABOT_URL`). Antes se reenviaba el token de quien pedía, y con el
 * login propio de Operaciones no se podía importar ni sincronizar con TSF.
 *
 * Como ya no es el token de la persona lo que llega a originabot, las rutas de
 * `server/routes/originabot/*` tienen que comprobar ANTES que quien pide tiene
 * sesión en Operaciones (`exigirSesion`): si no, serían una puerta abierta a TSF
 * con las credenciales de Operaciones.
 *
 * El token del usuario de servicio no depende de quién pide, por eso puede vivir
 * en el módulo (un isolate del Worker lo reutiliza entre peticiones).
 */
import type { H3Event } from 'h3'
import { FetchError } from 'ofetch'
import { toLoginBody, toUnergyTokens, type ExternalUnergyTokens } from './unergy-auth-api'

/** Margen antes del vencimiento del token para pedir otro. */
const MARGEN_MS = 60_000
/** Si el token no dice cuándo vence, cuánto se usa. */
const VIGENCIA_POR_DEFECTO_MS = 4 * 60_000
/** Cuánto vale la comprobación de la sesión de quien pide. */
const SESION_VIGENTE_MS = 60_000

let servicio: { token: string; vence: number } | null = null
let pidiendo: Promise<string> | null = null
const sesiones = new Map<string, number>()

function vencimiento(token: string): number {
  try {
    const carga = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(carga)) as { exp?: unknown }
    if (typeof exp === 'number') return exp * 1000 - MARGEN_MS
  } catch {
    // Sin `exp` legible: la vigencia por defecto.
  }
  return Date.now() + VIGENCIA_POR_DEFECTO_MS
}

function errorDeServicio(detail: string) {
  return createError({ statusCode: 502, statusMessage: detail, data: { detail } })
}

async function login(event: H3Event): Promise<string> {
  const config = useRuntimeConfig(event)
  if (!config.originabotUser || !config.originabotPassword) {
    throw errorDeServicio(
      'Operaciones no tiene configurado su usuario de originabot (NUXT_ORIGINABOT_USER y NUXT_ORIGINABOT_PASSWORD).',
    )
  }
  try {
    const respuesta = await $fetch<ExternalUnergyTokens>('/auth/login/', {
      baseURL: config.originabotAuthUrl,
      method: 'POST',
      body: toLoginBody(config.originabotUser, config.originabotPassword),
      retry: false,
    })
    return toUnergyTokens(respuesta).access
  } catch (err) {
    if (err instanceof FetchError && (err.status === 400 || err.status === 401)) {
      throw errorDeServicio(
        'originabot rechazó el usuario de Operaciones: revisa NUXT_ORIGINABOT_USER y NUXT_ORIGINABOT_PASSWORD.',
      )
    }
    throw errorDeServicio('No se pudo entrar a originabot: Unergy Auth no respondió.')
  }
}

/** `Bearer …` del usuario de Operaciones, del caché si sigue vigente. */
export async function autorizacionOriginabot(event: H3Event): Promise<string> {
  if (servicio && Date.now() < servicio.vence) return `Bearer ${servicio.token}`
  // Dos peticiones a la vez comparten el mismo login.
  pidiendo ??= login(event)
    .then((token) => {
      servicio = { token, vence: vencimiento(token) }
      return token
    })
    .finally(() => {
      pidiendo = null
    })
  return `Bearer ${await pidiendo}`
}

/** Para cuando originabot rechaza el token: el próximo pedido vuelve a loguearse. */
export function olvidarTokenOriginabot(): void {
  servicio = null
}

/**
 * Que quien pide tenga sesión en Operaciones (cualquiera de los dos logins),
 * preguntándole al backend. 401 si no: es su sesión la que venció.
 */
export async function exigirSesion(event: H3Event): Promise<void> {
  const autorizacion = getHeader(event, 'authorization')
  if (!autorizacion) {
    throw createError({ statusCode: 401, statusMessage: 'Inicia sesión para consultar TSF.' })
  }
  const vigente = sesiones.get(autorizacion)
  if (vigente && Date.now() < vigente) return

  try {
    await $fetch('/api/v1/auth/me', {
      baseURL: useRuntimeConfig(event).apiProxyTarget,
      headers: { Authorization: autorizacion },
      retry: false,
    })
  } catch (err) {
    sesiones.delete(autorizacion)
    if (err instanceof FetchError && (err.status === 401 || err.status === 403)) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Tu sesión venció. Inicia sesión de nuevo.',
      })
    }
    throw createError({
      statusCode: 503,
      statusMessage: 'No se pudo verificar tu sesión. Intenta de nuevo.',
    })
  }
  // Acotado: un mapa que solo crece es una fuga en un isolate que vive horas.
  if (sesiones.size > 500) sesiones.clear()
  sesiones.set(autorizacion, Date.now() + SESION_VIGENTE_MS)
}

/** Las dos cosas que hace cada ruta: comprobar a quien pide y devolver la credencial de Operaciones. */
export async function credencialOriginabot(event: H3Event): Promise<string> {
  await exigirSesion(event)
  return autorizacionOriginabot(event)
}
