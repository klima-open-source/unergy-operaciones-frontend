/**
 * Un componente de `features/` usado en una plantilla tiene que estar importado.
 *
 * `nuxt.config.ts` auto-importa `~/components/**` y **deliberadamente no**
 * `app/features/<slice>/components/`. Así que una etiqueta como
 * `<SelectorCliente>` sin su `import` no es un error de compilación: Vue la
 * resuelve en tiempo de ejecución, no la encuentra, y la deja sin renderizar.
 * El campo simplemente no aparece en pantalla, sin que nada falle.
 *
 * Es el gemelo de `contratos/componentesRegistrados.test.ts`, que cubre el mismo
 * agujero del lado de la API de opciones (`components: { ... }`). Este cubre el
 * de `<script setup>`, que es como están escritos los wizards.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RAIZ = process.cwd()
const FEATURES = join(RAIZ, 'app/features')

function vueRecursivo(carpeta: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada)
    if (statSync(ruta).isDirectory()) salida.push(...vueRecursivo(ruta))
    else if (entrada.endsWith('.vue')) salida.push(ruta)
  }
  return salida
}

/** Los nombres que Nuxt SÍ auto-importa: no necesitan `import` explícito. */
function nombresAutoImportados(): Set<string> {
  const nombres = new Set<string>()
  for (const dir of ['app/components']) {
    const carpeta = join(RAIZ, dir)
    try {
      for (const ruta of vueRecursivo(carpeta)) {
        nombres.add(ruta.split(/[\\/]/).pop()!.replace('.vue', ''))
      }
    } catch {
      /* la carpeta puede no existir */
    }
  }
  return nombres
}

const ARCHIVOS = vueRecursivo(FEATURES)
const AUTO = nombresAutoImportados()

/** Los componentes propios de features, por nombre de archivo. */
const DE_FEATURES = new Set(
  ARCHIVOS.filter((r) => /[\\/]components[\\/]/.test(r)).map((r) =>
    r.split(/[\\/]/).pop()!.replace('.vue', ''),
  ),
)

/** Solo la parte `<template>`: el `<script>` menciona nombres que no son etiquetas. */
function plantilla(fuente: string): string {
  const desde = fuente.indexOf('<template>')
  const hasta = fuente.lastIndexOf('</template>')
  return desde >= 0 && hasta > desde ? fuente.slice(desde, hasta) : ''
}

function etiquetasUsadas(fuente: string): string[] {
  const nombres = new Set<string>()
  for (const m of plantilla(fuente).matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) nombres.add(m[1])
  return [...nombres]
}

function importados(fuente: string): Set<string> {
  const nombres = new Set<string>()
  for (const m of fuente.matchAll(/^import\s+([^;\n]+?)\s+from/gm)) {
    for (const parte of m[1].replace(/[{}]/g, ',').split(',')) {
      const nombre = parte
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (nombre && /^[A-Z][A-Za-z0-9]*$/.test(nombre)) nombres.add(nombre)
    }
  }
  // Un componente definido en el propio archivo también vale.
  for (const m of fuente.matchAll(/^\s*const ([A-Z][A-Za-z0-9]*)\s*=/gm)) nombres.add(m[1])
  return nombres
}

describe('componentes de features importados donde se usan', () => {
  it('hay archivos que revisar', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0)
    expect(DE_FEATURES.size).toBeGreaterThan(0)
  })

  it.each(ARCHIVOS.map((r) => [r.replace(RAIZ, '').replace(/^[\\/]/, ''), r]))(
    '%s',
    (_etiqueta, ruta) => {
      const fuente = readFileSync(ruta, 'utf8')
      const propio = ruta.split(/[\\/]/).pop()!.replace('.vue', '')
      const faltan = etiquetasUsadas(fuente).filter(
        (n) => DE_FEATURES.has(n) && !AUTO.has(n) && n !== propio && !importados(fuente).has(n),
      )
      expect(faltan, 'usa componentes de features sin importarlos').toEqual([])
    },
  )
})
