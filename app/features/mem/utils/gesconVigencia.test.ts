/**
 * Vigencia de registros GESCON/ASIC: qué contratos y qué plantas siguen
 * inscritas en un SIC a una fecha dada.
 */
import type { RegistroAsicVigencia } from './gesconVigencia'
import { describe, expect, it } from 'vitest'
import {
  esVersionDeContrato,
  filaIdentidad,
  fmtFecha,
  modalidadTexto,
  opcionesSicVigentes,
  parseIso,
  pctTexto,
  plantasInscritas,
  toIso,
} from './gesconVigencia'

describe('esVersionDeContrato', () => {
  it('es vigente si es registro/modificación y es_version_vigente', () => {
    expect(esVersionDeContrato({ tipo_solicitud: 'registro', es_version_vigente: true })).toBe(true)
    expect(esVersionDeContrato({ tipo_solicitud: 'modificacion', es_version_vigente: true })).toBe(true)
  })

  it('no cuenta terminaciones ni desistimientos, aunque digan vigente', () => {
    expect(esVersionDeContrato({ tipo_solicitud: 'terminacion', es_version_vigente: true })).toBe(false)
    expect(esVersionDeContrato({ tipo_solicitud: 'desistimiento', es_version_vigente: true })).toBe(false)
  })

  it('no cuenta una fila superada, aunque su fecha_fin diga futuro', () => {
    expect(esVersionDeContrato({ tipo_solicitud: 'registro', es_version_vigente: false })).toBe(false)
  })
})

describe('opcionesSicVigentes', () => {
  const rows: RegistroAsicVigencia[] = [
    {
      id: 1,
      tipo_solicitud: 'registro',
      es_version_vigente: true,
      codigo_sic_contrato: '88806',
      contrato_interno: 'UNERGY 001',
      nombre_interno: 'Terpel 1',
      planta_nombre: 'La Reserva',
    },
    {
      id: 2,
      tipo_solicitud: 'terminacion',
      es_version_vigente: true,
      codigo_sic_contrato: '99999',
    },
  ]

  it('solo agrupa SIC con una versión vigente', () => {
    const opciones = opcionesSicVigentes(rows)
    expect(opciones).toHaveLength(1)
    expect(opciones[0]).toMatchObject({ sic: '88806', plantas: 'La Reserva' })
  })

  it('junta las plantas de un mismo SIC sin repetir', () => {
    const dosplantas: RegistroAsicVigencia[] = [
      ...rows,
      { id: 3, tipo_solicitud: 'registro', es_version_vigente: true, codigo_sic_contrato: '88806', planta_nombre: 'Otra planta' },
    ]
    expect(opcionesSicVigentes(dosplantas)[0]?.plantas).toBe('La Reserva · Otra planta')
  })
})

describe('plantasInscritas', () => {
  const rows: RegistroAsicVigencia[] = [
    { id: 1, tipo_solicitud: 'registro', es_version_vigente: true, codigo_sic_contrato: '89116', proyecto_id: 1, fecha_fin: '2026-12-31' },
    { id: 2, tipo_solicitud: 'registro', es_version_vigente: true, codigo_sic_contrato: '89116', proyecto_id: 2, fecha_fin_efectiva: '2026-03-01', fecha_fin: '2039-01-01' },
  ]

  it('sin fecha, trae todas las vigentes del SIC', () => {
    expect(plantasInscritas(rows, '89116')).toHaveLength(2)
  })

  it('con fecha, descarta las que ya salieron a esa fecha', () => {
    const inscritas = plantasInscritas(rows, '89116', '2026-06-01')
    expect(inscritas).toHaveLength(1)
    expect(inscritas[0]?.proyecto_id).toBe(1)
  })

  it('si a esa fecha no queda ninguna, cae a todas las vigentes', () => {
    expect(plantasInscritas(rows, '89116', '2030-01-01')).toHaveLength(2)
  })

  it('sin código SIC, no trae nada', () => {
    expect(plantasInscritas(rows, null)).toHaveLength(0)
  })
})

describe('filaIdentidad', () => {
  it('prefiere la fila con contrato_interno', () => {
    const inscritas: RegistroAsicVigencia[] = [
      { id: 1, contrato_interno: '' },
      { id: 2, contrato_interno: 'UNERGY 001' },
    ]
    expect(filaIdentidad(inscritas).id).toBe(2)
  })

  it('sin ninguna con contrato_interno, cae a la primera', () => {
    const inscritas: RegistroAsicVigencia[] = [{ id: 1 }, { id: 2 }]
    expect(filaIdentidad(inscritas).id).toBe(1)
  })

  it('sin filas, no revienta', () => {
    expect(filaIdentidad([])).toEqual({})
  })
})

describe('formato', () => {
  it('toIso normaliza string y Date a yyyy-mm-dd', () => {
    expect(toIso('2026-01-05T12:00:00')).toBe('2026-01-05')
    expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toIso(null)).toBeNull()
  })

  it('parseIso y fmtFecha son inversas razonables', () => {
    expect(parseIso('2026-01-05')?.getFullYear()).toBe(2026)
    expect(fmtFecha('2026-01-05')).toBe('05/01/2026')
    expect(fmtFecha(null)).toBe('sin fecha')
  })

  it('pctTexto multiplica la fracción por 100', () => {
    expect(pctTexto(0.835)).toBe('83.5%')
    expect(pctTexto(1)).toBe('100%')
    expect(pctTexto(null)).toBe('—')
  })

  it('modalidadTexto distingue uso del recurso, bolsa y normal', () => {
    expect(modalidadTexto({ uso_del_recurso: true })).toBe('Uso del recurso')
    expect(modalidadTexto({ es_duplicado: true })).toBe('Compra en bolsa')
    expect(modalidadTexto({})).toBe('Normal')
  })
})
