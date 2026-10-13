/**
 * Los proyectos de TSF en construcción u operación, para que el modal «Nuevo
 * proyecto» sugiera los que aún no están en Operaciones. Qué falta lo decide el
 * cliente, que ya tiene las plantas cargadas (`~/features/proyectos/prellenadoTsf`).
 */
import { proyectosEnEtapas } from '~~/server/utils/originabot-api'

export default defineEventHandler(async (event) => {
  const autorizacion = getHeader(event, 'authorization')
  if (!autorizacion) {
    const detail = 'Para ver los proyectos de TSF inicia sesión con Unergy Auth.'
    throw createError({ statusCode: 403, statusMessage: detail, data: { detail } })
  }
  return { resultados: await proyectosEnEtapas(event, autorizacion) }
})
