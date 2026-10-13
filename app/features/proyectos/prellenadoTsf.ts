/**
 * Lo que un proyecto de TSF prellena en `ProyectoForm`, y qué queda bloqueado.
 *
 * La regla: **un campo se bloquea solo si el dato vino de TSF y encajó** en lo que
 * Operaciones acepta. El operador de red se cruza por llave (`codigo_originabot`,
 * que `ImportarDesdeTsf` vincula antes de abrir el formulario); el nombre solo se
 * usa si TSF no trajo el code. Departamento, municipio y operador de red son catálogos
 * (DIVIPOLA, operadores de red): si TSF trae un nombre que no está, el campo
 * queda vacío y editable, y se avisa — bloquear un campo vacío dejaría el
 * proyecto sin ese dato para siempre.
 *
 * Lo derivado (el nombre comercial, sacado del código como hace `tsf_sync`) se
 * prellena pero no se bloquea: no es un dato de TSF.
 */
import type { ProyectoTsf, ResultadoTsf } from '~/features/proyectos/types'
import { slugify } from '~/utils/string'

/** Los campos de `ProyectoForm` que TSF puede fijar. */
export type CampoTsf =
  | 'codigo_tsf'
  | 'tipo_proyecto'
  | 'departamento'
  | 'municipio'
  | 'coordenadas'
  | 'operador_red_id'
  | 'p50_mensual'
  | 'p90_mensual'

export interface OperadorRedCatalogo {
  id: number
  nombre_comercial?: string | null
  nombre_legal?: string | null
  codigo_originabot?: string | null
}

export interface PrellenadoTsf {
  valores: {
    nombre_comercial: string
    codigo_tsf: string | null
    origina_code: string
    originabot_minifarm_id: number
    origen: 'originabot'
    tipo_proyecto: string | null
    departamento: string | null
    municipio: string | null
    latitud: number | null
    longitud: number | null
    operador_red_id: number | null
  }
  /** Generación simulada mensual (kWh); null = TSF no tiene zip o anual para esa fila. */
  simulacion: { p50: number[] | null; p90: number[] | null }
  bloqueados: CampoTsf[]
  /** Lo que TSF trae pero no encajó: «Departamento: "Cundinamarca D.C."». */
  sinCoincidencia: string[]
}

function buscar<T>(
  opciones: T[],
  nombre: string | null,
  nombreDe: (o: T) => (string | null | undefined)[],
): T | null {
  if (!nombre) return null
  const clave = slugify(nombre)
  return opciones.find((o) => nombreDe(o).some((n) => !!n && slugify(n) === clave)) ?? null
}

export function prellenadoDesdeTsf(
  tsf: ProyectoTsf,
  divipola: Record<string, string[]>,
  operadores: OperadorRedCatalogo[],
): PrellenadoTsf {
  const bloqueados: CampoTsf[] = []
  const sinCoincidencia: string[] = []

  const departamento = buscar(Object.keys(divipola), tsf.departamento, (d) => [d])
  if (departamento) bloqueados.push('departamento')
  else if (tsf.departamento) sinCoincidencia.push(`Departamento: «${tsf.departamento}»`)

  const municipio = departamento
    ? buscar(divipola[departamento] ?? [], tsf.municipio, (m) => [m])
    : null
  if (municipio) bloqueados.push('municipio')
  else if (tsf.municipio) sinCoincidencia.push(`Municipio: «${tsf.municipio}»`)

  const operador =
    (tsf.operadorRedCodigo
      ? operadores.find((o) => o.codigo_originabot === tsf.operadorRedCodigo)
      : null) ?? buscar(operadores, tsf.operadorRed, (o) => [o.nombre_comercial, o.nombre_legal])
  if (operador) bloqueados.push('operador_red_id')
  else if (tsf.operadorRed) sinCoincidencia.push(`Operador de red: «${tsf.operadorRed}»`)

  if (tsf.codigoTsf) bloqueados.push('codigo_tsf')
  if (tsf.tipoProyecto) bloqueados.push('tipo_proyecto')
  const conCoordenadas = tsf.latitud !== null && tsf.longitud !== null
  if (conCoordenadas) bloqueados.push('coordenadas')
  if (tsf.p50MensualKwh) bloqueados.push('p50_mensual')
  if (tsf.p90MensualKwh) bloqueados.push('p90_mensual')

  return {
    valores: {
      nombre_comercial: tsf.nombreSugerido,
      codigo_tsf: tsf.codigoTsf,
      origina_code: tsf.codigoOrigina,
      originabot_minifarm_id: tsf.minigranjaId,
      origen: 'originabot',
      tipo_proyecto: tsf.tipoProyecto,
      departamento,
      municipio,
      latitud: conCoordenadas ? tsf.latitud : null,
      longitud: conCoordenadas ? tsf.longitud : null,
      operador_red_id: operador?.id ?? null,
    },
    simulacion: { p50: tsf.p50MensualKwh, p90: tsf.p90MensualKwh },
    bloqueados,
    sinCoincidencia,
  }
}

/** Lo que hace falta de una planta de Operaciones para reconocerla en TSF. */
export interface PlantaConCodigos {
  codigo_tsf?: string | null
  origina_code?: string | null
  originabot_minifarm_id?: number | null
}

const PREFIJO_CREG = /^COL[A-Z0-9]+$/

/** `COLCEST456P1_BOSCONIA_ORIENTE` → `COLCEST456P1`; null si el nombre no empieza por un código CREG. */
function codigoTsfDe(codigo: string): string | null {
  const prefijo = codigo.split('_', 1)[0] ?? ''
  return PREFIJO_CREG.test(prefijo) ? prefijo : null
}

/**
 * El proyecto de Operaciones que ya corresponde a este de TSF, si lo hay. Primero
 * por llave (`originabot_minifarm_id`, ver `vincular_minigranjas_originabot`) y
 * después por los dos códigos que cruza `tsf_sync` (`codigo_tsf` es único en la
 * base): importarlo otra vez sería el duplicado que esa sincronización evita.
 */
export function proyectoExistente<T extends PlantaConCodigos>(
  tsf: Pick<ProyectoTsf, 'codigoTsf' | 'codigoOrigina'> & { minigranjaId?: number },
  proyectos: T[],
): T | null {
  return (
    proyectos.find(
      (p) =>
        (tsf.minigranjaId !== undefined && p.originabot_minifarm_id === tsf.minigranjaId) ||
        (!!tsf.codigoTsf && p.codigo_tsf === tsf.codigoTsf) ||
        (!!p.origina_code && p.origina_code === tsf.codigoOrigina),
    ) ?? null
  )
}

/** Los proyectos de TSF (en construcción u operación) que aún no están en Operaciones. */
export function faltanEnOperaciones(
  resultados: ResultadoTsf[],
  proyectos: PlantaConCodigos[],
): ResultadoTsf[] {
  return resultados.filter(
    (r) =>
      !proyectoExistente(
        { minigranjaId: r.minigranjaId, codigoTsf: codigoTsfDe(r.codigo), codigoOrigina: r.codigo },
        proyectos,
      ),
  )
}
