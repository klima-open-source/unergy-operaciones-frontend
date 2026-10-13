/**
 * Partir un rango de fechas en bloques para consultar al SIMEM.
 *
 * El SIMEM devuelve 502 cuando se le pide demasiado de una vez, así que los
 * rangos largos se parten. Cuánto aguanta depende de la granularidad del
 * dataset: los horarios/diarios traen 24 filas por día y por eso el bloque es
 * corto; los mensuales traen una por mes y aguantan un año.
 *
 * Portado del HTML suelto, donde esto ya estaba calibrado contra el servicio
 * real. Lo que se prueba acá es que los bloques CUBRAN el rango exacto, sin
 * huecos ni solapes: un día repetido duplica filas y uno saltado las pierde, y
 * las dos cosas pasan calladas.
 */
import { describe, expect, it } from 'vitest'
import { DIAS_MAXIMO_PESADO, diasEntre, esMensual, esPesado, partirRango, tamanoBloque } from './simemRangos'

describe('partirRango', () => {
  it('un rango que cabe en un bloque no se parte', () => {
    expect(partirRango('2026-09-01', '2026-09-20', 28)).toEqual([
      { inicio: '2026-09-01', fin: '2026-09-20' },
    ])
  })

  it('parte en bloques del tamaño pedido', () => {
    const bloques = partirRango('2026-01-01', '2026-03-01', 28)
    expect(bloques).toEqual([
      { inicio: '2026-01-01', fin: '2026-01-28' },
      { inicio: '2026-01-29', fin: '2026-02-25' },
      { inicio: '2026-02-26', fin: '2026-03-01' },
    ])
  })

  it('los bloques son contiguos: sin huecos ni días repetidos', () => {
    const bloques = partirRango('2026-01-01', '2026-06-30', 28)
    for (let i = 1; i < bloques.length; i++) {
      const finAnterior = new Date(`${bloques[i - 1]!.fin}T00:00:00Z`)
      const inicio = new Date(`${bloques[i]!.inicio}T00:00:00Z`)
      expect(inicio.getTime() - finAnterior.getTime()).toBe(86_400_000) // un día exacto
    }
  })

  it('el último bloque termina en la fecha pedida, no después', () => {
    const bloques = partirRango('2026-01-01', '2026-02-10', 28)
    expect(bloques.at(-1)!.fin).toBe('2026-02-10')
  })

  it('un solo día devuelve un bloque de ese día', () => {
    expect(partirRango('2026-09-15', '2026-09-15', 28)).toEqual([
      { inicio: '2026-09-15', fin: '2026-09-15' },
    ])
  })

  it('cruza el cambio de año sin desalinearse', () => {
    const bloques = partirRango('2025-12-20', '2026-01-20', 28)
    expect(bloques[0]).toEqual({ inicio: '2025-12-20', fin: '2026-01-16' })
    expect(bloques.at(-1)!.fin).toBe('2026-01-20')
  })

  it('un rango al revés no devuelve nada', () => {
    // Mejor vacío que un bucle infinito o un bloque sin sentido.
    expect(partirRango('2026-09-20', '2026-09-01', 28)).toEqual([])
  })
})

describe('diasEntre', () => {
  it('cuenta los días del rango', () => {
    expect(diasEntre('2026-09-01', '2026-09-30')).toBe(29)
  })

  it('el mismo día son cero días', () => {
    expect(diasEntre('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('no se descuadra con el cambio de hora ni con febrero', () => {
    expect(diasEntre('2024-02-01', '2024-03-01')).toBe(29) // 2024 es bisiesto
  })
})

describe('tamanoBloque', () => {
  it('los mensuales aguantan un año', () => {
    expect(tamanoBloque('C8381F')).toBe(365)
  })

  it('los horarios van en bloques cortos', () => {
    // 709b84 es horario: 24 filas por día.
    expect(tamanoBloque('709b84')).toBe(28)
  })

  it('el id del dataset no distingue mayúsculas', () => {
    expect(esMensual('c8381f')).toBe(true)
    expect(esMensual('C8381F')).toBe(true)
  })

  it('un dataset desconocido se trata como horario', () => {
    // Pedir de menos nunca rompe; pedir de más devuelve 502.
    expect(tamanoBloque('ZZZZZZ')).toBe(28)
  })
})


// ── Los datasets de generación, que son enormes ─────────────────────────────
//
// Medido contra SIMEM el 2026-10-08: generación real, ideal y disponibilidad
// traen ~47.000 filas POR DÍA, y entre 3 y 6 segundos cada consulta. Generación
// programada llegó a 1,44 millones de filas en una semana de 2025.
//
// Con bloques de 28 días una sola llamada pediría más de un millón de filas: el
// SIMEM responde 502 o el navegador se cae. Van de a un día, que además hace
// visible el progreso.

describe('datasets pesados', () => {
  it.each(['055A4D', 'E17D25', '2d5afe', 'AB7D7F', '24F4EC', '9E77E5'])(
    '%s va de a un día', (id) => {
      expect(esPesado(id)).toBe(true)
      expect(tamanoBloque(id)).toBe(1)
    },
  )

  it('el id no distingue mayúsculas', () => {
    expect(esPesado('055a4d')).toBe(true)
  })

  it('pesado le gana a mensual si alguna vez coincidieran', () => {
    // El bloque chico nunca rompe; el grande sí.
    expect(tamanoBloque('2d5afe')).toBe(1)
  })

  it('un rango de una semana son siete bloques', () => {
    expect(partirRango('2026-09-01', '2026-09-07', tamanoBloque('055A4D'))).toHaveLength(7)
  })

  it('el tope deja pedir un mes completo', () => {
    // La traída por bloques ya resuelve el volumen: el tope no debe impedir lo
    // que la herramienta anterior sí permitía.
    expect(DIAS_MAXIMO_PESADO).toBeGreaterThanOrEqual(31)
  })

  it('un dataset normal no es pesado', () => {
    expect(esPesado('E4CE10')).toBe(false)
    expect(tamanoBloque('E4CE10')).toBe(28)
  })
})
