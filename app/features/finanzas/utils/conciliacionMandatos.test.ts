/**
 * Motor de conciliación de mandatos: PDF del mandato vs. asientos de contabilidad.
 *
 * Portada a Vitest en la Fase 0 de la migración (antes:
 * `conciliacionMandatos.test.mjs`, evaluando el fuente con `new Function`).
 *
 * Casi todos los bloques de abajo son regresiones de casos reales de producción.
 * Los comentarios son la documentación de esas reglas: se conservan tal cual.
 */
import { describe, expect, it } from 'vitest'
import {
  AUTOCONSUMO_ACC_PREFIXES,
  conceptoDesdeEtiqueta,
  OPCIONES_AUTOCONSUMO,
  expandirAbreviaturas,
  extractMandate,
  matchIngresoConceptos,
  matchIngresoContab,
  normalizarCifra,
  parseAsientoNumber,
  parseAsientos,
  parseIngresos,
  parseIngresosPorConcepto,
  parseMandatoNumber,
  plantaDesdeEtiqueta,
  reconciliar,
  suggestTag,
} from './conciliacionMandatos'

// 0) PARSEO NUMÉRICO POR FUENTE — el mandato (PDF) usa formato US (coma=miles,
//    punto=decimal) y el asiento (Odoo) usa formato CO (punto=miles, coma=decimal).
//    Parsearlos igual genera diferencias falsas enormes en la conciliación.
describe('parseo numérico por fuente', () => {
  it('parseMandatoNumber lee formato US: coma=miles, punto=decimal', () => {
    expect(parseMandatoNumber('2,011.51')).toBe(2011.51)
    expect(parseMandatoNumber('129')).toBe(129)
    expect(parseMandatoNumber('$ 2,011,510.00')).toBe(2011510)
    expect(parseMandatoNumber('497,333')).toBe(497333)
    expect(parseMandatoNumber('0.50')).toBe(0.5)
    expect(parseMandatoNumber('-1,000.50')).toBe(-1000.5)
  })

  it('parseAsientoNumber lee formato CO: punto=miles, coma=decimal', () => {
    expect(parseAsientoNumber('2.011,51')).toBe(2011.51)
    expect(parseAsientoNumber('129.413')).toBe(129413) // son miles
    expect(parseAsientoNumber('129')).toBe(129)
    expect(parseAsientoNumber('$ 1.234.567,89')).toBe(1234567.89)
    expect(parseAsientoNumber('-1.000,50')).toBe(-1000.5)
  })

  it('ambos toleran vacío, null y un número nativo', () => {
    expect(parseMandatoNumber('')).toBe(0)
    expect(parseMandatoNumber(null)).toBe(0)
    expect(parseMandatoNumber(undefined)).toBe(0)
    expect(parseMandatoNumber(2011.51)).toBe(2011.51)
    expect(parseAsientoNumber('')).toBe(0)
    expect(parseAsientoNumber(null)).toBe(0)
    expect(parseAsientoNumber(2011.51)).toBe(2011.51)
  })

  it('el mismo valor en US y en CO coincide: la diferencia son céntimos, no miles', () => {
    expect(Math.abs(parseMandatoNumber('2,011.51') - parseAsientoNumber('2.011,51'))).toBeLessThan(0.001)
  })
})

// 1) STRADA / La Reserva — el emparejamiento por palabra completa NO debe sumar Estrada.
describe('STRADA vs. ESTRADA (La Reserva)', () => {
  const TAG = 'MINIGRANJA SOLAR LA RESERVA'
  const details = [
    { asociado: 'STRADA ASOCIADOS S A S', acc: '28151002', accDesc: '', debe: 497333, haber: 0, etiqueta: '', proj: TAG },
    { asociado: 'INVERSIONES ESTRADA ARBELAEZ Y CIA S. EN C.', acc: '28151002', accDesc: '', debe: 2655667, haber: 0, etiqueta: '', proj: TAG },
  ]

  it('STRADA solo suma su propia línea, no la de ESTRADA', () => {
    const res = reconciliar({ mandante: 'STRADA ASOCIADOS S.A.S.', vals: { mant: 497333 }, total: 497333 }, details, TAG)
    expect(res.sums.mant).toBe(497333) // NO 3153000
    expect(res.lines).toHaveLength(1)
    expect(res.status).toBe('ok')
  })

  it('ESTRADA tampoco absorbe la de STRADA', () => {
    const res = reconciliar(
      { mandante: 'INVERSIONES ESTRADA ARBELAEZ Y CIA S EN C', vals: { mant: 2655667 }, total: 2655667 },
      details,
      TAG,
    )
    expect(res.sums.mant).toBe(2655667)
  })
})

// 2) extractMandate lee mandante/NIT/total del CUERPO del PDF.
describe('extractMandate', () => {
  it('lee mandante, NIT y montos del cuerpo del PDF', () => {
    const pdf = `CMU12345
en calidad de mandatario, y STRADA ASOCIADOS S.A.S., con NIT. 900.123.456-7, en calidad de mandante, relacionado con el proyecto MINIGRANJA SOLAR LA RESERVA.
MANTENIMIENTO $ 497,333.00
VALOR A PAGAR $ 497,333.00`
    const m = extractMandate(pdf, 'x-CMU12345.pdf')
    expect(m.mandante).toContain('STRADA')
    expect(m.nit).toBe('900.123.456-7')
    expect(m.vals.mant).toBe(497333)
    expect(m.total).toBe(497333)
  })

  // 2b) REGRESIÓN: un mandato con miles en formato US (comas) NO debe producir
  //     una diferencia falsa de millones contra un asiento del mismo valor.
  it('un mandato en US no genera diferencia falsa contra un asiento en CO', () => {
    const pdfBug = `CMU9999
en calidad de mandatario, y ACME S.A.S., con NIT. 900.000.000-0, en calidad de mandante, relacionado con el proyecto PLANTA DEMO.
MANTENIMIENTO $ 2,011,510.00
VALOR A PAGAR $ 2,011,510.00`
    const mb = extractMandate(pdfBug, 'x-CMU9999.pdf')
    expect(mb.vals.mant).toBe(2011510) // NO 2.01

    const asientoRows = [
      ['Asiento contable', 'Asociado', 'Cuenta', 'Debe', 'Haber', 'Etiqueta', 'Cuenta analitica'],
      ['AS9', 'ACME S A S', '28151002 Mantenimiento', '2.011.510,00', '0', 'x', 'PLANTA DEMO'],
    ]
    const { details } = parseAsientos(asientoRows)
    const res = reconciliar(mb, details, 'PLANTA DEMO')
    expect(Math.round(res.sums.mant!)).toBe(2011510)
    expect(res.flags.find((f) => f.code === 'DIFERENCIA')).toBeUndefined()
    expect(res.status).toBe('ok')
  })

  // 2c) Mantenimiento pagado al contratista vía cuenta de Administración (caso real
  //     Nestlé/Solenium): el monto SÍ está contabilizado, solo que en 28151020/21 con
  //     el contratista como Asociado en vez de 28151002/03 con la fiduciaria. Debe
  //     avisar "OTRA_CUENTA", no reportarlo como FALTANTE.
  it('un costo cargado en otra cuenta avisa OTRA_CUENTA, no FALTANTE', () => {
    const tag = '[10002] PROYECTO-NESTLE'
    const fiduciaria = 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA S A SOCIEDAD FIDUCIARIA'
    const lineas = [
      { asociado: 'SOLENIUM SAS', acc: '28151020', accDesc: 'COSTOS PARA TERCEROS - ADMINISTRACION DE PROYECTOS', debe: 6831500, haber: 0, etiqueta: 'Mantenimiento Preventivo - Nestle', proj: tag },
      { asociado: 'SOLENIUM SAS', acc: '28151021', accDesc: 'IVA ADMINISTRACION DE PROYECTOS - COSTOS PARA TERCEROS', debe: 1297985, haber: 0, etiqueta: 'Mantenimiento Preventivo - Nestle', proj: tag },
    ]
    const res = reconciliar({ mandante: fiduciaria, vals: { mant: 6831500, iva_mant: 1297985 }, total: 8129485 }, lineas, tag)
    const codes = new Set(res.flags.map((f) => f.code))
    expect(codes.has('FALTANTE')).toBe(false)
    expect(codes.has('OTRA_CUENTA')).toBe(true)
    const otra = res.flags.filter((f) => f.code === 'OTRA_CUENTA')
    expect(otra.some((f) => f.txt.includes('28151020') && f.txt.includes('SOLENIUM SAS'))).toBe(true)
    // warn y no bad: el dinero sí está.
    expect(res.status).toBe('warn')
  })
})

// 3) parseAsientos + suggestTag.
describe('parseAsientos y suggestTag', () => {
  it('extrae detalles y etiquetas, y sugiere la etiqueta desde un nombre parcial', () => {
    const TAG = 'MINIGRANJA SOLAR LA RESERVA'
    const rows = [
      ['Asiento contable', 'Asociado', 'Cuenta', 'Debe', 'Haber', 'Etiqueta', 'Cuenta analitica'],
      ['AS1', 'STRADA ASOCIADOS S A S', '28151002 Mantenimiento', '497333', '0', 'x', TAG],
    ]
    const pa = parseAsientos(rows)
    expect(pa.details).toHaveLength(1)
    expect(pa.tags).toContain(TAG)
    expect(suggestTag('La Reserva', pa.tags, {}).tag).toBe(TAG)
  })
})

// 4) INGRESOS: plantaDesdeEtiqueta normaliza concepto + clasificador + mes.
describe('plantaDesdeEtiqueta', () => {
  it('quita el concepto y el mes para dejar solo la planta', () => {
    expect(plantaDesdeEtiqueta('INGRESO BRUTO MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL')).toBe('MINIGRANJA SOLAR URUACO')
    expect(plantaDesdeEtiqueta('COMERCIALIZACIÓN MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL')).toBe('MINIGRANJA SOLAR URUACO')
  })

  it('quita el clasificador BIAC', () => {
    expect(plantaDesdeEtiqueta('INGRESO BRUTO BIAC GD NAOS 1 ABRIL 2026 BIA ENERGY')).toBe('GD NAOS 1')
  })

  // 15) BUG jun-2026 — el batch de junio trajo conceptos que la regex vieja no
  //     reconocía, así que no se les quitaba el prefijo y cada línea quedaba como
  //     una "planta" distinta (382 grupos en vez de ~70) → el match se quedaba con
  //     el bruto sin restar costos (~3% de diferencia falsa).
  const URU = 'MINIGRANJA SOLAR URUACO'
  const etq = (concepto: string) => `${concepto} MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL`

  it.each([
    'SERVICIOS DESPACHO Y COORDINACION CND',
    'DESPACHO',
    'ENERGIA EN BOLSA',
    'ARRANQUE Y PARADA',
    'SERVICIOS DE ADMINISTRACION SIC',
    'I.V.A. SIC 19',
    'CARGO POR CONFIABILIDAD',
    'FAZNI',
  ])('el concepto "%s" colapsa a la misma planta que INGRESO BRUTO', (concepto) => {
    expect(plantaDesdeEtiqueta(etq(concepto))).toBe(URU)
  })

  it('quita los clasificadores nuevos entre el concepto y la planta', () => {
    expect(plantaDesdeEtiqueta('INGRESO BRUTO TERPEL 1 MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL')).toBe(URU)
    expect(plantaDesdeEtiqueta('INGRESO BRUTO TERPEL 2 MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL')).toBe(URU)
    expect(plantaDesdeEtiqueta('INGRESO BRUTO UNGG MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL')).toBe(URU)
  })

  it('deja fuera el sufijo COP/GENERADOR tras el concepto', () => {
    expect(plantaDesdeEtiqueta('ENERGIA EN BOLSA COP GENERADOR MINIGRANJA SOLAR URUACO JUNIO 2026')).toBe(URU)
  })
})

// 5) parseIngresos: suma neto de 28150505 por (asociado, planta); ignora 28151001
//    (contra-asiento). Debe/Haber como NÚMEROS, igual que los entrega SheetJS.
describe('parseIngresos', () => {
  it('agrupa por asociado y planta, y usa el neto en vez del bruto', () => {
    const rows = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      ['CM/1', '28150505 INGRESO DE ENERGIA', 'RODRIGUEZ VELEZ BEATRIZ', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 0, 3712635.47],
      ['CM/1', '28150505 INGRESO DE ENERGIA', 'RODRIGUEZ VELEZ BEATRIZ', 'COMERCIALIZACIÓN MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 273321.72, 0],
      ['CM/1', '28151001 FACTURAS DE COMERCIALIZACION', 'RODRIGUEZ VELEZ BEATRIZ', 'COMERCIALIZACIÓN MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 0, 273321.72],
      ['CM/1', '28150501 GANANCIAS POR PARTICIPACION', 'TERPEL ENERGIA S.A.S E.S.P', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 3712635.47, 0],
    ]
    const ing = parseIngresos(rows)
    expect(ing).toHaveLength(1) // TERPEL 28150501 excluido
    const rodri = ing.find((g) => g.asociado.includes('RODRIGUEZ'))!
    expect(Math.round(Math.abs(rodri.valor_contabilidad))).toBe(3439314) // NO 3712635 bruto
  })

  // 16) BUG jun-2026 — las 6 líneas de Uruaco de junio (con conceptos nuevos)
  //     deben agrupar en UN solo grupo cuyo neto (débito − crédito) = 44.345.428,
  //     NO el bruto 45.786.907.
  //     NOTA: no se entregaron las 6 líneas crudas; los importes por línea son
  //     representativos, elegidos para reproducir los totales reportados de junio.
  //     Lo que fija la regresión es (a) que todas colapsen a UN grupo y (b) que el
  //     neto reste los costos de conceptos nuevos.
  it('colapsa las líneas de junio en un grupo y resta los costos de los conceptos nuevos', () => {
    const AC = '28150505 INGRESO DE ENERGIA'
    const ASO = 'RODRIGUEZ VELEZ BEATRIZ'
    const rows = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      // Ingresos (haber) — bruto = 44.000.000 + 1.500.000 + 286.907 = 45.786.907
      ['CM/6', AC, ASO, 'INGRESO BRUTO TERPEL 1 MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 44000000],
      ['CM/6', AC, ASO, 'CARGO POR CONFIABILIDAD MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 1500000],
      ['CM/6', AC, ASO, 'FAZNI MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 286907],
      // Costos (debe) — total = 900.000 + 400.000 + 141.479 = 1.441.479
      ['CM/6', AC, ASO, 'COMERCIALIZACION MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 900000, 0],
      ['CM/6', AC, ASO, 'ARRANQUE Y PARADA MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 400000, 0],
      ['CM/6', AC, ASO, 'I.V.A. SIC 19 MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 141479, 0],
    ]
    const res = parseIngresos(rows)
    expect(res).toHaveLength(1)
    expect(Math.round(Math.abs(res[0]!.valor_contabilidad))).toBe(44345428)
  })

  // 19) jun-2026 — costos operativos bajo OTRO asociado (el operador: XM, NEU, …)
  //     se atribuyen al inversionista de la MISMA planta. Antes cada asociado era
  //     un grupo → el mandante quedaba sin sus costos y salían diferencias falsas.
  it('fusiona los costos del operador en el grupo del inversionista', () => {
    const rows = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      ['CM/6', '28150505 INGRESO', 'FONSAR SAS', 'INGRESO BRUTO GD AGUSTIN 2 JUNIO 2026 XM', 0, 58238467],
      ['CM/6', '28150505 INGRESO', 'XM COMPANIA DE EXPERTOS EN MERCADOS', 'ARRANQUE Y PARADA (COP) GD AGUSTIN 2 JUNIO 2026 XM', 675783, 0],
      ['CM/6', '28150505 INGRESO', 'XM COMPANIA DE EXPERTOS EN MERCADOS', 'SERVICIOS DESPACHO Y COORDINACION CND (COP) GD AGUSTIN 2 JUNIO 2026 XM', 498739, 0],
    ]
    const g = parseIngresos(rows)
    expect(g).toHaveLength(1)
    expect(g[0]!.asociado).toMatch(/FONSAR/)
    expect(Math.round(Math.abs(g[0]!.valor_contabilidad))).toBe(57063945) // 58238467 - 675783 - 498739

    const gc = parseIngresosPorConcepto(rows)
    expect(gc).toHaveLength(1)
    expect(Math.round(gc[0]!.conceptos['ARRANQUE Y PARADA']!)).toBe(675783)
    expect(Math.round(gc[0]!.conceptos['SERVICIOS DESPACHO Y COORDINACION CND']!)).toBe(498739)
  })

  it('no fusiona cuando la misma planta tiene varios inversionistas', () => {
    const rows = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      ['CM/6', '28150505 INGRESO', 'PA 17844 BANCOLOMBIA', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 45786907],
      ['CM/6', '28150505 INGRESO', 'SUNO ACTIVOS SOSTENIBLES S A S', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 6969547],
    ]
    expect(parseIngresos(rows)).toHaveLength(2)
  })
})

// 6) matchIngresoContab: empareja por asociado (palabra completa) + planta (con número).
describe('matchIngresoContab', () => {
  const grupos = [
    { asociado: 'GD EL REMOLINO 1 S.A.S. E.S.P', planta: 'GD NAOS 1', valor_contabilidad: -58469697 },
    { asociado: 'GD EL REMOLINO 1 S.A.S. E.S.P', planta: 'GD NAOS 2', valor_contabilidad: -56507155 },
    { asociado: 'RODRIGUEZ VELEZ BEATRIZ', planta: 'MINIGRANJA SOLAR URUACO', valor_contabilidad: -3439314 },
  ]

  it('distingue plantas que solo difieren en el número', () => {
    const m = matchIngresoContab({ mandante: 'GD EL REMOLINO 1 S.A.S. E.S.P.', projName: 'GD NAOS 1' }, grupos)
    expect(m!.planta).toBe('GD NAOS 1')
  })

  it('empareja ignorando tildes y mayúsculas', () => {
    const m = matchIngresoContab({ mandante: 'Rodríguez Vélez Beatriz', projName: 'Minigranja Solar Uruaco' }, grupos)
    expect(m!.planta).toBe('MINIGRANJA SOLAR URUACO')
  })

  // 17) BUG jun-2026 — el PDF trae "PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA
  //     ... 17844 SOL DE LA SIERRA" pero el asiento abrevia el PA a "PA 17844 SOL
  //     DE LA SIERRA". Comparten el código de portafolio 17844 → es el mismo PA.
  //     Antes se exigían TODOS los tokens del mandante y las 8 plantas de Sol de la
  //     Sierra quedaban SIN match.
  describe('mandante abreviado por código de portafolio (Sol de la Sierra)', () => {
    const MSIERRA = 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA S A SOCIEDAD FIDUCIARIA - 17844 SOL DE LA SIERRA'
    const gSierra = [
      { asociado: 'PA 17844 SOL DE LA SIERRA', planta: 'MINIGRANJA SOLAR LA PAZ LEYENDA', valor_contabilidad: -66407637 },
      { asociado: 'PA 17844 SOL DE LA SIERRA', planta: 'MINIGRANJA SOLAR SAN DIEGO SUR', valor_contabilidad: -57570713 },
      // Decoy: otro fondo (18254) con el MISMO nombre de planta NO debe robar el match.
      { asociado: 'PA 18254 OTRO FONDO', planta: 'MINIGRANJA SOLAR LA PAZ LEYENDA', valor_contabilidad: -999 },
    ]

    it('reconoce el PA por el código y no deja que otro fondo robe el match', () => {
      const m = matchIngresoContab({ mandante: MSIERRA, projName: 'Minigranja Solar La Paz Leyenda' }, gSierra)
      expect(m!.asociado).toBe('PA 17844 SOL DE LA SIERRA')
      expect(Math.round(m!.valor_contabilidad)).toBe(-66407637)
    })

    it('empareja el resto de plantas del mismo fondo', () => {
      const m = matchIngresoContab({ mandante: MSIERRA, projName: 'Minigranja Solar San Diego Sur' }, gSierra)
      expect(m!.planta).toBe('MINIGRANJA SOLAR SAN DIEGO SUR')
    })

    it('un fondo distinto no roba la planta del 17844 aunque compartan nombre', () => {
      const m = matchIngresoContab(
        { mandante: 'PATRIMONIOS AUTONOMOS X - 18254 OTRO FONDO', projName: 'Minigranja Solar San Diego Sur' },
        gSierra,
      )
      expect(m).toBeFalsy()
    })
  })
})

// 7) ARRIENDO La Esmeralda (CMU0996) — datos reales del Excel de mayo 2026.
//    Cuenta de costo 28150517, analítica [10038] LA ESMERALDA, mandante Bancolombia.
//    Son 5 contratos; en CADA UNO el mandante (la fiduciaria) aparece con el MISMO
//    importe en débito (costo) y en crédito (contrapartida) → el NETO (debe − haber)
//    se cancela y el arriendo "no aparece" (queda 0). El costo real es la suma de los
//    DÉBITOS: 5 × 368.513,81 = 1.842.569,05 = arriendo del mandato.
//    Además cada contrato lleva un crédito al ARRENDADOR (persona natural), que NO
//    debe sumarse: su asociado no es el mandante y, además, es crédito (no débito).
describe('arriendo de La Esmeralda', () => {
  const ESM = '[10038] LA ESMERALDA'
  const BANC = 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA SA SOCIEDAD FIDUCIARIA'
  const DEB = 368513.81
  const arrendadores = ['EDGARDO JESUS AROCA MENDIOLA', 'DULM DAYAN AROCA GUTIERREZ', 'CARLOS ALBERTO AROCA MINDIOLA']

  const arrLineas: Array<{
    asociado: string
    acc: string
    accDesc: string
    debe: number
    haber: number
    etiqueta: string
    proj: string
  }> = []
  for (const ct of ['30980', '30976', '30982', '30978', '30974']) {
    arrLineas.push({ asociado: BANC, acc: '28150517', accDesc: 'Costo arriendo', debe: 0, haber: DEB, etiqueta: ct, proj: ESM })
    arrLineas.push({ asociado: BANC, acc: '28150517', accDesc: 'Costo arriendo', debe: DEB, haber: 0, etiqueta: ct, proj: ESM })
  }
  // Créditos a los arrendadores (personas naturales) en 3 de los contratos.
  arrendadores.forEach((p, i) =>
    arrLineas.push({ asociado: p, acc: '28150517', accDesc: 'Costo arriendo', debe: 0, haber: 184256.91, etiqueta: ['30982', '30978', '30974'][i]!, proj: ESM }),
  )

  it('suma los débitos de los 5 contratos en vez de netear a cero', () => {
    const res = reconciliar({ mandante: BANC, vals: { arr: 1842569 }, total: 1842569 }, arrLineas, ESM)
    expect(Math.round(res.sums.arr!)).toBe(1842569) // NO 0, NO 184257
    expect(res.lines.every((l) => l.asociado === BANC)).toBe(true)
    expect(res.status).toBe('ok')
  })
})

// 8) BUG 1 — Póliza y Servicios Públicos: cuentas 28151004/28151007/28151008 que
//    antes se ignoraban (ni se sumaban del asiento ni se buscaban en el PDF).
describe('BUG 1 — póliza y servicios públicos', () => {
  const TAGP = '[10099] PLANTA POLIZA'
  const MANDP = 'ACME S A S'
  const pdfPol = `CMU7001
en calidad de mandatario, y ACME S.A.S., con NIT. 900.111.222-3, en calidad de mandante, relacionado con el proyecto PLANTA POLIZA.
POLIZA TODO RIESGO Y LUCROCESANTE $ 500,000.00
IVA POLIZA $ 95,000.00
SERVICIOS PUBLICOS - CONSUMO DE ENERGIA $ 300,000.00
VALOR A PAGAR $ 895,000.00`

  it('el PDF separa póliza, su IVA y los servicios públicos', () => {
    const mp = extractMandate(pdfPol, 'x-CMU7001.pdf')
    expect(mp.vals.poliza).toBe(500000)
    expect(mp.vals.iva_poliza).toBe(95000) // no absorbido por `poliza`
    expect(mp.vals.serv_pub).toBe(300000)
  })

  it('las tres cuentas concilian contra el asiento', () => {
    const mp = extractMandate(pdfPol, 'x-CMU7001.pdf')
    const lineas = [
      { asociado: MANDP, acc: '28151004', accDesc: '', debe: 500000, haber: 0, etiqueta: '', proj: TAGP },
      { asociado: MANDP, acc: '28151007', accDesc: '', debe: 95000, haber: 0, etiqueta: '', proj: TAGP },
      { asociado: MANDP, acc: '28151008', accDesc: '', debe: 300000, haber: 0, etiqueta: '', proj: TAGP },
    ]
    const res = reconciliar(mp, lineas, TAGP)
    expect(res.sums.poliza).toBe(500000)
    expect(res.sums.iva_poliza).toBe(95000)
    expect(res.sums.serv_pub).toBe(300000)
    expect(res.status).toBe('ok')
  })
})

// 9) BUG 2 — abreviatura "PA" (Patrimonio Autónomo) en el Asociado (caso Nestlé).
//    El asiento abrevia el mandante con "PA"; debe reconocerse igual al mandato que
//    trae el nombre completo "PATRIMONIOS AUTONOMOS...".
describe('BUG 2 — abreviatura "PA" en el asociado', () => {
  it('expandirAbreviaturas expande "PA" pero no toca "PARQUE"', () => {
    expect(expandirAbreviaturas('FIDUCIARIA BANCOLOMBIA PA NESTLE 18254')).toContain('PATRIMONIOS AUTONOMOS')
    expect(expandirAbreviaturas('PARQUE INDUSTRIAL')).not.toContain('PATRIMONIOS AUTONOMOS')
  })

  it('el mandato con nombre completo concilia contra el asiento abreviado', () => {
    const TAGN = '[18254] NESTLE'
    const MAND_FULL = 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA S A SOCIEDAD FIDUCIARIA NESTLE'
    const ASO_ABREV = 'FIDUCIARIA BANCOLOMBIA PA NESTLE 18254'
    const lineas = [
      { asociado: ASO_ABREV, acc: '28151002', accDesc: '', debe: 1000000, haber: 0, etiqueta: '', proj: TAGN },
      { asociado: ASO_ABREV, acc: '28151003', accDesc: '', debe: 190000, haber: 0, etiqueta: '', proj: TAGN },
    ]
    const res = reconciliar({ mandante: MAND_FULL, vals: { mant: 1000000, iva_mant: 190000 }, total: 1190000 }, lineas, TAGN)
    expect(res.lines).toHaveLength(2)
    expect(res.sums.mant).toBe(1000000)
    expect(res.sums.iva_mant).toBe(190000)
    expect(res.status).toBe('ok')
  })
})

// 10) BUG 3 — el mandato lista el mismo concepto en dos líneas: se SUMA (no se pisa).
describe('BUG 3 — conceptos repetidos en el mandato', () => {
  it('dos líneas del mismo concepto se suman', () => {
    const pdf = `CMU7004
en calidad de mandatario, y ACME S.A.S., con NIT. 900.000.000-0, en calidad de mandante, relacionado con el proyecto PLANTA DUP2.
ARRIENDO $ 40,000.00
ARRIENDO $ 39,705.00
VALOR A PAGAR $ 79,705.00`
    expect(extractMandate(pdf, 'x-CMU7004.pdf').vals.arr).toBe(79705) // NO 39705 pisado
  })

  it('las reglas específicas ganan a la genérica: arr_cc y arr_fact son conceptos distintos', () => {
    const pdf = `CMU7003
en calidad de mandatario, y ACME S.A.S., con NIT. 900.000.000-0, en calidad de mandante, relacionado con el proyecto PLANTA DUP.
ARRIENDO CUENTA DE COBRO $ 79,705.00
ARRIENDO FACTURA ELECTRONICA $ 79,706.00
VALOR A PAGAR $ 159,411.00`
    const m = extractMandate(pdf, 'x-CMU7003.pdf')
    expect(m.vals.arr_cc).toBe(79705)
    expect(m.vals.arr_fact).toBe(79706)
  })
})

// 11) BUG 4 — split de arriendo por ETIQUETA del asiento (caso La Reserva).
//     Misma cuenta 28150517, distinta etiqueta: "CC" (Cuenta de Cobro) vs "FACT".
describe('BUG 4 — arriendo dividido por etiqueta del asiento', () => {
  const TAGLR = 'MINIGRANJA SOLAR LA RESERVA'
  const MANDLR = 'STRADA ASOCIADOS S A S'
  const pdfLR = `CMU1136
en calidad de mandatario, y STRADA ASOCIADOS S.A.S., con NIT. 900.123.456-7, en calidad de mandante, relacionado con el proyecto MINIGRANJA SOLAR LA RESERVA.
ARRIENDO CUENTA DE COBRO $ 79,705.00
ARRIENDO FACTURA ELECTRONICA $ 79,706.00
VALOR A PAGAR $ 159,411.00`

  it('la etiqueta CC/FACT reclasifica cada línea', () => {
    const mLR = extractMandate(pdfLR, 'x-CMU1136.pdf')
    const lineas = [
      { asociado: MANDLR, acc: '28150517', accDesc: '', debe: 79705, haber: 0, etiqueta: 'ARRIENDO CC 40100', proj: TAGLR },
      { asociado: MANDLR, acc: '28150517', accDesc: '', debe: 79706, haber: 0, etiqueta: 'ARRIENDO FACT 40101', proj: TAGLR },
    ]
    const res = reconciliar(mLR, lineas, TAGLR)
    expect(res.sums.arr_cc).toBe(79705)
    expect(res.sums.arr_fact).toBe(79706)
    expect(res.sums.arr).toBeUndefined()
    expect(res.status).toBe('ok')
  })

  it('sin CC/FACT en la etiqueta la línea sigue cayendo en "arr" genérico', () => {
    const lineas = [{ asociado: MANDLR, acc: '28150517', accDesc: '', debe: 100, haber: 0, etiqueta: 'ARRIENDO ABRIL', proj: TAGLR }]
    const res = reconciliar({ mandante: MANDLR, vals: { arr: 100 }, total: 100 }, lineas, TAGLR)
    expect(res.sums.arr).toBe(100)
  })

  // 11b) BUG 4b — la CC migró a cuenta dedicada 28151025 (no responsable de IVA);
  //      antes no estaba en ACC2CONCEPT y la línea se descartaba en silencio, sin
  //      generar ninguna alerta (el mandato reportaba FALTANTE aunque sí estaba).
  it('reconoce la cuenta dedicada 28151025 para la cuenta de cobro', () => {
    const mLR = extractMandate(pdfLR, 'x-CMU1136.pdf')
    const lineas = [
      { asociado: MANDLR, acc: '28151025', accDesc: '', debe: 79705, haber: 0, etiqueta: 'ARRIENDO CC JULIO LA RESERVA', proj: TAGLR },
      { asociado: MANDLR, acc: '28150517', accDesc: '', debe: 79706, haber: 0, etiqueta: 'ARRIENDO FACT JULIO LA RESERVA', proj: TAGLR },
    ]
    const res = reconciliar(mLR, lineas, TAGLR)
    expect(res.sums.arr_cc).toBe(79705)
    expect(res.sums.arr_fact).toBe(79706)
    expect(res.status).toBe('ok')
  })

  // 11c) BUG 4c — caso real CMU1284 (jul-2026): el mandato dejó de decir "Cuenta de
  //      Cobro"/"Factura Electrónica" y pasó a decir "Arriendo No Responsable de
  //      IVA" / "Arriendo Responsable de IVA". Antes del fix, el chequeo que evita
  //      que "IVA MANTENIMIENTO" caiga en 'mant' también disparaba aquí (la frase
  //      nueva contiene la palabra IVA) y AMBOS montos se descartaban en silencio.
  it('entiende la redacción nueva "Responsable / No Responsable de IVA"', () => {
    const pdfIVA = `CMU1284
en calidad de mandatario, y SOLENIUM S.A.S., con NIT. 900.999.888-1, en calidad de mandante, relacionado con el proyecto Minigranja Solar Sabana de Torres.
Arriendo No Responsable de IVA $ 673,757.00
Arriendo Responsable de IVA $ 673,757.00
Iva Arriendo $ 128,014.00
Servicio de Internet $ 188,236.00
Iva Internet $ 35,765.00
VALOR A PAGAR $ 1,699,529.00`
    const mIVA = extractMandate(pdfIVA, 'x-CMU1284.pdf')
    expect(mIVA.vals.arr_cc).toBe(673757)
    expect(mIVA.vals.arr_fact).toBe(673757)
    expect(mIVA.vals.iva_arr).toBe(128014)
    expect(mIVA.vals.arr).toBeUndefined() // reclasificado, no descartado

    const MANDIVA = 'SOLENIUM S A S'
    const TAGIVA = 'MINIGRANJA SOLAR SABANA DE TORRES'
    const lineas = [
      { asociado: MANDIVA, acc: '28151025', accDesc: '', debe: 673757, haber: 0, etiqueta: 'ARRIENDO JULIO', proj: TAGIVA },
      { asociado: MANDIVA, acc: '28150517', accDesc: '', debe: 673757, haber: 0, etiqueta: 'ARRIENDO FACT JULIO', proj: TAGIVA },
      { asociado: MANDIVA, acc: '28150518', accDesc: '', debe: 128014, haber: 0, etiqueta: 'ARRIENDO FACT JULIO', proj: TAGIVA },
      { asociado: MANDIVA, acc: '28151009', accDesc: '', debe: 188236, haber: 0, etiqueta: 'INTERNET JULIO', proj: TAGIVA },
      { asociado: MANDIVA, acc: '28151010', accDesc: '', debe: 35765, haber: 0, etiqueta: 'INTERNET JULIO', proj: TAGIVA },
    ]
    const res = reconciliar(mIVA, lineas, TAGIVA)
    expect(res.sums.arr_cc).toBe(673757)
    expect(res.sums.arr_fact).toBe(673757)
    expect(res.status).toBe('ok')
  })

  // 11d) BUG 4d — caso real CMU1264/1265/1266: el mandato solo lista "Arriendo"
  //      genérico (un único arrendador, no responsable de IVA, sin línea de IVA
  //      arriendo) y ese único arrendador cae en la cuenta 28151025. Reclasificar
  //      esa cuenta a arr_cc SIEMPRE (fix anterior) rompía este caso: el mandato
  //      decía 'arr' pero el asiento sumaba 'arr_cc' — nunca coincidían (FALTANTE
  //      + SOBRANTE simultáneos). Solo debe dividirse cuando el mandato separa.
  it('no divide el arriendo cuando el mandato no lo divide', () => {
    const pdfGen = `CMU1264
en calidad de mandatario, y SUNO ACTIVOS SOSTENIBLES S.A.S., con NIT. 900.777.666-2, en calidad de mandante, relacionado con el proyecto MINIGRANJA EL SON.
ARRIENDO $ 874,490.00
VALOR A PAGAR $ 874,490.00`
    const mGen = extractMandate(pdfGen, 'x-CMU1264.pdf')
    expect(mGen.vals.arr).toBe(874490)
    expect(mGen.vals.arr_cc).toBeUndefined()

    const lineas = [
      { asociado: 'SUNO ACTIVOS SOSTENIBLES S A S', acc: '28151025', accDesc: '', debe: 874490, haber: 0, etiqueta: 'ARRIENDO JULIO', proj: 'MINIGRANJA EL SON' },
    ]
    const res = reconciliar(mGen, lineas, 'MINIGRANJA EL SON')
    expect(res.sums.arr).toBe(874490)
    expect(res.sums.arr_cc).toBeUndefined()
    expect(res.status).toBe('ok')
  })
})

// 12) BUG 5 — Administración e IVA administración: cuentas 28151020/28151021 que
//     antes se ignoraban (ni se sumaban del asiento ni se buscaban en el PDF).
describe('BUG 5 — administración de proyectos', () => {
  it('separa administración de su IVA y ambas concilian', () => {
    const TAGA = '[10100] PLANTA ADMIN'
    const MANDA = 'ACME S A S'
    const pdfAdm = `CMU7002
en calidad de mandatario, y ACME S.A.S., con NIT. 900.111.222-3, en calidad de mandante, relacionado con el proyecto PLANTA ADMIN.
ADMINISTRACION DE PROYECTOS $ 200,000.00
IVA ADMINISTRACION $ 38,000.00
VALOR A PAGAR $ 238,000.00`
    const ma = extractMandate(pdfAdm, 'x-CMU7002.pdf')
    expect(ma.vals.admin).toBe(200000)
    expect(ma.vals.iva_admin).toBe(38000)

    const lineas = [
      { asociado: MANDA, acc: '28151020', accDesc: '', debe: 200000, haber: 0, etiqueta: '', proj: TAGA },
      { asociado: MANDA, acc: '28151021', accDesc: '', debe: 38000, haber: 0, etiqueta: '', proj: TAGA },
    ]
    const res = reconciliar(ma, lineas, TAGA)
    expect(res.sums.admin).toBe(200000)
    expect(res.sums.iva_admin).toBe(38000)
    expect(res.status).toBe('ok')
  })
})

// 13) BUG 6 — asociado ABREVIADO en el asiento (caso real Sol Sierra, CMU1107).
//     El mandante del PDF trae el nombre corporativo completo + fondo, pero el
//     asiento abrevia a "PA 17844 SOL DE LA SIERRA" (sin FIDUCIARIA/BANCOLOMBIA).
//     Debe reconciliar; y fondos distintos (18254 Nestlé, Skandia) NO deben cruzar.
describe('BUG 6 — asociado abreviado en el asiento', () => {
  const TAGSS = '[10051] COLCEST53P1 LA PAZ LEYENDA'
  const MAND_SS = 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA S A SOCIEDAD FIDUCIARIA - 17844 SOL DE LA SIERRA'
  const lineasSS = [
    { asociado: 'PA 17844 SOL DE LA SIERRA', acc: '28151009', accDesc: '', debe: 64706.3, haber: 0, etiqueta: '', proj: TAGSS },
    { asociado: 'PA 17844 SOL DE LA SIERRA', acc: '28151010', accDesc: '', debe: 12294.2, haber: 0, etiqueta: '', proj: TAGSS },
    { asociado: 'PA 17844 SOL DE LA SIERRA', acc: '28151020', accDesc: '', debe: 2681883.45, haber: 0, etiqueta: '', proj: TAGSS },
    { asociado: 'PA 17844 SOL DE LA SIERRA', acc: '28151021', accDesc: '', debe: 509557.86, haber: 0, etiqueta: '', proj: TAGSS },
    // Ruido: otro tercero del MISMO proyecto que NO debe sumarse.
    { asociado: 'SOLENIUM SAS', acc: '28151020', accDesc: '', debe: 999999, haber: 0, etiqueta: '', proj: TAGSS },
    // Otro patrimonio Bancolombia con fondo DISTINTO (Nestlé 18254): NO debe cruzar.
    { asociado: 'FIDUCIARIA BANCOLOMBIA PA NESTLE 18254', acc: '28151020', accDesc: '', debe: 888888, haber: 0, etiqueta: '', proj: TAGSS },
  ]

  it('reconoce el asociado abreviado y deja fuera al resto de terceros', () => {
    const res = reconciliar(
      { mandante: MAND_SS, vals: { int: 64706.3, iva_int: 12294.2, admin: 2681883.45, iva_admin: 509557.86 }, total: 3268441.81 },
      lineasSS,
      TAGSS,
    )
    expect(res.lines).toHaveLength(4)
    expect(Math.round(res.sums.admin!)).toBe(2681883) // sin sumar 999999 / 888888
    expect(res.status).toBe('ok')
  })

  it('un mandato de otro fondo solo suma su propia línea', () => {
    const res = reconciliar(
      {
        mandante: 'PATRIMONIOS AUTONOMOS FIDUCIARIA BANCOLOMBIA S A SOCIEDAD FIDUCIARIA - 18254 NESTLE',
        vals: { admin: 888888 },
        total: 888888,
      },
      lineasSS,
      TAGSS,
    )
    expect(res.sums.admin).toBe(888888)
  })
})

// 14) normalizarCifra — función ÚNICA que detecta miles/decimal en AMBOS formatos.
describe('normalizarCifra', () => {
  it('lee el formato US del mandato', () => {
    expect(normalizarCifra('1,234,567')).toBe(1234567)
    expect(normalizarCifra('2,011.51')).toBe(2011.51)
    expect(normalizarCifra('$ 2,011,510.00')).toBe(2011510)
    expect(normalizarCifra('497,333')).toBe(497333)
    expect(normalizarCifra('0.50')).toBe(0.5)
  })

  it('lee el formato CO del asiento', () => {
    expect(normalizarCifra('1.234.567')).toBe(1234567)
    expect(normalizarCifra('2.011,51')).toBe(2011.51)
    expect(normalizarCifra('129.413')).toBe(129413)
    expect(normalizarCifra('$ 1.234.567,89')).toBe(1234567.89)
    expect(normalizarCifra('0,50')).toBe(0.5)
  })

  it('lee los casos reales del lote Sol Sierra', () => {
    expect(normalizarCifra('2,681,883.45')).toBe(2681883.45)
    expect(normalizarCifra('64,706.30')).toBe(64706.3)
  })

  it('maneja sin separador, negativos, paréntesis, número nativo y vacío', () => {
    expect(normalizarCifra('129')).toBe(129)
    expect(normalizarCifra('-1,000.50')).toBe(-1000.5)
    expect(normalizarCifra('-1.000,50')).toBe(-1000.5)
    expect(normalizarCifra('(1.234)')).toBe(-1234) // paréntesis = negativo
    expect(normalizarCifra(2011.51)).toBe(2011.51)
    expect(normalizarCifra('')).toBe(0)
    expect(normalizarCifra(null)).toBe(0)
  })

  it('el mismo valor coincide venga de donde venga', () => {
    expect(Math.abs(normalizarCifra('2,011.51') - normalizarCifra('2.011,51'))).toBeLessThan(0.001)
    // El bug original de "Auditoría PDFs": $2,011,510.00 (US) NO debe leerse como 2.011.
    expect(normalizarCifra('2,011,510.00')).not.toBe(2.011)
  })
})

// 18) INGRESOS POR CONCEPTO (jun-2026) — desglose para el validador de ingresos.
//     El mandato lista Ingreso Bruto (suma) + costos (resta) y "Valor a pagar".
//     La contabilidad trae los mismos conceptos como líneas del 28150505. El
//     validador debe cruzar CONCEPTO a CONCEPTO, no solo el total.
describe('ingresos por concepto', () => {
  it('conceptoDesdeEtiqueta saca la clave canónica del concepto', () => {
    expect(conceptoDesdeEtiqueta('INGRESO BRUTO MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL')).toBe('INGRESO BRUTO')
    expect(conceptoDesdeEtiqueta('ARRANQUE Y PARADA (COP) MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL')).toBe('ARRANQUE Y PARADA')
    expect(conceptoDesdeEtiqueta('I.V.A. SIC (19%) (COP) (GENERADOR) MINIGRANJA SOLAR URUACO JUNIO 2026')).toBe('I V A SIC')
    expect(
      conceptoDesdeEtiqueta('SERVICIOS DESPACHO Y COORDINACIÓN CND (COP) (GENERADOR) MINIGRANJA SOLAR URUACO JUNIO 2026'),
    ).toBe('SERVICIOS DESPACHO Y COORDINACION CND')
    expect(
      conceptoDesdeEtiqueta('SERVICIOS DE ADMINISTRACIÓN SIC (COP) (GENERADOR) MINIGRANJA SOLAR URUACO JUNIO 2026'),
    ).toBe('SERVICIOS DE ADMINISTRACION SIC')
  })

  it('parseIngresosPorConcepto netea por concepto e ignora el contra-asiento 28151001', () => {
    const rows = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      ['CM/6', '28150505 INGRESO DE ENERGIA', 'PA 17844 SOL DE LA SIERRA', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 45786907],
      ['CM/6', '28150505 INGRESO DE ENERGIA', 'PA 17844 SOL DE LA SIERRA', 'ARRANQUE Y PARADA (COP) MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 612972, 0],
      ['CM/6', '28151001 FACTURAS DE COMERCIALIZACION', 'PA 17844 SOL DE LA SIERRA', 'ARRANQUE Y PARADA (COP) MINIGRANJA SOLAR URUACO JUNIO 2026 TERPEL', 0, 612972],
      ['CM/6', '28150505 INGRESO DE ENERGIA', 'PA 17844 SOL DE LA SIERRA', 'I.V.A. SIC (19%) (COP) (GENERADOR) MINIGRANJA SOLAR URUACO JUNIO 2026', 26283, 0],
    ]
    const g = parseIngresosPorConcepto(rows)
    expect(g).toHaveLength(1)
    expect(Math.round(g[0]!.conceptos['INGRESO BRUTO']!)).toBe(-45786907)
    expect(Math.round(g[0]!.conceptos['ARRANQUE Y PARADA']!)).toBe(612972) // solo 28150505
    expect(Math.round(g[0]!.conceptos['I V A SIC']!)).toBe(26283)
  })

  it('matchIngresoConceptos marca OK, DIFERENCIA, faltante y sobrante', () => {
    const valsPdf = { 'INGRESO BRUTO': 45786907, 'ARRANQUE Y PARADA': 612972, 'I V A SIC': 26283, FAZNI: 5000 }
    const contab = { 'INGRESO BRUTO': -45786907, 'ARRANQUE Y PARADA': 613500, 'I V A SIC': 26283, COMERCIALIZACION: 1000 }
    const filas = matchIngresoConceptos(valsPdf, contab, 200)
    const byK = Object.fromEntries(filas.map((f) => [f.concepto, f]))
    expect(byK['INGRESO BRUTO']!.estado).toBe('OK')
    expect(byK['ARRANQUE Y PARADA']!.estado).toBe('DIFERENCIA') // dif 528 > tolerancia 200
    expect(byK['FAZNI']!.estado).toBe('FALTA_CONTAB')
    expect(byK['COMERCIALIZACION']!.estado).toBe('SOBRA_CONTAB')
  })

  it('extractMandate parsea los conceptos de ingreso con las claves canónicas', () => {
    const pdfTxt = [
      'Concepto Valor',
      'Ingreso Bruto (COP) (Suma) (**) $ 45,786,907',
      'Arranque y parada (COP) (Resta) $ 612,972',
      'Energía en Bolsa (Generador) (COP) (Resta) $ 276,566',
      'Servicios Despacho y Coordinación CND (Generador) (COP) (Resta) $ 387,327',
      'Servicios de Administración SIC (Generador) (COP) (Resta) $ 138,331',
      'I.V.A. SIC (19%) (Generador) (COP) (Resta) $ 26,283',
      'Valor a pagar $ 44,345,428',
    ].join('\n')
    const m = extractMandate(pdfTxt, 'CMU1053-Mandato-Minigranja Solar Uruaco-X.pdf')
    expect(m.total).toBe(44345428)
    expect(m.vals['INGRESO BRUTO']).toBe(45786907)
    expect(m.vals['ARRANQUE Y PARADA']).toBe(612972)
    expect(m.vals['SERVICIOS DESPACHO Y COORDINACION CND']).toBe(387327)
    expect(m.vals['I V A SIC']).toBe(26283)
  })
})

// 20) AUTOCONSUMO usa OTRAS CUENTAS — bug real (2026-09-09): el botón «Ejecutar
//     Conciliación» nunca se habilitaba en la sub-pestaña AUTOCONSUMO. La vista
//     llamaba `parseIngresos(matriz)` sin cuenta, así que filtraba por 28150505,
//     que en autoconsumo no existe: 0 grupos → botón deshabilitado para siempre.
//
//     Las cuentas de autoconsumo, verificadas contra el soporte real de agosto
//     de 2026 (AUTOCONSUMO AGOSTO 2026.xlsx, 90 líneas):
//
//       28150508  VALORES RECIBIDOS PARA TERCEROS - AUTOCONSUMO  → Ingreso Bruto
//       28150502  INTERESES POR MORA                             → Interés
//       28151305  CLIENTES NACIONALES - AUTOCONSUMO              → retenciones
//
//     El PDF del mandato lista «Ingreso Bruto (Suma)» + «Interés (Suma)» =
//     «Valor a pagar», así que la conciliación suma las dos primeras. Las
//     retenciones (retefuente e ICA) NO entran: no aparecen en el mandato.
//     Y hay una segunda trampa: en autoconsumo la CONTRAPARTIDA vive en la
//     MISMA cuenta. Cada proyecto sale dos veces en la 28150508 — el cliente al
//     debe y SUNO (el mandante) al haber, por el mismo importe. La fusión
//     operador→inversionista de ingresos las anulaba entre sí y dejaba de
//     residuo justo la retención. Por eso autoconsumo no fusiona y se queda con
//     el lado por pagar (neto < 0), que es el del mandante: es a él a quien va
//     dirigido el mandato.
describe('parseIngresos con las cuentas de AUTOCONSUMO', () => {
  // Cifras reales de CMU1160 (Almacen Amc Sas), soporte de agosto 2026.
  const rows = [
    ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
    // El cliente, al debe.
    ['CM/2026/09/0001', '28150508 VALORES RECIBIDOS PARA TERCEROS - AUTOCONSUMO', 'ALMACEN AMC SAS', 'AGOSTO 2026 PROY ALMACEN AMC SAS INGRESO BRUTO', 4724156.57, 0],
    ['CM/2026/09/0001', '28150502 INTERESES POR MORA', 'ALMACEN AMC SAS', 'AGOSTO 2026 PROY ALMACEN AMC SAS INTERES', 183486.18, 0],
    // El mandante, al haber: el espejo, en la MISMA cuenta.
    ['CM/2026/09/0001', '28150508 VALORES RECIBIDOS PARA TERCEROS - AUTOCONSUMO', 'SUNO ACTIVOS SOSTENIBLES S.A.S', 'AGOSTO 2026 PROY ALMACEN AMC SAS INGRESO BRUTO', 0, 4724156.57],
    ['CM/2026/09/0001', '28150508 VALORES RECIBIDOS PARA TERCEROS - AUTOCONSUMO', 'SUNO ACTIVOS SOSTENIBLES S.A.S', 'AGOSTO 2026 PROY ALMACEN AMC SAS INTERES', 0, 183486.18],
    // Retenciones: no aparecen en el mandato, no deben contar.
    ['CM/2026/09/0001', '28151305 CLIENTES NACIONALES - AUTOCONSUMO', 'ALMACEN AMC SAS', 'AGOSTO 2026 PROY ALMACEN AMC SAS RETENCION EN LA FUENTE', 0, 150227],
  ]

  it('con la cuenta de ingresos no encuentra nada: eso dejaba el botón muerto', () => {
    expect(parseIngresos(rows)).toHaveLength(0)
  })

  it('devuelve el lado del mandante: Ingreso Bruto + Interés, sin retenciones', () => {
    const grupos = parseIngresos(rows, AUTOCONSUMO_ACC_PREFIXES, OPCIONES_AUTOCONSUMO)
    expect(grupos).toHaveLength(1)
    expect(grupos[0]!.asociado).toContain('SUNO')
    expect(grupos[0]!.planta).toBe('ALMACEN AMC SAS')
    // 4.724.157 + 183.486 = 4.907.643, sin los 150.227 de retención.
    expect(Math.round(Math.abs(grupos[0]!.valor_contabilidad))).toBe(4907643)
  })

  it('sin las opciones de autoconsumo la fusión deja solo el residuo', () => {
    // La regresión exacta: cliente y mandante se anulaban y quedaba ~0.
    const grupos = parseIngresos(rows, AUTOCONSUMO_ACC_PREFIXES)
    expect(grupos).toHaveLength(0)
  })

  it('ingresos sigue fusionando operador→inversionista como siempre', () => {
    const ing = [
      ['Asiento contable', 'Cuenta', 'Asociado', 'Etiqueta', 'Debe', 'Haber'],
      ['CM/1', '28150505 INGRESO DE ENERGIA', 'RODRIGUEZ VELEZ BEATRIZ', 'INGRESO BRUTO MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 0, 3712635.47],
      ['CM/1', '28150505 INGRESO DE ENERGIA', 'RODRIGUEZ VELEZ BEATRIZ', 'COMERCIALIZACIÓN MINIGRANJA SOLAR URUACO ABRIL 2026 TERPEL', 273321.72, 0],
    ]
    expect(Math.round(Math.abs(parseIngresos(ing)[0]!.valor_contabilidad))).toBe(3439314)
  })
})
