import { describe, expect, it } from 'vitest'
import type { ProyectoTsf } from '~/features/proyectos/types'
import { prellenadoDesdeTsf, proyectoExistente } from './prellenadoTsf'

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
  tipoProyecto: 'minigranja',
}

const DIVIPOLA = { Cesar: ['Agustín Codazzi', 'Bosconia'], 'Bogotá D.C.': ['Bogotá D.C.'] }
const OPERADORES = [
  { id: 4, nombre_comercial: 'AFINIA', nombre_legal: 'Caribe Mar de la Costa S.A.S. E.S.P.' },
  { id: 5, nombre_comercial: null, nombre_legal: 'Electrificadora del Huila' },
]

describe('prellenadoDesdeTsf', () => {
  it('prellena todo lo que encaja y lo bloquea', () => {
    const p = prellenadoDesdeTsf(TSF, DIVIPOLA, OPERADORES)

    expect(p.valores).toEqual({
      nombre_comercial: 'Bosconia Oriente',
      codigo_tsf: 'COLCEST456P1',
      origina_code: 'COLCEST456P1_BOSCONIA_ORIENTE',
      origen: 'originabot',
      tipo_proyecto: 'minigranja',
      departamento: 'Cesar',
      municipio: 'Bosconia',
      latitud: 9.88,
      longitud: -73.76,
      // "Afinia" contra "AFINIA": se compara sin mayúsculas ni tildes.
      operador_red_id: 4,
    })
    expect(p.bloqueados.sort()).toEqual(
      [
        'codigo_tsf',
        'coordenadas',
        'departamento',
        'municipio',
        'operador_red_id',
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

  it('compara sin tildes: "Agustin Codazzi" de TSF encaja con el de DIVIPOLA', () => {
    const p = prellenadoDesdeTsf({ ...TSF, municipio: 'Agustin Codazzi' }, DIVIPOLA, OPERADORES)
    expect(p.valores.municipio).toBe('Agustín Codazzi')
  })

  it('lo que no está en el catálogo queda vacío, editable y avisado', () => {
    const p = prellenadoDesdeTsf(
      { ...TSF, departamento: 'Cundinamarca', municipio: 'Cota', operadorRed: 'Enel' },
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
