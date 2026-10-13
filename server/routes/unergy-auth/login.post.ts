/**
 * Login con Unergy Auth. Una ruta y no un endpoint de `server/api/`: es pública
 * por definición (pedir un token no puede exigir uno), y todo lo de `server/api/`
 * debe declarar su permiso (`endpoints.guard.test.ts`).
 *
 * Devuelve el par de tokens; el usuario y su rol los resuelve el cliente con
 * `GET /api/v1/auth/me` del backend de operaciones.
 */
import { loginUnergy } from '~~/server/utils/unergy-auth-api'

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.unergyAuthEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Unergy Auth no está habilitado.' })
  }

  const body = await readBody<{ email?: unknown; password?: unknown }>(event)
  if (
    typeof body?.email !== 'string' ||
    typeof body?.password !== 'string' ||
    !body.email ||
    !body.password
  ) {
    const detail = 'Correo y contraseña son obligatorios.'
    throw createError({ statusCode: 400, statusMessage: detail, data: { detail } })
  }

  return loginUnergy(event, { email: body.email, password: body.password })
})
