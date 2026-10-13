/**
 * La generación simulada mensual, leída del proyecto de PVsyst que TSF guarda
 * como «Pre-simulación» (un zip: `.PRJ` + una variante `.VC?` por año simulado).
 *
 * **Qué se lee.** Cada variante es texto. La energía inyectada a la red
 * (`VarSimul…=E_Grid`) va hora por hora en líneas `Day_DDMM=+2Qg+VYm-Dp…`: un
 * signo y un entero en base 64 (alfabeto `0-9A-Za-z.`) por hora, multiplicado por
 * una escala de la variable. Ese formato no está documentado; se verificó contra
 * un proyecto real de dos formas independientes: la radiación decodificada,
 * sumada por mes, da los mismos kWh/m² que el archivo trae en texto (error 0,03 %),
 * y la energía nominal decodificada entre la irradiancia efectiva da los kWp del
 * arreglo (1.320,44 frente a 1.320,48).
 *
 * **Qué se usa: la FORMA, no el total.** De aquí sale cuánto pesa cada mes en el
 * año, promediando todas las variantes (años) del zip. El total lo ponen los
 * anuales oficiales de TSF (P50 y P90 MWh/año): así los 12 meses suman lo que
 * dice TSF, y la escala del formato —la parte inferida— se cancela.
 */
import JSZip from 'jszip'

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.'
const VARIANTE = /\.vc[a-z0-9]$/i
const FICHA = /([+-])([^+-]*)/g

function decodificar(cuerpo: string): number {
  let valor = 0
  for (const c of cuerpo) {
    const digito = ALFABETO.indexOf(c)
    if (digito < 0) throw new Error(`Carácter fuera del alfabeto de PVsyst: «${c}»`)
    valor = valor * 64 + digito
  }
  return valor
}

/**
 * La energía a red de una variante, por mes, en las unidades internas del
 * archivo (proporcionales a kWh). null si la variante no trae `E_Grid` horario.
 */
export function eGridMensualCrudo(variante: string): number[] | null {
  const texto = variante.replace(/\r/g, '')
  const bloque = texto.match(/VarSimul_\d+=E_Grid\n([\s\S]*?)End of VarSimul/)?.[1]
  if (!bloque) return null
  const meses = Array<number>(12).fill(0)
  let horas = 0
  for (const [, mes, linea] of bloque.matchAll(/Day_\d{2}(\d{2})=(.*)/g)) {
    const m = Number(mes) - 1
    if (!(m >= 0 && m < 12) || !linea) continue
    for (const [, signo, cuerpo] of linea.matchAll(FICHA)) {
      if (!cuerpo) continue
      meses[m]! += (signo === '-' ? -1 : 1) * decodificar(cuerpo)
      horas++
    }
  }
  return horas ? meses : null
}

/** Cuánto pesa cada mes en el año (suman 1). null si no hay energía positiva. */
export function pesosMensuales(meses: number[]): number[] | null {
  const total = meses.reduce((a, b) => a + b, 0)
  return total > 0 ? meses.map((m) => m / total) : null
}

/** El promedio de los pesos de todas las variantes (años) que traigan `E_Grid`. */
export function pesosDeVariantes(variantes: string[]): number[] | null {
  const pesos = variantes
    .map(eGridMensualCrudo)
    .map((m) => (m ? pesosMensuales(m) : null))
    .filter((p): p is number[] => p !== null)
  if (!pesos.length) return null
  return Array.from({ length: 12 }, (_, i) => pesos.reduce((s, p) => s + p[i]!, 0) / pesos.length)
}

/** Reparte un total anual (kWh) según los pesos, en kWh enteros por mes. */
export function repartir(pesos: number[], totalKwh: number): number[] {
  return pesos.map((p) => Math.round(p * totalKwh))
}

/** Los pesos mensuales desde el zip de pre-simulación. null si no es un proyecto de PVsyst legible. */
export async function pesosDeZip(zip: ArrayBuffer): Promise<number[] | null> {
  const archivo = await JSZip.loadAsync(zip)
  const variantes = await Promise.all(
    Object.values(archivo.files)
      .filter((f) => !f.dir && VARIANTE.test(f.name))
      .map((f) => f.async('string')),
  )
  return pesosDeVariantes(variantes)
}
