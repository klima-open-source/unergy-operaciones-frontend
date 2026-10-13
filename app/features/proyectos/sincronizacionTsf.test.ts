import { describe, expect, it } from 'vitest'
import type { ProyectoTsf } from '~/features/proyectos/types'
import {
  cambiosDesdeTsf,
  listaEs,
  marca,
  marcaSeguidor,
  payloadsDe,
  tipoTracker,
} from './sincronizacionTsf'

const TSF: ProyectoTsf = {
  minigranjaId: 3094,
  codigoOrigina: 'COLLAGT17P2_EL-MOLINO_OCCIDENTE',
  codigoTsf: 'COLLAGT17P2',
  nombreSugerido: 'El Molino Occidente',
  etapa: 'Construcción',
  departamento: 'La Guajira',
  municipio: 'El Molino',
  latitud: 10.653,
  longitud: -72.946,
  operadorRed: 'Air-e',
  operadorRedCodigo: 'aire',
  tipoProyecto: 'minigranja',
  p50MensualKwh: Array(12).fill(100_000),
  p90MensualKwh: null,
  inversionistas: [],
  tecnico: {
    modulos: 2016,
    strings: 72,
    inversores: 4,
    kwpDc: 1320.48,
    kwAc: 990,
    paneles: [{ fabricante: 'Jinkosolar 2025', modelo: 'JKM655N', potencia: 655 }],
    equiposInversor: [{ fabricante: 'Huawei Technologies', modelo: 'SUN2000', potencia: 247.5 }],
    sistema: 'Tracker Zentrack 1P',
  },
  voltajeRed: '13.8',
  ecs: {
    estado: 'ECS aprobado',
    codigoInsumo: '32313468',
    vencimiento: '2027-01-10',
    archivoUrl: 'https://b2/ecs.pdf',
    conformidadUrl: null,
  },
  arriendo: null,
}

const DIVIPOLA = { 'La Guajira': ['El Molino', 'Riohacha'] }
const OPERADORES = [
  { id: 2, nombre_comercial: 'Air-e', nombre_legal: 'AIR-E', codigo_originabot: 'aire' },
]

describe('formato de Operaciones', () => {
  it('marcas con solo el fabricante', () => {
    expect(marca([{ fabricante: 'Huawei Technologies', modelo: null, potencia: null }])).toBe(
      'Huawei',
    )
  })
  it('potencias como lista en español', () => {
    expect(listaEs(['300', '50', '40'])).toBe('300, 50 y 40')
    expect(listaEs(['247.5'])).toBe('247.5')
  })
  it('tracker y seguidor desde el SystemKind de PVsyst', () => {
    expect(tipoTracker('Tracker Zentrack 1P')).toBe('1P')
    expect(marcaSeguidor('Tracker Zentrack 1P')).toBe('Zentrack')
    expect(tipoTracker('Fixed tilted plane')).toBeNull()
    expect(marcaSeguidor('Fixed tilted plane')).toBeNull()
  })
})

describe('cambiosDesdeTsf', () => {
  it('en una planta vacía propone todo lo que TSF trae', () => {
    const cambios = cambiosDesdeTsf(TSF, { info_tecnica: null }, DIVIPOLA, OPERADORES)
    const por = Object.fromEntries(cambios.map((c) => [c.clave, c]))
    expect(por.capacidad_instalada_kwp?.valor).toBe(1320.48)
    expect(por.potencia_panel_kwp?.valor).toBe('0.655')
    expect(por.marca_paneles?.valor).toBe('Jinkosolar')
    expect(por.potencia_inversores_kwp?.valor).toBe('247.5')
    expect(por.marca_inversores?.valor).toBe('Huawei')
    expect(por.tipo_tracker?.valor).toBe('1P')
    expect(por.marca_seguidor_solar?.valor).toBe('Zentrack')
    expect(por.potencia_ac_kw?.valor).toBe(990)
    expect(por.operador_red_id?.valor).toBe(2)
    expect(por.operador_red_id?.propuestoTexto).toBe('Air-e')
    expect(por.ecs_estado?.valor).toBe('ECS aprobado')
    expect(por.p50_mensual_kwh?.propuestoTexto).toBe('12 meses · 1.200.000 kWh/año')
    // Lo que TSF no trae no se propone.
    expect(por.p90_mensual_kwh).toBeUndefined()
    expect(por.ecs_conformidad_url).toBeUndefined()
  })

  it('lo que ya coincide no se propone, aunque venga como texto del DecimalField', () => {
    const cambios = cambiosDesdeTsf(
      TSF,
      {
        codigo_tsf: 'COLLAGT17P2',
        potencia_ac_kw: '990.000',
        info_tecnica: { capacidad_instalada_kwp: '1320.480', marca_inversores: 'Huawei' },
      },
      DIVIPOLA,
      OPERADORES,
    )
    const claves = cambios.map((c) => c.clave)
    expect(claves).not.toContain('codigo_tsf')
    expect(claves).not.toContain('potencia_ac_kw')
    expect(claves).not.toContain('capacidad_instalada_kwp')
    expect(claves).not.toContain('marca_inversores')
  })

  it('el voltaje conserva la baja tensión y no se propone si la media coincide', () => {
    const igual = cambiosDesdeTsf(
      TSF,
      { info_tecnica: { voltaje_red: '13.8/800' } },
      DIVIPOLA,
      OPERADORES,
    )
    expect(igual.find((c) => c.clave === 'voltaje_red')).toBeUndefined()

    const distinto = cambiosDesdeTsf(
      TSF,
      { info_tecnica: { voltaje_red: '34.5/800' } },
      DIVIPOLA,
      OPERADORES,
    )
    expect(distinto.find((c) => c.clave === 'voltaje_red')?.valor).toBe('13.8/800')
  })

  it('agrupa lo elegido por endpoint', () => {
    const cambios = cambiosDesdeTsf(TSF, { info_tecnica: null }, DIVIPOLA, OPERADORES).filter((c) =>
      ['potencia_ac_kw', 'cantidad_strings'].includes(c.clave),
    )
    expect(payloadsDe(cambios)).toEqual({
      proyecto: { potencia_ac_kw: 990 },
      infoTecnica: { cantidad_strings: 72 },
    })
  })
})

describe('tipo de proyecto en la sincronización', () => {
  it('nunca reemplaza el tipo que ya tiene la planta (gd no es minigranja)', () => {
    const cambios = cambiosDesdeTsf(
      TSF,
      { tipo_proyecto: 'gd', info_tecnica: null },
      DIVIPOLA,
      OPERADORES,
    )
    expect(cambios.find((c) => c.clave === 'tipo_proyecto')).toBeUndefined()
  })
  it('sí llena un tipo vacío', () => {
    const cambios = cambiosDesdeTsf(
      TSF,
      { tipo_proyecto: null, info_tecnica: null },
      DIVIPOLA,
      OPERADORES,
    )
    expect(cambios.find((c) => c.clave === 'tipo_proyecto')?.valor).toBe('minigranja')
  })
})
