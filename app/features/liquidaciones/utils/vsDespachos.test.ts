/**
 * El Excel «Ingresos vs. despachos» se cruza con contabilidad. Estas pruebas
 * fijan lo único que puede cambiar en silencio y arruinar esa conciliación:
 * qué columnas trae, en qué orden y de qué campo sale cada una.
 *
 * La regla del negocio —lo liquidado suma despacho + venta en bolsa y NO resta
 * las compras en bolsa— la impone el backend; acá se verifica que la columna
 * informativa de compras exista y que no se mezcle con el total.
 */
import { describe, expect, it } from 'vitest'
import type { FilaVsDespachos } from './vsDespachos'
import { columnasVsDespachos, nombreArchivoVsDespachos } from './vsDespachos'

const FILA: FilaVsDespachos = {
  proyecto_id: 52,
  proyecto: 'MGS 0007 La Paz Vallenata',
  topico: 'vallenata',
  contratos_sic: ['84962', '90060'],
  kwh_facturacion: 100_000,
  debe_ingresar_ppa: 70_000_000,
  ingreso_bolsa: 7_465_112,
  debe_ingresar: 77_465_112,
  kwh_sin_valorizar: 0,
  lineas_sin_valorizar: 0,
  kwh_despachos: 100_000,
  liquidado_despachos: 77_464_585,
  compras_bolsa: 1_200_000,
  diferencia: 527,
}

function valorDe (header: string, fila: FilaVsDespachos = FILA) {
  const col = columnasVsDespachos.find(c => c.header === header)
  if (!col) throw new Error(`No existe la columna «${header}»`)
  return col.value(fila)
}

describe('columnas del Excel de ingresos vs. despachos', () => {
  it('trae las dos cifras que pidió Jessica, con ese nombre', () => {
    const headers = columnasVsDespachos.map(c => c.header)
    expect(headers).toContain('Debe ingresar (COP)')
    expect(headers).toContain('Liquidado despachos + bolsa (COP)')
  })

  it('pone el proyecto primero: es la columna por la que se busca', () => {
    expect(columnasVsDespachos[0]?.header).toBe('Proyecto')
  })

  it('el «debe ingresar» es el total, no solo la parte PPA', () => {
    expect(valorDe('Debe ingresar (COP)')).toBe(77_465_112)
    expect(valorDe('Debe ingresar - PPA (COP)')).toBe(70_000_000)
    expect(valorDe('Debe ingresar - bolsa (COP)')).toBe(7_465_112)
  })

  it('las compras en bolsa van en su propia columna y no tocan lo liquidado', () => {
    expect(valorDe('Liquidado despachos + bolsa (COP)')).toBe(77_464_585)
    expect(valorDe('Compras en bolsa (no restadas)')).toBe(1_200_000)
  })

  it('la diferencia sale del backend tal cual, sin recalcularla acá', () => {
    // Si el front la recalculara, un redondeo distinto haría que el Excel no
    // cuadre con lo que muestra la pantalla.
    expect(valorDe('Diferencia (COP)')).toBe(527)
  })

  it('muestra la energía que no se pudo valorizar', () => {
    // Sin esta columna, un proyecto al que le falta la tarifa se lee como si
    // le faltara plata.
    const sinTarifa = { ...FILA, kwh_sin_valorizar: 80_000, lineas_sin_valorizar: 1 }
    expect(valorDe('kWh sin valorizar', sinTarifa)).toBe(80_000)
  })

  it('un proyecto sin nombre no rompe la exportación', () => {
    const huerfano = { ...FILA, proyecto: null, topico: null, contratos_sic: [] }
    expect(valorDe('Proyecto', huerfano)).toBe('')
    expect(valorDe('Tópico (API)', huerfano)).toBe('')
    expect(valorDe('Contratos SIC', huerfano)).toBe('')
  })

  it('el nombre del archivo lleva el mes', () => {
    expect(nombreArchivoVsDespachos('2026-07')).toBe('Ingresos_vs_despachos_2026-07.xlsx')
    expect(nombreArchivoVsDespachos('2026-07-01')).toBe('Ingresos_vs_despachos_2026-07.xlsx')
  })
})
