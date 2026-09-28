/**
 * Derivaciones del CRM comercial: KPIs, tablero, filtros, orden y firma.
 *
 * Portada a TypeScript en la fase 3 de la migración (antes: `comercial.test.js`,
 * que a su vez venía de `comercial.test.mjs` en la fase 0).
 */
import type { Oferta } from '~/features/comercial/types'
import { describe, expect, it } from 'vitest'
import {
  COLUMNAS,
  TIPOS_OFERTA,
  aFechaStr,
  agruparPorColumna,
  alarmante,
  aniosDelPeriodo,
  ayudaPrecio,
  diasDesde,
  etiquetaPrecio,
  filtrar,
  kpis,
  labelEtapa,
  mesDelCodigo,
  ordenar,
  placeholderPrecio,
  puedeFirmarPPA,
  resumenColumna,
  segmentoTipo,
  sinRespuesta,
  tarifasMensualesQueGenera,
  validarFirma,
} from './comercial'

// Fixture: el caso real de Tecni-plast (Margaritas 1 firmada, Margaritas 2 muda).
const oferta = (extra: Partial<Oferta> = {}): Oferta => ({
  id: 1,
  estado: 'oferta',
  tipo: 'compra_energia',
  cliente_id: 7,
  cliente_razon_social: 'TECNI-PLAST S.A.S.',
  planta_nombre: 'Margaritas 1',
  codigo_seguimiento: 'OP.COM No.0103-6-2026',
  resultado: 'pendiente',
  seguimientos: 0,
  fecha_oferta: null,
  fecha_ultima_respuesta: null,
  alerta: false,
  dias_sin_respuesta: 0,
  updated_at: '2026-08-01T10:00:00-05:00',
  ficha: { energia_promedio_kwh_mes: 170000, fuentes: {} },
  ...extra,
})

const OFERTAS: Oferta[] = [
  oferta({ id: 1, estado: 'firmado', planta_nombre: 'Margaritas 1' }),
  oferta({
    id: 2,
    estado: 'oferta',
    planta_nombre: 'Margaritas 2',
    fecha_oferta: '2026-06-01',
    seguimientos: 6,
    alerta: true,
    dias_sin_respuesta: 42,
  }),
  oferta({
    id: 3,
    estado: 'declinado',
    planta_nombre: 'Los Apóstoles',
    tipo: 'servicios_operacionales',
    resultado: 'declinado',
    ficha: { energia_promedio_kwh_mes: null, fuentes: {} },
  }),
  oferta({
    id: 4,
    estado: 'operando',
    planta_nombre: 'San Pelayo',
    ficha: { energia_promedio_kwh_mes: 430000, fuentes: {} },
  }),
]

describe('kpis de la banda', () => {
  it('cuenta activas y total, y suma la energía de las abiertas', () => {
    const k = kpis(OFERTAS)
    expect(k.activas).toBe(3) // excluye declinado/terminado
    expect(k.total).toBe(4)
    expect(Math.round(k.energiaMwhMes)).toBe(770) // 170 + 170 + 430
    expect(k.alertas).toBe(1)
    expect(k.sinRespuesta).toBe(1)
  })

  it('una oferta declinada no suma energía aunque tenga ficha', () => {
    expect(kpis([oferta({ estado: 'declinado' })]).energiaMwhMes).toBe(0)
  })

  it('aguanta una lista vacía y un nulo', () => {
    expect(kpis([]).activas).toBe(0)
    expect(kpis(null).total).toBe(0)
  })
})

describe('tablero por columnas', () => {
  it('tiene seis columnas', () => {
    expect(COLUMNAS).toHaveLength(6)
  })

  it('reparte cada oferta en su columna y manda declinado a Cerradas', () => {
    const grupos = agruparPorColumna(OFERTAS)
    expect(grupos.firmado!.map((o) => o.id)).toEqual([1])
    expect(grupos.oferta!.map((o) => o.id)).toEqual([2])
    expect(grupos.operando!.map((o) => o.id)).toEqual([4])
    expect(grupos.cerradas!.map((o) => o.id)).toEqual([3])
  })

  it('soltar en Cerradas declina — terminar lo hace el job diario', () => {
    expect(COLUMNAS.find((c) => c.value === 'cerradas')!.alSoltar).toBe('declinado')
  })

  // Una etapa que el backend agregue mañana no se puede perder en silencio.
  it('deja visible una etapa desconocida en la primera columna', () => {
    const grupos = agruparPorColumna([oferta({ id: 9, estado: 'etapa_nueva' })])
    expect(grupos.oportunidad!.map((o) => o.id)).toEqual([9])
  })

  it('resume conteo y energía de una columna', () => {
    const res = resumenColumna(agruparPorColumna(OFERTAS).oferta)
    expect(res.n).toBe(1)
    expect(Math.round(res.energiaMwhMes)).toBe(170)
  })
})

describe('filtrar', () => {
  it('el texto busca en planta, cliente y código, sin distinguir mayúsculas', () => {
    expect(filtrar(OFERTAS, { texto: 'margaritas' })).toHaveLength(2)
    expect(filtrar(OFERTAS, { texto: 'TECNI' })).toHaveLength(4)
    expect(filtrar(OFERTAS, { texto: '0103' })).toHaveLength(4)
  })

  it('filtra por tipo, etapa y cliente', () => {
    expect(filtrar(OFERTAS, { tipos: ['servicios_operacionales'] }).map((o) => o.id)).toEqual([3])
    expect(filtrar(OFERTAS, { etapas: ['oferta', 'firmado'] }).map((o) => o.id)).toEqual([1, 2])
    expect(filtrar(OFERTAS, { clientes: [99] })).toHaveLength(0)
  })

  it('filtra por las señales de atención', () => {
    expect(filtrar(OFERTAS, { soloAlerta: true }).map((o) => o.id)).toEqual([2])
    expect(filtrar(OFERTAS, { soloSinRespuesta: true }).map((o) => o.id)).toEqual([2])
  })

  it('sin filtros no filtra', () => {
    expect(filtrar(OFERTAS, {})).toHaveLength(4)
  })
})

describe('ordenar', () => {
  it('rezagadas pone lo más viejo primero y energía pone la planta más grande', () => {
    expect(ordenar(OFERTAS, 'rezagadas')[0]!.id).toBe(2)
    expect(ordenar(OFERTAS, 'energia')[0]!.id).toBe(4)
  })

  it('un criterio inválido no pierde filas y no muta la lista original', () => {
    expect(ordenar(OFERTAS, 'criterio_que_no_existe')).toHaveLength(4)
    expect(OFERTAS[0]!.id).toBe(1)
  })
})

describe('señales de la tarjeta', () => {
  it('sinRespuesta: enviada y nunca contestada', () => {
    expect(sinRespuesta({ fecha_oferta: '2026-06-01', fecha_ultima_respuesta: null })).toBe(true)
    expect(
      sinRespuesta({ fecha_oferta: '2026-06-01', fecha_ultima_respuesta: '2026-06-10' }),
    ).toBe(false)
    expect(sinRespuesta({ fecha_oferta: null })).toBe(false)
  })

  it('alarmante: cuatro toques sin respuesta', () => {
    expect(alarmante({ seguimientos: 4, fecha_ultima_respuesta: null })).toBe(true)
    expect(alarmante({ seguimientos: 3, fecha_ultima_respuesta: null })).toBe(false)
    expect(alarmante({ seguimientos: 9, fecha_ultima_respuesta: '2026-07-01' })).toBe(false)
  })
})

describe('mesDelCodigo', () => {
  it('extrae el mes que vive dentro del código de seguimiento', () => {
    expect(mesDelCodigo({ codigo_seguimiento: 'OP.COM No.0103-6-2026' })).toBe('jun 2026')
    expect(mesDelCodigo({ codigo_seguimiento: 'OP.REP No.0087-12-2025' })).toBe('dic 2025')
  })

  it('devuelve null si el código no tiene el formato o el mes no existe', () => {
    expect(mesDelCodigo({ codigo_seguimiento: 'sin formato' })).toBeNull()
    expect(mesDelCodigo({})).toBeNull()
    expect(mesDelCodigo({ codigo_seguimiento: 'OP.COM No.0103-13-2026' })).toBeNull()
  })
})

describe('fechas', () => {
  const HOY = new Date('2026-08-19T12:00:00').getTime()

  it('diasDesde cuenta días y nunca da negativo', () => {
    expect(diasDesde('2026-08-09', HOY)).toBe(10)
    expect(diasDesde('2026-08-19', HOY)).toBe(0)
    expect(diasDesde('2026-09-01', HOY)).toBe(0)
    expect(diasDesde(null)).toBeNull()
  })

  it('aFechaStr normaliza a YYYY-MM-DD sin corrimiento de zona', () => {
    expect(aFechaStr('2026-08-19T10:00:00-05:00')).toBe('2026-08-19')
    expect(aFechaStr(new Date(2026, 7, 19))).toBe('2026-08-19')
    expect(aFechaStr(null)).toBeNull()
  })
})

describe('firmar', () => {
  it('solo las ofertas de energía firman PPA, y solo si no tienen contrato', () => {
    expect(puedeFirmarPPA(oferta({ tipo: 'compra_energia' }))).toBe(true)
    expect(puedeFirmarPPA(oferta({ tipo: 'comunidad_energetica' }))).toBe(true)
    // El backend responde 422 si se intenta.
    expect(puedeFirmarPPA(oferta({ tipo: 'servicios_operacionales' }))).toBe(false)
    expect(puedeFirmarPPA(oferta({ tipo: 'compra_energia', ppa_contrato_id: 5 }))).toBe(false)
  })

  it('validarFirma acepta una tarifa única bien formada', () => {
    expect(
      validarFirma({
        fecha_inicio: '2026-02-12',
        fecha_fin: '2032-12-31',
        modo_precio: 'unica',
        tarifa_base: 300,
      }),
    ).toEqual([])
  })

  it('validarFirma rechaza periodo invertido, precio ausente, años repetidos y mes base inválido', () => {
    expect(
      validarFirma({
        fecha_inicio: '2026-02-12',
        fecha_fin: '2025-01-01',
        modo_precio: 'unica',
        tarifa_base: 300,
      }),
    ).toEqual(['La fecha de fin es anterior a la de inicio.'])

    expect(
      validarFirma({ fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', modo_precio: 'unica' }),
    ).toEqual(['Falta la tarifa ($/kWh).'])

    expect(
      validarFirma({
        fecha_inicio: '2026-01-01',
        fecha_fin: '2027-12-31',
        modo_precio: 'tabla',
        precios_anuales: [
          { anio: 2026, precio: 320 },
          { anio: 2026, precio: 305 },
        ],
      }),
    ).toEqual(['La tabla de precios tiene años repetidos.'])

    expect(
      validarFirma({
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        modo_precio: 'unica',
        tarifa_base: 300,
        periodo_indexacion_base: '2025-13',
      }),
    ).toEqual(['El mes base de indexación debe ser YYYY-MM (por ejemplo 2025-10).'])
  })

  // Mismo recorte al periodo que `_tarifas_mensuales` del backend: arranca el
  // 12-feb-2026 y termina el 30-jun-2027 → 11 meses + 6 meses.
  it('tarifasMensualesQueGenera expande la tabla anual recortada al periodo', () => {
    expect(
      tarifasMensualesQueGenera({
        fecha_inicio: '2026-02-12',
        fecha_fin: '2027-06-30',
        modo_precio: 'tabla',
        precios_anuales: [
          { anio: 2026, precio: 320 },
          { anio: 2027, precio: 305 },
        ],
      }),
    ).toBe(17)

    expect(
      tarifasMensualesQueGenera({
        fecha_inicio: '2026-02-12',
        fecha_fin: '2027-06-30',
        modo_precio: 'tabla',
        precios_anuales: [
          { anio: 2025, precio: 320 },
          { anio: 2026, precio: 320 },
        ],
      }),
    ).toBe(11)

    expect(tarifasMensualesQueGenera({ modo_precio: 'unica', tarifa_base: 300 })).toBe(0)
  })

  it('aniosDelPeriodo lista los años cubiertos', () => {
    expect(aniosDelPeriodo('2026-02-12', '2028-01-01')).toEqual([2026, 2027, 2028])
    expect(aniosDelPeriodo('2026-02-12', '2025-01-01')).toEqual([])
  })
})

describe('vocabulario alineado con el backend', () => {
  it('los tipos son los del enum del backend', () => {
    expect(TIPOS_OFERTA.map((t) => t.value)).toEqual([
      'servicios_operacionales',
      'compra_energia',
      'comunidad_energetica',
    ])
  })

  it('el segmento del código de seguimiento sale del tipo', () => {
    expect(segmentoTipo('compra_energia')).toBe('COM')
    expect(segmentoTipo('servicios_operacionales')).toBe('REP')
  })

  it('una etapa vieja se muestra cruda en vez de inventarle etiqueta', () => {
    expect(labelEtapa('oportunidad')).toBe('Oportunidad')
    expect(labelEtapa('prospeccion')).toBe('prospeccion')
  })
})

// El formulario pedía «Precio — p. ej. REP: 6 · CGM: 6» para los tres tipos.
// REP y CGM son comisiones en %: en una compra de energía no aplican, ahí lo
// que se pacta es la tarifa en $/kWh.
describe('el precio cambia de significado con el tipo de oferta', () => {
  it('las ofertas de energía piden tarifa y los servicios comisión', () => {
    expect(etiquetaPrecio('compra_energia')).toBe('Tarifa de energía ($/kWh)')
    expect(etiquetaPrecio('comunidad_energetica')).toBe('Tarifa de energía ($/kWh)')
    expect(etiquetaPrecio('servicios_operacionales')).toBe('Comisión del servicio (%)')
  })

  it('el ejemplo de REP/CGM no se le muestra a una compra de energía', () => {
    expect(placeholderPrecio('compra_energia')).toBe('p. ej. 320')
    expect(placeholderPrecio('servicios_operacionales')).toBe('p. ej. REP: 6 · CGM: 6')
  })

  it('sin tipo elegido no se afirma nada sobre el precio', () => {
    expect(ayudaPrecio(null)).toBeNull()
  })
})
