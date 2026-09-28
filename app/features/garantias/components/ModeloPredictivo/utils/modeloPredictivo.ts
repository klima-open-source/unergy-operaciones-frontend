/**
 * Constantes de dominio y helpers puros de presentación del Modelo Predictivo.
 * Sin estado y sin dependencias de Vue: reutilizables y testeables por separado.
 */
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'
import type { FrescuraGeneracion, InsumoModelo } from '~/features/garantias/types'
import { EstadoVencimiento, ProcedenciaVentana } from '~/features/garantias/types'
import { isFetchError, readDetail } from '~/core/errors'

export const ESTADO_LABEL: Record<EstadoVencimiento, string> = {
  [EstadoVencimiento.FIRME]: 'firme',
  [EstadoVencimiento.ESTIMADO]: 'estimado',
  [EstadoVencimiento.PRELIMINAR]: 'preliminar',
}

export const ESTADO_TITLE: Record<EstadoVencimiento, string> = {
  [EstadoVencimiento.FIRME]: 'XM ya publicó el monto',
  [EstadoVencimiento.ESTIMADO]:
    'La ventana base ya cerró: solo falta que XM liquide días ya ocurridos',
  [EstadoVencimiento.PRELIMINAR]: 'La ventana base sigue abierta: incluye días futuros',
}

/** Color de `GBadge` por estado del vencimiento. */
export const ESTADO_SEVERITY: Record<EstadoVencimiento, GandalfBadgeColor> = {
  [EstadoVencimiento.FIRME]: 'success',
  [EstadoVencimiento.ESTIMADO]: 'action',
  [EstadoVencimiento.PRELIMINAR]: 'default',
}

export const PROCEDENCIA_LABEL: Record<ProcedenciaVentana, string> = {
  [ProcedenciaVentana.OBSERVADA]: 'observada',
  [ProcedenciaVentana.DERIVADA]: 'derivada',
  [ProcedenciaVentana.CANDIDATAS]: 'candidatas',
}

export const PROCEDENCIA_TITLE: Record<ProcedenciaVentana, string> = {
  [ProcedenciaVentana.OBSERVADA]: 'Ventana tomada de la hoja PERIODO BASE o del nombre del CGM',
  [ProcedenciaVentana.DERIVADA]:
    'Ventana derivada de la regla general (cierra en 14, cálculo en 7)',
  [ProcedenciaVentana.CANDIDATAS]:
    'Ventana no derivable: se calculó sobre todas las candidatas y la dispersión ensancha el intervalo',
}

/** Color de `GBadge` por procedencia de la ventana. */
export const PROCEDENCIA_SEVERITY: Record<ProcedenciaVentana, GandalfBadgeColor> = {
  [ProcedenciaVentana.OBSERVADA]: 'success',
  [ProcedenciaVentana.DERIVADA]: 'action',
  [ProcedenciaVentana.CANDIDATAS]: 'warning',
}

const FUENTE_ANCHO: Record<string, { label: string; color: string }> = {
  ventana_candidata: { label: 'Ventana candidata', color: '#F59E0B' },
  liquidacion: { label: 'Liquidación', color: '#915BD8' },
  dias_sin_liquidar: { label: 'Días sin liquidar', color: '#60A5FA' },
  precio_proyectado: { label: 'Precio proyectado', color: '#EC4899' },
}

/** Las cuatro fuentes que puede citar el backend son un catálogo abierto: sin match, se usa la clave cruda como label. */
export function fuenteAncho(clave: string): { label: string; color: string } {
  return FUENTE_ANCHO[clave] || { label: clave, color: '#9CA3AF' }
}

/** true cuando el dato de generación está más viejo que el umbral y compromete el margen. */
export function generacionAtrasada(frescura: FrescuraGeneracion | null | undefined): boolean {
  if (!frescura) return false
  return Number(frescura.dias_atraso) > Number(frescura.umbral_dias)
}

/** Versión de liquidación distinta de tx2 = insumo contaminado (riesgo 13 del spec). */
export function insumoContaminado(insumo: InsumoModelo | null | undefined): boolean {
  return !!insumo && insumo.version !== 'tx2'
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** '2026-09' -> 'Septiembre 2026'. Devuelve el crudo si no matchea. */
export function nombreMes(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''))
  if (!m) return String(periodo ?? '—')
  const nombre = MESES[Number(m[2]) - 1]
  if (!nombre) return String(periodo)
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${m[1]}`
}

/** '2026-08-28' -> '28 ago'. Sin Date: evita corrimientos por zona horaria. */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return '—'
  const abrev = MESES[Number(m[2]) - 1]
  if (!abrev) return String(iso)
  return `${m[3]} ${abrev.slice(0, 3)}`
}

/** '2026-08-01' + '2026-08-07' -> '01–07 ago'; cruza mes -> '25 jul – 07 ago'. */
export function rangoCorto(ini: string | null | undefined, fin: string | null | undefined): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ini || ''))
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fin || ''))
  if (!a || !b) return '—'
  if (a[1] === b[1] && a[2] === b[2]) {
    return `${a[3]}–${b[3]} ${MESES[Number(a[2]) - 1]!.slice(0, 3)}`
  }
  return `${fechaCorta(ini)} – ${fechaCorta(fin)}`
}

// Textos genéricos que FastAPI/Starlette devuelven por defecto (p.ej. un 404
// de una ruta que aún no existe en el backend). No son mensajes de aplicación
// y no deben mostrarse tal cual al usuario.
const DETALLE_GENERICO = new Set([
  'Not Found',
  'Internal Server Error',
  'Unprocessable Entity',
  'Method Not Allowed',
])

/**
 * Mensaje de error apto para mostrar al usuario. Solo usa el `detail` que
 * manda el backend cuando es plausible (status 4xx y no es un texto genérico
 * de framework); en cualquier otro caso devuelve `fallback`.
 */
export function mensajeError(e: unknown, fallback: string): string {
  if (!isFetchError(e)) return fallback
  const status = e.status
  const detail = readDetail(e.data)
  const detalleValido =
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    detail !== undefined &&
    !DETALLE_GENERICO.has(detail.trim())
  return detalleValido ? detail : fallback
}
