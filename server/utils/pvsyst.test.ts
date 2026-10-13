import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { eGridMensualCrudo, pesosDeVariantes, pesosDeZip, repartir } from './pvsyst'

// Variantes sintéticas con el mismo formato que PVsyst: se codifica en el test y
// se comprueba que el decodificador recupere exactamente lo codificado. (El
// proyecto real con que se validó el formato no se guarda en el repo: es de un
// cliente.)

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.'

function codificar(n: number): string {
  const signo = n < 0 ? '-' : '+'
  let v = Math.abs(n)
  let s = ''
  do {
    s = ALFABETO[v % 64] + s
    v = Math.floor(v / 64)
  } while (v > 0)
  return signo + s
}

/** Una variante con `E_Grid` horario: `porMes[m]` es la energía de CADA hora de sol del mes m. */
function variante(porMes: number[], { conRuido = true } = {}): string {
  const dias = porMes.map((valor, m) => {
    const mes = String(m + 1).padStart(2, '0')
    // 6 horas de noche negativas (consumo), 2 horas de sol, 16 de cero.
    const horas = [-90, -90, -90, -90, -90, -90, valor, valor, ...Array(16).fill(0)]
    return `        Day_01${mes}=${horas.map(codificar).join('')}`
  })
  return [
    '﻿PVObject_=pvVCalcul',
    '  Comment=Simulación de prueba',
    // Otra variable antes de E_Grid: no debe mezclarse.
    ...(conRuido
      ? [
          '    VarSimul_8=GlobHor',
          '      WRFactor=63716.98',
          `        Day_0101=${codificar(500000)}`,
          '    End of VarSimul=viGlobHor',
        ]
      : []),
    '    VarSimul_140=E_Grid',
    '      Varident=E_Grid',
    '      VarAcc=Hour',
    '      WRFactor=67.66',
    ...dias,
    '    End of VarSimul=viE_Grid',
  ].join('\r\n')
}

const PLANO = Array(12).fill(1000)
const VERANO = [3000, 3000, 2000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2000, 3000]

describe('eGridMensualCrudo', () => {
  it('suma las horas de cada mes, con el consumo nocturno restando', () => {
    // 2 horas de sol (1000 c/u) − 6 de noche (90 c/u) = 1460 por mes.
    expect(eGridMensualCrudo(variante(PLANO))).toEqual(Array(12).fill(1460))
  })

  it('lee solo E_Grid aunque haya otras variables antes', () => {
    expect(eGridMensualCrudo(variante(PLANO, { conRuido: true }))).toEqual(
      eGridMensualCrudo(variante(PLANO, { conRuido: false })),
    )
  })

  it('sin E_Grid horario no hay curva', () => {
    expect(eGridMensualCrudo('PVObject_=pvVCalcul\r\n  Comment=x')).toBeNull()
  })

  it('un carácter fuera del alfabeto es un archivo que no es de PVsyst: falla, no inventa', () => {
    const rota = variante(PLANO, { conRuido: false }).replace('Day_0101=', 'Day_0101=+#!')
    expect(() => eGridMensualCrudo(rota)).toThrow()
  })
})

describe('pesosDeVariantes', () => {
  it('pesa cada mes en el año y promedia los años', () => {
    const pesos = pesosDeVariantes([variante(PLANO), variante(PLANO)])!
    expect(pesos.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    pesos.forEach((p) => expect(p).toBeCloseTo(1 / 12, 10))
  })

  it('los meses fuertes pesan más', () => {
    const pesos = pesosDeVariantes([variante(VERANO)])!
    expect(pesos[0]!).toBeGreaterThan(pesos[5]!)
  })

  it('ignora las variantes sin E_Grid', () => {
    expect(pesosDeVariantes(['basura', variante(PLANO)])).toEqual(
      pesosDeVariantes([variante(PLANO)]),
    )
  })
})

describe('repartir', () => {
  it('reparte el anual de TSF según los pesos, en kWh', () => {
    expect(repartir(Array(12).fill(1 / 12), 1_200_000)).toEqual(Array(12).fill(100_000))
  })
})

describe('pesosDeZip', () => {
  it('lee las variantes .VC? del zip y deja fuera lo demás', async () => {
    const zip = new JSZip()
    zip.file('Planta_Project.PRJ', 'PVObject_=pvProject')
    zip.file('Planta_Project.VCD', variante(PLANO))
    zip.file('Planta_Project.VCE', variante(PLANO))
    zip.file('clima.MET', 'PVObject_=pvMeteo')
    const pesos = await pesosDeZip(await zip.generateAsync({ type: 'arraybuffer' }))
    expect(pesos).toHaveLength(12)
    pesos!.forEach((p) => expect(p).toBeCloseTo(1 / 12, 10))
  })

  it('un zip sin variantes no tiene curva', async () => {
    const zip = new JSZip()
    zip.file('informe.pdf', '%PDF')
    expect(await pesosDeZip(await zip.generateAsync({ type: 'arraybuffer' }))).toBeNull()
  })
})
