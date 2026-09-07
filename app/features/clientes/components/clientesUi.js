// Lenguaje visual compartido entre la tabla de clientes y la pestaña Resumen del
// detalle. Mismo semáforo en ambos niveles para no re-aprender colores.
export const SERVICIO_LABELS = {
  representacion: 'Representación',
  cgm: 'CGM',
  ppa: 'PPA',
  rec: 'REC',
  mantenimiento: 'Mantenimiento',
  arriendo: 'Arriendo',
  internet: 'Internet',
}

export const SEMAFORO = {
  vigente:    { color: '#16a34a', bg: '#e8f5e9', label: 'Vigente' },
  por_vencer: { color: '#d97706', bg: '#FFFBEB', label: 'Por vencer' },
  vencido:    { color: '#dc2626', bg: '#FEF2F2', label: 'Vencido' },
}

export function servicioLabel(slug) {
  return SERVICIO_LABELS[slug] || slug
}

export function fmt(v) {
  return (v === null || v === undefined || v === '') ? '—' : v
}

export function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}
