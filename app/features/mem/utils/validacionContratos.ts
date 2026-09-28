/**
 * Validación de solapamiento de fechas en contratos ASIC (GESCON).
 *
 * Contexto de negocio:
 *   Un contrato ASIC registra una planta (proyecto) bajo un código SIC ante XM,
 *   con una ventana [fecha_inicio, fecha_fin]. Si la MISMA planta queda activa en
 *   dos contratos con fechas que se cruzan, su generación se cuenta dos veces en
 *   Cumplimiento. El modelo ya expone dos banderas para resolver ese cruce:
 *     - reemplaza_anterior : esta planta sustituye al registro previo en el SIC.
 *     - es_duplicado       : "compra en bolsa" — la planta ya está en otro
 *                            contrato; el suministro cuenta pero su origen es bolsa.
 *   Un cruce SIN ninguna de las dos banderas es un conflicto de atribución.
 *
 * Este módulo son funciones puras (sin dependencias de Vue ni de red) para poder
 * usarlas en la vista y probarlas con node (ver validacionContratos.test.mjs).
 */

type FechaValor = string | Date | null | undefined

export interface ContratoAsic {
  id?: number | string | null
  proyecto_id?: number | string | null
  estado_solicitud?: string
  codigo_sic_contrato?: string | null
  /** Solo para mostrar el conflicto en la UI (`GesconView.vue`) -- no entra en el cálculo. */
  contrato_interno?: string | null
  fecha_inicio?: FechaValor
  fecha_fin?: FechaValor
  fecha_fin_efectiva?: FechaValor
  tipo_solicitud?: string | null
  es_duplicado?: boolean
}

// Estados que ya no aportan energía: no cuentan para el solapamiento.
export const ESTADOS_INACTIVOS = ['rechazado', 'desistido', 'terminado']

// Centinelas para tratar fechas abiertas como ±infinito en comparación de strings.
const MIN_DATE = '0000-01-01'
const MAX_DATE = '9999-12-31'

/**
 * Normaliza un valor de fecha (Date | 'YYYY-MM-DD...' | null) a 'YYYY-MM-DD'.
 * Usa componentes locales para no correr el día por zona horaria.
 */
export function toIsoDate(v: FechaValor): string | null {
  if (!v) return null
  if (typeof v === 'string') return v.slice(0, 10)
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

/**
 * ¿El contrato sigue vigente/activo? (no rechazado/desistido/terminado).
 */
export function contratoActivo(c: ContratoAsic | null | undefined): boolean {
  return !ESTADOS_INACTIVOS.includes(c?.estado_solicitud ?? '')
}

/**
 * Fin EFECTIVO de la ventana de un registro, en ISO.
 *
 * `asic_solicitudes` guarda cada solicitud histórica como fila permanente: una
 * fila superada por un relevo (otra planta con reemplaza_anterior=true en su
 * SIC) o por una modificación posterior conserva su `fecha_fin` CRUDA
 * (p. ej. 2039) aunque su vigencia real terminó el día anterior al relevo.
 * El backend publica ese fin real como `fecha_fin_efectiva` (GET /asic,
 * calculado por app/utils/gescon_vigencia.py). Comparar solapamientos contra
 * la fecha cruda produce falsos positivos — caso real: SIC 89116, MGS 0012
 * La Reserva, planta reubicada de contrato vía modificación.
 *
 * Fallback a `fecha_fin` cruda si el backend aún no manda el campo.
 */
export function finEfectivoIso(c: ContratoAsic | null | undefined): string | null {
  return toIsoDate(c?.fecha_fin_efectiva) || toIsoDate(c?.fecha_fin)
}

/**
 * Devuelve los contratos de `existingContracts` cuya ventana de fechas se cruza
 * con [startDate, endDate]. Un extremo nulo se trata como abierto (±infinito).
 * El fin de cada existente es su fin EFECTIVO (ver finEfectivoIso), no el crudo.
 *
 * Regla canónica de solapamiento de rangos: f1.inicio <= f2.fin && f1.fin >= f2.inicio.
 */
export function checkDateOverlap(
  startDate: FechaValor,
  endDate: FechaValor,
  existingContracts: ContratoAsic[] = [],
): ContratoAsic[] {
  const s1 = toIsoDate(startDate) || MIN_DATE
  const e1 = toIsoDate(endDate) || MAX_DATE
  return (existingContracts || []).filter((c) => {
    const s2 = toIsoDate(c.fecha_inicio) || MIN_DATE
    const e2 = finEfectivoIso(c) || MAX_DATE
    return s1 <= e2 && e1 >= s2
  })
}

/**
 * Busca los contratos que el nuevo registro reemplazaría: mismos SIC, activos,
 * con fechas que se cruzan, excluyendo el propio registro (por id) y — si el nuevo
 * trae proyecto — las plantas realmente distintas se conservan porque "reemplaza
 * anterior" opera a nivel de SIC (una planta sustituye a la anterior del SIC).
 */
export function findReplacementContract(
  newContract: ContratoAsic = {},
  existingContracts: ContratoAsic[] = [],
): ContratoAsic[] {
  const sic = newContract.codigo_sic_contrato || null
  if (!sic) return []
  const candidatos = (existingContracts || []).filter((c) =>
    c.id !== newContract.id &&
    contratoActivo(c) &&
    c.codigo_sic_contrato === sic,
  )
  return checkDateOverlap(newContract.fecha_inicio, newContract.fecha_fin, candidatos)
}

/**
 * Detecta duplicados exactos del contrato: mismo SIC, misma planta, mismas fechas
 * de inicio/fin y mismo tipo de solicitud (excluyendo el propio registro por id).
 */
export function validateContractUniqueness(
  contract: ContratoAsic = {},
  existingContracts: ContratoAsic[] = [],
): ContratoAsic[] {
  const sic = contract.codigo_sic_contrato || null
  const proyecto = contract.proyecto_id ?? null
  const ini = toIsoDate(contract.fecha_inicio)
  const fin = toIsoDate(contract.fecha_fin)
  return (existingContracts || []).filter((c) =>
    c.id !== contract.id &&
    (c.codigo_sic_contrato || null) === sic &&
    (c.proyecto_id ?? null) === proyecto &&
    toIsoDate(c.fecha_inicio) === ini &&
    toIsoDate(c.fecha_fin) === fin &&
    (c.tipo_solicitud ?? null) === (contract.tipo_solicitud ?? null),
  )
}

/**
 * Núcleo de la validación de atribución de generación para la vista.
 * Devuelve los contratos ACTIVOS de la MISMA planta cuyas ventanas EFECTIVAS se
 * cruzan con la ventana propuesta (excluyendo el propio registro). Es el eje de
 * doble conteo.
 *
 * No cuentan como conflicto:
 * - Filas superadas por un relevo/modificación (su ventana efectiva termina
 *   antes — ver finEfectivoIso). Eran el falso positivo de plantas reubicadas.
 * - Filas ya marcadas es_duplicado (cruce ya resuelto como compra en bolsa).
 * - Terminaciones (no son contratos que generen; su planta es display-only).
 *
 * Al EDITAR una fila que un relevo ya recortó en el servidor, el recorte se
 * respeta también sobre la ventana propuesta: el corte lo impone el relevo del
 * SIC, no la fecha_fin que se esté escribiendo en el formulario.
 *
 * @param contract  { id?, proyecto_id, fecha_inicio, fecha_fin }
 * @param existingContracts  contratos ya cargados
 */
export function conflictosAtribucion(
  contract: ContratoAsic = {},
  existingContracts: ContratoAsic[] = [],
): ContratoAsic[] {
  const proyecto = contract.proyecto_id ?? null
  if (proyecto == null) return []
  if (!contract.fecha_inicio) return []
  const mismaPlanta = (existingContracts || []).filter((c) =>
    c.id !== contract.id &&
    contratoActivo(c) &&
    c.tipo_solicitud !== 'terminacion' &&
    !c.es_duplicado &&
    (c.proyecto_id ?? null) === proyecto,
  )

  // Corte que el servidor ya le impuso a ESTA fila (relevo posterior en su SIC):
  // si su ventana efectiva termina antes que la cruda, ese fin manda sobre lo
  // que diga el formulario.
  let finPropuesto = toIsoDate(contract.fecha_fin)
  if (contract.id != null) {
    const propio = (existingContracts || []).find((c) => c.id === contract.id)
    if (propio) {
      const efectiva = toIsoDate(propio.fecha_fin_efectiva)
      const cruda = toIsoDate(propio.fecha_fin)
      const recortada = efectiva && (!cruda || efectiva < cruda)
      if (recortada && (!finPropuesto || efectiva < finPropuesto)) finPropuesto = efectiva
    }
  }

  return checkDateOverlap(contract.fecha_inicio, finPropuesto, mismaPlanta)
}
