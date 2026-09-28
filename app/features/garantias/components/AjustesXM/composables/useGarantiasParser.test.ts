import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseMensual, parseSemanales, parseTxr } from './useGarantiasParser'

/** Construye un `File` .xlsx real a partir de una o varias hojas (AOA), para probar los parsers de punta a punta. */
function buildWorkbookFile(sheets: Record<string, unknown[][]>, filename: string): File {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  }
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new File([new Uint8Array(buffer)], filename)
}

describe('parseSemanales', () => {
  it('suma los ajustes + TIE por agente y arma la hoja madre completa', async () => {
    // Filas 0-7 son relleno hasta la fila de encabezados (índice 8). Necesitan
    // una celda no vacía: una fila realmente vacía no entra en el rango de la
    // hoja y `sheet_to_json` la compacta, corriendo los índices.
    const relleno = Array.from({ length: 8 }, () => ['relleno'])
    const garantiaAoa = [
      ...relleno,
      ['', '', '', 'AjusteA'], // fila 8: encabezado de ajustes desde la columna 3
      ['UNGC', '', '', 5000], // fila 9 (DATA_START)
      ['UNGG', '', '', 7000],
      ['TOTAL', '', ''],
      ['', 'PB', 550.25],
      ['', 'Restricciones', 10],
      ['', 'STN', 5],
      ['', 'TRM del día', 4000],
      ['', 'PTB', 2],
    ]
    const garantiaFile = buildWorkbookFile(
      { 'DEPOSITO SEMANAL MENSUAL': garantiaAoa },
      'GARANTIA SEMANAL MENSUAL 12JUN-2026.xlsx',
    )

    const relleno11 = Array.from({ length: 11 }, () => ['relleno'])
    const webAoa = [...relleno11, ['UNGC', '', '', 300], ['UNGG', '', '', 400]]
    const webFile = buildWorkbookFile({ DEPOSITO: webAoa }, 'WEB GARANTIAS 12JUN-2026.xlsx')

    const saldoAoa = [['', '3050200006371', 100000, 20, 5, '', '', 30, '', 90000]]
    const saldoFile = buildWorkbookFile(
      { WebBalancePubrdl: saldoAoa },
      'Saldo cuenta custodia 2026-06-12.xlsx',
    )

    const resultado = await parseSemanales(garantiaFile, saldoFile, webFile)

    expect(resultado.errors).toEqual([])
    expect(resultado.ungc).toEqual([
      { label: 'AjusteA', valor: 5000 },
      { label: 'TIE', valor: 300 },
    ])
    expect(resultado.ungg).toEqual([
      { label: 'AjusteA', valor: 7000 },
      { label: 'TIE', valor: 400 },
    ])
    expect(resultado.totalUNGC).toBe(5300)
    expect(resultado.totalUNGG).toBe(7400)
    expect(resultado.totalConsignar).toBe(12700)
    expect(resultado.precios).toEqual({ pb: 550.25, restricciones: 10, stn: 5, trm: 4000, ptb: 2 })
    expect(resultado.custodia).toEqual({
      disponible: 90000,
      congelado: 25,
      saldo: 100000,
      transferencias: 30,
    })
    // La fecha real de la semana sale del nombre del archivo de garantía, no de "hoy".
    expect(resultado.fecha).toBe('2026-06-12')
    expect(resultado.fechaNombre).toBe('GARANTIA SEMANAL MENSUAL 12JUN-2026')
  })

  it('reporta un error por archivo y sigue si falta la garantía', async () => {
    const archivoInvalido = new File([new Uint8Array([1, 2, 3])], 'roto.xlsx')
    const resultado = await parseSemanales(archivoInvalido, archivoInvalido, archivoInvalido)

    expect(resultado.errors.length).toBeGreaterThan(0)
    expect(resultado.totalConsignar).toBe(0)
    expect(resultado.custodia).toBeNull()
  })
})

describe('parseTxr', () => {
  it('lee el ajuste de UNGG y la fecha de vencimiento', async () => {
    const aoa = [
      ['CODIGO', 'Nombre', 'Total Ajuste'],
      ['UNGC', 'A', 123.45],
      ['UNGG', 'B', 678.9],
      ['FECHA DE VENCIMIENTO: 15 DE JUNIO DE 2026'],
    ]
    const file = buildWorkbookFile({ Ajuste: aoa }, 'txr.xlsx')

    const resultado = await parseTxr(file)

    expect(resultado.errors).toEqual([])
    expect(resultado.headers).toEqual(['CODIGO', 'Nombre', 'Total Ajuste'])
    expect(resultado.rows).toHaveLength(2)
    // El monto a consignar es el "Total Ajuste" de UNGG, no el de UNGC.
    expect(resultado.totalAjuste).toBe(678.9)
    expect(resultado.fechaVencimiento).toBe('2026-06-15')
  })

  it('avisa cuando no encuentra la hoja esperada', async () => {
    const file = buildWorkbookFile({ Hoja1: [['algo', 'irrelevante']] }, 'sin-formato.xlsx')

    const resultado = await parseTxr(file)

    expect(resultado.errors).toHaveLength(1)
    expect(resultado.totalAjuste).toBe(0)
  })
})

describe('parseMensual', () => {
  it('toma la garantía de UNGG por encima de la de UNGC y detecta que sí hay que consignar', async () => {
    const aoa = [
      ['CODIGO', 'Nombre', 'Garantia Mensual'],
      ['UNGC', 'A', 0],
      ['UNGG', 'B', 15000],
      ['Fecha límite de presentación: 05 DE 08 DE 2026'],
      ['Garantías mensuales 2026-08'],
    ]
    const file = buildWorkbookFile({ Ajuste: aoa }, 'mensual.xlsx')

    const resultado = await parseMensual(file)

    expect(resultado.errors).toEqual([])
    expect(resultado.garantiaUNGC).toBe(0)
    expect(resultado.garantiaUNGG).toBe(15000)
    expect(resultado.monto).toBe(15000)
    expect(resultado.noConsigna).toBe(false)
    expect(resultado.fechaVencimiento).toBe('2026-08-05')
    expect(resultado.mesReporte).toBe('2026-08')
  })

  it('marca `noConsigna` cuando ninguno de los dos agentes genera garantía', async () => {
    const aoa = [
      ['CODIGO', 'Nombre', 'Garantia Mensual'],
      ['UNGC', 'A', 0],
      ['UNGG', 'B', 0],
    ]
    const file = buildWorkbookFile({ Ajuste: aoa }, 'mensual.xlsx')

    const resultado = await parseMensual(file)

    expect(resultado.noConsigna).toBe(true)
    expect(resultado.monto).toBe(0)
  })
})
