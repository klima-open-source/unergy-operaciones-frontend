/**
 * Filtros de Servicios (PPA, Representación, Operación).
 *
 * Viven fuera de `ServiciosUnificadoView.vue` por dos razones concretas: el
 * componente tiene 1838 líneas y está en `LEGACY_PENDIENTE_DE_MIGRAR` del
 * eslint, así que nada de lo que se escriba adentro se lintea ni se puede
 * probar.
 *
 * El filtrado es en JS plano y no dentro del DataTable, siguiendo la decisión
 * que ya documenta la vista para los filtros de Proyectos: el contador del
 * subtítulo ("33 de 33") y el Excel leen `filasVisibles`, no la tabla, así que
 * filtrar en la tabla dejaría el Excel exportando filas que no se ven.
 */
import { describe, expect, it } from 'vitest'

import {
  ConProyecto,
  FILTROS_PPA_VACIOS,
  FILTROS_SERVICIO_VACIOS,
  contarActivos,
  depurarFiltros,
  filtrarPpa,
  filtrarServicios,
  opcionesDe,
  tiposDePlantaPresentes,
} from './filtrosServicios'

const PPA = [
  {
    id: 1,
    comprador_nombre: 'Terpel',
    vendedor_nombre: 'Unergy',
    tipo_contrato: 'venta',
    _vigencia: { clave: 'vigente' },
  },
  {
    id: 2,
    comprador_nombre: 'Terpel',
    vendedor_nombre: 'Celsia',
    tipo_contrato: 'compra',
    _vigencia: { clave: 'vencido' },
  },
  {
    id: 3,
    comprador_nombre: 'Éxito',
    vendedor_nombre: 'Unergy',
    tipo_contrato: 'venta',
    _vigencia: { clave: 'por_vencer' },
  },
]

const SERVICIOS = [
  {
    id: 1,
    servicio_aplica: 'representacion',
    estado: 'vigente',
    inversionista_nombre: 'PA Sol',
    portafolio: 'Norte',
    proyecto_id: 10,
    proyecto: { id: 10, nombre_comercial: 'GD NAOS 1', tipo_proyecto: 'gd' },
  },
  {
    id: 2,
    servicio_aplica: 'representacion',
    estado: 'terminado',
    inversionista_nombre: 'PA Luna',
    portafolio: 'Norte',
    proyecto_id: null,
  },
  {
    id: 3,
    servicio_aplica: 'mantenimiento',
    estado: 'vigente',
    contratante_nombre: 'Unergy',
    prestador_nombre: 'Solenium',
    proyecto_id: 11,
    proyecto: { id: 11, nombre_comercial: 'MGS 0018 La Paz Leyenda', tipo_proyecto: 'minigranja' },
  },
  {
    id: 4,
    servicio_aplica: 'arriendo',
    estado: 'vigente',
    contratante_nombre: 'Unergy',
    prestador_nombre: 'Don José',
    proyecto_id: null,
  },
]

const ids = (filas: { id: number }[]) => filas.map((f) => f.id)

// ── PPA ───────────────────────────────────────────────────────────────────────

describe('filtrarPpa', () => {
  it('sin filtros devuelve todo', () => {
    expect(ids(filtrarPpa(PPA, FILTROS_PPA_VACIOS))).toEqual([1, 2, 3])
  })

  it('filtra por estado de vigencia', () => {
    const r = filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, estado: 'vencido' })
    expect(ids(r)).toEqual([2])
  })

  it('filtra por tipo de contrato', () => {
    expect(ids(filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, tipo: 'venta' }))).toEqual([1, 3])
  })

  it('filtra por comprador y por vendedor', () => {
    expect(ids(filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, comprador: 'Terpel' }))).toEqual([1, 2])
    expect(ids(filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, vendedor: 'Unergy' }))).toEqual([1, 3])
  })

  it('combina los filtros con Y, no con O', () => {
    const r = filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, comprador: 'Terpel', tipo: 'venta' })
    expect(ids(r)).toEqual([1])
  })

  it('devuelve vacío cuando nada coincide, sin romperse', () => {
    expect(filtrarPpa(PPA, { ...FILTROS_PPA_VACIOS, comprador: 'Nadie' })).toEqual([])
  })
})

// ── Representación / Operación ────────────────────────────────────────────────

describe('filtrarServicios', () => {
  it('sin filtros devuelve todo', () => {
    expect(ids(filtrarServicios(SERVICIOS, FILTROS_SERVICIO_VACIOS))).toEqual([1, 2, 3, 4])
  })

  it('filtra por tipo de servicio (la columna que separa Operación)', () => {
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, tipo: 'arriendo' })),
    ).toEqual([4])
  })

  it('filtra por estado del contrato', () => {
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, estado: 'terminado' })),
    ).toEqual([2])
  })

  it('filtra por inversionista y por portafolio', () => {
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, inversionista: 'PA Sol' })),
    ).toEqual([1])
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, portafolio: 'Norte' })),
    ).toEqual([1, 2])
  })

  it('filtra por contratante y por prestador', () => {
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, prestador: 'Solenium' })),
    ).toEqual([3])
    expect(
      ids(filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, contratante: 'Unergy' })),
    ).toEqual([3, 4])
  })

  it('aísla los contratos sin proyecto asociado', () => {
    const sin = filtrarServicios(SERVICIOS, {
      ...FILTROS_SERVICIO_VACIOS,
      proyecto: ConProyecto.SIN,
    })
    expect(ids(sin)).toEqual([2, 4])
  })

  it('y los que sí lo tienen', () => {
    const con = filtrarServicios(SERVICIOS, {
      ...FILTROS_SERVICIO_VACIOS,
      proyecto: ConProyecto.CON,
    })
    expect(ids(con)).toEqual([1, 3])
  })

  it('trata proyecto_id = 0 como sin proyecto', () => {
    // Defensa: un id 0 es falsy y no debe colarse como "con proyecto".
    const filas = [{ id: 9, proyecto_id: 0 }]
    expect(
      ids(filtrarServicios(filas, { ...FILTROS_SERVICIO_VACIOS, proyecto: ConProyecto.CON })),
    ).toEqual([])
    expect(
      ids(filtrarServicios(filas, { ...FILTROS_SERVICIO_VACIOS, proyecto: ConProyecto.SIN })),
    ).toEqual([9])
  })
})

// ── Tipo de planta ────────────────────────────────────────────────────────────
//
// Se llama "tipo de planta" y no "tipo" porque en Operación ya hay una columna
// Tipo, la del contrato (mantenimiento/arriendo/internet). Son dos cosas
// distintas y quedan una al lado de la otra.

describe('filtrarServicios por tipo de planta', () => {
  it('filtra por el tipo del proyecto asociado, que es un campo anidado', () => {
    const gd = filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, tipoPlanta: 'gd' })
    expect(ids(gd)).toEqual([1])
  })

  it('distingue minigranja de GD', () => {
    const mg = filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, tipoPlanta: 'minigranja' })
    expect(ids(mg)).toEqual([3])
  })

  it('deja fuera los contratos sin planta, que no tienen tipo', () => {
    // Los huérfanos (2 y 4) no tienen `proyecto`, así que ningún tipo los toma.
    const gd = filtrarServicios(SERVICIOS, { ...FILTROS_SERVICIO_VACIOS, tipoPlanta: 'gd' })
    expect(ids(gd)).not.toContain(2)
    expect(ids(gd)).not.toContain(4)
  })

  it('se combina con los demás filtros', () => {
    const r = filtrarServicios(SERVICIOS, {
      ...FILTROS_SERVICIO_VACIOS,
      tipoPlanta: 'gd',
      estado: 'terminado',
    })
    expect(ids(r)).toEqual([])
  })
})

describe('tiposDePlantaPresentes', () => {
  it('saca los tipos que de verdad hay entre las filas, ordenados', () => {
    expect(tiposDePlantaPresentes(SERVICIOS)).toEqual(['gd', 'minigranja'])
  })

  it('ignora los contratos sin planta', () => {
    expect(tiposDePlantaPresentes([{ id: 1, proyecto: null }])).toEqual([])
  })

  it('devuelve [] sin filas', () => {
    expect(tiposDePlantaPresentes([])).toEqual([])
  })
})

// ── Contador (para el botón "Limpiar filtros") ────────────────────────────────

describe('contarActivos', () => {
  it('no cuenta los vacíos', () => {
    expect(contarActivos(FILTROS_PPA_VACIOS)).toBe(0)
    expect(contarActivos(FILTROS_SERVICIO_VACIOS)).toBe(0)
  })

  it('cuenta uno por filtro puesto', () => {
    expect(contarActivos({ ...FILTROS_PPA_VACIOS, estado: 'vigente' })).toBe(1)
    expect(contarActivos({ ...FILTROS_PPA_VACIOS, estado: 'vigente', tipo: 'venta' })).toBe(2)
  })

  it('una cadena vacía no cuenta como filtro', () => {
    expect(contarActivos({ ...FILTROS_PPA_VACIOS, comprador: '' })).toBe(0)
  })
})

// ── Opciones de los desplegables ──────────────────────────────────────────────

describe('opcionesDe', () => {
  it('saca los valores únicos presentes, ordenados en español', () => {
    // "Éxito" antes que "Terpel": se ordena con `localeCompare('es')`, no por
    // código de carácter (donde la É tildada caería al final).
    expect(opcionesDe(PPA, 'comprador_nombre')).toEqual([
      { label: 'Éxito', value: 'Éxito' },
      { label: 'Terpel', value: 'Terpel' },
    ])
  })

  it('ignora nulos y vacíos', () => {
    const filas = [
      { portafolio: 'Norte' },
      { portafolio: null },
      { portafolio: '' },
      { portafolio: 'Norte' },
    ]
    expect(opcionesDe(filas, 'portafolio')).toEqual([{ label: 'Norte', value: 'Norte' }])
  })

  it('devuelve [] sin filas', () => {
    expect(opcionesDe([], 'portafolio')).toEqual([])
  })
})

// ── Tolerancia a links viejos ─────────────────────────────────────────────────

describe('depurarFiltros', () => {
  it('descarta un valor que ya no existe en los datos', () => {
    // Un link compartido hace meses puede nombrar un inversionista que ya no
    // está: aplicarlo dejaría la tabla vacía con un filtro que nadie entiende.
    const sucio = { ...FILTROS_SERVICIO_VACIOS, inversionista: 'PA Que Ya No Existe' }
    const limpio = depurarFiltros(sucio, { inversionista: ['PA Sol', 'PA Luna'] })
    expect(limpio.inversionista).toBeNull()
  })

  it('conserva los valores que sí existen', () => {
    const sucio = { ...FILTROS_SERVICIO_VACIOS, inversionista: 'PA Sol' }
    const limpio = depurarFiltros(sucio, { inversionista: ['PA Sol', 'PA Luna'] })
    expect(limpio.inversionista).toBe('PA Sol')
  })

  it('no toca las claves de las que no se le dio lista de válidos', () => {
    const sucio = { ...FILTROS_SERVICIO_VACIOS, estado: 'vigente' }
    expect(depurarFiltros(sucio, {}).estado).toBe('vigente')
  })
})
