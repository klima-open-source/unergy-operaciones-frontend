/**
 * El Resumen del Reporte de Energía: qué fronteras reportaron automático (CGM)
 * en un período, y con qué fuente se reportó lo que no.
 *
 * Lo que vive acá es lo que el backend NO decide: qué rango pedir para cada
 * período, cómo se muestra cada fila y cada día, los filtros de la tabla y la
 * franja de distribución. Qué días cuentan, la tasa, la fuente dominante y los
 * KPIs de Semana/Mes los calcula `resumen_ventana` en el backend, y acá no se
 * recalculan.
 *
 * Funciones puras, fuera del `.vue`, para poder probarlas sin montar nada.
 */
import {
  CambioPeriodo,
  GrupoFuenteReporte,
  TipoFronteraReporte,
  type FilaResumenVentana,
} from '~/features/fronteras/types'

export enum Periodo {
  DIA = 'dia',
  SEMANA = 'semana',
  MES = 'mes',
}

/** Cómo se ve una frontera en un día: la leyenda de la maqueta, más la fuente manual. */
export enum CategoriaDia {
  AUTOMATICO = 'automatico',
  NO_AUTOMATICO = 'no_automatico',
  EXCLUIDO = 'excluido',
  /** La frontera dejó de aparecer en el reporte (`nunca_clasificado`). */
  SIN_DATO = 'sin_dato',
}

export enum FiltroTipo {
  TODOS = 'todos',
  GENERACION = 'generacion',
  CONSUMO = 'consumo',
}

export enum FiltroAutomatico {
  TODOS = 'todos',
  AUTOMATICO = 'automatico',
  NO_AUTOMATICO = 'no_automatico',
}

export const ETIQUETA_TIPO: Record<TipoFronteraReporte, string> = {
  [TipoFronteraReporte.GENERACION]: 'Generación',
  [TipoFronteraReporte.CONSUMO]: 'Consumo',
}

/** Las tarjetas KPI que filtran la tabla al hacerles clic. */
export enum FiltroKpi {
  SIEMPRE = 'siempre',
  NUNCA = 'nunca',
  MEJORARON = 'mejoraron',
  EMPEORARON = 'empeoraron',
}

export const COLOR_CATEGORIA: Record<CategoriaDia, string> = {
  [CategoriaDia.AUTOMATICO]: '#2B6C93',
  [CategoriaDia.NO_AUTOMATICO]: '#B4571F',
  [CategoriaDia.EXCLUIDO]: '#C7C2B4',
  [CategoriaDia.SIN_DATO]: '#B7B2A4',
}

export const ETIQUETA_CATEGORIA: Record<CategoriaDia, string> = {
  [CategoriaDia.AUTOMATICO]: 'Automático',
  [CategoriaDia.NO_AUTOMATICO]: 'No automático',
  [CategoriaDia.EXCLUIDO]: 'Excluido',
  [CategoriaDia.SIN_DATO]: 'Sin dato',
}

/**
 * El color de cada fuente manual. Los cuatro de la maqueta (medidor, terceros,
 * estimación) más los que la maqueta no muestra, con el tono que ya tenían en
 * los gráficos viejos.
 */
export const COLOR_FUENTE: Record<GrupoFuenteReporte, string> = {
  [GrupoFuenteReporte.CGM]: '#2B6C93',
  [GrupoFuenteReporte.MEDIDOR]: '#6B93AA',
  [GrupoFuenteReporte.INVERSOR]: '#6B8FD6',
  [GrupoFuenteReporte.TERCEROS]: '#4F8F72',
  [GrupoFuenteReporte.ESTIMACION]: '#C98A3E',
  [GrupoFuenteReporte.APAGADO]: '#8A94A6',
  [GrupoFuenteReporte.SIN_FUENTE]: '#C97086',
  [GrupoFuenteReporte.OTRO]: '#52596B',
}

/** De mayor a menor respaldo del dato: desempata la distribución, como en el backend. */
const ORDEN_FUENTE: GrupoFuenteReporte[] = [
  GrupoFuenteReporte.CGM,
  GrupoFuenteReporte.MEDIDOR,
  GrupoFuenteReporte.INVERSOR,
  GrupoFuenteReporte.TERCEROS,
  GrupoFuenteReporte.ESTIMACION,
  GrupoFuenteReporte.APAGADO,
  GrupoFuenteReporte.SIN_FUENTE,
  GrupoFuenteReporte.OTRO,
]

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

// ── Fechas ─────────────────────────────────────────────────────────────────
// Todo en `YYYY-MM-DD` y con aritmética en UTC: un `Date` local correría el día
// según la zona del navegador.

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}

function aISO(y: number, mesBase0: number, d: number): string {
  return new Date(Date.UTC(y, mesBase0, d)).toISOString().slice(0, 10)
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = partes(iso)
  return aISO(y, m - 1, d + dias)
}

/** Cuántos días van de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = partes(desde)
  const [y2, m2, d2] = partes(hasta)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export interface Ventana {
  desde: string
  hasta: string
  /** Cada día de `[desde, hasta]`, en orden. */
  fechas: string[]
}

function fechasEntre(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) fechas.push(f)
  return fechas
}

/**
 * El rango que se le pide al backend.
 *
 * `referencia` es el día más reciente que puede tener reporte (ayer: el
 * reporte siempre es del día anterior). `offset` 0 es el período que lo
 * contiene, -1 el anterior, y así.
 *
 * - Día: ese día.
 * - Semana: los 7 días que terminan en la referencia (no una semana de
 *   calendario), corridos de a 7.
 * - Mes: el mes de calendario; el actual, solo hasta la referencia.
 */
export function ventana(periodo: Periodo, offset: number, referencia: string): Ventana {
  if (periodo === Periodo.DIA) {
    const dia = sumarDias(referencia, offset)
    return { desde: dia, hasta: dia, fechas: [dia] }
  }
  if (periodo === Periodo.SEMANA) {
    const hasta = sumarDias(referencia, offset * 7)
    const desde = sumarDias(hasta, -6)
    return { desde, hasta, fechas: fechasEntre(desde, hasta) }
  }
  const [y, m] = partes(referencia)
  const desde = aISO(y, m - 1 + offset, 1)
  const ultimo = aISO(y, m + offset, 0)
  const hasta = offset === 0 ? referencia : ultimo
  return { desde, hasta, fechas: fechasEntre(desde, hasta) }
}

/** `28 sep` */
export function fechaCorta(iso: string): string {
  const [, m, d] = partes(iso)
  return `${d} ${MESES[m - 1]!.slice(0, 3)}`
}

export function etiquetaVentana(periodo: Periodo, v: Ventana): string {
  const [y, m, d] = partes(v.hasta)
  if (periodo === Periodo.DIA) return `${d} de ${MESES[m - 1]} de ${y}`
  if (periodo === Periodo.SEMANA) return `${fechaCorta(v.desde)} – ${fechaCorta(v.hasta)}, ${y}`
  const mes = MESES[m - 1]!
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${y}`
}

/** `5, 6 sep y 1 oct`: los días agrupados por mes. */
export function formatearExcluidos(fechas: string[]): string {
  const grupos: { mes: string; dias: number[] }[] = []
  for (const iso of [...fechas].sort()) {
    const [, m, d] = partes(iso)
    const mes = MESES[m - 1]!.slice(0, 3)
    const ultimo = grupos.at(-1)
    if (ultimo?.mes === mes) ultimo.dias.push(d)
    else grupos.push({ mes, dias: [d] })
  }
  return grupos.map((g) => `${g.dias.join(', ')} ${g.mes}`).join(' y ')
}

// ── Filas ──────────────────────────────────────────────────────────────────

export interface DiaVista {
  fecha: string
  categoria: CategoriaDia
  /** "Automático", "Excluido", "Sin dato", o la fuente manual de ese día. */
  texto: string
  color: string
  grupo: GrupoFuenteReporte | null
}

export interface FilaVista {
  clave: string
  fila: FilaResumenVentana
  /** Cómo se resume la fila en una sola etiqueta: la de Día, y la de una fila sin tasa. */
  categoria: CategoriaDia
  /** Semana/Mes con días que cuentan: se muestra la barra de %, no una etiqueta. */
  conTasa: boolean
  dias: DiaVista[]
  esAutomatico: boolean
  esSiempreAutomatico: boolean
  esNuncaAutomatico: boolean
}

function diaVista(dia: FilaResumenVentana['dias'][number]): DiaVista {
  if (dia.excluido) {
    return {
      fecha: dia.fecha,
      categoria: CategoriaDia.EXCLUIDO,
      texto: ETIQUETA_CATEGORIA[CategoriaDia.EXCLUIDO],
      color: COLOR_CATEGORIA[CategoriaDia.EXCLUIDO],
      grupo: null,
    }
  }
  if (dia.automatico) {
    return {
      fecha: dia.fecha,
      categoria: CategoriaDia.AUTOMATICO,
      texto: ETIQUETA_CATEGORIA[CategoriaDia.AUTOMATICO],
      color: COLOR_CATEGORIA[CategoriaDia.AUTOMATICO],
      grupo: null,
    }
  }
  return {
    fecha: dia.fecha,
    categoria: CategoriaDia.NO_AUTOMATICO,
    texto: dia.etiqueta_fuente ?? 'Otro',
    color: COLOR_CATEGORIA[CategoriaDia.NO_AUTOMATICO],
    grupo: dia.grupo_fuente,
  }
}

function diaSinDato(fecha: string): DiaVista {
  return {
    fecha,
    categoria: CategoriaDia.SIN_DATO,
    texto: ETIQUETA_CATEGORIA[CategoriaDia.SIN_DATO],
    color: COLOR_CATEGORIA[CategoriaDia.SIN_DATO],
    grupo: null,
  }
}

/**
 * `fechas` son las del período: una frontera que dejó de aparecer no trae
 * días propios, y se muestra "Sin dato" en cada uno.
 */
export function filaVista(fila: FilaResumenVentana, periodo: Periodo, fechas: string[]): FilaVista {
  const total = fila.dias_automaticos + fila.dias_no_automaticos
  let categoria: CategoriaDia
  if (fila.nunca_clasificado) categoria = CategoriaDia.SIN_DATO
  else if (total === 0) categoria = CategoriaDia.EXCLUIDO
  else if (fila.dias_no_automaticos === 0) categoria = CategoriaDia.AUTOMATICO
  else categoria = CategoriaDia.NO_AUTOMATICO

  return {
    clave: `${fila.frontera_id}-${fila.tipo}`,
    fila,
    categoria,
    conTasa: periodo !== Periodo.DIA && total > 0,
    dias: fila.nunca_clasificado ? fechas.map(diaSinDato) : fila.dias.map(diaVista),
    esAutomatico: categoria === CategoriaDia.AUTOMATICO,
    // Las mismas dos reglas con las que el backend cuenta las tarjetas.
    esSiempreAutomatico: total > 0 && fila.tasa === 100,
    esNuncaAutomatico: fila.nunca_clasificado || (total > 0 && fila.tasa === 0),
  }
}

const ORDEN_DIA: Record<CategoriaDia, number> = {
  [CategoriaDia.SIN_DATO]: 0,
  [CategoriaDia.NO_AUTOMATICO]: 1,
  [CategoriaDia.EXCLUIDO]: 2,
  [CategoriaDia.AUTOMATICO]: 3,
}

/**
 * En Día el orden del backend (por tasa) no sirve: todas son 0 % o 100 %, y un
 * día excluido empata con uno no automático. Primero lo que hay que mirar.
 */
export function ordenarDia(filas: FilaVista[]): FilaVista[] {
  return [...filas].sort((a, b) => ORDEN_DIA[a.categoria] - ORDEN_DIA[b.categoria])
}

/** Azul pleno desde 85 %, azul apagado desde 50 %, naranja por debajo. */
export function colorTasa(tasa: number): string {
  if (tasa >= 85) return '#2B6C93'
  if (tasa >= 50) return '#4E7E97'
  return '#B4571F'
}

export interface Filtros {
  busqueda: string
  tipo: FiltroTipo
  automatico: FiltroAutomatico
  kpi: FiltroKpi | null
}

function coincideBusqueda(f: FilaVista, q: string): boolean {
  return `${f.fila.nombre_proyecto} ${f.fila.codigo_frontera ?? ''}`.toLowerCase().includes(q)
}

function coincideTipo(f: FilaVista, tipo: FiltroTipo): boolean {
  if (tipo === FiltroTipo.GENERACION) return f.fila.tipo === TipoFronteraReporte.GENERACION
  if (tipo === FiltroTipo.CONSUMO) return f.fila.tipo === TipoFronteraReporte.CONSUMO
  return true
}

export function aplicarFiltros(filas: FilaVista[], filtros: Filtros): FilaVista[] {
  const q = filtros.busqueda.trim().toLowerCase()
  return filas.filter((f) => {
    if (!coincideTipo(f, filtros.tipo)) return false
    if (filtros.automatico === FiltroAutomatico.AUTOMATICO && !f.esAutomatico) return false
    if (filtros.automatico === FiltroAutomatico.NO_AUTOMATICO && f.esAutomatico) return false
    if (filtros.kpi === FiltroKpi.SIEMPRE && !f.esSiempreAutomatico) return false
    if (filtros.kpi === FiltroKpi.NUNCA && !f.esNuncaAutomatico) return false
    if (filtros.kpi === FiltroKpi.MEJORARON && f.fila.cambio !== CambioPeriodo.MEJORO) return false
    if (filtros.kpi === FiltroKpi.EMPEORARON && f.fila.cambio !== CambioPeriodo.EMPEORO)
      return false
    return !q || coincideBusqueda(f, q)
  })
}

// ── Distribución de fuente ─────────────────────────────────────────────────

export interface GrupoDistribucion {
  clave: string
  etiqueta: string
  color: string
  dias: number
  pct: number
}

function posicion(clave: string): number {
  if (clave === CategoriaDia.AUTOMATICO) return -1
  const i = ORDEN_FUENTE.indexOf(clave as GrupoFuenteReporte)
  if (i >= 0) return i
  return clave === CategoriaDia.SIN_DATO ? ORDEN_FUENTE.length : ORDEN_FUENTE.length + 1
}

/**
 * La franja de cierre: los días-frontera por fuente, de mayor a menor. Es la
 * pregunta que respondían los tres gráficos viejos, ahora en una sola barra.
 *
 * Respeta el tipo y la búsqueda pero NO el filtro Automático/No automático:
 * con él puesto la franja sería siempre 100 % de un solo grupo.
 */
export function distribucion(
  filas: FilaVista[],
  filtros: Pick<Filtros, 'busqueda' | 'tipo'>,
): GrupoDistribucion[] {
  const q = filtros.busqueda.trim().toLowerCase()
  const conteo = new Map<string, { etiqueta: string; color: string; dias: number }>()
  for (const f of filas) {
    if (!coincideTipo(f, filtros.tipo) || (q && !coincideBusqueda(f, q))) continue
    for (const d of f.dias) {
      const clave = d.grupo ?? d.categoria
      const color = d.grupo ? COLOR_FUENTE[d.grupo] : COLOR_CATEGORIA[d.categoria]
      const actual = conteo.get(clave) ?? { etiqueta: d.texto, color, dias: 0 }
      actual.dias += 1
      conteo.set(clave, actual)
    }
  }
  const total = [...conteo.values()].reduce((s, g) => s + g.dias, 0)
  return [...conteo.entries()]
    .map(([clave, g]) => ({ clave, ...g, pct: total ? Math.round((g.dias / total) * 100) : 0 }))
    .sort((a, b) => b.dias - a.dias || posicion(a.clave) - posicion(b.clave))
}
