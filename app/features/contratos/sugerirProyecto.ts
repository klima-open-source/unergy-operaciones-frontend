/**
 * A qué planta pertenece un contrato de servicio que quedó sin `proyecto_id`.
 *
 * En Representación la pista es el código Sun Factory o el número del acta. En
 * Operación no hay ninguno de los dos: lo que suele haber es el nombre de la
 * planta escrito en `prestador_nombre` —el campo del proveedor— o en
 * `nombre_proyecto_ref`. Que ese nombre esté ahí ya es un dato mal cargado; esto
 * lo aprovecha como pista, no lo bendice.
 *
 * **Ante duda no sugiere nada.** El seed de CGM ya asignó contratos a plantas
 * ajenas y duplicó registros por emparejar con criterio flojo, y hubo que
 * escribir un deduplicador para limpiarlo. El backend llegó a la misma regla
 * (`om_match_seed` devuelve `None` con más de un candidato). Acá pasa igual: si
 * "Chiriguana" encaja con "Chiriguana 2" y "Chiriguana 4", no se propone nada y
 * elige la persona.
 *
 * Lo que devuelve es una SUGERENCIA para confirmar en el diálogo, nunca una
 * asignación automática.
 */

/** Lo que la vista sabe de una planta al momento de sugerir. */
export interface ProyectoCandidato {
  id: number
  nombre_comercial?: string | null
  codigo_tsf?: string | null
}

/** Los campos del contrato que sirven de pista. */
export interface PistasContrato {
  codigo_sun_factory?: string | null
  nombre_proyecto_ref?: string | null
  prestador_nombre?: string | null
}

export interface Sugerencia {
  proyectoId: number
  /** Por qué se propone, para mostrarlo y que se pueda verificar. */
  motivo: string
}

/**
 * Palabras que describen el TIPO de instalación y no identifican a ninguna.
 *
 * La lista es corta a propósito. Quitar de más es lo que produce colisiones:
 * "norte", "sur" u "occidente" parecen genéricas pero son justo lo que separa
 * La Paz Norte de La Paz Occidente.
 */
const GENERICAS = new Set(['minigranja', 'granja', 'solar', 'planta', 'parque'])

/** Minúsculas, sin tildes, sin las palabras del tipo de planta. */
export function normalizarNombrePlanta(nombre: string | null | undefined): string {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((palabra) => palabra !== '' && !GENERICAS.has(palabra))
    .join(' ')
}

/** El único elemento que cumple, o `null` si no hay exactamente uno. */
function unico<T>(candidatos: T[]): T | null {
  return candidatos.length === 1 ? candidatos[0]! : null
}

function porNombre(clave: string, proyectos: ProyectoCandidato[]): ProyectoCandidato | null {
  if (!clave) return null

  const normalizados = proyectos.map((p) => ({
    proyecto: p,
    nombre: normalizarNombrePlanta(p.nombre_comercial),
  }))

  // Primero el nombre idéntico: es el caso limpio y no admite ambigüedad de
  // interpretación, solo de repetidos.
  const exactos = normalizados.filter((n) => n.nombre === clave)
  if (exactos.length) return unico(exactos)?.proyecto ?? null

  // Después, que uno contenga al otro — cubre "MGS 0021 - El Molino" contra
  // "El Molino". Solo vale si deja UN candidato: "chiriguana" contra
  // "chiriguana 2" y "chiriguana 4" deja dos, y ahí no se sugiere nada.
  const contenidos = normalizados.filter(
    (n) => n.nombre !== '' && (n.nombre.includes(clave) || clave.includes(n.nombre)),
  )
  return unico(contenidos)?.proyecto ?? null
}

/**
 * La planta que probablemente le corresponde al contrato, o `null`.
 *
 * Se prueban las pistas de más fuerte a más débil, y la primera que resuelve
 * gana: el código Sun Factory identifica sin ambigüedad, mientras que el nombre
 * en `prestador_nombre` es una pista circunstancial.
 */
export function sugerirProyecto(
  contrato: PistasContrato,
  proyectos: ProyectoCandidato[],
): Sugerencia | null {
  const sunFactory = (contrato.codigo_sun_factory || '').trim().toLowerCase()
  if (sunFactory) {
    const porTsf = proyectos.find((p) => (p.codigo_tsf || '').trim().toLowerCase() === sunFactory)
    if (porTsf) {
      return {
        proyectoId: porTsf.id,
        motivo: `código Sun Factory ${contrato.codigo_sun_factory}`,
      }
    }
  }

  const referencia = contrato.nombre_proyecto_ref || ''
  for (const numero of referencia.match(/\d{4}/g) || []) {
    const porNumero = proyectos.find((p) => (p.nombre_comercial || '').includes(numero))
    if (porNumero) {
      return { proyectoId: porNumero.id, motivo: `número ${numero} de "${referencia}"` }
    }
  }

  for (const [campo, valor] of [
    ['nombre de referencia', referencia],
    ['Prestador', contrato.prestador_nombre || ''],
  ] as const) {
    const encontrado = porNombre(normalizarNombrePlanta(valor), proyectos)
    if (encontrado) {
      return { proyectoId: encontrado.id, motivo: `nombre en ${campo}: "${valor}"` }
    }
  }

  return null
}
