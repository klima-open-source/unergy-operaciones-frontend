/**
 * Detalle de una minigranja de TSF, ya traducido a lo que prellena el
 * formulario de proyecto. Ver `server/utils/originabot-api.ts`.
 */
import { minigranjaDeTsf } from '~~/server/utils/originabot-api'

export default defineEventHandler((event) => {
  const autorizacion = getHeader(event, 'authorization')
  if (!autorizacion) {
    const detail = 'Para importar desde TSF inicia sesión con Unergy Auth.'
    throw createError({ statusCode: 403, statusMessage: detail, data: { detail } })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Id de minigranja inválido.' })
  }

  return minigranjaDeTsf(event, autorizacion, id)
})
