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

// ── Datos técnicos: subarreglos de la variante + archivos .PAN y .OND ────────

/** Un equipo (panel o inversor) tal como lo describe su archivo de PVsyst. */
export interface EquipoPvsyst {
  fabricante: string | null
  modelo: string | null
  /** Panel: W pico. Inversor: kW AC nominal. */
  potencia: number | null
}

export interface TecnicoPvsyst {
  modulos: number
  strings: number
  inversores: number
  /** Σ módulos × potencia del panel, en kWp. null si falta el .PAN de algún subarreglo. */
  kwpDc: number | null
  /** Σ inversores × potencia AC del subarreglo, en kW. */
  kwAc: number | null
  paneles: EquipoPvsyst[]
  equiposInversor: EquipoPvsyst[]
  /** `SystemKind` de la variante: «Tracker Zentrack 1P», «Fixed tilted plane»… */
  sistema: string | null
}

function valor(texto: string, clave: string): string | null {
  const m = texto.match(new RegExp(`^\\s*${clave}=(.*)$`, 'm'))
  const v = m?.[1]?.trim()
  return v ? v : null
}

function numeroDe(texto: string, clave: string): number | null {
  const v = valor(texto, clave)
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Fabricante, modelo y potencia de un .PAN (`PNom`, W) o un .OND (`PNomConv`, kW). */
export function equipoDe(texto: string, clavePotencia: 'PNom' | 'PNomConv'): EquipoPvsyst {
  const limpio = texto.replace(/\r/g, '')
  return {
    fabricante: valor(limpio, 'Manufacturer'),
    modelo: valor(limpio, 'Model'),
    potencia: numeroDe(limpio, clavePotencia),
  }
}

interface Subarreglo {
  panel: string | null
  inversor: string | null
  serie: number
  strings: number
  inversores: number
  acPorInversor: number | null
}

function subarreglos(variante: string): Subarreglo[] {
  const texto = variante.replace(/\r/g, '')
  const bloques = texto.split('PVObject_=pvSubArray').slice(1)
  return bloques.map((b) => ({
    panel: valor(b, 'PVModule'),
    inversor: valor(b, 'GInverter'),
    serie: numeroDe(b, 'NModSerie') ?? 0,
    strings: numeroDe(b, 'NStringCh') ?? 0,
    inversores: numeroDe(b, 'NInverter') ?? 0,
    acPorInversor: numeroDe(b, 'PNomAC_InMPPT'),
  }))
}

/**
 * El arreglo de UNA variante (el diseño no cambia entre años: solo la
 * degradación), con los equipos leídos de sus archivos. `equipos` resuelve un
 * nombre de archivo (`PVModule=…`, `GInverter=…`) a su texto.
 */
export function tecnicoDeVariante(
  variante: string,
  equipos: (nombre: string) => string | null,
): TecnicoPvsyst | null {
  const subs = subarreglos(variante)
  if (!subs.length) return null
  const panelDe = (n: string | null) => {
    const t = n ? equipos(n) : null
    return t ? equipoDe(t, 'PNom') : null
  }
  const inversorDe = (n: string | null) => {
    const t = n ? equipos(n) : null
    return t ? equipoDe(t, 'PNomConv') : null
  }

  let kwpDc: number | null = 0
  let kwAc: number | null = 0
  for (const s of subs) {
    const panel = panelDe(s.panel)
    kwpDc =
      kwpDc !== null && panel?.potencia != null
        ? kwpDc + (s.serie * s.strings * panel.potencia) / 1000
        : null
    const ac = s.acPorInversor ?? inversorDe(s.inversor)?.potencia ?? null
    kwAc = kwAc !== null && ac !== null ? kwAc + s.inversores * ac : null
  }
  const distintos = <T>(xs: (T | null)[]) =>
    xs
      .filter((x): x is T => x !== null)
      .filter((x, i, a) => a.findIndex((y) => JSON.stringify(y) === JSON.stringify(x)) === i)

  return {
    modulos: subs.reduce((n, s) => n + s.serie * s.strings, 0),
    strings: subs.reduce((n, s) => n + s.strings, 0),
    inversores: subs.reduce((n, s) => n + s.inversores, 0),
    kwpDc: kwpDc === null ? null : Math.round(kwpDc * 1000) / 1000,
    kwAc: kwAc === null ? null : Math.round(kwAc * 1000) / 1000,
    paneles: distintos(subs.map((s) => panelDe(s.panel))),
    equiposInversor: distintos(subs.map((s) => inversorDe(s.inversor))),
    sistema: valor(variante.replace(/\r/g, ''), 'SystemKind'),
  }
}

export interface Presimulacion {
  /** Peso de cada mes en el año (suman 1), promedio de todas las variantes. */
  pesos: number[] | null
  tecnico: TecnicoPvsyst | null
}

/** Todo lo que se lee del zip de pre-simulación. */
export async function leerPresimulacion(zip: ArrayBuffer): Promise<Presimulacion> {
  const archivo = await JSZip.loadAsync(zip)
  const archivos = Object.values(archivo.files).filter((f) => !f.dir)
  const textos = new Map<string, string>()
  for (const f of archivos) {
    if (/\.(vc[a-z0-9]|pan|ond)$/i.test(f.name)) {
      textos.set(f.name.split('/').pop()!.toLowerCase(), await f.async('string'))
    }
  }
  const variantes = [...textos.entries()]
    .filter(([n]) => VARIANTE.test(n))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, t]) => t)
  const equipos = (nombre: string) => textos.get(nombre.split(/[\\/]/).pop()!.toLowerCase()) ?? null
  return {
    pesos: pesosDeVariantes(variantes),
    // La primera variante (año 0): el arreglo es el mismo en todas.
    tecnico: variantes.map((v) => tecnicoDeVariante(v, equipos)).find((t) => t !== null) ?? null,
  }
}

/** Los pesos mensuales desde el zip de pre-simulación. null si no es un proyecto de PVsyst legible. */
export async function pesosDeZip(zip: ArrayBuffer): Promise<number[] | null> {
  return (await leerPresimulacion(zip)).pesos
}
