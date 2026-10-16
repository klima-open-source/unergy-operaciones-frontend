/**
 * El proyecto — la planta. Es la entidad central de la plataforma: clientes,
 * contratos, fronteras, fallas y liquidaciones son formas de mirarla.
 *
 * Por eso vive en `~/types/` y no en un slice: la consumen `proyectos`,
 * `contratos`, `clientes`, `fallas`, `solar`, `fronteras`, `liquidaciones` y
 * `mem`.
 *
 * **Verificado contra `ProyectoForm.vue`**, que es el payload exacto de
 * `POST`/`PATCH /proyectos`, y contra las vistas que leen la respuesta. El
 * backend puede devolver más campos; lo que se afirma aquí es lo que se usa.
 *
 * Los catálogos van como `as const` + unión de literales, no como `enum`: hay
 * literales sueltos (`'en_operacion'`) repartidos por las vistas del legacy y
 * con un `enum` ninguno compilaría. Pasan a `enum` cuando la fase 3 migre esos
 * call sites.
 */
import type { FechaISO, Id, Opcion } from '~/types/api'

// ── Catálogos ────────────────────────────────────────────────────────────────

export const ESTADOS_PROYECTO = [
  { value: 'en_desarrollo', label: 'En desarrollo' },
  { value: 'en_operacion', label: 'En operacion' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'cancelado', label: 'Cancelado' },
] as const satisfies readonly Opcion[]

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]['value']

/** Cómo se conecta la planta. Decide qué contratos y qué liquidación le aplican. */
export const TIPOS_PROYECTO = ['minigranja', 'autoconsumo', 'gd', 'movilidad_electrica'] as const
export type TipoProyecto = (typeof TIPOS_PROYECTO)[number]

export const TIPOS_TECNOLOGIA = ['solar', 'eolica', 'hidraulica', 'biomasa', 'otra'] as const
export type TipoTecnologia = (typeof TIPOS_TECNOLOGIA)[number]

/**
 * La figura regulatoria ante la CREG: autogenerador a pequeña/gran escala,
 * generación distribuida, recurso energético distribuido.
 */
export const CLASIFICACIONES_REGULATORIAS = ['AGP', 'AGPE', 'AGGE', 'GD', 'DER', 'otra'] as const
export type ClasificacionRegulatoria = (typeof CLASIFICACIONES_REGULATORIAS)[number]

// ── La entidad ───────────────────────────────────────────────────────────────

/**
 * Los campos que se crean y se editan desde el formulario. Es exactamente el
 * cuerpo de `POST /proyectos` y `PATCH /proyectos/{id}`.
 */
export interface ProyectoEditable {
  nombre_comercial: string
  estado: EstadoProyecto
  tipo_proyecto: TipoProyecto | null
  tipo_tecnologia: TipoTecnologia | null
  departamento: string | null
  /** Del catálogo DIVIPOLA, no texto libre: si no, no se puede agrupar ni filtrar. */
  municipio: string | null
  direccion_vereda: string | null
  latitud: number | null
  longitud: number | null
  /** Enlaza con el catálogo real que usa el Reporte CGM (`Frontera.operador_red_id`). */
  operador_red_id: Id | null
  clasificacion_regulatoria: ClasificacionRegulatoria | null
  /** Identificador en la API de monitoreo de Unergy. */
  sub_project: string | null
  /** Código en Sun Factory, el origen del pipeline comercial. */
  codigo_tsf: string | null
  es_comunidad_energetica: boolean
  nombre_comunidad: string | null
}

export interface Proyecto extends ProyectoEditable {
  id: Id
}

/**
 * Potencia y capacidad viven en su propia tabla (`proyecto_info_tecnica`) y en
 * su propio endpoint (`PUT /proyectos/{id}/info-tecnica`), porque necesitan que
 * el proyecto exista. Por eso **no** son parte de `ProyectoEditable`: al crear,
 * el formulario las emite aparte para guardarlas en un segundo paso.
 */
export interface ProyectoInfoTecnica {
  potencia_ac_kw: number | null
  capacidad_instalada_kwp: number | null
  [campo: string]: unknown
}

/**
 * Quién es dueño de qué parte de la planta, y desde cuándo. La participación
 * suma 100 % entre los inversionistas vigentes de un mismo proyecto.
 */
export interface ProyectoInversionista {
  id: Id
  cliente_id: Id
  porcentaje_participacion: number
  fecha_inicio: FechaISO | null
  /** `null` mientras siga vigente. */
  fecha_fin: FechaISO | null
}
