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

/** Una fila de «lo que pide atención»: qué es y la ficha donde se resuelve. */
export interface ItemAtencion {
  id: number
  titulo: string
  detalle: string
  url: string
}

export interface ListaAtencion {
  total: number
  /** Los primeros 8. */
  items: ItemAtencion[]
}

/** `GET /dashboard/atencion`. */
export interface Atencion {
  contratos_por_vencer: ListaAtencion
  plantas_sin_operacion: ListaAtencion
  arrendadores_sin_cliente: ListaAtencion
  dias_por_vencer: number
}
