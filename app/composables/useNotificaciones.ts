/**
 * El estado compartido de la campana de notificaciones: conteo sin leer (con
 * sondeo) y la lista, que se trae bajo demanda cuando se abre el desplegable.
 *
 * `useState`, no un `ref` de módulo: es estado de UI compartido entre quien
 * lo consuma, no algo que dependa del usuario, pero `useState` es el patrón que
 * ya usan `useAuth`/`useSidebar` y no hay motivo para uno distinto aquí.
 *
 * El sondeo usa `useIntervalFn` (VueUse): se limpia solo con el ciclo de vida
 * del componente que llama a este composable, así que no hay un `setInterval`
 * suelto que sobreviva a un unmount.
 */
import type { Notificacion } from '~/features/notificaciones/types'
import { logger } from '~/core/logger'
import { NotificacionesService } from '~/features/notificaciones/services/notificaciones'
import { toast } from 'vue-sonner'

interface NotificacionesState {
  items: Notificacion[]
  unreadCount: number
  conteoErrorMostrado: boolean
}

function useNotificacionesState() {
  return useState<NotificacionesState>('notificaciones', () => ({
    items: [],
    unreadCount: 0,
    conteoErrorMostrado: false,
  }))
}

const POLL_INTERVAL_MS = 60_000

function avisarError(titulo: string, mensaje: string): void {
  toast.error(titulo, { description: mensaje, duration: 4000 })
}

export function useNotificaciones() {
  const state = useNotificacionesState()

  async function refrescarConteo(): Promise<void> {
    try {
      state.value.unreadCount = await new NotificacionesService().contarNoLeidas()
      state.value.conteoErrorMostrado = false
    } catch (err) {
      const mensaje = logger.error('notificaciones', err)
      // Este sondeo corre cada 60s: sin esta bandera, una caída sostenida del
      // backend repetiría el toast indefinidamente en vez de avisar una vez.
      if (!state.value.conteoErrorMostrado) {
        state.value.conteoErrorMostrado = true
        avisarError('No se pudo actualizar notificaciones', mensaje)
      }
    }
  }

  async function cargar(): Promise<void> {
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

  useIntervalFn(refrescarConteo, POLL_INTERVAL_MS, { immediateCallback: true })

  return {
    items: computed(() => state.value.items),
    unreadCount: computed(() => state.value.unreadCount),
    cargar,
    marcarLeida,
    marcarTodasLeidas,
  }
}
