/**
 * Borrar una frontera no puede arrastrarse a la de al lado.
 *
 * El 2026-09-15 se borraron dos fronteras de mas --BARAYA y BRAYA SERV AUX,
 * ids 5 y 6, que estaban reportando al ASIC hasta el dia anterior--. No fue un
 * clic torpe: era la pantalla.
 *
 * Al confirmar se esperaba el DELETE y despues se recargaba el listado ENTERO
 * (`limit: 500`). Durante esos segundos la tabla seguia mostrando la lista
 * vieja --parecia que no habia pasado nada-- y al terminar las filas subian una
 * posicion. Un segundo clic en el mismo punto caia sobre la frontera SIGUIENTE.
 *
 * Esta guarda mira el codigo fuente, no el DOM: lo que hay que impedir es que
 * alguien devuelva el `await loadData()` o quite el `:disabled`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fuente = readFileSync(resolve(__dirname, 'components/FronterasView.vue'), 'utf-8')

const borrar = fuente.slice(
  fuente.indexOf('function deleteFrontera'),
  fuente.indexOf('async function loadData'),
)

describe('borrado de fronteras', () => {
  it('apaga los botones mientras hay un borrado en curso', () => {
    expect(fuente).toContain(':disabled="borrandoId !== null"')
  })

  it('marca cual se esta borrando', () => {
    expect(borrar).toContain('borrandoId.value = f.id')
    expect(borrar).toContain('borrandoId.value = null')
  })

  it('quita la fila de la lista local', () => {
    expect(borrar).toMatch(/fronteras\.value\s*=\s*fronteras\.value\.filter/)
  })

  it('NO recarga el listado entero', () => {
    expect(borrar).not.toContain('loadData()')
  })

  it('nombra la frontera, no solo su codigo', () => {
    expect(borrar).toContain('f.nombre_frontera')
  })

  it('no dice que el borrado es irreversible', () => {
    // Es borrado logico: se revierte poniendo `deleted_at` en NULL. Un aviso
    // falso asusta y no protege.
    expect(borrar).not.toContain('no se puede deshacer')
  })
})
