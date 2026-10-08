/**
 * Leer el archivo `capains` de XM: el catálogo de plantas del mercado.
 *
 * Llega por el FTP de XM con nombre `capainsMMDD.tx1` y es un CSV con `;`. Una
 * fila por (planta, submercado), así que **las plantas se repiten**: hay que
 * agrupar, no contar filas. El `capains1006.tx1` del 2026-10-06 trae 1.091
 * filas para 687 plantas.
 *
 * No trae ni las unidades `Uns` ni la fecha de operación: eso se le pega aparte
 * desde el SIMEM. Este parser solo lee lo que el archivo sí tiene.
 */
import { describe, expect, it } from 'vitest'
import { fechaDeNombre, parsearCapains } from './capains'

const CABECERA = 'AGENTE;PLANTA;NOMBRE;CAPACIDAD INSTALADA;DESPACHO CENTRAL;TIPO;'
  + 'TIPO TECNOLOGIA;EXPLOTACION COMERCIAL;SUBMERCADOS DE CONSUMO ASOCIADOS'

const ARCHIVO = [
  CABECERA,
  'AAGG;3C3Z;LA SIERPE;19900;ND;O;SOL;N;3C3Z',
  'AAGG;3C3Z;LA SIERPE;19900;ND;O;SOL;N;3C41',
  'BIAG;4T9M;GD NAOS II;960;ND;O;SOL;N;4T9M',
].join('\n')

describe('parsearCapains', () => {
  it('agrupa las filas repetidas en una planta', () => {
    // LA SIERPE viene dos veces, por dos submercados: es UNA planta.
    const r = parsearCapains(ARCHIVO)
    expect(Object.keys(r)).toHaveLength(2)
    expect(r['3C3Z']).toEqual({ ag: 'AAGG', nm: 'LA SIERPE', kw: 19900, dp: 'ND', tp: 'O', tc: 'SOL' })
  })

  it('la capacidad queda como número', () => {
    expect(parsearCapains(ARCHIVO)['4T9M']!.kw).toBe(960)
  })

  it('tolera CRLF, que es como llega del FTP', () => {
    expect(Object.keys(parsearCapains(ARCHIVO.replace(/\n/g, '\r\n')))).toHaveLength(2)
  })

  it('ignora líneas vacías y la cabecera', () => {
    expect(Object.keys(parsearCapains(`${CABECERA}\n\n\n`))).toHaveLength(0)
  })

  it('una fila sin planta no entra', () => {
    expect(parsearCapains(`${CABECERA}\nAAGG;;SIN CODIGO;100;ND;O;SOL;N;X`)).toEqual({})
  })

  it('una capacidad ilegible queda en 0, no rompe el archivo entero', () => {
    const r = parsearCapains(`${CABECERA}\nAAGG;XXXX;RARA;n/a;ND;O;SOL;N;XXXX`)
    expect(r['XXXX']!.kw).toBe(0)
  })

  it('recorta los espacios de los campos', () => {
    const r = parsearCapains(`${CABECERA}\n AAGG ; 9ZZZ ; CON ESPACIOS ;100;ND;O;SOL;N;X`)
    expect(r['9ZZZ']).toMatchObject({ ag: 'AAGG', nm: 'CON ESPACIOS' })
  })

  it('un archivo que no es capains no devuelve basura', () => {
    // Mejor vacío que un catálogo inventado que reemplace al bueno.
    expect(parsearCapains('hola,mundo\n1,2')).toEqual({})
  })

  it('exige la cabecera esperada', () => {
    expect(parsearCapains('A;B;C\nAAGG;3C3Z;LA SIERPE')).toEqual({})
  })
})

describe('fechaDeNombre', () => {
  it('saca el día del nombre del archivo', () => {
    expect(fechaDeNombre('capains1006.tx1', 2026)).toBe('2026-10-06')
  })

  it('no le importan mayúsculas ni la ruta', () => {
    expect(fechaDeNombre('C:/XM/CAPAINS0531.TX1', 2026)).toBe('2026-05-31')
  })

  it('un nombre que no cuadra devuelve null en vez de una fecha inventada', () => {
    expect(fechaDeNombre('otracosa.txt', 2026)).toBeNull()
    expect(fechaDeNombre('capains99.tx1', 2026)).toBeNull()
  })

  it('un mes o día imposible no pasa', () => {
    expect(fechaDeNombre('capains1340.tx1', 2026)).toBeNull()
  })
})
