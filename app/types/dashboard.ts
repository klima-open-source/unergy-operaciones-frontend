/**
 * `GET /dashboard/kpis` — lo consumen `alertas` y `dashboard`, de ahí que viva
 * aquí y no en ninguno de los dos slices.
 *
 * Forma verificada contra `AlertasView.vue` y `DashboardView.vue`: el backend
 * devuelve más campos de los que se leen hoy.
 */
export interface KpisOperativos {
  proyectos_total?: number
  proyectos_operacion?: number
  clientes_total?: number
  fallas_abiertas?: number
  fallas_criticas_antiguas?: number
  fallas_por_prioridad?: {
    critica?: number
    grave?: number
    media?: number
    leve?: number
    [clave: string]: unknown
  }
  mwh_mes?: number
  fleet_power_kw?: number
  fleet_online?: number
  fleet_total?: number
  gen_solenium_last_date?: string
  gen_solenium_projects?: number
  precio_bolsa_cop_kwh?: number
  alarmas_mgs?: number
  alarmas_mgs_criticas?: number
  ppa_con_compromisos?: number
  liquidaciones_pendientes?: number
  [clave: string]: unknown
}
