/**
 * MIGRACIÓN — Fase 1. El reenvío al backend de operaciones.
 *
 * El legacy lo resolvía con `server.proxy` de Vite en desarrollo y con los
 * `rewrites` de `vercel.json` en producción: dos configuraciones que decían lo
 * mismo en dos sitios y que se podían desincronizar. Aquí es una sola ruta de
 * Nitro, y vale igual en `bun run dev` que en el build.
 *
 * Que el navegador y la API compartan origen es lo que evita el CORS.
 */
import type { H3Event } from 'h3'

/**
 * Reenvía la petición tal cual, conservando método, cuerpo y cabeceras.
 *
 * `prefijoAQuitar` recorta un prefijo antes de reenviar (lo usaba el proxy de
 * EVO, retirado el 2026-10-16). `cabeceras` es lo que se añade server-side — un
 * token que no debe llegar al cliente.
 */
export function reenviar(
  event: H3Event,
  destino: string,
  opciones: { prefijoAQuitar?: string; cabeceras?: Record<string, string> } = {},
) {
  const { prefijoAQuitar = '', cabeceras } = opciones

  const url = getRequestURL(event)
  const ruta = prefijoAQuitar ? url.pathname.slice(prefijoAQuitar.length) : url.pathname

  return proxyRequest(event, `${destino.replace(/\/$/, '')}${ruta}${url.search}`, {
    headers: cabeceras,
  })
}
