/**
 * Solo el contrato de arrendamiento de una minigranja de TSF, para el botón de la
 * pestaña Arriendos: no descarga la pre-simulación ni el ECS. `arriendo: null`
 * si TSF no tiene contrato (o termsheet) para el proyecto.
 */
import { arriendoDeMinigranja } from '~~/server/utils/originabot-api'

export default defineEventHandler(async (event) => {
  const autorizacion = getHeader(event, 'authorization')
  if (!autorizacion) {
    const detail = 'Para sincronizar con TSF inicia sesión con Unergy Auth.'
    throw createError({ statusCode: 403, statusMessage: detail, data: { detail } })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Id de minigranja inválido.' })
  }

  return { arriendo: await arriendoDeMinigranja(event, autorizacion, id) }
})
