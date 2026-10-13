/**
 * Busca proyectos en TSF (Portfolio Manager de originabot) para importarlos.
 *
 * Una ruta y no un endpoint de `server/api/`: la autorización la decide
 * originabot con el token de Unergy Auth de quien pide, que se reenvía tal cual.
 * Solo estos dos caminos llegan a originabot: no es un proxy abierto.
 */
import { buscarEnTsf } from '~~/server/utils/originabot-api'

const MINIMO = 3

export default defineEventHandler((event) => {
  const autorizacion = getHeader(event, 'authorization')
  if (!autorizacion) {
    const detail = 'Para importar desde TSF inicia sesión con Unergy Auth.'
    throw createError({ statusCode: 403, statusMessage: detail, data: { detail } })
  }

  const q = getQuery(event).q
  const busqueda = typeof q === 'string' ? q.trim() : ''
  if (busqueda.length < MINIMO) {
    const detail = `Escribe al menos ${MINIMO} caracteres para buscar en TSF.`
    throw createError({ statusCode: 400, statusMessage: detail, data: { detail } })
  }

  return buscarEnTsf(event, autorizacion, busqueda)
})
