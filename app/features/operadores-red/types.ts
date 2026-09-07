/** Forma verificada contra `OperadoresRedView.vue`, `OperadorRedDetailView.vue`, `ReporteCGMView.vue` y `HistorialEnviosCGM.vue`. */

// ── Operadores de red ─────────────────────────────────────────────────────────

export interface ContactoOperadorRed {
  id: number
  email: string
  nombre?: string | null
}

export interface OperadorRed {
  id: number
  nombre_legal: string
  nombre_comercial?: string | null
  contactos: ContactoOperadorRed[]
  fronteras_vinculadas: number
}

export interface PayloadOperadorRed {
  nombre_legal: string
  nombre_comercial?: string | null
}

export interface PayloadContactoOperadorRed {
  email: string
  nombre?: string | null
}

/** El 409 estructurado cuando el nombre se parece a un operador ya existente. */
export interface DuplicadoOperadorRed {
  duplicado_nombre: true
  candidato_id: number
  candidato_nombre: string
}

// ── Fronteras, para el reporte CGM ────────────────────────────────────────────

export interface ClienteCgm {
  id: number
  nombre: string
  correos: string[]
}

/**
 * Forma parcial de `Frontera` (el slice `fronteras` no está migrado todavía):
 * solo los campos que usa el reporte CGM.
 */
export interface FronteraCgm {
  id: number
  proyecto_id?: number
  proyecto_nombre?: string
  operador_red_id?: number | null
  operador_comercial?: string | null
  operador_correos?: string[]
  clientes_cgm?: ClienteCgm[]
}

// ── Reporte CGM: envío e historial ───────────────────────────────────────────

export interface DestinatarioEnvioCgm {
  tipo: string
  id: number
  proyectos: number[] | null
}

export interface PayloadEnvioCgm {
  fecha_inicio: string
  fecha_fin: string
  destinatarios: DestinatarioEnvioCgm[]
}

export interface ResultadoEnvioCgm {
  ok: boolean
  nombre: string
  error?: string
}

export interface RespuestaEnvioCgm {
  resultados: ResultadoEnvioCgm[]
}

/** Fila de `GET /informes/envios`. */
export interface EnvioInforme {
  id: number
  asunto?: string
  exitoso: boolean
  error?: string
  enviado_at: string
  proyectos?: string
  proyectos_total?: number | null
}
