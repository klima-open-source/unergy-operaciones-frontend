/**
 * Los proyectos de TSF en construcción u operación, para que el modal «Nuevo
 * proyecto» sugiera los que aún no están en Operaciones. Qué falta lo decide el
 * cliente, que ya tiene las plantas cargadas (`~/features/proyectos/prellenadoTsf`).
 */
import { proyectosEnEtapas } from '~~/server/utils/originabot-api'
import { credencialOriginabot } from '~~/server/utils/originabot-servicio'

export default defineEventHandler(async (event) => {
  const autorizacion = await credencialOriginabot(event)
  return { resultados: await proyectosEnEtapas(event, autorizacion) }
})
