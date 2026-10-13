/**
 * De dónde sale el catálogo de plantas que usan las vistas del SIMEM.
 *
 * Por defecto, el JSON que viaja con la aplicación — una foto del `capains` de
 * XM. Si alguien cargó uno más nuevo desde «Actualizar catálogo», ese manda.
 *
 * El catálogo cargado vive en `localStorage`, o sea **solo en ese navegador**.
 * Es deliberado y es una limitación, no un diseño terminado: para que una
 * actualización la vean todos hay que guardarla en el backend. Mientras tanto,
 * quien la carga ve los nombres nuevos de inmediato y el resto sigue con la foto
 * que trae la aplicación, que es lo que ya pasaba.
 */
import type { PlantaSimem } from './simemAgentes'

const CLAVE = 'simem.catalogoPlantas'

export interface CatalogoGuardado {
  /** Fecha del archivo `capains` del que salió (`YYYY-MM-DD`). */
  fecha: string | null
  /** Cuándo se cargó. */
  cargadoEn: string
  plantas: Record<string, PlantaSimem>
}

export function leerGuardado(): CatalogoGuardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const d = JSON.parse(crudo) as CatalogoGuardado
    // Un guardado corrupto no debe dejar la vista sin catálogo: se ignora y se
    // cae al que trae la aplicación.
    return d?.plantas && Object.keys(d.plantas).length ? d : null
  } catch {
    return null
  }
}

export function guardar(plantas: Record<string, PlantaSimem>, fecha: string | null): void {
  const d: CatalogoGuardado = { fecha, cargadoEn: new Date().toISOString(), plantas }
  localStorage.setItem(CLAVE, JSON.stringify(d))
}

export function olvidar(): void {
  localStorage.removeItem(CLAVE)
}

/** El catálogo a usar: el cargado si existe, si no el que trae la aplicación. */
export async function cargarCatalogo(): Promise<{
  plantas: Record<string, PlantaSimem>
  origen: 'cargado' | 'aplicación'
  fecha: string | null
}> {
  const guardado = leerGuardado()
  if (guardado) return { plantas: guardado.plantas, origen: 'cargado', fecha: guardado.fecha }
  const { default: plantas } = await import('~/features/mem/data/plantasSimem.json')
  return {
    plantas: plantas as unknown as Record<string, PlantaSimem>,
    origen: 'aplicación',
    fecha: null,
  }
}

export interface DiferenciasCatalogo {
  nuevas: string[]
  retiradas: string[]
  cambiadas: { codigo: string, antes: PlantaSimem, ahora: PlantaSimem }[]
}

/** Qué cambia si se adopta el catálogo nuevo. Se muestra ANTES de reemplazar. */
export function comparar(
  actual: Record<string, PlantaSimem>,
  nuevo: Record<string, PlantaSimem>,
): DiferenciasCatalogo {
  const nuevas = Object.keys(nuevo).filter((k) => !(k in actual)).sort()
  const retiradas = Object.keys(actual).filter((k) => !(k in nuevo)).sort()
  const cambiadas = Object.keys(nuevo)
    .filter((k) => {
      const a = actual[k]
      const b = nuevo[k]!
      return a && (a.nm !== b.nm || a.kw !== b.kw || a.tc !== b.tc || a.ag !== b.ag)
    })
    .sort()
    .map((codigo) => ({ codigo, antes: actual[codigo]!, ahora: nuevo[codigo]! }))
  return { nuevas, retiradas, cambiadas }
}
