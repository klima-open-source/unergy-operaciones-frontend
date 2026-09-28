/**
 * Lee las facturas XM en PDF (paso opcional del asistente semanal) y las
 * clasifica para poder marcarlas como descuento del disponible de custodia.
 */
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MESES: Record<string, number> = {
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
const DATE_RE = /(\d{1,2})-([a-zA-Záéíóú]+)\.?-(\d{2,4})/

export interface DocumentoFactura {
  archivo: string
  pagina: number
  tipo: string
  concepto: string
  descuenta: boolean
  signo: number
  numero: string | null
  valorTotal: number | null
  vencimiento: string | null
  warnings: string[]
}

export interface ResultadoFacturas {
  documentos: DocumentoFactura[]
  errors: string[]
}

interface Clasificacion {
  tipo: string
  concepto: string
  descuenta: boolean
  signo: number
}

// Clasificación primaria por prefijo del número de documento (inequívoco).
// signo: +1 suma al total a descontar (Unergy paga), -1 resta (a favor), 0 informativo.
const PREFIX_MAP: Record<string, Clasificacion> = {
  ASIC: { tipo: 'DÉBITO', concepto: 'Factura de venta', descuenta: true, signo: 1 },
  NDAS: { tipo: 'DÉBITO', concepto: 'Factura de venta', descuenta: true, signo: 1 },
  OSE: { tipo: 'DÉBITO', concepto: 'Factura de venta', descuenta: true, signo: 1 },
  ASNC: { tipo: 'CRÉDITO', concepto: 'Nota crédito', descuenta: false, signo: -1 },
  ASIV: { tipo: 'INFORME', concepto: 'Informe de ventas', descuenta: false, signo: 0 },
  AAVC: { tipo: 'AJUSTE CARGO', concepto: 'Ajuste a cargo', descuenta: false, signo: 1 },
  AAVF: { tipo: 'AJUSTE FAVOR', concepto: 'Ajuste a favor', descuenta: false, signo: -1 },
}

// Fallback por título — más específicos primero (la Nota Crédito contiene "factura electrónica de venta").
const TIPO_RULES: (Clasificacion & { re: RegExp })[] = [
  {
    re: /Nota\s*cr[eé]dito/i,
    tipo: 'CRÉDITO',
    concepto: 'Nota crédito',
    descuenta: false,
    signo: -1,
  },
  {
    re: /Informe de Ventas/i,
    tipo: 'INFORME',
    concepto: 'Informe de ventas',
    descuenta: false,
    signo: 0,
  },
  {
    re: /Ajuste de Ventas a Cargo/i,
    tipo: 'AJUSTE CARGO',
    concepto: 'Ajuste a cargo',
    descuenta: false,
    signo: 1,
  },
  {
    re: /Ajuste de Ventas a Favor/i,
    tipo: 'AJUSTE FAVOR',
    concepto: 'Ajuste a favor',
    descuenta: false,
    signo: -1,
  },
  {
    re: /FACTURA ELECTR[OÓ]NICA DE VENTA/i,
    tipo: 'DÉBITO',
    concepto: 'Factura de venta',
    descuenta: true,
    signo: 1,
  },
]

function classify(numero: string | null, text: string): Clasificacion {
  if (numero) {
    const pre = (numero.match(/^[A-Z]+/) || [])[0]
    if (pre && PREFIX_MAP[pre]) return PREFIX_MAP[pre]
  }
  for (const r of TIPO_RULES) if (r.re.test(text)) return r
  return { tipo: 'DESCONOCIDO', concepto: '—', descuenta: false, signo: 0 }
}

// Detecta formato CO (9.755,00) o US/SAP (996,711.40) por el separador decimal más a la derecha.
function parseAmount(s: string | null | undefined): number | null {
  if (s == null) return null
  const str = String(s).trim()
  const ld = str.lastIndexOf('.')
  const lc = str.lastIndexOf(',')
  let n: string
  if (ld > lc) n = str.replace(/,/g, '')
  else if (lc > ld) n = str.replace(/\./g, '').replace(',', '.')
  else n = str.replace(/[.,]/g, '')
  const r = parseFloat(n)
  return isNaN(r) ? null : r
}

function parseFechaES(s: string | null | undefined): Date | null {
  const m = String(s).toLowerCase().match(DATE_RE)
  if (!m) return null
  const mes = MESES[m[2]!.slice(0, 4)] ?? MESES[m[2]!.slice(0, 3)]
  if (mes == null) return null
  let yy = parseInt(m[3]!, 10)
  if (yy < 100) yy += 2000
  const d = new Date(yy, mes, parseInt(m[1]!, 10))
  return isNaN(d.getTime()) ? null : d
}

function fechaISO(d: Date | null): string | null {
  if (!d) return null
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function vencimientoDesdeItems(items: TextItem[]): string | null {
  const label = items.find((it) => /vencimiento/i.test(it.str))
  if (!label) return null
  const lx = label.transform[4]
  const ly = label.transform[5]
  let best: string | null = null
  let score = Infinity
  for (const it of items) {
    const m = it.str.match(DATE_RE)
    if (!m) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const dy = ly - y
    if (dy < -2) continue
    const s = Math.abs(dy) + Math.abs(x - lx) * 0.5
    if (s < score) {
      score = s
      best = m[0]
    }
  }
  return best
}

export async function parseFacturas(files: File[]): Promise<ResultadoFacturas> {
  const documentos: DocumentoFactura[] = []
  const errors: string[] = []
  for (const file of files) {
    let pdf
    try {
      const data = await file.arrayBuffer()
      pdf = await pdfjsLib.getDocument({ data }).promise
    } catch (e) {
      errors.push(`No se pudo leer ${file.name}: ${(e as Error).message}`)
      continue
    }
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      // Sin `includeMarkedContent`, pdf.js solo devuelve `TextItem`.
      const items = content.items as TextItem[]
      const text = items.map((i) => i.str).join(' ')
      const warnings: string[] = []

      if (!text.trim()) {
        documentos.push({
          archivo: file.name,
          pagina: p,
          tipo: 'DESCONOCIDO',
          concepto: '—',
          descuenta: false,
          signo: 0,
          numero: null,
          valorTotal: null,
          vencimiento: null,
          warnings: ['escaneada'],
        })
        continue
      }

      const numero = (text.match(/\b([A-Z]{2,5}\d{4,})\b/) || [])[1] || null
      const cls = classify(numero, text)

      // Valor Total: cabecera con dos puntos (CO) — fallback a "VALOR TOTAL" resumen (OSE/SAP).
      const valMatches = [...text.matchAll(/Valor Total:\s*([\d.,]+)/g)]
      let valorTotal = valMatches.length ? parseAmount(valMatches[0]![1]) : null
      if (valMatches.length > 1) warnings.push('multiple_valor')
      if (!valMatches.length) {
        const m = text.match(/VALOR TOTAL\s+([\d.,]+)/)
        if (m) valorTotal = parseAmount(m[1])
        else warnings.push('sin_valor')
      }

      let vStr = vencimientoDesdeItems(items)
      if (!vStr) {
        const after = text.split(/vencimiento/i)[1]
        if (after) {
          const m = after.match(DATE_RE)
          if (m) vStr = m[0]
        }
      }
      const vDate = parseFechaES(vStr)
      if (!vDate) warnings.push('sin_vencimiento')

      documentos.push({
        archivo: file.name,
        pagina: p,
        tipo: cls.tipo,
        concepto: cls.concepto,
        descuenta: cls.descuenta,
        signo: cls.signo ?? 0,
        numero,
        valorTotal,
        vencimiento: fechaISO(vDate),
        warnings,
      })
    }
  }
  const seen = new Set<string>()
  const dedup = documentos.filter((d) => {
    if (!d.numero) return true
    if (seen.has(d.numero)) return false
    seen.add(d.numero)
    return true
  })
  return { documentos: dedup, errors }
}
