// Constantes de dominio y helpers puros de presentacion del Modelo Predictivo.
// Sin estado y sin dependencias de Vue: reutilizables y testeables por separado.

export const ESTADO = Object.freeze({
  FIRME: 'firme',
  ESTIMADO: 'estimado',
  PRELIMINAR: 'preliminar',
})

export const PROCEDENCIA = Object.freeze({
  OBSERVADA: 'observada',
  DERIVADA: 'derivada',
  CANDIDATAS: 'candidatas',
})

export const ESQUEMA = Object.freeze({
  SEMANAL: 'semanal',
  MENSUAL: 'mensual',
})

export const AGENTE = Object.freeze({
  UNGG: 'UNGG',
  UNGC: 'UNGC',
})

const ESTADO_CHIP = {
  [ESTADO.FIRME]: { label: 'firme', bg: '#ECFDF5', color: '#059669',
    title: 'XM ya publicó el monto' },
  [ESTADO.ESTIMADO]: { label: 'estimado', bg: 'rgba(145,91,216,0.10)', color: '#915BD8',
    title: 'La ventana base ya cerró: solo falta que XM liquide días ya ocurridos' },
  [ESTADO.PRELIMINAR]: { label: 'preliminar', bg: '#F3F4F6', color: '#6b7280',
    title: 'La ventana base sigue abierta: incluye días futuros' },
}

const PROCEDENCIA_CHIP = {
  [PROCEDENCIA.OBSERVADA]: { label: 'observada', bg: '#ECFDF5', color: '#059669',
    title: 'Ventana tomada de la hoja PERIODO BASE o del nombre del CGM' },
  [PROCEDENCIA.DERIVADA]: { label: 'derivada', bg: 'rgba(145,91,216,0.10)', color: '#915BD8',
    title: 'Ventana derivada de la regla general (cierra en 14, cálculo en 7)' },
  [PROCEDENCIA.CANDIDATAS]: { label: 'candidatas', bg: '#FEF3C7', color: '#92400E',
    title: 'Ventana no derivable: se calculó sobre todas las candidatas y la dispersión ensancha el intervalo' },
}

const CHIP_DESCONOCIDO = { label: '—', bg: '#F3F4F6', color: '#6b7280', title: '' }

export function chipEstado(estado) {
  return ESTADO_CHIP[estado] || CHIP_DESCONOCIDO
}

export function chipProcedencia(procedencia) {
  return PROCEDENCIA_CHIP[procedencia] || CHIP_DESCONOCIDO
}

const FUENTE_ANCHO = {
  ventana_candidata: { label: 'Ventana candidata', color: '#F59E0B' },
  liquidacion: { label: 'Liquidación', color: '#915BD8' },
  dias_sin_liquidar: { label: 'Días sin liquidar', color: '#60A5FA' },
  precio_proyectado: { label: 'Precio proyectado', color: '#EC4899' },
}

export function fuenteAncho(clave) {
  return FUENTE_ANCHO[clave] || { label: clave, color: '#9CA3AF' }
}

/** true cuando el dato de generación está más viejo que el umbral y compromete el margen. */
export function generacionAtrasada(frescura) {
  if (!frescura) return false
  return Number(frescura.dias_atraso) > Number(frescura.umbral_dias)
}

/** Versión de liquidación distinta de tx2 = insumo contaminado (riesgo 13 del spec). */
export function insumoContaminado(insumo) {
  return !!insumo && insumo.version !== 'tx2'
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** '2026-09' -> 'Septiembre 2026'. Devuelve el crudo si no matchea. */
export function nombreMes(periodo) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodo || ''))
  if (!m) return String(periodo ?? '—')
  const nombre = MESES[Number(m[2]) - 1]
  if (!nombre) return String(periodo)
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${m[1]}`
}

/** '2026-08-28' -> '28 ago'. Sin Date: evita corrimientos por zona horaria. */
export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return '—'
  const abrev = MESES[Number(m[2]) - 1]
  if (!abrev) return String(iso)
  return `${m[3]} ${abrev.slice(0, 3)}`
}

/** '2026-08-01' + '2026-08-07' -> '01–07 ago'; cruza mes -> '25 jul – 07 ago'. */
export function rangoCorto(ini, fin) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ini || ''))
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fin || ''))
  if (!a || !b) return '—'
  if (a[1] === b[1] && a[2] === b[2]) {
    return `${a[3]}–${b[3]} ${MESES[Number(a[2]) - 1].slice(0, 3)}`
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
export function mensajeError(e, fallback) {
  const status = e?.status
  const detail = e?.data?.detail
  const detalleValido = typeof status === 'number' && status >= 400 && status < 500
    && typeof detail === 'string' && detail.trim() !== '' && !DETALLE_GENERICO.has(detail.trim())
  return detalleValido ? detail : fallback
}
