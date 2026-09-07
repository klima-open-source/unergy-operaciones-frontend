import type { Component } from 'vue'
import { CircleQuestionMarkIcon, GaugeIcon, ServerIcon, TagIcon, TriangleAlertIcon, ZapIcon } from '@lucide/vue'
import { COLOR_CATEGORIA } from '~/features/fallas/utils/colores'
// Título y categoría de una falla, derivados de la CLASIFICACIÓN ESTRUCTURADA
// reportada (equipo / evento / detalle del elemento), con respaldo al tipo legacy
// para fallas viejas sin clasificación. Evita que el tipo_id legacy muestre títulos
// que contradicen lo reportado (p.ej. "Fusible de string quemado" en una falla de red).

export interface FallaInversor {
  nombre?: string | null
  proyecto_inversor_id?: number | string | null
  potencia_kw?: number | null
  tipos_etiquetas?: string[]
  tipos?: string[]
}

export interface FallaClasificacion {
  categoria?: string
  categoria_etiqueta?: string
  subtipo_etiqueta?: string
  detalle?: string | null
  inversores?: FallaInversor[]
  afecta_medicion?: boolean
  perdida_comunicacion?: boolean
}

export interface FallaTipo {
  etiqueta?: string
  categoria?: {
    etiqueta?: string
    color_hex?: string
  }
}

export interface Falla {
  clasificacion?: FallaClasificacion | null
  tipo?: FallaTipo | null
  tipo_libre?: string | null
  descripcion?: string | null
  pendiente_reclasificar?: boolean
}

// Ícono por sistema (coincide con ESTRUCTURA_FALLAS del backend).
//
// El backend manda además un `icono` propio en `GET /fallas/estructura`, pero es
// una clase de PrimeIcons y ya no hay icon-font que la pinte.
// La traducción vive aquí, del código de categoría al componente de `@lucide/vue`,
// para no depender de la forma de ese campo.
const ICONO_CAT: Record<string, Component> = {
  red: ZapIcon,
  frontera: GaugeIcon,
  inversores: ServerIcon,
  generando_sin_datos: CircleQuestionMarkIcon,
  eventos_adversos: TriangleAlertIcon,
}

/** Ícono del sistema afectado, por código de categoría del backend. */
export function iconoCategoriaFalla(codigo: string | null | undefined): Component {
  return (codigo && ICONO_CAT[codigo]) || TagIcon
}

// Título específico: el equipo/evento/detalle reportado.
export function tituloFalla(f: Falla | null | undefined): string {
  if (!f) return 'Sin tipo'
  const c = f.clasificacion
  if (c && typeof c === 'object') {
    // Inversores: lista de inversores afectados + tipos de falla
    if (Array.isArray(c.inversores) && c.inversores.length) {
      const nombres = c.inversores
        .map(
          (i) =>
            i.nombre ||
            (i.proyecto_inversor_id ? `Inversor ${i.proyecto_inversor_id}` : 'Inversor'),
        )
        .join(', ')
      const tipos = [...new Set(c.inversores.flatMap((i) => i.tipos_etiquetas || []))].join(', ')
      return tipos ? `${nombres} — ${tipos}` : nombres
    }
    // Red / Frontera / Eventos adversos: el equipo o evento reportado (+ detalle libre)
    if (c.subtipo_etiqueta) {
      return c.detalle ? `${c.subtipo_etiqueta}: ${c.detalle}` : c.subtipo_etiqueta
    }
    if (c.categoria_etiqueta) return c.categoria_etiqueta
  }
  // Respaldo para fallas legacy sin clasificación estructurada
  return f.tipo?.etiqueta || f.tipo_libre || f.descripcion || 'Sin tipo'
}

// Categoría (para el punto/tag de color): prioriza la estructura sobre el tipo legacy.
export function categoriaFalla(f: Falla | null | undefined): { etiqueta: string; color: string } {
  const c = f?.clasificacion
  if (c && typeof c === 'object' && c.categoria) {
    return {
      etiqueta: c.categoria_etiqueta || c.categoria,
      color: COLOR_CATEGORIA[c.categoria] || f?.tipo?.categoria?.color_hex || '#915BD8',
    }
  }
  return {
    etiqueta: f?.tipo?.categoria?.etiqueta || '',
    color: f?.tipo?.categoria?.color_hex || '#915BD8',
  }
}

export interface ClasificacionDetalleInversor {
  nombre: string
  potenciaKw: number | null
  tipos: string[]
}

export interface ClasificacionDetalle {
  categoria: string
  categoriaEtiqueta: string
  categoriaColor: string
  /** Componente de `@lucide/vue`. */
  icono: Component
  subtitulo: string
  detalle: string | null
  pendienteReclasificar: boolean
  frontera: { afectaMedicion: boolean; perdidaComunicacion: boolean } | null
  inversores: ClasificacionDetalleInversor[]
  // capa aparte: tipos de falla de inversor (conjunto único)
  inversorTipos: string[]
  // true si todos los inversores comparten los mismos tipos
  tiposUniformes: boolean
}

// Modelo de presentación de la clasificación estructurada, agnóstico al estilo:
// lo consumen la vista de detalle web y el sheet móvil. Devuelve null para fallas
// legacy sin clasificación (esas caen al tipo/tipo_libre en el encabezado).
export function clasificacionDetalle(f: Falla | null | undefined): ClasificacionDetalle | null {
  const c = f?.clasificacion
  if (!c || typeof c !== 'object' || !c.categoria) return null
  const cat = c.categoria
  const inversores: ClasificacionDetalleInversor[] = Array.isArray(c.inversores)
    ? c.inversores.map((i) => ({
        nombre:
          i.nombre || (i.proyecto_inversor_id ? `Inversor ${i.proyecto_inversor_id}` : 'Inversor'),
        potenciaKw: i.potencia_kw ?? null,
        // Preferir etiquetas resueltas; respaldo a códigos crudos.
        tipos:
          Array.isArray(i.tipos_etiquetas) && i.tipos_etiquetas.length
            ? i.tipos_etiquetas
            : (i.tipos ?? []),
      }))
    : []
  // Capa "tipo de falla": conjunto único de tipos across inversores, y si todos
  // los inversores comparten el mismo set (para no repetir chips por inversor).
  const inversorTipos = [...new Set(inversores.flatMap((i) => i.tipos))]
  const _key = (arr: string[]) => [...arr].sort().join('|')
  const tiposUniformes =
    inversores.length > 0 && inversores.every((i) => _key(i.tipos) === _key(inversores[0]!.tipos))
  return {
    categoria: cat,
    categoriaEtiqueta: c.categoria_etiqueta || cat,
    categoriaColor: COLOR_CATEGORIA[cat] || f?.tipo?.categoria?.color_hex || '#915BD8',
    icono: iconoCategoriaFalla(cat),
    subtitulo: c.subtipo_etiqueta || '',
    detalle: c.detalle || null,
    pendienteReclasificar: !!f?.pendiente_reclasificar,
    frontera:
      cat === 'frontera'
        ? { afectaMedicion: !!c.afecta_medicion, perdidaComunicacion: !!c.perdida_comunicacion }
        : null,
    inversores,
    inversorTipos,
    tiposUniformes,
  }
}
