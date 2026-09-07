/** Forma verificada contra `DashboardView.vue`. */

export type EstadoCumplimientoPpa = 'deficit' | 'excedente' | 'ok'

export interface TotalesCumplimientoPpa {
  estado?: EstadoCumplimientoPpa
  gen_total_mwh?: number
  gen_proyectada_mwh?: number
  energia_minima_mwh?: number
  compras_bolsa_mwh?: number
  [clave: string]: unknown
}

export interface ContratoCumplimientoPpa {
  id: number
  estado?: EstadoCumplimientoPpa
  nombre_interno?: string
  comprador_nombre?: string
  compras_bolsa_mwh?: number
  [clave: string]: unknown
}

/** Respuesta de `GET /cumplimiento/ppa/resumen`. */
export interface ResumenCumplimientoPpa {
  totales?: TotalesCumplimientoPpa
  contratos?: ContratoCumplimientoPpa[]
}
