import { describe, expect, it } from 'vitest'
import { avisosCoordenadas, enlaceGoogleMaps, leerCoordenada, leerPar, mostrarCoordenada } from './coordenadas'

describe('leerCoordenada', () => {
  it('lee punto y coma como decimal', () => {
    expect(leerCoordenada('6.244203')).toBe(6.244203)
    expect(leerCoordenada('6,244203')).toBe(6.244203)
    expect(leerCoordenada('-75,581211')).toBe(-75.581211)
    expect(leerCoordenada(' 10 ')).toBe(10)
  })

  it('vacío es null', () => {
    expect(leerCoordenada('   ')).toBeNull()
  })

  it('rechaza lo que no es una coordenada', () => {
    expect(leerCoordenada('6.244.203')).toBeUndefined()
    expect(leerCoordenada('1.000,5')).toBeUndefined()
    expect(leerCoordenada('abc')).toBeUndefined()
    expect(leerCoordenada('6244203')).toBeUndefined()
  })

  it('redondea a 6 decimales', () => {
    expect(leerCoordenada('6.12345678')).toBe(6.123457)
  })
})

describe('leerPar', () => {
  it('lee el par como lo copia Google Maps', () => {
    expect(leerPar('6.244203, -75.581211')).toEqual({ latitud: 6.244203, longitud: -75.581211 })
    expect(leerPar('6.244203,-75.581211')).toEqual({ latitud: 6.244203, longitud: -75.581211 })
  })

  it('acepta coma decimal si el separador es punto y coma o espacio', () => {
    expect(leerPar('6,244203; -75,581211')).toEqual({ latitud: 6.244203, longitud: -75.581211 })
    expect(leerPar('6,244203 -75,581211')).toEqual({ latitud: 6.244203, longitud: -75.581211 })
  })

  it('una sola coordenada con coma decimal no es un par', () => {
    expect(leerPar('6,24')).toBeNull()
    expect(leerPar('6.244203')).toBeNull()
  })
})

describe('mostrarCoordenada', () => {
  it('muestra con coma y sin miles', () => {
    expect(mostrarCoordenada(-75.581211)).toBe('-75,581211')
    expect(mostrarCoordenada('10.344512')).toBe('10,344512')
    expect(mostrarCoordenada(null)).toBe('')
  })
})

describe('avisosCoordenadas', () => {
  it('sin avisos dentro de Colombia', () => {
    expect(avisosCoordenadas(6.244203, -75.581211)).toEqual([])
  })

  it('detecta el par invertido', () => {
    expect(avisosCoordenadas(-75.581211, 6.244203)).toEqual(['Parece que la latitud y la longitud están invertidas.'])
  })

  it('detecta el signo menos olvidado en la longitud', () => {
    expect(avisosCoordenadas(6.244203, 75.581211)).toEqual(['A la longitud le falta el signo menos: en Colombia es negativa.'])
  })

  it('avisa si la latitud está fuera', () => {
    expect(avisosCoordenadas(40.4, -75.5)).toHaveLength(1)
  })

  it('no avisa de lo que falta', () => {
    expect(avisosCoordenadas(null, null)).toEqual([])
  })
})

describe('enlaceGoogleMaps', () => {
  it('arma el enlace con el punto', () => {
    expect(enlaceGoogleMaps(6.2, -75.5)).toBe('https://www.google.com/maps?q=6.2,-75.5')
  })
})
