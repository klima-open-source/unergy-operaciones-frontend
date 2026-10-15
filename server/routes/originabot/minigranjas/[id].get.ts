/**
 * Detalle de una minigranja de TSF, ya traducido a lo que prellena el
 * formulario de proyecto. Ver `server/utils/originabot-api.ts`.
 */
import { minigranjaDeTsf } from '~~/server/utils/originabot-api'
import { credencialOriginabot } from '~~/server/utils/originabot-servicio'

export default defineEventHandler(async (event) => {
  const autorizacion = await credencialOriginabot(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Id de minigranja inválido.' })
  }

  return minigranjaDeTsf(event, autorizacion, id)
})
