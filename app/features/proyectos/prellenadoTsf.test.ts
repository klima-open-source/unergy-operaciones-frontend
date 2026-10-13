import { describe, expect, it } from 'vitest'
import type { ProyectoTsf } from '~/features/proyectos/types'
import { faltanEnOperaciones, prellenadoDesdeTsf, proyectoExistente } from './prellenadoTsf'

const TSF: ProyectoTsf = {
  minigranjaId: 1913,
  codigoOrigina: 'COLCEST456P1_BOSCONIA_ORIENTE',
  codigoTsf: 'COLCEST456P1',
  nombreSugerido: 'Bosconia Oriente',
  etapa: 'Firmado',
  departamento: 'Cesar',
  municipio: 'Bosconia',
  latitud: 9.88,
  longitud: -73.76,
  operadorRed: 'Afinia',
  operadorRedCodigo: 'afinia',
  tipoProyecto: 'minigranja',
  p50MensualKwh: Array(12).fill(100_000),
  p90MensualKwh: null,
  inversionistas: [],
}

const DIVIPOLA = { Cesar: ['Agustín Codazzi', 'Bosconia'], 'Bogotá D.C.': ['Bogotá D.C.'] }
const OPERADORES = [
  {
    id: 4,
    nombre_comercial: 'AFINIA',
    nombre_legal: 'Caribe Mar de la Costa S.A.S. E.S.P.',
    codigo_originabot: 'afinia',
  },
  { id: 5, nombre_comercial: null, nombre_legal: 'Electrificadora del Huila' },
]

describe('prellenadoDesdeTsf', () => {
  it('prellena todo lo que encaja y lo bloquea', () => {
    const p = prellenadoDesdeTsf(TSF, DIVIPOLA, OPERADORES)

    expect(p.valores).toEqual({
      nombre_comercial: 'Bosconia Oriente',
      codigo_tsf: 'COLCEST456P1',
      origina_code: 'COLCEST456P1_BOSCONIA_ORIENTE',
      originabot_minifarm_id: 1913,
      origen: 'originabot',
      tipo_proyecto: 'minigranja',
      departamento: 'Cesar',
      municipio: 'Bosconia',
      latitud: 9.88,
      longitud: -73.76,
      operador_red_id: 4,
    })
    expect(p.bloqueados.sort()).toEqual(
      [
        'codigo_tsf',
        'coordenadas',
        'departamento',
        'municipio',
        'operador_red_id',
        'p50_mensual',
        'tipo_proyecto',
      ].sort(),
    )
    expect(p.sinCoincidencia).toEqual([])
  })

  it('el nombre comercial se prellena pero nunca se bloquea: es derivado, no un dato de TSF', () => {
    expect(prellenadoDesdeTsf(TSF, DIVIPOLA, OPERADORES).bloqueados).not.toContain(
      'nombre_comercial',
    )
  })

  it('el operador se cruza por su code de originabot, aunque el nombre no se parezca', () => {
    const p = prellenadoDesdeTsf(
      { ...TSF, operadorRed: 'Caribemar', operadorRedCodigo: 'afinia' },
      DIVIPOLA,
      OPERADORES,
    )
    expect(p.valores.operador_red_id).toBe(4)
    expect(p.bloqueados).toContain('operador_red_id')
  })

  it('sin code (TSF no lo trajo), cae al nombre: sin mayúsculas ni tildes', () => {
    const p = prellenadoDesdeTsf({ ...TSF, operadorRedCodigo: null }, DIVIPOLA, OPERADORES)
    expect(p.valores.operador_red_id).toBe(4)
  })

  it('compara sin tildes: "Agustin Codazzi" de TSF encaja con el de DIVIPOLA', () => {
    const p = prellenadoDesdeTsf({ ...TSF, municipio: 'Agustin Codazzi' }, DIVIPOLA, OPERADORES)
    expect(p.valores.municipio).toBe('Agustín Codazzi')
  })

  it('lo que no está en el catálogo queda vacío, editable y avisado', () => {
    const p = prellenadoDesdeTsf(
      {
        ...TSF,
        departamento: 'Cundinamarca',
        municipio: 'Cota',
        operadorRed: 'Enel',
        operadorRedCodigo: 'enel',
      },
      DIVIPOLA,
      OPERADORES,
    )

    expect(p.valores.departamento).toBeNull()
    expect(p.valores.municipio).toBeNull()
    expect(p.valores.operador_red_id).toBeNull()
    expect(p.bloqueados).not.toContain('departamento')
    expect(p.bloqueados).not.toContain('municipio')
    expect(p.bloqueados).not.toContain('operador_red_id')
    expect(p.sinCoincidencia).toEqual([
      'Departamento: «Cundinamarca»',
      'Municipio: «Cota»',
      'Operador de red: «Enel»',
    ])
  })

  it('lo que TSF no trae no se bloquea ni se avisa', () => {
    const p = prellenadoDesdeTsf(
      { ...TSF, codigoTsf: null, latitud: null, tipoProyecto: null, operadorRed: null },
      DIVIPOLA,
      OPERADORES,
    )
    expect(p.bloqueados).not.toContain('codigo_tsf')
    expect(p.bloqueados).not.toContain('coordenadas')
    expect(p.bloqueados).not.toContain('tipo_proyecto')
    expect(p.valores.longitud).toBeNull()
    expect(p.sinCoincidencia).toEqual([])
  })
})

describe('proyectoExistente', () => {
  const proyectos = [
    { id: 1, codigo_tsf: 'COLCEST456P1', origina_code: null },
    { id: 2, codigo_tsf: null, origina_code: 'COLCEST999P1_OTRO' },
  ]

  it('reconoce el proyecto por su código TSF', () => {
    expect(proyectoExistente(TSF, proyectos)?.id).toBe(1)
  })

  it('o por el código completo de origina', () => {
    expect(
      proyectoExistente(
        { codigoTsf: 'COLCEST999P2', codigoOrigina: 'COLCEST999P1_OTRO' },
        proyectos,
      )?.id,
    ).toBe(2)
  })

  it('sin coincidencia, null: se puede importar', () => {
    expect(
      proyectoExistente({ codigoTsf: 'COLX1P1', codigoOrigina: 'COLX1P1_X' }, proyectos),
    ).toBeNull()
  })
})

describe('simulación mensual', () => {
  it('la fila que TSF trae se prellena y se bloquea; la que no, queda editable', () => {
    const p = prellenadoDesdeTsf(TSF, DIVIPOLA, OPERADORES)
    expect(p.simulacion).toEqual({ p50: Array(12).fill(100_000), p90: null })
    expect(p.bloqueados).toContain('p50_mensual')
    expect(p.bloqueados).not.toContain('p90_mensual')
  })
})

describe('faltanEnOperaciones', () => {
  const resultado = (minigranjaId: number, codigo: string) => ({
    minigranjaId,
    codigo,
    etapa: 'operation',
    etapaLabel: 'Operación',
    ubicacion: null,
    operadorRed: null,
  })

  it('sugiere solo los de TSF que no tienen planta aquí', () => {
    const tsf = [
      resultado(1913, 'COLCEST456P1_BOSCONIA_ORIENTE'), // por código CREG
      resultado(253, 'Minigranja 0030 - Chimá Oriente'), // renombrada: solo por id
      resultado(77, 'COLX77P1_SITIO'), // por origina_code
      resultado(500, 'MiniGranja - Malula - Mendoza'), // no está
    ]
    const plantas = [
      { codigo_tsf: 'COLCEST456P1' },
      { originabot_minifarm_id: 253, codigo_tsf: 'COLCORT7P1' },
      { origina_code: 'COLX77P1_SITIO' },
    ]
    expect(faltanEnOperaciones(tsf, plantas).map((r) => r.minigranjaId)).toEqual([500])
  })

  it('una renombrada sin la llave guardada se sugiere: por eso existe vincular_minigranjas_originabot', () => {
    const tsf = [resultado(253, 'Minigranja 0030 - Chimá Oriente')]
    expect(faltanEnOperaciones(tsf, [{ codigo_tsf: 'COLCORT7P1' }])).toHaveLength(1)
  })
})

describe('proyectoExistente por llave', () => {
  it('reconoce la planta por su minigranja aunque no compartan código', () => {
    const plantas = [{ id: 9, originabot_minifarm_id: 1913, codigo_tsf: null, origina_code: null }]
    expect(
      proyectoExistente(
        { minigranjaId: 1913, codigoTsf: null, codigoOrigina: 'Otro nombre' },
        plantas,
      )?.id,
    ).toBe(9)
  })
})
