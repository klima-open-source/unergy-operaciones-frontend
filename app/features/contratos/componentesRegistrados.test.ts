/**
 * Cada componente registrado en `components: {...}` tiene que existir.
 *
 * Nace de un fallo real: al quitar la UI de pagos de `OperacionView.vue` se
 * borraron también `Acordeon`, `FacturasCobradas` y `FacturasEmitidas`, que
 * estaban escritos justo después en el archivo. La vista quedó en 500 con
 * "Acordeon is not defined".
 *
 * Ni el build ni las pruebas lo detectaron: Vue resuelve los componentes en
 * tiempo de ejecución, así que un componente registrado pero inexistente compila
 * perfecto y revienta al abrir la pantalla.
 *
 * Estas vistas declaran sus componentes a mano —varios son objetos inline en el
 * mismo archivo, no SFC importados— y por eso el `<script setup>` no los resuelve
 * solo. Ahí es donde se puede perder uno sin que nada avise.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const CARPETA = join(process.cwd(), 'app/features/contratos/components')

/** Los `components: { A, B }` de un archivo, con sus nombres. */
function registrados(fuente: string): string[] {
  const nombres: string[] = []
  for (const bloque of fuente.matchAll(/components:\s*\{([^}]*)\}/g)) {
    for (const parte of bloque[1].split(',')) {
      const nombre = parte.split(':')[0].trim()
      if (/^[A-Z][A-Za-z0-9]*$/.test(nombre)) nombres.push(nombre)
    }
  }
  return [...new Set(nombres)]
}

/** Lo que el archivo define localmente o importa. */
function disponibles(fuente: string): Set<string> {
  const nombres = new Set<string>()
  for (const m of fuente.matchAll(/^\s*const ([A-Z][A-Za-z0-9]*)\s*=/gm)) nombres.add(m[1])
  for (const m of fuente.matchAll(/^import\s+([^;\n]+?)\s+from/gm)) {
    // `import X from`, `import { A, B as C } from`, `import X, { A } from`
    for (const parte of m[1].replace(/[{}]/g, ',').split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/).pop()?.trim()
      if (nombre && /^[A-Z][A-Za-z0-9]*$/.test(nombre)) nombres.add(nombre)
    }
  }
  return nombres
}

const ARCHIVOS = readdirSync(CARPETA).filter((f) => f.endsWith('.vue'))

describe('componentes registrados en los .vue de contratos', () => {
  it('hay archivos que revisar', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0)
  })

  it.each(ARCHIVOS)('%s: todos los registrados existen', (archivo) => {
    const fuente = readFileSync(join(CARPETA, archivo), 'utf8')
    const faltan = registrados(fuente).filter((n) => !disponibles(fuente).has(n))
    expect(faltan, `${archivo} registra componentes que no existen`).toEqual([])
  })
})
