/**
 * Quien escucha `@save` de ProyectoForm tiene que recibir TODO lo que emite.
 *
 * Nace de un fallo real (2026-09-20). ProyectoForm pasó a emitir un tercer
 * argumento --el inversionista inicial-- y en `ProyectoDesdeCRMDialog` esa
 * tercera posición la ocupaba `forzar = false`, el flag que salta el aviso de
 * posible duplicado del CRM. Un objeto ahí es "verdadero", asi que el CRM habria
 * empezado a forzar SIEMPRE: creando plantas duplicadas sin preguntar, y sin
 * ningun error a la vista.
 *
 * Nada lo habria detectado. No hay pruebas de montaje en este repo --ni
 * @vue/test-utils ni entorno DOM-- y agregarlos para esto seria desproporcionado,
 * asi que se verifica el contrato leyendo el codigo, igual que
 * `componentesRegistrados` y `componentesImportados`.
 *
 * La regla: un handler de `@save` declara al menos tantos parametros como
 * argumentos emite el componente, y ninguno de esos es un flag con valor por
 * defecto booleano. Un `= false` dentro del tramo que ocupan los datos significa
 * que un dato va a caer en un flag.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RAIZ = process.cwd()
const FORM = join(RAIZ, 'app/features/proyectos/components/ProyectoForm.vue')

function vueRecursivo(carpeta: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada)
    if (statSync(ruta).isDirectory()) salida.push(...vueRecursivo(ruta))
    else if (entrada.endsWith('.vue')) salida.push(ruta)
  }
  return salida
}

/** Cuántos argumentos manda el `emit('save', ...)` del formulario. */
function argumentosEmitidos(fuente: string): number {
  const m = fuente.match(/emit\(\s*['"]save['"]\s*,([^)]*)\)/)
  if (!m) return 0
  return m[1].split(',').filter((p) => p.trim()).length
}

/** Los parámetros declarados por una función, en orden. */
function parametrosDe(fuente: string, nombre: string): string[] | null {
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patrones = [
    new RegExp(`function\\s+${escapado}\\s*\\(([^)]*)\\)`),
    new RegExp(`(?:const|let)\\s+${escapado}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>`),
  ]
  for (const patron of patrones) {
    const m = fuente.match(patron)
    if (m)
      return m[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
  }
  return null
}

const EMITIDOS = argumentosEmitidos(readFileSync(FORM, 'utf8'))

/** Los archivos que usan `<ProyectoForm @save="handler">`, con su handler. */
const CONSUMIDORES = vueRecursivo(join(RAIZ, 'app/features'))
  .map((ruta) => {
    const fuente = readFileSync(ruta, 'utf8')
    const m = fuente.match(/<ProyectoForm[^>]*@save="([A-Za-z0-9_$]+)"/s)
    return m ? { ruta, fuente, handler: m[1] } : null
  })
  .filter((x): x is { ruta: string; fuente: string; handler: string } => x !== null)

describe('contrato de @save de ProyectoForm', () => {
  it('el formulario emite argumentos y alguien los escucha', () => {
    expect(EMITIDOS).toBeGreaterThan(0)
    expect(CONSUMIDORES.length).toBeGreaterThan(0)
  })

  it.each(CONSUMIDORES.map((c) => [c.ruta.replace(RAIZ, '').replace(/^[\\/]/, ''), c]))(
    '%s: ningún flag ocupa el lugar de un dato',
    (_etiqueta, consumidor) => {
      const params = parametrosDe(consumidor.fuente, consumidor.handler)
      expect(params, `no se encontró el handler ${consumidor.handler}`).not.toBeNull()

      expect(
        params!.length,
        `${consumidor.handler} declara ${params!.length} parámetros y ProyectoForm emite ${EMITIDOS}`,
      ).toBeGreaterThanOrEqual(EMITIDOS)

      const flagEnMedio = params!.slice(0, EMITIDOS).find((p) => /=\s*(true|false)\s*$/.test(p))
      expect(
        flagEnMedio,
        `«${flagEnMedio}» es un flag en una posición que ProyectoForm usa para un dato: ` +
          'ese dato se leería como el flag (todo objeto es "verdadero"). Movelo al final.',
      ).toBeUndefined()
    },
  )
})
