/**
 * Parsers de los archivos Excel que arman el reporte semanal, TXR y mensual de
 * garantías (ola de fase 3 — solo se tipó, la lógica de cálculo no cambió).
 */
import * as XLSX from 'xlsx'

/** Una celda de Excel tal como la deja `sheet_to_json({ header: 1 })`. */
type CeldaExcel = string | number | boolean | Date | null | undefined
type FilaExcel = CeldaExcel[]

export interface FilaAjuste {
  label: string
  valor: number
}

export interface PreciosGarantia {
  pb: number | null
  restricciones: number | null
  stn: number | null
  trm: number | null
  ptb: number | null
}

export interface CustodiaGarantia {
  disponible: number
  congelado: number
  saldo: number
  transferencias: number
}

export interface ResultadoSemanales {
  ungc: FilaAjuste[]
  ungg: FilaAjuste[]
  custodia: CustodiaGarantia | null
  precios: Partial<PreciosGarantia>
  totalUNGC: number
  totalUNGG: number
  totalConsignar: number
  fechaNombre: string
  fecha: string | null
  errors: string[]
}

/**
 * La "hoja madre" mostrada en vivo (paso 2 del asistente semanal) y guardada
 * como snapshot del histórico — mismos datos de `ResultadoSemanales` más los
 * derivados de custodia/facturas que calcula `SemanalesTab`.
 */
export interface HojaMadre {
  fechaNombre?: string
  precios?: Partial<PreciosGarantia>
  ungc?: FilaAjuste[]
  ungg?: FilaAjuste[]
  totalUNGC?: number | null
  totalUNGG?: number | null
  totalConsignar?: number | null
  disponibleCrudo?: number | null
  facturasDescontadas?: number | null
  disponibleNeto?: number | null
  disponibleAplicacion?: number | null
  congelado?: number | null
  saldo?: number | null
  pb?: number | null
  variacionPb?: number | null
}

export type FilaTabla = Record<string, CeldaExcel>

export interface ResultadoTxr {
  rows: FilaTabla[]
  headers: string[]
  totalAjuste: number
  fechaVencimiento: string | null
  errors: string[]
}

export interface ResultadoMensual {
  rows: FilaTabla[]
  headers: string[]
  monto: number
  garantiaUNGC: number
  garantiaUNGG: number
  noConsigna: boolean
  fechaVencimiento: string | null
  mesReporte: string | null
  errors: string[]
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

const HEADER_ROW = 8
const DATA_START = 9

function sheetRows(ws: XLSX.WorkSheet | undefined): FilaExcel[] {
  if (!ws) return []
  return XLSX.utils.sheet_to_json<FilaExcel>(ws, { header: 1, defval: null })
}

function findSheetByPattern(wb: XLSX.WorkBook, pattern: RegExp): XLSX.WorkSheet | undefined {
  const name = wb.SheetNames.find((n) => pattern.test(n))
  return (name && wb.Sheets[name]) || wb.Sheets[wb.SheetNames[0]!]
}

// Normaliza acentos (compuestos o descompuestos) y mayúsculas para comparar nombres de hoja.
function normSheet(s: unknown): string {
  return String(s)
    .normalize('NFC')
    .toUpperCase()
    .replace(/[ÁÀÂÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .trim()
}

function findSheetByName(wb: XLSX.WorkBook, target: string): XLSX.WorkSheet | null {
  const t = normSheet(target)
  const found =
    wb.SheetNames.find((n) => normSheet(n) === t) ||
    wb.SheetNames.find((n) => normSheet(n).includes(t))
  return found ? (wb.Sheets[found] ?? null) : null
}

// Las celdas numéricas de Excel ya vienen como Number; null-safe.
function num(v: CeldaExcel): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

const MESES_ARCH: Record<string, string> = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dic: '12',
  jan: '01',
  apr: '04',
  aug: '08',
  dec: '12',
}

// Extrae la fecha REAL de la semana desde los nombres de archivo.
// Ej.: "GARANTIA SEMANAL MENSUAL 12JUN-2026" → 2026-06-12 ; "Saldo cuenta custodia 2026-06-10" → 2026-06-10.
// Devuelve ISO 'YYYY-MM-DD' o null si no encuentra fecha.
function parseFechaArchivo(...names: (string | undefined | null)[]): string | null {
  for (const name of names) {
    if (!name) continue
    const s = String(name)
    let m = s.match(/(\d{1,2})\s*([A-Za-z]{3,})[-_.\s]*(\d{4})/) // 12JUN-2026
    if (m) {
      const mes = MESES_ARCH[m[2]!.toLowerCase().slice(0, 3)]
      if (mes) return `${m[3]}-${mes}-${String(m[1]).padStart(2, '0')}`
    }
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/) // 2026-06-10
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) // 10/06/2026
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  return null
}

function parseGarantiaSheet(wb: XLSX.WorkBook): {
  adjColNames: string[]
  agents: Record<string, Record<string, number>>
  precios: Partial<PreciosGarantia>
} {
  const ws = findSheetByPattern(wb, /dep[oó]sito\s*sem/i)
  const rows = sheetRows(ws)
  const header = rows[HEADER_ROW] || []

  const adjColNames: string[] = []
  const adjCols: { idx: number; name: string }[] = []
  for (let c = 3; c < header.length; c++) {
    const name = String(header[c] ?? '').trim()
    if (name) {
      adjCols.push({ idx: c, name })
      adjColNames.push(name)
    }
  }

  const agents: Record<string, Record<string, number>> = {}
  let totalRowIdx = -1
  for (let i = DATA_START; i < rows.length; i++) {
    const row = rows[i]
    const c0 = String(row?.[0] ?? '').trim()
    if (c0.toUpperCase() === 'TOTAL') {
      totalRowIdx = i
      break
    }
    if (!row) continue
    if (c0 === 'UNGC' || c0 === 'UNGG') {
      const vals: Record<string, number> = {}
      for (const { idx, name } of adjCols) vals[name] = num(row[idx]) ?? 0
      agents[c0] = vals
    }
  }

  const precios: Partial<PreciosGarantia> = {
    pb: null,
    restricciones: null,
    stn: null,
    trm: null,
    ptb: null,
  }
  if (totalRowIdx !== -1) {
    for (let i = totalRowIdx; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const label = String(row[1] ?? '').trim()
      const val = num(row[2])
      if (/^PB$/i.test(label)) precios.pb = val
      else if (/^Restricciones$/i.test(label)) precios.restricciones = val
      else if (/^STN$/i.test(label)) precios.stn = val
      else if (/^TRM\s*del/i.test(label)) precios.trm = val
      else if (/^PTB$/i.test(label)) precios.ptb = val
    }
  }
  return { adjColNames, agents, precios }
}

function parseWebTie(wb: XLSX.WorkBook): Record<string, number> {
  // Hoja DEPÓSITO (verificado con archivo real): encabezados en fila 10, datos desde fila 11.
  // Código en columna 0, valor "Valor a Pagar de TIES" en columna 3.
  const ws = findSheetByName(wb, 'DEPÓSITO') || wb.Sheets[wb.SheetNames[0]!]
  const rows = sheetRows(ws)
  const tie: Record<string, number> = {}
  for (let i = 11; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const code = String(row[0] ?? '').trim()
    if (code === 'UNGC' || code === 'UNGG') tie[code] = num(row[3]) ?? 0
  }
  return tie
}

function parseCustodia(wb: XLSX.WorkBook): CustodiaGarantia | null {
  const ws = findSheetByName(wb, 'WebBalancePubrdl') || wb.Sheets[wb.SheetNames[0]!]
  const rows = sheetRows(ws)
  for (const row of rows) {
    if (!row) continue
    if (String(row[1] ?? '').trim() === '3050200006371') {
      return {
        disponible: num(row[9]) ?? 0,
        congelado: (num(row[3]) ?? 0) + (num(row[4]) ?? 0),
        saldo: num(row[2]) ?? 0,
        transferencias: num(row[7]) ?? 0,
      }
    }
  }
  return null
}

function buildBlock(
  adjColNames: string[],
  agentVals: Record<string, number> | undefined,
  tieVal: number | undefined,
): { rows: FilaAjuste[]; total: number } {
  const rows = adjColNames.map((name) => ({
    label: name,
    valor: agentVals ? (agentVals[name] ?? 0) : 0,
  }))
  rows.push({ label: 'TIE', valor: tieVal ?? 0 })
  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0)
  return { rows, total }
}

export async function parseSemanales(
  garantiaFile: File,
  saldoFile: File,
  webFile: File,
): Promise<ResultadoSemanales> {
  const errors: string[] = []
  let gWb: XLSX.WorkBook | undefined
  let sWb: XLSX.WorkBook | undefined
  let wWb: XLSX.WorkBook | undefined
  try {
    gWb = await readWorkbook(garantiaFile)
  } catch (e) {
    errors.push(`Error leyendo Garantía: ${(e as Error).message}`)
  }
  try {
    sWb = await readWorkbook(saldoFile)
  } catch (e) {
    errors.push(`Error leyendo Saldo: ${(e as Error).message}`)
  }
  try {
    wWb = await readWorkbook(webFile)
  } catch (e) {
    errors.push(`Error leyendo WEB: ${(e as Error).message}`)
  }

  if (!gWb) {
    return {
      ungc: [],
      ungg: [],
      custodia: null,
      precios: {},
      totalUNGC: 0,
      totalUNGG: 0,
      totalConsignar: 0,
      fechaNombre: '',
      fecha: null,
      errors,
    }
  }

  const { adjColNames, agents, precios } = parseGarantiaSheet(gWb)
  const tie = wWb ? parseWebTie(wWb) : {}
  if (!agents.UNGC) errors.push('No se encontró la fila UNGC en Garantía (se muestra en $0)')
  if (!agents.UNGG) errors.push('No se encontró la fila UNGG en Garantía')

  const blkUNGC = buildBlock(adjColNames, agents.UNGC, tie.UNGC)
  const blkUNGG = buildBlock(adjColNames, agents.UNGG, tie.UNGG)

  let custodia: CustodiaGarantia | null = null
  if (sWb) {
    custodia = parseCustodia(sWb)
    if (!custodia) errors.push('No se encontró la cuenta 3050200006371 en Saldo Cuenta Custodia')
  }

  const totalUNGC = blkUNGC.total
  const totalUNGG = blkUNGG.total
  const totalConsignar = totalUNGC + totalUNGG
  const fechaNombre = garantiaFile.name.replace(/\.[^.]+$/, '')
  const fecha = parseFechaArchivo(garantiaFile?.name, saldoFile?.name, webFile?.name)

  return {
    ungc: blkUNGC.rows,
    ungg: blkUNGG.rows,
    custodia,
    precios,
    totalUNGC,
    totalUNGG,
    totalConsignar,
    fechaNombre,
    fecha,
    errors,
  }
}

const MESES_TXR: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dic: 11,
}
const txt = (s: CeldaExcel): string =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
const isTotalAjuste = (s: CeldaExcel): boolean => /^total\s*ajuste$/i.test(txt(s))

interface HojaEncontrada {
  name: string
  headerRowIdx: number
  rows: FilaExcel[]
}

// Detecta la hoja de datos por contenido: la fila cuyo primer encabezado es CÓDIGO
// y que contiene una columna "Total Ajuste". Devuelve { name, headerRowIdx, rows }.
function findTxrSheet(wb: XLSX.WorkBook): HojaEncontrada | null {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<FilaExcel>(wb.Sheets[name]!, { header: 1, defval: null })
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const row = rows[i]
      if (!row) continue
      if (normSheet(row[0]) !== 'CODIGO') continue
      if (row.some((c) => isTotalAjuste(c))) return { name, headerRowIdx: i, rows }
    }
  }
  return null
}

// Busca "FECHA DE VENCIMIENTO: DD DE MMM DE YYYY" en cualquier celda del libro → ISO.
function findVencimiento(wb: XLSX.WorkBook): string | null {
  const re = /FECHA DE VENCIMIENTO:\s*(\d{1,2})\s+DE\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+DE\s+(\d{4})/i
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<FilaExcel>(wb.Sheets[name]!, { header: 1, defval: null })
    for (const row of rows) {
      if (!row) continue
      for (const cell of row) {
        const m = String(cell ?? '').match(re)
        if (!m) continue
        const mes = MESES_TXR[m[2]!.toLowerCase().slice(0, 3)]
        if (mes == null) continue
        const z = (n: number) => String(n).padStart(2, '0')
        return `${m[3]}-${z(mes + 1)}-${z(parseInt(m[1]!, 10))}`
      }
    }
  }
  return null
}

export async function parseTxr(file: File): Promise<ResultadoTxr> {
  const errors: string[] = []
  let wb: XLSX.WorkBook
  try {
    wb = await readWorkbook(file)
  } catch (e) {
    errors.push(`Error leyendo archivo TXR/Mensual: ${(e as Error).message}`)
    return { rows: [], headers: [], totalAjuste: 0, fechaVencimiento: null, errors }
  }

  const found = findTxrSheet(wb)
  if (!found) {
    errors.push(
      `No se encontró una hoja con encabezados esperados (CÓDIGO + "Total Ajuste"). Hojas en el archivo: ${wb.SheetNames.join(', ')}`,
    )
    return { rows: [], headers: [], totalAjuste: 0, fechaVencimiento: findVencimiento(wb), errors }
  }

  const { rows, headerRowIdx } = found
  const rawHeaders = (rows[headerRowIdx] || []).map((h) => txt(h))
  const codigoIdx = rawHeaders.findIndex((h) => normSheet(h) === 'CODIGO')
  const ajusteHeader = rawHeaders.find((h) => isTotalAjuste(h))

  // Filas UNGC / UNGG por columna CÓDIGO; mapear todas las columnas por nombre.
  const dataRows: FilaTabla[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const cod = normSheet(row[codigoIdx!])
    if (cod === 'UNGC' || cod === 'UNGG') {
      const obj: FilaTabla = {}
      rawHeaders.forEach((h, idx) => {
        if (h) obj[h] = row[idx] ?? null
      })
      dataRows.push(obj)
    }
  }

  if (!dataRows.length) errors.push('No se encontraron filas con código UNGC o UNGG')

  // Monto a consignar = Total Ajuste de UNGG.
  const ungg = dataRows.find((r) => normSheet(r[rawHeaders[codigoIdx!]!]) === 'UNGG')
  const totalRaw = ungg && ajusteHeader ? ungg[ajusteHeader] : null
  const totalAjuste =
    totalRaw != null && !isNaN(parseFloat(String(totalRaw))) ? parseFloat(String(totalRaw)) : 0

  return {
    rows: dataRows,
    headers: rawHeaders.filter(Boolean),
    totalAjuste,
    fechaVencimiento: findVencimiento(wb),
    errors,
  }
}

// ---------- Mensual (distinto al TXR) ----------

const empiezaGarantia = (s: CeldaExcel): boolean => /^garant[ií]a/i.test(txt(s))

// Hoja de detalle: CÓDIGO en col 0 + columna que empiece con GARANTIA. Entre varias
// candidatas (hay una hoja resumen con solo CÓDIGO+GARANTIA), usar la de más columnas.
function findMensualSheet(wb: XLSX.WorkBook): HojaEncontrada | null {
  const candidates: (HojaEncontrada & { ncols: number })[] = []
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<FilaExcel>(wb.Sheets[name]!, { header: 1, defval: null })
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const row = rows[i]
      if (!row) continue
      if (normSheet(row[0]) !== 'CODIGO') continue
      if (row.some((c) => empiezaGarantia(c))) {
        candidates.push({
          name,
          headerRowIdx: i,
          rows,
          ncols: row.filter((c) => txt(c)).length,
        })
        break
      }
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => b.ncols - a.ncols)
  return candidates[0]!
}

// "Fecha límite de presentación: DD DE MM DE YYYY" (mes numérico). Respaldo: FECHA DE VENCIMIENTO (texto).
function findFechaLimite(wb: XLSX.WorkBook): string | null {
  const re = /Fecha l[ií]mite de presentaci[oó]n:\s*(\d{1,2})\s+DE\s+(\d{1,2})\s+DE\s+(\d{4})/i
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<FilaExcel>(wb.Sheets[name]!, { header: 1, defval: null })
    for (const row of rows) {
      if (!row) continue
      for (const cell of row) {
        const m = String(cell ?? '').match(re)
        if (!m) continue
        const z = (n: number) => String(n).padStart(2, '0')
        return `${m[3]}-${z(parseInt(m[2]!, 10))}-${z(parseInt(m[1]!, 10))}`
      }
    }
  }
  return findVencimiento(wb)
}

// Mes del reporte desde el título "Garantías mensuales YYYY-MM".
function findMesReporte(wb: XLSX.WorkBook): string | null {
  const re = /Garant[ií]as mensuales\s+(\d{4})-(\d{1,2})/i
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<FilaExcel>(wb.Sheets[name]!, { header: 1, defval: null })
    for (const row of rows) {
      if (!row) continue
      for (const cell of row) {
        const m = String(cell ?? '').match(re)
        if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
      }
    }
  }
  return null
}

export async function parseMensual(file: File): Promise<ResultadoMensual> {
  const errors: string[] = []
  let wb: XLSX.WorkBook
  try {
    wb = await readWorkbook(file)
  } catch (e) {
    errors.push(`Error leyendo archivo Mensual: ${(e as Error).message}`)
    return {
      rows: [],
      headers: [],
      monto: 0,
      garantiaUNGC: 0,
      garantiaUNGG: 0,
      noConsigna: false,
      fechaVencimiento: null,
      mesReporte: null,
      errors,
    }
  }

  const found = findMensualSheet(wb)
  if (!found) {
    errors.push(
      `No se encontró una hoja con encabezados esperados (CÓDIGO + columna GARANTIA). Hojas en el archivo: ${wb.SheetNames.join(', ')}`,
    )
    return {
      rows: [],
      headers: [],
      monto: 0,
      garantiaUNGC: 0,
      garantiaUNGG: 0,
      noConsigna: false,
      fechaVencimiento: findFechaLimite(wb),
      mesReporte: findMesReporte(wb),
      errors,
    }
  }

  const { rows, headerRowIdx } = found
  const rawHeaders = (rows[headerRowIdx] || []).map((h) => txt(h))
  const codigoIdx = rawHeaders.findIndex((h) => normSheet(h) === 'CODIGO')
  const garantiaHeader = rawHeaders.find((h) => empiezaGarantia(h))

  const dataRows: FilaTabla[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const cod = normSheet(row[codigoIdx!])
    if (cod === 'UNGC' || cod === 'UNGG') {
      const obj: FilaTabla = {}
      rawHeaders.forEach((h, idx) => {
        if (h) obj[h] = row[idx] ?? null
      })
      dataRows.push(obj)
    }
  }
  if (!dataRows.length) errors.push('No se encontraron filas con código UNGC o UNGG')

  const codHeader = rawHeaders[codigoIdx!]!
  const valGarantia = (cod: string): number => {
    const r = dataRows.find((x) => normSheet(x[codHeader]) === cod)
    return r && garantiaHeader ? (num(r[garantiaHeader]) ?? 0) : 0
  }
  const garantiaUNGG = valGarantia('UNGG')
  const garantiaUNGC = valGarantia('UNGC')
  const monto = garantiaUNGG || garantiaUNGC
  const noConsigna = garantiaUNGG === 0 && garantiaUNGC === 0

  return {
    rows: dataRows,
    headers: rawHeaders.filter(Boolean),
    monto,
    garantiaUNGC,
    garantiaUNGG,
    noConsigna,
    fechaVencimiento: findFechaLimite(wb),
    mesReporte: findMesReporte(wb),
    errors,
  }
}
