/**
 * Estado de los reconectadores para Generación Solar (escritorio) y la app
 * móvil. Vive en un solo lugar a propósito: las dos vistas ya se separaron
 * dos veces leyendo el mismo endpoint, y el ON/OFF no puede comportarse
 * distinto según desde dónde se mande.
 *
 * - `rcnMap`: el estado y la telemetría de cada relay (`/reconectadores/estados`),
 *   reemplazado completo en cada consulta.
 * - `pendientes`: tras un comando se sostiene el estado enviado ("Aplicando…")
 *   hasta que SolarView reporte una lectura POSTERIOR al comando. Sin esto la
 *   pantalla volvía al estado anterior a los pocos segundos y alguien podía
 *   creer que falló y mandar el comando otra vez.
 * - `interruptor`: el interruptor general del ON/OFF (solo admin lo cambia).
 */
import { onUnmounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { normalizeError } from '~/core/errors'
import { ReconectadoresService } from '~/features/mobile/services/reconectadores'
import type { EstadoInterruptorReconectadores, EstadoReconectador } from '~/features/mobile/types'

const ESPERA_CONFIRMACION_MS = 3 * 60_000
const SONDEO_PENDIENTE_MS = 15_000

/** Hora de la lectura de SolarView ("2026-10-02 11:47:22", hora de Colombia). */
export function lecturaMs(raw: unknown): number | null {
  if (!raw) return null
  let s = String(raw).trim().replace(' ', 'T')
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += '-05:00'
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

export function useReconectadores() {
  const service = new ReconectadoresService()
  const { can } = useAuth()

  const rcnMap = reactive<Record<number, EstadoReconectador>>({})
  const pendientes = reactive<Record<number, { active: boolean; desde: number }>>({})
  const recargando = ref(false)
  let sondeo: ReturnType<typeof setTimeout> | null = null

  function programarSondeo(): void {
    if (sondeo) clearTimeout(sondeo)
    sondeo = Object.keys(pendientes).length
      ? setTimeout(() => void cargarEstados(), SONDEO_PENDIENTE_MS)
      : null
  }

  async function cargarEstados(): Promise<void> {
    recargando.value = true
    try {
      const data = await service.obtenerEstados()
      const llegaron = new Set<number>()
      for (const r of data) {
        llegaron.add(r.proyecto_id)
        const p = pendientes[r.proyecto_id]
        if (p) {
          const t = lecturaMs(r.ultima_actualizacion)
          const confirmada = t != null && t > p.desde
          const vencida = Date.now() - p.desde > ESPERA_CONFIRMACION_MS
          if (confirmada || vencida) {
            Reflect.deleteProperty(pendientes, r.proyecto_id)
            if (!confirmada) {
              toast.warning('Sin confirmación del reconectador', {
                description: `SolarView no ha reportado el cambio en ${String(r.nombre ?? 'la planta')}. Revisa el estado antes de reintentar.`,
              })
            }
          } else {
            rcnMap[r.proyecto_id] = { ...r, active: p.active }
            continue
          }
        }
        rcnMap[r.proyecto_id] = r
      }
      // Reemplazo completo: un relay que ya no viene no se sigue mostrando ni
      // contando con un estado viejo.
      for (const id of Object.keys(rcnMap).map(Number)) {
        if (!llegaron.has(id) && !pendientes[id]) Reflect.deleteProperty(rcnMap, id)
      }
    } catch {
      /* silencioso: sin reconectadores la tarjeta queda como antes */
    } finally {
      recargando.value = false
      programarSondeo()
    }
  }

  /** Tras un comando enviado: refleja el estado y lo sostiene hasta confirmar. */
  function marcarEnviado(proyectoId: number, active: boolean): void {
    pendientes[proyectoId] = { active, desde: Date.now() }
    rcnMap[proyectoId] = { ...(rcnMap[proyectoId] || { proyecto_id: proyectoId }), active }
    void cargarEstados()
  }

  // ── Interruptor general (solo admin) ──────────────────────────────────────
  const interruptor = ref<EstadoInterruptorReconectadores | null>(null)
  const cambiandoInterruptor = ref(false)

  async function cargarInterruptor(): Promise<void> {
    if (!can('reconectadores:interruptor')) return
    try {
      interruptor.value = await service.obtenerInterruptor()
    } catch {
      /* sin el estado no se muestra el interruptor */
    }
  }

  const confirm = useConfirm()

  /** Pide confirmación antes de encender o apagar TODOS los comandos. */
  function pedirCambioInterruptor(habilitado: boolean): void {
    confirm({
      title: habilitado ? '¿Encender los comandos ON/OFF?' : '¿Apagar los comandos ON/OFF?',
      description: habilitado
        ? 'Los usuarios de admin y operaciones podrán abrir y cerrar reconectadores (con su usuario de SolarView). Apagar un reconectador deja la planta fuera de línea y puede haber gente en sitio: coordínalo con el equipo de campo.'
        : 'Nadie podrá abrir ni cerrar reconectadores desde la plataforma hasta que se vuelvan a encender.',
      confirmLabel: habilitado ? 'Encender' : 'Apagar',
      variant: habilitado ? 'destructive' : 'default',
      onConfirm: () => cambiarInterruptor(habilitado),
    })
  }

  async function cambiarInterruptor(habilitado: boolean): Promise<void> {
    cambiandoInterruptor.value = true
    try {
      interruptor.value = await service.cambiarInterruptor(habilitado)
      toast.success(habilitado ? 'Comandos ON/OFF encendidos' : 'Comandos ON/OFF apagados')
    } catch (err) {
      toast.error('No se pudo cambiar', { description: normalizeError(err).message })
    } finally {
      cambiandoInterruptor.value = false
    }
  }

  /** Texto para el `title` del interruptor: quién lo cambió y cuándo. */
  function tituloInterruptor(): string {
    const i = interruptor.value
    if (!i) return ''
    if (i.forzado_por_servidor) return 'Encendido en la configuración del servidor'
    if (!i.actualizado_por) return 'Nunca se ha encendido desde la plataforma'
    const cuando = i.actualizado_en ? new Date(i.actualizado_en).toLocaleString('es-CO') : ''
    return `${i.habilitado ? 'Encendido' : 'Apagado'} por ${i.actualizado_por} ${cuando}`.trim()
  }

  onUnmounted(() => {
    if (sondeo) clearTimeout(sondeo)
  })

  return {
    rcnMap,
    pendientes,
    recargando,
    cargarEstados,
    marcarEnviado,
    interruptor,
    cambiandoInterruptor,
    cargarInterruptor,
    pedirCambioInterruptor,
    tituloInterruptor,
  }
}
