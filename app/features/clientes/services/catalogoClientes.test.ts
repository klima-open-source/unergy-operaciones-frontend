import { describe, expect, it } from 'vitest'
import type { Cliente } from '~/types/cliente'
import { clientePorNombre } from './catalogoClientes'

const cliente = (id: number, razon_social_nombre: string) =>
  ({ id, razon_social_nombre }) as Cliente

describe('clientePorNombre', () => {
  const lista = [cliente(1, 'SOLENIUM S.A.S.'), cliente(2, 'Unergy Energía Digital S.A.S.')]

  it('empareja sin contar tildes, mayúsculas ni puntuación', () => {
    expect(clientePorNombre(lista, 'Solenium S.A.S.')?.id).toBe(1)
    expect(clientePorNombre(lista, 'UNERGY ENERGIA DIGITAL SAS')?.id).toBe(2)
  })

  it('no inventa: un nombre que no está, o vacío, no empareja', () => {
    expect(clientePorNombre(lista, 'Otra Empresa')).toBeNull()
    expect(clientePorNombre(lista, '  ')).toBeNull()
  })

  it('con dos clientes que se llaman igual no elige ninguno', () => {
    expect(clientePorNombre([...lista, cliente(3, 'Solenium SAS')], 'Solenium S.A.S.')).toBeNull()
  })
})
