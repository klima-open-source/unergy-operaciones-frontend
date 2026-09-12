/**
 * Tarifas de un contrato de Representación/CGM y su indexación.
 *
 * Vive fuera de la vista porque la decisión de "qué tarifa se cobra hoy" tiene
 * que ser una sola: la ficha de `/proyectos/{id}/representacion` y cualquier
 * listado que muestre la tarifa deben decir el mismo número. Mientras esto
 * estuvo escrito dentro de `RepresentacionView.vue`, la vista nueva se llevó una
 * copia sin el arreglo que el util del legacy ya tenía, y volvió a mostrar como
 * vigente un aniversario que no había llegado.
 *
 * El JSONB `indexacion_cgm` / `indexacion_representacion` guarda una fila por
 * aniversario: `{año, ipc, valor, esBase}` — con la clave acentuada y `esBase`
 * en camelCase, que es como las escribió el seed. La fecha exacta del
 * aniversario NO se persiste: se deriva de `fecha_firma_contrato` manteniendo
 * mes y día, igual que hace `proximo_aniversario` en el backend.
 */
import { hoyColombia } from '~/utils/fecha'

import { EstadoFilaIndexacion, type EntradaIndexacion } from './types'

/**
 * La clave del año llega como `año` desde el seed. Se aceptan las variantes sin
 * tilde por si algún registro se escribió de otra forma, que es lo que hacía la
 * vista antes de extraer esto.
 */
type FilaConVariantesDeAnio = EntradaIndexacion & { year?: number }

/** El año de una fila, o `null` si no lo trae. */
export function anioDeFila(fila: EntradaIndexacion | null | undefined): number | null {
  const f = fila as FilaConVariantesDeAnio | null | undefined
  return Number(f?.año ?? f?.anio ?? f?.year) || null
}

/** Copia ordenada por año. Devuelve `[]` ante `null` o cualquier cosa que no sea lista. */
export function ordenarIndexacion(
  filas: EntradaIndexacion[] | null | undefined,
): EntradaIndexacion[] {
  if (!Array.isArray(filas)) return []
  return [...filas].sort((a, b) => (anioDeFila(a) || 0) - (anioDeFila(b) || 0))
}

/**
 * Fecha del aniversario de una fila, como texto comparable (`YYYY-MM-DD`).
 * Sin fecha de firma solo se puede saber el año.
 */
export function fechaAniversario(
  fila: EntradaIndexacion | null | undefined,
  fechaFirma: string | null | undefined,
): string {
  const anio = anioDeFila(fila)
  if (!anio) return ''
  const firma = fechaFirma ? String(fechaFirma) : ''
  return firma.length >= 10 ? `${anio}-${firma.slice(5, 10)}` : String(anio)
}

/**
 * Índice de la fila vigente: el aniversario más reciente que YA pasó. `-1` si
 * ninguno. Espera `filas` ya ordenadas por año (`ordenarIndexacion`).
 *
 * Con fecha de firma se compara la fecha completa del aniversario; sin ella solo
 * se puede comparar el año. Son dos ramas EXCLUYENTES y no un `||`: unidas,
 * `"2026" <= "2026"` daba siempre verdadero y cualquier fila del año en curso
 * contaba como alcanzada aunque su aniversario fuera posterior a hoy. Un
 * contrato firmado el 22 de diciembre mostraba en septiembre la tarifa indexada
 * de diciembre, que todavía no se cobra.
 */
export function indiceVigente(
  filas: EntradaIndexacion[],
  fechaFirma: string | null | undefined,
  hoy: string = hoyColombia(),
): number {
  const conFirma = !!fechaFirma && String(fechaFirma).length >= 10
  let idx = -1
  for (let i = 0; i < filas.length; i++) {
    const alcanzado = conFirma
      ? fechaAniversario(filas[i], fechaFirma) <= hoy
      : String(anioDeFila(filas[i])) <= hoy.slice(0, 4)
    if (alcanzado) idx = i
  }
  return idx
}

/**
 * La tarifa que se cobra hoy. Cae a `tarifaBase` cuando no hay indexación
 * cargada, porque un contrato recién capturado tiene la tarifa del contrato y
 * todavía ninguna fila de aniversario.
 */
export function valorVigente(
  indexacion: EntradaIndexacion[] | null | undefined,
  fechaFirma: string | null | undefined,
  tarifaBase: number | null = null,
  hoy: string = hoyColombia(),
): number | null {
  const filas = ordenarIndexacion(indexacion)
  const i = indiceVigente(filas, fechaFirma, hoy)
  const valor = i >= 0 ? filas[i]?.valor : null
  const usada = valor ?? tarifaBase
  return usada != null ? Number(usada) : null
}

/** Estado de una fila frente a la vigente: ya pasó, es la actual, o está por venir. */
export function estadoFilaIndexacion(
  filas: EntradaIndexacion[],
  i: number,
  fechaFirma: string | null | undefined,
  hoy: string = hoyColombia(),
): EstadoFilaIndexacion {
  const vigente = indiceVigente(filas, fechaFirma, hoy)
  if (i < vigente) return EstadoFilaIndexacion.PAGADO
  if (i === vigente) return EstadoFilaIndexacion.VIGENTE
  return EstadoFilaIndexacion.PENDIENTE
}
