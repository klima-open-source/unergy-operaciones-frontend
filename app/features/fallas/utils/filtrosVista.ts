// ──────────────────────────────────────────────────────────────────────────
// Filtros de la lista de Gestión de Fallas (`MonitoreoView.vue`), los de la
// barra (búsqueda) y los del popover (proyecto, prioridad, estado, fechas,
// solo vencidas). Viven acá para poder preguntar "¿esta falla se ve con los
// filtros actuales?" también al abrir una falla desde otra pestaña.
// ──────────────────────────────────────────────────────────────────────────

import type { Falla } from '~/features/fallas/types'
import { categoriaFalla, tituloFalla } from '~/features/fallas/utils/fallaTitulo'
import { codigoEstadoFiltro } from '~/features/fallas/utils/grupoEstado'

export interface FiltrosVistaFallas {
  texto: string
  proyectoId: number | null
  /** `codigo` de la prioridad. */
  prioridad: string | null
  /** `codigo` del estado, ya normalizado con `codigoEstadoFiltro`. */
  estado: string | null
  /** `YYYY-MM-DD`, sobre la fecha de identificación. */
  desde: string | null
  hasta: string | null
  soloVencidas: boolean
}

/**
 * Sin cerrar y con el SLA vencido: lo que marca la etiqueta "Vencido" de la
 * fila. `sla_cumplido` (lo fija el cierre) manda sobre el porcentaje.
 */
export function esVencida(
  f: Pick<Falla, 'estado' | 'sla_cumplido' | 'sla_pct'>,
): boolean {
  if (f.estado?.es_estado_final) return false
  if (f.sla_cumplido != null) return f.sla_cumplido === false
  return f.sla_pct != null && f.sla_pct >= 100
}

function coincideTexto(f: Falla, texto: string): boolean {
  const q = texto.trim().toLowerCase()
  if (!q) return true
  return [
    f.codigo_interno,
    f.descripcion,
    f.proyecto?.nombre_comercial,
    tituloFalla(f),
    categoriaFalla(f).etiqueta,
  ].some((campo) => (campo ?? '').toLowerCase().includes(q))
}

export function cumpleFiltrosVista(f: Falla, filtros: FiltrosVistaFallas): boolean {
  const dia = f.fecha_identificacion?.slice(0, 10) ?? ''
  return (
    coincideTexto(f, filtros.texto) &&
    (!filtros.proyectoId || f.proyecto?.id === filtros.proyectoId) &&
    (!filtros.prioridad || f.prioridad?.codigo === filtros.prioridad) &&
    (!filtros.estado || codigoEstadoFiltro(f.estado?.codigo) === filtros.estado) &&
    // `YYYY-MM-DD` compara como texto, sin pasar por `Date` (y su zona horaria).
    (!filtros.desde || (!!dia && dia >= filtros.desde)) &&
    (!filtros.hasta || (!!dia && dia <= filtros.hasta)) &&
    (!filtros.soloVencidas || esVencida(f))
  )
}

/**
 * Desde qué día se piden las fallas cerradas: la ventana por defecto, o el
 * filtro "Desde" si pide algo anterior (p.ej. al volver del formulario con
 * `?desde=` en la URL). Ambos en `YYYY-MM-DD`.
 */
export function inicioDeCarga(desdeFiltro: string | null, porDefecto: string): string {
  return desdeFiltro && desdeFiltro < porDefecto ? desdeFiltro : porDefecto
}
