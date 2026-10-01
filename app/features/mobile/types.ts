/**
 * Forma verificada contra las vistas de `mobile`: `MobileSolarView.vue`,
 * `ReconnectSheet.vue` y `ReconnectorPanel.vue`. El resto de endpoints que
 * consume `mobile` (fallas, proyectos, usuarios, notificaciones, generación
 * solar, reporte CGM) ya están tipados en sus slices propios.
 */

/** `GET /reconectadores/estados`: estado + telemetría del relay por proyecto. */
export interface EstadoReconectador {
  proyecto_id: number
  active: boolean | null
  [clave: string]: unknown
}

/** El comando va con el token del servidor: ya no lleva credenciales de Solenium. */
/** `GET/POST /reconectadores/interruptor`: si los comandos ON/OFF están encendidos. */
export interface EstadoInterruptorReconectadores {
  habilitado: boolean
  /** Encendido por el `.env` del servidor: desde la plataforma no se apaga. */
  forzado_por_servidor: boolean
  actualizado_por: string | null
  actualizado_en: string | null
}

export interface PayloadComandoReconectador {
  accion: 'ON' | 'OFF'
  /** Usuario y contraseña de SolarView de quien manda el comando; no se guardan. */
  username: string
  password: string
}
