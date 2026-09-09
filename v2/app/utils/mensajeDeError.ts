/**
 * El motivo real de un error de la API, en texto legible.
 *
 * Casi todas las vistas hacen `e.response?.data?.detail || e.message`, y eso
 * pierde justo el caso más frecuente: cuando DRF rechaza por validación no
 * manda `detail`, manda un diccionario **por campo**:
 *
 *     {"code": ["Este campo es requerido."]}
 *
 * Sin `detail`, el toast caía en `e.message` y mostraba
 * «POST /api/v1/... failed with 400», que no dice nada. El backend sí había
 * explicado el motivo; era la vista la que no lo leía.
 */

const SEPARADOR = ' · '

function textoDelCuerpo(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') return data.trim() || null

  if (Array.isArray(data)) {
    const partes = data.map(String).filter(Boolean)
    return partes.length ? partes.join(SEPARADOR) : null
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    // `detail` es lo que manda DRF para los errores que no son de campo.
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail

    // Errores por campo: {campo: ["msg", …]}.
    const partes = Object.entries(obj)
      .map(([campo, valor]) => {
        const msg = Array.isArray(valor) ? valor.map(String).join(' ') : String(valor)
        return msg.trim() ? `${campo}: ${msg}` : null
      })
      .filter((x): x is string => x !== null)
    return partes.length ? partes.join(SEPARADOR) : null
  }

  return null
}

/**
 * @param error     Lo que sea que atrapó el `catch` (se espera un error de axios).
 * @param respaldo  Qué decir si el error no trae nada legible.
 */
export function mensajeDeError(error: unknown, respaldo = 'Ocurrió un error inesperado.'): string {
  const e = error as { response?: { data?: unknown }; message?: string } | undefined
  return textoDelCuerpo(e?.response?.data) || e?.message?.trim() || respaldo
}
