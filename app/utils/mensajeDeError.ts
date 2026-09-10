/**
 * El motivo real de un error de la API, en texto legible.
 *
 * El cuerpo del error llega en dos sitios segun el cliente: `e.response.data`
 * con axios y `e.data` con ofetch. Se miran los dos.
 *
 * Casi todas las vistas hacen `…?.data?.detail || e.message`, y eso
 * pierde justo el caso más frecuente: cuando DRF rechaza por validación no
 * manda `detail`, manda un diccionario **por campo**:
 *
 *     {"code": ["Este campo es requerido."]}
 *
 * Sin `detail`, el toast caía en `e.message` y mostraba
 * «POST /api/v1/... failed with 400», que no dice nada. El backend sí había
 * explicado el motivo; era la vista la que no lo leía.
 *
 * El otro caso que se perdía: `detail` puede ser un OBJETO, no un string. Los
 * avisos estructurados del backend (el 409 de nombre parecido al crear un
 * cliente o un proyecto) mandan `{mensaje, candidato_id, candidato_nombre}`
 * ahí dentro, y sin leerlo el usuario veía «detail: [object Object]».
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

    // `detail` tambien puede ser un OBJETO: los avisos estructurados del
    // backend (el 409 de "ya existe un cliente con un nombre muy parecido"
    // manda `mensaje` + `candidato_id` + `candidato_nombre`, para que la vista
    // pueda ofrecer "crear de todos modos"). Sin esto caia en la rama de
    // errores por campo y el usuario leia "detail: [object Object]".
    if (obj.detail && typeof obj.detail === 'object' && !Array.isArray(obj.detail)) {
      const anidado = obj.detail as Record<string, unknown>
      for (const clave of ['mensaje', 'msg', 'detail'] as const) {
        const valor = anidado[clave]
        if (typeof valor === 'string' && valor.trim()) return valor
      }
    }

    // Errores por campo: {campo: ["msg", …]}. `non_field_errors` es la clave
    // con la que DRF marca lo que NO es de un campo (un `unique_together`, un
    // `validate()` del serializer): ahi el nombre de la clave no le dice nada a
    // nadie, asi que sale solo el mensaje.
    const partes = Object.entries(obj)
      .map(([campo, valor]) => {
        const msg = Array.isArray(valor) ? valor.map(String).join(' ') : String(valor)
        if (!msg.trim()) return null
        return campo === 'non_field_errors' ? msg : `${campo}: ${msg}`
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
  const e = error as { response?: { data?: unknown }; data?: unknown; message?: string } | undefined
  return (
    textoDelCuerpo(e?.response?.data) || textoDelCuerpo(e?.data) || e?.message?.trim() || respaldo
  )
}
