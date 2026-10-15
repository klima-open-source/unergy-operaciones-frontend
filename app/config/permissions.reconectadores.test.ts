/**
 * Los permisos del reconectador. Se perdieron una vez (2026-10-07) al resolver
 * un cambio en este archivo, y el botón de encender/apagar quedó bloqueado para
 * todos, incluidos los admin, sin que nada fallara. Esta prueba lo evita.
 *
 * Deben coincidir con el backend: `ROLES_COMANDO = ["operaciones"]` (+ admin)
 * para el ON/OFF, y solo admin para el interruptor general.
 */
import { describe, expect, it } from 'vitest'
import { ROLE_PERMISSIONS } from './permissions'
import { UserRole } from '~/types/user'

const tiene = (rol: UserRole, permiso: string) =>
  (ROLE_PERMISSIONS[rol] as readonly string[]).includes(permiso)

describe('permisos del reconectador', () => {
  it('admin y operaciones pueden encender y apagar', () => {
    expect(tiene(UserRole.ADMIN, 'reconectadores:command')).toBe(true)
    expect(tiene(UserRole.OPERACIONES, 'reconectadores:command')).toBe(true)
  })

  it('solo admin enciende o apaga el interruptor general', () => {
    expect(tiene(UserRole.ADMIN, 'reconectadores:interruptor')).toBe(true)
    for (const rol of Object.values(UserRole).filter((r) => r !== UserRole.ADMIN)) {
      expect(tiene(rol, 'reconectadores:interruptor')).toBe(false)
    }
  })

  it('los demás roles no mandan comandos', () => {
    const otros = Object.values(UserRole).filter(
      (r) => r !== UserRole.ADMIN && r !== UserRole.OPERACIONES,
    )
    for (const rol of otros) expect(tiene(rol, 'reconectadores:command')).toBe(false)
  })
})
