import { FilePenIcon, MailIcon, MessageSquareIcon, PhoneIcon, UsersIcon } from '@lucide/vue'
/**
 * Vocabulario y derivaciones del CRM comercial.
 *
 * Existe porque las constantes del pipeline estaban copiadas en tres componentes
 * (la vista principal, el detalle del cliente y el panel de ofertas) y ya habían
 * divergido: el dropdown de "Tipo de servicio" mandaba valores que el backend
 * rechaza con 422, y el selector de etapa al crear una oferta se descartaba antes
 * de enviarse. Una sola fuente evita que vuelva a pasar.
 *
 * Todo acá es puro: se prueba con `node src/views/Comercial/comercial.test.mjs`.
 */

// ── Etapas del pipeline (EstadoComercialEnum del backend) ────────────────────
// El orden es el del avance del negocio y define el orden de las columnas.
export const ETAPAS = [
  { value: 'oportunidad', label: 'Oportunidad', severidad: 'information', color: '#3B82F6' },
  { value: 'oferta', label: 'Oferta', severidad: 'warning', color: '#F59E0B' },
  { value: 'contrato', label: 'Contrato', severidad: 'default', color: '#8B5CF6' },
  { value: 'firmado', label: 'Firmado', severidad: 'default', color: '#14B8A6' },
  { value: 'operando', label: 'Operando', severidad: 'success', color: '#2e7d32' },
  { value: 'terminado', label: 'Terminado', severidad: 'default', color: '#7a6e8a' },
  { value: 'declinado', label: 'Declinado', severidad: 'destructive', color: '#D64455' },
]

// Etapas que siguen abiertas: son las que cuentan como negocio vivo.
export const ETAPAS_ABIERTAS = ['oportunidad', 'oferta', 'contrato', 'firmado', 'operando']

/**
 * Columnas del tablero. `terminado` y `declinado` se agrupan en una sola columna
 * "Cerradas": eran dos columnas de 1/7 de ancho, ilegibles, y casi siempre vacías.
 *
 * Soltar una tarjeta en Cerradas significa DECLINADO y no terminado a propósito:
 * `terminado` no se mueve a mano — lo pone el job diario cuando pasa la fecha_fin
 * del PPA (ver cerrar_contratos_vencidos en el backend).
 */
export const COLUMNAS = [
  { value: 'oportunidad', label: 'Oportunidad', estados: ['oportunidad'] },
  { value: 'oferta', label: 'Oferta', estados: ['oferta'] },
  { value: 'contrato', label: 'Contrato', estados: ['contrato'] },
  { value: 'firmado', label: 'Firmado', estados: ['firmado'] },
  { value: 'operando', label: 'Operando', estados: ['operando'] },
  { value: 'cerradas', label: 'Cerradas', estados: ['terminado', 'declinado'], alSoltar: 'declinado' },
]

// ── Tipos de oferta (TipoOfertaComercialEnum) ────────────────────────────────
// Estos son los valores REALES que acepta el backend.
export const TIPOS_OFERTA = [
  { value: 'servicios_operacionales', label: 'Servicios operacionales', segmento: 'REP' },
  { value: 'compra_energia', label: 'Compra de energía', segmento: 'COM' },
  { value: 'comunidad_energetica', label: 'Comunidad energética', segmento: 'CEN' },
]

// Solo las ofertas de energía derivan en un PPA; las de servicios usan el
// contrato de representación (el backend responde 422 si se le pide firmar una).
export const TIPOS_ENERGIA = ['compra_energia', 'comunidad_energetica']

export const RESULTADOS = [
  { value: 'pendiente', label: 'Pendiente', severidad: 'warning' },
  { value: 'aceptado', label: 'Aceptado', severidad: 'success' },
  { value: 'declinado', label: 'Declinado', severidad: 'destructive' },
]

export const TIPOS_GESTION = [
  { value: 'llamada', label: 'Llamada', icono: PhoneIcon },
  { value: 'correo', label: 'Correo', icono: MailIcon },
  { value: 'reunion', label: 'Reunión', icono: UsersIcon },
  { value: 'whatsapp', label: 'WhatsApp', icono: MessageSquareIcon },
  { value: 'nota', label: 'Nota', icono: FilePenIcon },
]

export const ORIGENES_CLIENTE = [
  { value: 'prospeccion_propia', label: 'Prospección propia' },
  { value: 'recomendacion', label: 'Recomendación' },
  { value: 'referido', label: 'Referido' },
  { value: 'otro', label: 'Otro' },
]

// De dónde salió cada dato de la ficha operativa (`ficha.fuentes` del backend).
// Se muestra al lado del valor porque un null y un "todavía no lo sabemos" se
// ven igual, y en una herramienta comercial eso lleva a decisiones sobre datos
// inventados.
export const FUENTES = {
  proyecto: { label: 'del proyecto', clase: 'bg-purple-50 text-purple-700' },
  oferta: { label: 'declarado en la oferta', clase: 'bg-amber-50 text-amber-700' },
  contrato: { label: 'del contrato', clase: 'bg-teal-50 text-teal-700' },
  estimada: { label: 'estimada', clase: 'bg-gray-100 text-gray-600' },
  generacion: { label: 'medida', clase: 'bg-green-50 text-green-700' },
}

// ── Etiquetas ────────────────────────────────────────────────────────────────
const buscar = (lista, v) => lista.find((x) => x.value === v)

export function labelEtapa(v) { return buscar(ETAPAS, v)?.label ?? v ?? '—' }
export function severidadEtapa(v) { return buscar(ETAPAS, v)?.severidad ?? 'information' }
export function colorEtapa(v) { return buscar(ETAPAS, v)?.color ?? '#7a6e8a' }
export function labelTipo(v) { return buscar(TIPOS_OFERTA, v)?.label ?? v ?? '—' }
export function segmentoTipo(v) { return buscar(TIPOS_OFERTA, v)?.segmento ?? '—' }
export function labelResultado(v) { return buscar(RESULTADOS, v)?.label ?? v ?? '—' }
export function severidadResultado(v) { return buscar(RESULTADOS, v)?.severidad ?? 'default' }
export function labelGestion(v) { return buscar(TIPOS_GESTION, v)?.label ?? v ?? '—' }

export function puedeFirmarPPA(oferta) {
  return !!oferta && TIPOS_ENERGIA.includes(oferta.tipo) && !oferta.ppa_contrato_id
}

// ── Precio de la oferta ──────────────────────────────────────────────────────
/**
 * Qué es «el precio» depende del tipo de oferta, y el formulario mostraba lo
 * mismo para los tres: la etiqueta «Precio» con el ejemplo «REP: 6 · CGM: 6»
 * —que son las COMISIONES en % de los servicios de representación y de CGM—.
 *
 * En una compra de energía no hay comisión: lo que se pacta es la tarifa de la
 * energía en $/kWh. Quien registraba una compra veía un campo pidiéndole
 * porcentajes de un servicio que esa oferta no incluye, y escribía ahí la
 * tarifa o lo dejaba vacío. Lo mismo vale para comunidad energética, que
 * también desemboca en un PPA.
 */
export function etiquetaPrecio(tipo) {
  return TIPOS_ENERGIA.includes(tipo) ? 'Tarifa de energía ($/kWh)' : 'Comisión del servicio (%)'
}

export function placeholderPrecio(tipo) {
  return TIPOS_ENERGIA.includes(tipo) ? 'p. ej. 320' : 'p. ej. REP: 6 · CGM: 6'
}

export function ayudaPrecio(tipo) {
  if (!tipo) return null
  return TIPOS_ENERGIA.includes(tipo)
    ? 'Tarifa tentativa de la oferta. La pactada se carga al firmar y vive en el contrato, que es de donde la leen Cumplimiento y Liquidaciones.'
    : 'Comisión sobre lo facturado. Las de representación y CGM se anotan juntas: «REP: 6 · CGM: 6».'
}

// ── Fechas ───────────────────────────────────────────────────────────────────
// Las fechas del API llegan como 'YYYY-MM-DD' (date) o ISO con hora (datetime).
// Se normaliza a medianoche local para que no se corran un día por la zona.
export function aFecha(v) {
  if (!v) return null
  if (v instanceof Date) return v
  const s = String(v)
  return s.length <= 10 ? new Date(`${s}T00:00:00`) : new Date(s)
}

export function aFechaStr(v) {
  if (!v) return null
  if (typeof v === 'string') return v.slice(0, 10)
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtFecha(v) {
  const d = aFecha(v)
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('es-CO', { dateStyle: 'medium' })
    : '—'
}

export function diasDesde(v, hoy = Date.now()) {
  const d = aFecha(v)
  if (!d || Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((hoy - d.getTime()) / 86400000))
}

// Sin fecha registrada, el mes y el año viven dentro del propio código
// (OP.COM No.0103-6-2026). Se muestra como aproximado y NO se guarda: una fecha
// exacta inventada es peor que ninguna en una herramienta comercial.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function mesDelCodigo(oferta) {
  const codigo = oferta?.codigo_seguimiento || oferta?.numero_oferta || ''
  const m = /No\.?\s*\d{1,4}\s*-\s*(\d{1,2})\s*-\s*(\d{4})/.exec(codigo)
  const mes = m && MESES[Number(m[1]) - 1]
  return mes ? `${mes} ${m[2]}` : null
}

// Se envió y el cliente nunca contestó: es la señal fuerte del tablero.
export function sinRespuesta(oferta) {
  return !!oferta?.fecha_oferta && !oferta?.fecha_ultima_respuesta
}

// Cuatro toques sin una sola respuesta: el negocio se enfrió.
export function alarmante(oferta) {
  return (oferta?.seguimientos || 0) >= 4 && !oferta?.fecha_ultima_respuesta
}

// ── Energía ──────────────────────────────────────────────────────────────────
// El CRM habla en kWh/mes (como cantidad_minima_kwh_mes) pero los totales se
// leen mejor en MWh/mes.
export function mwhMes(oferta) {
  const kwh = oferta?.ficha?.energia_promedio_kwh_mes
  return typeof kwh === 'number' && Number.isFinite(kwh) ? kwh / 1000 : 0
}

export function fmtMwh(valor) {
  if (!valor) return '—'
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: valor < 10 ? 1 : 0 })} MWh/mes`
}

// ── Derivaciones del tablero ─────────────────────────────────────────────────
/**
 * La banda de indicadores, derivada de las ofertas que ya están en memoria: no
 * hace falta un endpoint de KPIs para tener el pulso del mes.
 */
export function kpis(ofertas) {
  const abiertas = (ofertas || []).filter((o) => ETAPAS_ABIERTAS.includes(o.estado))
  return {
    activas: abiertas.length,
    total: (ofertas || []).length,
    energiaMwhMes: abiertas.reduce((a, o) => a + mwhMes(o), 0),
    alertas: (ofertas || []).filter((o) => o.alerta).length,
    sinRespuesta: (ofertas || []).filter((o) => ETAPAS_ABIERTAS.includes(o.estado) && sinRespuesta(o)).length,
  }
}

export function resumenColumna(ofertas) {
  return {
    n: (ofertas || []).length,
    energiaMwhMes: (ofertas || []).reduce((a, o) => a + mwhMes(o), 0),
    alertas: (ofertas || []).filter((o) => o.alerta).length,
  }
}

export function agruparPorColumna(ofertas) {
  const out = {}
  for (const col of COLUMNAS) out[col.value] = []
  for (const o of ofertas || []) {
    const col = COLUMNAS.find((c) => c.estados.includes(o.estado))
    if (col) out[col.value].push(o)
    // Una etapa desconocida (un enum nuevo en el backend) NO se descarta en
    // silencio: cae en la primera columna, donde alguien la va a ver.
    else out[COLUMNAS[0].value].push(o)
  }
  return out
}

export function filtrar(ofertas, f = {}) {
  const q = (f.texto || '').trim().toLowerCase()
  return (ofertas || []).filter((o) => {
    if (q) {
      const heno = [o.codigo_seguimiento, o.numero_oferta, o.cliente_razon_social,
        o.planta_nombre, o.oportunidad_nombre, o.ficha?.municipio]
        .filter(Boolean).join(' ').toLowerCase()
      if (!heno.includes(q)) return false
    }
    if (f.tipos?.length && !f.tipos.includes(o.tipo)) return false
    if (f.etapas?.length && !f.etapas.includes(o.estado)) return false
    if (f.resultado && o.resultado !== f.resultado) return false
    if (f.clientes?.length && !f.clientes.includes(o.cliente_id)) return false
    if (f.soloAlerta && !o.alerta) return false
    if (f.soloSinRespuesta && !sinRespuesta(o)) return false
    return true
  })
}

export function ordenar(ofertas, criterio = 'reciente') {
  const ts = (v) => (v ? new Date(v).getTime() : 0)
  const copia = [...(ofertas || [])]
  const comparadores = {
    reciente: (a, b) => ts(b.updated_at) - ts(a.updated_at),
    antiguo: (a, b) => ts(a.updated_at) - ts(b.updated_at),
    // Lo más rezagado primero: es el orden con el que se trabaja la lista.
    rezagadas: (a, b) => (b.dias_sin_respuesta || 0) - (a.dias_sin_respuesta || 0),
    energia: (a, b) => mwhMes(b) - mwhMes(a),
    cliente: (a, b) => (a.cliente_razon_social || '').localeCompare(b.cliente_razon_social || '', 'es'),
  }
  return copia.sort(comparadores[criterio] || comparadores.reciente)
}

// ── Firmar: validación espejo del schema del backend ─────────────────────────
/**
 * Las mismas reglas que FirmarOfertaIn, para que el comercial se entere antes
 * del 422 y no después. Devuelve la lista de problemas (vacía = se puede firmar).
 */
export function validarFirma(form) {
  const errores = []
  const inicio = aFechaStr(form?.fecha_inicio)
  const fin = aFechaStr(form?.fecha_fin)
  if (!inicio) errores.push('Falta la fecha de inicio del suministro.')
  if (!fin) errores.push('Falta la fecha de fin del suministro.')
  if (inicio && fin && fin < inicio) errores.push('La fecha de fin es anterior a la de inicio.')

  const filas = (form?.precios_anuales || []).filter((p) => p.anio && p.precio > 0)
  if (form?.modo_precio === 'tabla') {
    if (!filas.length) errores.push('La tabla de precios está vacía.')
    const anios = filas.map((p) => p.anio)
    if (new Set(anios).size !== anios.length) errores.push('La tabla de precios tiene años repetidos.')
  } else if (!(form?.tarifa_base > 0)) {
    errores.push('Falta la tarifa ($/kWh).')
  }

  if (form?.periodo_indexacion_base && !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.periodo_indexacion_base)) {
    errores.push('El mes base de indexación debe ser YYYY-MM (por ejemplo 2025-10).')
  }
  return errores
}

/**
 * Cuántas filas mensuales de `ppa_tarifas` va a generar la tabla anual. Es el
 * mismo recorte al periodo que hace el backend (_tarifas_mensuales): un contrato
 * que arranca en octubre no tiene tarifa de enero a septiembre de ese año.
 */
export function tarifasMensualesQueGenera(form) {
  const inicio = aFecha(form?.fecha_inicio)
  const fin = aFecha(form?.fecha_fin)
  if (!inicio || !fin || form?.modo_precio !== 'tabla') return 0
  let n = 0
  for (const p of form.precios_anuales || []) {
    if (!p.anio || !(p.precio > 0)) continue
    if (p.anio < inicio.getFullYear() || p.anio > fin.getFullYear()) continue
    const desde = p.anio === inicio.getFullYear() ? inicio.getMonth() + 1 : 1
    const hasta = p.anio === fin.getFullYear() ? fin.getMonth() + 1 : 12
    n += Math.max(0, hasta - desde + 1)
  }
  return n
}

// Los años que debería tener la tabla de precios para cubrir el periodo.
export function aniosDelPeriodo(fechaInicio, fechaFin) {
  const inicio = aFecha(fechaInicio)
  const fin = aFecha(fechaFin)
  if (!inicio || !fin || fin < inicio) return []
  const out = []
  for (let a = inicio.getFullYear(); a <= fin.getFullYear(); a += 1) out.push(a)
  return out
}
