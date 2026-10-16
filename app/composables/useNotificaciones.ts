/**
 * El estado compartido de la campana de notificaciones: conteo sin leer (con
 * sondeo) y la lista, que se trae bajo demanda cuando se abre el desplegable.
 *
 * `useState`, no un `ref` de módulo: es estado de UI compartido entre quien
 * lo consuma, no algo que dependa del usuario, pero `useState` es el patrón que
 * ya usan `useAuth`/`useSidebar` y no hay motivo para uno distinto aquí.
 *
 * El sondeo era la mayor fuente de tráfico de fondo de la plataforma (auditoría
 * del 2026-10-15): cada 60 s en TODAS las pestañas abiertas, también de fondo, y
 * otra vez cada vez que se cambiaba de layout (la campana se vuelve a montar).
 * Ahora:
 * - cada 5 min, y solo con la pestaña a la vista (`useRefrescoVisible`); al
 *   volver a ella, se pone al día si pasaron más de 5 min;
 * - al montarse, solo consulta si el conteo guardado tiene más de 1 min: cambiar
 *   de página no vuelve a preguntar;
 * - abrir el desplegable sí trae la lista y el conteo al momento.
 */
import type { Notificacion } from '~/features/notificaciones/types'
import { useRefrescoVisible } from '~/composables/refrescoVisible'
import { logger } from '~/core/logger'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import { toast } from 'vue-sonner'

interface NotificacionesState {
  items: Notificacion[]
  unreadCount: number
  conteoErrorMostrado: boolean
  /** Cuándo se consultó el conteo por última vez (ms). 0 = nunca. */
  conteoEn: number
}

function useNotificacionesState() {
  return useState<NotificacionesState>('notificaciones', () => ({
    items: [],
    unreadCount: 0,
    conteoErrorMostrado: false,
    conteoEn: 0,
  }))
}

const CADA_MS = 5 * 60_000
/** Al montarse, un conteo más reciente que esto se reusa. */
const VIGENTE_MS = 60_000

function avisarError(titulo: string, mensaje: string): void {
  toast.error(titulo, { description: mensaje, duration: 4000 })
}

export function useNotificaciones() {
  const state = useNotificacionesState()

  async function refrescarConteo(): Promise<void> {
    state.value.conteoEn = Date.now()
    try {
      state.value.unreadCount = await new NotificacionesService().contarNoLeidas()
      state.value.conteoErrorMostrado = false
    } catch (err) {
      const mensaje = logger.error('notificaciones', err)
      // Este sondeo es periódico: sin esta bandera, una caída sostenida del
      // backend repetiría el toast indefinidamente en vez de avisar una vez.
      if (!state.value.conteoErrorMostrado) {
        state.value.conteoErrorMostrado = true
        avisarError('No se pudo actualizar notificaciones', mensaje)
      }
    }
  }

  /** Al abrir el desplegable: la lista y, de paso, el conteo al día. */
  async function cargar(): Promise<void> {
    void refrescarConteo()
    try {
      state.value.items = await new NotificacionesService().listar()
    } catch (err) {
      avisarError('No se pudieron cargar las notificaciones', logger.error('notificaciones', err))
      state.value.items = []
    }
  }

  async function marcarLeida(notificacion: Notificacion): Promise<void> {
    if (notificacion.leida) return
    try {
      await new NotificacionesService().marcarLeida(notificacion.id)
      notificacion.leida = true
      if (state.value.unreadCount > 0) state.value.unreadCount--
    } catch (err) {
      avisarError('No se pudo marcar como leída', logger.error('notificaciones', err))
    }
  }

  async function marcarTodasLeidas(): Promise<void> {
    try {
      await new NotificacionesService().marcarTodasLeidas()
      state.value.items.forEach((n) => {
        n.leida = true
      })
      state.value.unreadCount = 0
    } catch (err) {
      avisarError('No se pudieron marcar todas como leídas', logger.error('notificaciones', err))
    }
  }

  useRefrescoVisible(refrescarConteo, { cadaMs: CADA_MS, viejoTrasMs: CADA_MS })
  onMounted(() => {
    if (Date.now() - state.value.conteoEn > VIGENTE_MS) void refrescarConteo()
  })

  return {
    items: computed(() => state.value.items),
    unreadCount: computed(() => state.value.unreadCount),
    cargar,
    marcarLeida,
    marcarTodasLeidas,
  }
}
