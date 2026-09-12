/**
 * Filtros de la vista Servicios: PPA, Representación y Operación.
 *
 * El filtrado es JS plano y NO va dentro del DataTable, siguiendo la misma
 * decisión que ya documenta `ServiciosUnificadoView.vue` para los filtros de
 * Proyectos: el contador del subtítulo y el botón de Excel leen `filasVisibles`
 * (un computed), no la tabla. Filtrar dentro del DataTable dejaría el Excel
 * exportando filas que no se están viendo.
 *
 * Vive acá y no dentro del `.vue` porque ese componente tiene 1838 líneas y está
 * en `LEGACY_PENDIENTE_DE_MIGRAR` del `eslint.config`: nada escrito adentro se
 * lintea ni se puede probar.
 */

/** Si el contrato de servicio está asociado a una planta o quedó huérfano. */
export enum ConProyecto {
  CON = 'con',
  SIN = 'sin',
}

/** Filtros de la pestaña PPA. `estado` es la clave de `_vigencia`. */
export interface FiltrosPpa {
  estado: string | null
  tipo: string | null
  comprador: string | null
  vendedor: string | null
}

/** Filtros de Representación y Operación, que comparten tabla y datos. */
export interface FiltrosServicio {
  tipo: string | null
  /**
   * El tipo del PROYECTO (minigranja, gd, autoconsumo…), no el del contrato.
   * Se llama `tipoPlanta` y no `tipo` porque en Operación conviven los dos:
   * `tipo` es mantenimiento/arriendo/internet y este es la clase de planta.
   */
  tipoPlanta: string | null
  estado: string | null
  inversionista: string | null
  portafolio: string | null
  proyecto: ConProyecto | null
}

export const FILTROS_PPA_VACIOS: FiltrosPpa = {
  estado: null,
  tipo: null,
  comprador: null,
  vendedor: null,
}

export const FILTROS_SERVICIO_VACIOS: FiltrosServicio = {
  tipo: null,
  tipoPlanta: null,
  estado: null,
  inversionista: null,
  portafolio: null,
  proyecto: null,
}

/** Una fila cualquiera de las dos tablas; se lee por campo, sin exigir la forma completa. */
type Fila = Record<string, unknown>

/** `null`, `undefined` y la cadena vacía significan "sin filtrar". */
function puesto(valor: unknown): boolean {
  return valor !== null && valor !== undefined && valor !== ''
}

function coincide(fila: Fila, campo: string, valor: unknown): boolean {
  return !puesto(valor) || fila[campo] === valor
}

export function filtrarPpa<T extends Fila>(filas: T[], f: FiltrosPpa): T[] {
  return filas.filter((fila) => {
    // `_vigencia` lo precalcula la vista antes de filtrar, para que la columna
    // Estado siga siendo ordenable.
    const vigencia = (fila._vigencia as { clave?: string } | undefined)?.clave
    return (
      (!puesto(f.estado) || vigencia === f.estado) &&
      coincide(fila, 'tipo_contrato', f.tipo) &&
      coincide(fila, 'comprador_nombre', f.comprador) &&
      coincide(fila, 'vendedor_nombre', f.vendedor)
    )
  })
}

export function filtrarServicios<T extends Fila>(filas: T[], f: FiltrosServicio): T[] {
  return filas.filter((fila) => {
    if (puesto(f.proyecto)) {
      // `proyecto_id` 0 es falsy y cuenta como huérfano, igual que null.
      const tiene = Boolean(fila.proyecto_id)
      if (tiene !== (f.proyecto === ConProyecto.CON)) return false
    }
    if (puesto(f.tipoPlanta) && tipoDePlanta(fila) !== f.tipoPlanta) return false

    return (
      coincide(fila, 'servicio_aplica', f.tipo) &&
      coincide(fila, 'estado', f.estado) &&
      coincide(fila, 'inversionista_nombre', f.inversionista) &&
      coincide(fila, 'portafolio', f.portafolio)
    )
  })
}

/** El tipo de la planta asociada, o `null` si el contrato quedó huérfano. */
function tipoDePlanta(fila: Fila): string | null {
  const proyecto = fila.proyecto as { tipo_proyecto?: string | null } | null | undefined
  return proyecto?.tipo_proyecto || null
}

/**
 * Los tipos de planta que de verdad aparecen entre las filas, ordenados.
 *
 * Se derivan de los datos y no del catálogo completo para no ofrecer un filtro
 * que no seleccionaría nada.
 */
export function tiposDePlantaPresentes<T extends Fila>(filas: T[]): string[] {
  const vistos = new Set<string>()
  for (const fila of filas) {
    const tipo = tipoDePlanta(fila)
    if (tipo) vistos.add(tipo)
  }
  return [...vistos].sort()
}

/**
 * Cuántos filtros hay puestos — decide si se muestra "Limpiar filtros".
 *
 * El parámetro es `object` y no `Record<string, unknown>` a propósito: las
 * interfaces de TS no traen índice implícito, así que `FiltrosPpa` no encajaría
 * en un `Record` y habría que castear en cada llamada.
 */
export function contarActivos(filtros: object): number {
  return Object.values(filtros).filter(puesto).length
}

/** Valores únicos de un campo entre las filas cargadas, para armar un desplegable. */
export function opcionesDe<T extends Fila>(
  filas: T[],
  campo: string,
): { label: string; value: string }[] {
  const vistos = new Set<string>()
  for (const fila of filas) {
    const valor = fila[campo]
    if (typeof valor === 'string' && valor !== '') vistos.add(valor)
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, 'es')).map((v) => ({ label: v, value: v }))
}

/**
 * Descarta los valores que ya no existen en los datos.
 *
 * Hace falta porque los filtros viajan en la URL: un link compartido hace meses
 * puede nombrar un inversionista o un portafolio que ya no está, y aplicarlo
 * tal cual dejaría una tabla vacía con un filtro que nadie entiende. Las claves
 * sin lista de válidos (estado, tipo — que salen de enums fijos) no se tocan.
 */
export function depurarFiltros<T extends Record<string, unknown>>(
  filtros: T,
  validos: Partial<Record<keyof T, string[]>>,
): T {
  const salida = { ...filtros }
  for (const clave of Object.keys(validos) as (keyof T)[]) {
    const permitidos = validos[clave]
    const valor = salida[clave]
    if (permitidos && puesto(valor) && !permitidos.includes(valor as string)) {
      salida[clave] = null as T[keyof T]
    }
  }
  return salida
}
