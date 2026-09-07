/**
 * Colores de fallas: catálogo único en el frontend.
 *
 * `color_hex` de `fallas_cat_estados`/`fallas_cat_prioridades` se eliminó del
 * backend (auditoría 2026-09-02) -- el único consumidor real era este mismo
 * frontend (el correo de notificación tiene su propio esquema de colores
 * independiente, ver `_ESTADO_MAP` en `email_service.py`; se sincronizaron
 * los valores hex a mano, pero viven en repos separados y no se pueden
 * compartir de verdad). Estos tres mapas son ahora la única fuente para
 * pintar estado/prioridad/categoría en toda la plataforma (web y móvil) --
 * no crear otro mapa igual en otro archivo.
 *
 * Los valores de ESTADO y PRIORIDAD son los mismos que tenía la BD antes de
 * quitar la columna (no se inventaron colores nuevos). CATEGORIA ya vivía
 * hardcodeada acá mismo (antes como `COLOR_CAT` en fallaTitulo.ts) y no se
 * tocó -- sigue viniendo de `ESTRUCTURA_FALLAS` del lado del backend
 * (app/services/fallas/estructura.py), que si sigue siendo dueña de esos
 * datos vía `GET /fallas/estructura`.
 */

export const COLOR_ESTADO: Record<string, string> = {
  programado: '#3B82F6',
  abierta: '#EF4444',
  en_gestion: '#F97316',
  en_espera: '#EAB308',
  cerrada: '#22C55E',
  sin_solucion: '#6B7280',
}

export const COLOR_PRIORIDAD: Record<string, string> = {
  critica: '#DC2626',
  grave: '#EA580C',
  media: '#CA8A04',
  leve: '#16A34A',
}

export const COLOR_CATEGORIA: Record<string, string> = {
  red: '#F59E0B',
  frontera: '#0EA5E9',
  inversores: '#915BD8',
  generando_sin_datos: '#64748B',
  eventos_adversos: '#EF4444',
}

const COLOR_DEFECTO = '#915BD8'

/** Color de un estado por su `codigo` (`estado?.codigo`, no el id). */
export function colorEstado(codigo: string | null | undefined, porDefecto = COLOR_DEFECTO): string {
  return (codigo && COLOR_ESTADO[codigo]) || porDefecto
}

/** Color de una prioridad por su `codigo`. */
export function colorPrioridad(codigo: string | null | undefined, porDefecto = COLOR_DEFECTO): string {
  return (codigo && COLOR_PRIORIDAD[codigo]) || porDefecto
}

/** Color de una categoría por su `codigo`. */
export function colorCategoria(codigo: string | null | undefined, porDefecto = COLOR_DEFECTO): string {
  return (codigo && COLOR_CATEGORIA[codigo]) || porDefecto
}
