/**
 * Refresco automático solo mientras la pantalla está a la vista.
 *
 * - A la vista: llama a `refrescar` cada `cadaMs`.
 * - En segundo plano (otra pestaña, app minimizada, pantalla bloqueada): no
 *   llama nada. Los navegadores de escritorio NO congelan una pestaña oculta,
 *   solo la ralentizan: sin esto seguía pidiendo datos para nadie.
 * - Al volver: si la última carga tiene más de `viejoTrasMs`, se pone al día de
 *   inmediato y retoma el ritmo.
 *
 * La usan Generación Solar en escritorio (cada 5 min: refresca varias tarjetas a
 * la vez) y en móvil (cada 60 s: refresca una planta). Decisión del 2026-10-05.
 */
import { onMounted, onUnmounted } from 'vue'

export interface OpcionesRefresco {
  cadaMs: number
  viejoTrasMs: number
}

/** Lo mínimo de `document` que hace falta: así se prueba sin navegador. */
export interface DocumentoVisible {
  visibilityState: string
  addEventListener(tipo: 'visibilitychange', fn: () => void): void
  removeEventListener(tipo: 'visibilitychange', fn: () => void): void
}

export function crearRefrescoVisible(
  refrescar: () => unknown,
  { cadaMs, viejoTrasMs }: OpcionesRefresco,
  doc: DocumentoVisible,
) {
  let timer: ReturnType<typeof setInterval> | null = null
  let ultimaCarga = Date.now()

  function ejecutar(): void {
    ultimaCarga = Date.now()
    void refrescar()
  }

  function detener(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  function programar(): void {
    detener()
    if (doc.visibilityState === 'visible') timer = setInterval(ejecutar, cadaMs)
  }

  function alCambiarVisibilidad(): void {
    if (doc.visibilityState !== 'visible') return detener()
    if (Date.now() - ultimaCarga >= viejoTrasMs) ejecutar()
    programar()
  }

  return {
    iniciar(): void {
      doc.addEventListener('visibilitychange', alCambiarVisibilidad)
      programar()
    },
    detener(): void {
      doc.removeEventListener('visibilitychange', alCambiarVisibilidad)
      detener()
    },
    /** Para cargas que no salen de aquí (al abrir, el botón manual): reinicia la cuenta. */
    marcarCarga(): void {
      ultimaCarga = Date.now()
    },
  }
}

/** `crearRefrescoVisible` atado al ciclo de vida del componente. */
export function useRefrescoVisible(refrescar: () => unknown, opciones: OpcionesRefresco) {
  const refresco = crearRefrescoVisible(refrescar, opciones, document)
  onMounted(refresco.iniciar)
  onUnmounted(refresco.detener)
  return { marcarCarga: refresco.marcarCarga }
}
