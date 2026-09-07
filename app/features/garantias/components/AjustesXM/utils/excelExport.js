const FONT = 'Arial'
const PURPLE = '7030A0'
const GREEN = 'C6EFCE'
const MONEY = '$#,##0.00'

function thinBorder() {
  const s = { style: 'thin', color: { rgb: '000000' } }
  return { top: s, bottom: s, left: s, right: s }
}

/**
 * Exporta la "hoja madre" de Garantías Semanales replicando el formato XM:
 * título, bloques por agente (UNGC/UNGG) con ajustes + TIE + TOTAL A PAGAR,
 * total combinado y panel lateral de custodia.
 * data = { ungc, ungg, totalUNGC, totalUNGG, totalConsignar, custodia, disponibleAplicacion }
 * ungc/ungg = [{ label, valor }] donde la última fila es la de TIE.
 */
export async function exportHojaMadreExcel(data, filename = 'garantias_hoja_madre.xlsx') {
  const XLSXStyle = await import('xlsx-js-style')
  const {
    ungc = [], ungg = [],
    totalConsignar = 0,
    custodia = null,
    disponibleAplicacion = 0,
    disponibleCrudo = null,
    facturasDescontadas = 0,
    disponibleNeto = null,
  } = data || {}
  const crudo = disponibleCrudo ?? custodia?.disponible ?? 0
  const neto = disponibleNeto ?? (crudo - (facturasDescontadas || 0))

  const aoa = []
  const merges = []
  const set = (r, c, v) => { if (!aoa[r]) aoa[r] = []; aoa[r][c] = v }

  // Título (A1:C1)
  set(0, 0, 'Garantías UNGG Y UNGC')
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } })

  let r = 1
  const blocks = []
  function addBlock(name, rows) {
    set(r, 0, 'AGENTE')
    const headerRow = r; r++
    const startData = r
    for (const row of rows) { set(r, 1, row.label); set(r, 2, Number(row.valor) || 0); r++ }
    const endData = r - 1
    const total = rows.reduce((s, x) => s + (Number(x.valor) || 0), 0)
    set(r, 1, 'TOTAL A PAGAR'); set(r, 2, total)
    const totalRow = r; r++
    set(startData, 0, name)
    if (endData >= startData) merges.push({ s: { r: startData, c: 0 }, e: { r: endData, c: 0 } })
    blocks.push({ headerRow, startData, endData, totalRow })
  }

  addBlock('UNGC', ungc)
  r++ // fila en blanco
  addBlock('UNGG', ungg)
  r++ // fila en blanco
  set(r, 0, 'UNGG y UNGC'); set(r, 1, 'TOTAL A PAGAR'); set(r, 2, totalConsignar)
  const combinedRow = r
  r++

  // Panel lateral (columnas E-F) — desglose auditable
  const panelStart = 1
  const panel = [
    ['Disponible (crudo)', crudo],
    ['(−) Facturas descontadas', facturasDescontadas || 0],
    ['Disponible (3050200006371)', neto],
    ['Disponible (Aplicación de garantía)', disponibleAplicacion ?? 0],
    ['Congelado', custodia?.congelado ?? 0],
    ['Saldo', custodia?.saldo ?? 0],
  ]
  const aplIdx = 3 // índice (0-based) de la fila "Aplicación de garantía" dentro del panel
  panel.forEach(([lbl, val], i) => { set(panelStart + i, 4, lbl); set(panelStart + i, 5, val) })
  const panelEnd = panelStart + panel.length - 1

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = [{ wpx: 80 }, { wpx: 210 }, { wpx: 120 }, { wpx: 18 }, { wpx: 210 }, { wpx: 120 }]

  const range = XLSXStyle.utils.decode_range(ws['!ref'])
  const cellAt = (rr, cc) => {
    const addr = XLSXStyle.utils.encode_cell({ r: rr, c: cc })
    if (!ws[addr]) ws[addr] = { t: 's', v: '' }
    return ws[addr]
  }
  const purpleStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: PURPLE } },
    font: { name: FONT, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center' },
  }
  const purpleRow = (rr) => { for (let cc = 0; cc <= 2; cc++) cellAt(rr, cc).s = { ...purpleStyle } }
  const money = (rr, cc) => { const c = cellAt(rr, cc); c.s = c.s || {}; c.s.numFmt = MONEY }

  // Título
  cellAt(0, 0).s = { font: { name: FONT, sz: 12, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }

  // Bloques
  for (const b of blocks) {
    purpleRow(b.headerRow)
    purpleRow(b.totalRow)
    cellAt(b.startData, 0).s = { font: { name: FONT, sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
    for (let rr = b.startData; rr <= b.totalRow; rr++) money(rr, 2)
  }
  purpleRow(combinedRow)
  money(combinedRow, 2)

  // Panel lateral: bordes + dinero + verde en "Aplicación de garantía"
  for (let rr = panelStart; rr <= panelEnd; rr++) {
    for (const cc of [4, 5]) { const c = cellAt(rr, cc); c.s = c.s || {}; c.s.border = thinBorder(); c.s.font = { name: FONT, sz: 10 } }
    money(rr, 5)
  }
  for (const cc of [4, 5]) {
    const c = cellAt(panelStart + aplIdx, cc)
    c.s.fill = { patternType: 'solid', fgColor: { rgb: GREEN } }
  }

  // Fuente Arial en todas las celdas (preservando estilos ya aplicados)
  for (let rr = range.s.r; rr <= range.e.r; rr++)
    for (let cc = range.s.c; cc <= range.e.c; cc++) {
      const addr = XLSXStyle.utils.encode_cell({ r: rr, c: cc })
      if (!ws[addr]) continue
      ws[addr].s = ws[addr].s || {}
      ws[addr].s.font = { name: FONT, sz: 10, ...(ws[addr].s.font || {}) }
    }

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Garantias')
  XLSXStyle.writeFile(wb, filename)
}

export async function exportTablaExcel(rows, filename = 'tabla.xlsx') {
  if (!rows || !rows.length) return
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, filename)
}

export async function exportHistorialExcel(historial, filename = 'historial_garantias.xlsx') {
  if (!historial || !historial.length) return
  const XLSX = await import('xlsx')
  const rows = historial.map((r) => ({
    Fecha: r.fecha,
    Tipo: r.tipo,
    'PB ($)': r.pb,
    'Total UNGC': r.totalUNGC,
    'Total UNGG': r.totalUNGG,
    'Total Consignar': r.totalConsignar,
    'Disponible Custodia': r.disponibleCustodia,
    Congelado: r.congelado,
    Saldo: r.saldo,
    'Ajuste TXR': r.totalAjusteTXR,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historial')
  XLSX.writeFile(wb, filename)
}
