/** Forma verificada contra `AlertasContratosPPAView.vue` y `AlertasView.vue`. */

export interface ProyectoHuerfanoPpa {
  proyecto_id: number
  nombre_comercial: string
  tipo_proyecto?: string
  estado?: string
  [clave: string]: unknown
}

export interface ContratoDuplicadoPpa {
  codigo_sic_contrato: string
  contrato_interno?: string
  tipo_solicitud?: string
  fecha_inicio?: string
  fecha_fin?: string
  porcentaje_fncer?: number
  [clave: string]: unknown
}

export interface ProyectoDuplicadoPpa {
  proyecto_id: number
  nombre_comercial: string
  tipo_proyecto?: string
  sics: ContratoDuplicadoPpa[]
  [clave: string]: unknown
}

/** Respuesta de `GET /alertas/contratos-ppa`. */
export interface AlertasContratosPpa {
  fecha_consulta: string
  huerfanos: ProyectoHuerfanoPpa[]
  duplicados: ProyectoDuplicadoPpa[]
}
