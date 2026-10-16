/**
 * Busca proyectos en TSF (Portfolio Manager de originabot) para importarlos.
 *
 * Una ruta y no un endpoint de `server/api/`. Quien pide tiene que tener sesión
 * en Operaciones, y a originabot se llega con el usuario de Operaciones (ver
 * `server/utils/originabot-servicio.ts`). Solo estos caminos llegan a
 * originabot: no es un proxy abierto.
 */
import { buscarEnTsf } from '~~/server/utils/originabot-api'
import { credencialOriginabot } from '~~/server/utils/originabot-servicio'

const MINIMO = 3

export default defineEventHandler(async (event) => {
  const autorizacion = await credencialOriginabot(event)

  const q = getQuery(event).q
  const busqueda = typeof q === 'string' ? q.trim() : ''
  if (busqueda.length < MINIMO) {
    const detail = `Escribe al menos ${MINIMO} caracteres para buscar en TSF.`
    throw createError({ statusCode: 400, statusMessage: detail, data: { detail } })
  }

  return buscarEnTsf(event, autorizacion, busqueda)
})
