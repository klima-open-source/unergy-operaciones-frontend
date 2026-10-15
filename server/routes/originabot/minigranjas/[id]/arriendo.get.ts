/**
 * Solo el contrato de arrendamiento de una minigranja de TSF, para el botón de la
 * pestaña Arriendos: no descarga la pre-simulación ni el ECS. `arriendo: null`
 * si TSF no tiene contrato (o termsheet) para el proyecto.
 */
import { arriendoDeMinigranja } from '~~/server/utils/originabot-api'
import { credencialOriginabot } from '~~/server/utils/originabot-servicio'

export default defineEventHandler(async (event) => {
  const autorizacion = await credencialOriginabot(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Id de minigranja inválido.' })
  }

  return { arriendo: await arriendoDeMinigranja(event, autorizacion, id) }
})
