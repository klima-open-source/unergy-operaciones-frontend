/**
 * El rango de fechas que el calendario de fallas le pide al servidor.
 *
 * Se extrajo del componente para poder probar el borde que de verdad importa:
 * la conversión a texto. `toISOString()` pasa por UTC, y en Colombia (UTC-5)
 * devuelve el día ANTERIOR para cualquier hora local antes de las 19:00 -- un
 * calendario que pide el mes con esa fecha se deja por fuera el día 1 y arrastra
 * uno del mes pasado, sin que nada falle. Es la misma trampa que en el backend
 * cubre `hoy_col()`.
 */

/** `YYYY-MM-DD` de una fecha, leída en hora LOCAL y no en UTC. */
export function iso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Primer y último día del mes al que pertenece `mes`, inclusive.
 *
 * No cubre la grilla completa de seis semanas a propósito: las celdas de relleno
 * de los meses vecinos se dibujan con `eventos: []` fijo, así que pedir sus
 * fallas sería traer datos que no se muestran.
 */
export function rangoDelMes(mes: Date): { desde: string; hasta: string } {
  const año = mes.getFullYear()
  const m = mes.getMonth()
  // Día 0 del mes siguiente = último del actual, sin tablas de días por mes ni
  // casos especiales de febrero bisiesto.
  return { desde: iso(new Date(año, m, 1)), hasta: iso(new Date(año, m + 1, 0)) }
}
