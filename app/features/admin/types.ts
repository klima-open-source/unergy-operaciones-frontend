/** Forma verificada contra `AdminUsuariosView.vue`, `ApiKeysDialog.vue` y `DiagnosticoEnlacesView.vue`. */

// ── Usuarios ──────────────────────────────────────────────────────────────────

/**
 * Los roles que devuelve `GET /usuarios`. No coincide con `UserRole`
 * (`~/types/user.ts`, los que emite el JWT): trae `cgm` y `solo_lectura`, que
 * ahí no existen, y le faltan `coordinador` y `tecnico`. Discrepancia real del
 * backend, documentada aquí — no se reconcilia como parte de esta migración.
 */
export type RolUsuarioAdmin =
  'admin' | 'operaciones' | 'monitoreo' | 'liquidaciones' | 'cgm' | 'solo_lectura' | 'comercial'

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: RolUsuarioAdmin
  activo: boolean
  [clave: string]: unknown
}

export interface PayloadUsuario {
  nombre: string
  email: string
  rol: RolUsuarioAdmin
  activo?: boolean
  [clave: string]: unknown
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: number
  nombre: string
  activo: boolean
  key_prefix: string
  created_at: string
  ultimo_uso?: string
}

// ── Diagnóstico de enlaces (Contrato → GESCON → Planta → sub_project) ────────

export interface ProyectoConSubProject {
  id: number
  nombre: string
  estado?: string
  sub_project?: string
}

export interface RegistroGescon {
  id: number
  tipo?: string
  estado?: string
  codigo_sic?: string
  planta?: string
  sub_project?: string
  pct_despacho?: number
  es_duplicado?: boolean
  reemplaza_anterior?: boolean
  fecha_inicio?: string
  fecha_fin?: string
}

export interface PlantaResuelta {
  asic_id: number
  planta: string
  sub_project?: string
  pct_despacho?: number
  es_duplicado?: boolean
}

export interface ContratoDiagnosticoEnlaces {
  contrato_id: number
  nombre_interno?: string
  numero_codigo_contrato?: string
  comprador?: string
  tipo?: string
  n_plantas_activas: number
  gescon_raw?: RegistroGescon[]
  gescon_resolved?: PlantaResuelta[]
}

/** Respuesta de `GET /cumplimiento/diagnostico`. */
export interface DiagnosticoEnlaces {
  proyectos_con_sub_project?: ProyectoConSubProject[]
  contratos?: ContratoDiagnosticoEnlaces[]
}

export interface AccionFixEnlaces {
  action: string
  contrato?: string
  planta?: string
  sub_project?: string
  reason?: string
  asic_id?: number
}

/** Respuesta de `POST /cumplimiento/fix-enlaces`. */
export interface ResultadoFixEnlaces {
  actions: AccionFixEnlaces[]
}
