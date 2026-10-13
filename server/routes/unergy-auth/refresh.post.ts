/**
 * Renueva el access token de Unergy Auth. Pública por la misma razón que el
 * login: se llama justamente cuando el access ya no sirve.
 */
import { refreshUnergy } from '~~/server/utils/unergy-auth-api'

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.unergyAuthEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Unergy Auth no está habilitado.' })
  }

  const body = await readBody<{ refresh?: unknown }>(event)
  if (typeof body?.refresh !== 'string' || !body.refresh) {
    const detail = 'Falta el refresh token.'
    throw createError({ statusCode: 400, statusMessage: detail, data: { detail } })
  }

  return refreshUnergy(event, body.refresh)
})
