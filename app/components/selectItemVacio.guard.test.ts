/**
 * Guard de código fuente: ningún `SelectItem` puede tener `value=""`.
 *
 * Reka UI lanza «A <SelectItem /> must have a value prop that is not an empty string» en
 * runtime, cuando la vista ya se montó: ni typecheck ni lint lo ven. La opción «Todos» /
 * «Ninguno» usa `VALOR_SELECT_VACIO` (ver `~/utils/select.ts`).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..')
const EXCLUIDAS = [join(RAIZ, 'components', 'ui'), join(RAIZ, 'components', 'gandalf')]

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name)
    if (EXCLUIDAS.includes(ruta)) return []
    if (e.isDirectory()) return vueFiles(ruta)
    return e.name.endsWith('.vue') ? [ruta] : []
  })
}

describe('SelectItem con valor vacío', () => {
  it('no existe ninguno en app/', () => {
    const culpables = vueFiles(RAIZ).filter((f) =>
      /<SelectItem\b[^>]*?(?<![:\w-])value=""/.test(readFileSync(f, 'utf8')),
    )
    expect(culpables.map((f) => relative(RAIZ, f))).toEqual([])
  })
})
