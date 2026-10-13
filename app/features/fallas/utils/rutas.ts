// Rutas de Gestión de Fallas y los parámetros de query que viajan entre la
// lista (`/fallas`) y las páginas del formulario.

import type { Falla } from '~/features/fallas/types'

export const RUTAS_FALLAS = {
  lista: '/fallas',
  nueva: '/fallas/nueva',
  detalle: (id: Falla['id']) => `/fallas/${id}`,
  editar: (id: Falla['id']) => `/fallas/${id}/editar`,
} as const

/**
 * Parámetros propios de la navegación lista ↔ formulario. El resto de la query
 * (los filtros de la lista) viaja tal cual de ida y de vuelta, para que al
 * volver la lista quede como se dejó.
 */
export enum ParamQueryFallas {
  /** `/fallas/nueva?proyectos=12,45`: proyectos preseleccionados. */
  PREFILL_PROYECTOS = 'proyectos',
  /** `/fallas?falla=123`: abrir el panel de esa falla al cargar la lista. */
  ABRIR_FALLA = 'falla',
}
