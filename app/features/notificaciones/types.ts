/**
 * La notificación tal como la consume la campana (`~/composables/useNotificaciones`).
 *
 * Verificado contra el contrato real del backend (NotificacionOut en
 * app/schemas/notificaciones.py) el 2026-08-31 -- el campo real es `tipo`
 * ('alerta'/'info'/'accion'), no `severidad` (nunca lo envía el backend, así
 * que la campana de escritorio caía siempre al ícono/color genérico).
 */
export interface Notificacion {
  id: number
  titulo?: string | null
  mensaje?: string | null
  /** Sin cerrar a una unión: un valor que no reconozcan los mapas de color/icono cae al genérico. */
  tipo?: string | null
  leida: boolean
  created_at: string
}
